import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Pool-based overhead allocation.
 *
 * For a given month:
 *  1. Pool = sum of `general_expenses` for that month
 *     (currency conversion handled below; assumes currency_conversion_rates table)
 *  2. Eligible resources = those with resource_monthly_costs.amount > 0 in that month
 *  3. overheadPerResource = pool / count(eligible)
 *  4. For each eligible resource with time_entries in the month:
 *       cost = salaryEur + overheadPerResource
 *       distributed across active project_members (allocation_percentage, normalized)
 *  5. "Salary allocation" expense_entries written with currency='EUR'.
 */

async function loadConversionRates(admin: any): Promise<Record<string, number>> {
  const { data } = await admin
    .from("currency_conversion_rates")
    .select("from_currency, year, month, rate")
    .eq("to_currency", "EUR");
  const cache: Record<string, number> = {};
  (data ?? []).forEach((r: any) => {
    cache[`${r.from_currency}-${r.year}-${r.month}`] = Number(r.rate);
  });
  return cache;
}

function toEur(amount: number, currency: string, year: number, month: number, rates: Record<string, number>): number {
  if (!currency || currency === "EUR") return amount;
  const rate = rates[`${currency}-${year}-${month}`] ?? 1;
  return amount * rate;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = roleData?.some((r: any) =>
      ["admin", "office_admin"].includes(r.role)
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Only admins can run allocation" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { year, month } = await req.json();
    if (!year || !month || month < 1 || month > 12) {
      return new Response(JSON.stringify({ error: "Valid year and month (1-12) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1);
    nextMonth.setDate(nextMonth.getDate() - 1);
    const monthEnd = nextMonth.toISOString().split("T")[0];
    const descPrefix = "Salary allocation";
    const descSuffix = `- ${new Date(year, month - 1).toLocaleString("en-US", { month: "short" })} ${year}`;

    const rates = await loadConversionRates(admin);

    // 1. Get all resource_monthly_costs for this month (overhead column ignored)
    const { data: monthlyCosts, error: mcErr } = await admin
      .from("resource_monthly_costs")
      .select("resource_id, amount, currency")
      .eq("year", year)
      .eq("month", month);
    if (mcErr) throw mcErr;

    if (!monthlyCosts || monthlyCosts.length === 0) {
      return new Response(JSON.stringify({ message: "No salary data for this month", allocated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Compute eligible resources (salary>0 in EUR) and overhead pool
    const eligible = monthlyCosts
      .map((mc: any) => ({
        resource_id: mc.resource_id,
        salaryEur: toEur(Number(mc.amount || 0), mc.currency || "EUR", year, month, rates),
      }))
      .filter((r: any) => r.salaryEur > 0);

    if (eligible.length === 0) {
      return new Response(JSON.stringify({ message: "No resources with salary>0 this month", allocated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: generalExpenses } = await admin
      .from("general_expenses")
      .select("amount, currency")
      .eq("year", year)
      .eq("month", month);

    const overheadPool = (generalExpenses ?? []).reduce(
      (s: number, ge: any) => s + toEur(Number(ge.amount || 0), ge.currency || "EUR", year, month, rates),
      0
    );
    const overheadPerResource = overheadPool / eligible.length;

    // 3. Wipe ALL existing salary-allocation expense entries for this month
    // (covers both newly-eligible and previously-allocated resources)
    const { error: wipeErr } = await admin
      .from("expense_entries")
      .delete()
      .eq("category", "operational")
      .gte("expense_date", monthStart)
      .lte("expense_date", monthEnd)
      .like("description", `${descPrefix}%`);
    if (wipeErr) throw wipeErr;

    let totalAllocated = 0;
    const errors: string[] = [];

    for (const { resource_id, salaryEur } of eligible) {
      const totalCost = salaryEur + overheadPerResource;
      if (totalCost <= 0) continue;

      // Check if resource has any time_entries this month
      const { count: teCount, error: teErr } = await admin
        .from("time_entries")
        .select("id", { count: "exact", head: true })
        .eq("resource_id", resource_id)
        .gte("entry_date", monthStart)
        .lte("entry_date", monthEnd)
        .is("deleted_at", null);
      if (teErr) {
        errors.push(`Time entries check failed for ${resource_id}: ${teErr.message}`);
        continue;
      }
      if (!teCount || teCount === 0) continue;

      // Active project_members for this month
      const { data: members, error: memErr } = await admin
        .from("project_members")
        .select("project_id, allocation_percentage, is_primary")
        .eq("resource_id", resource_id)
        .or(`start_date.is.null,start_date.lte.${monthEnd}`)
        .or(`end_date.is.null,end_date.gte.${monthStart}`);
      if (memErr) {
        errors.push(`Members query failed for ${resource_id}: ${memErr.message}`);
        continue;
      }
      if (!members || members.length === 0) continue;

      const totalAlloc = members.reduce((s: number, m: any) => s + Number(m.allocation_percentage || 0), 0);
      if (totalAlloc <= 0) continue;
      const primaryMember = members.find((m: any) => m.is_primary) || members[0];
      const multiplier = totalAlloc > 100 ? 100 / totalAlloc : 1;

      const splits: { project_id: string; amount: number }[] = [];
      let distributed = 0;
      for (const m of members) {
        const share = (Number(m.allocation_percentage || 0) * multiplier) / 100;
        const amt = Math.round(totalCost * share * 100) / 100;
        splits.push({ project_id: m.project_id, amount: amt });
        distributed += amt;
      }
      const remainder = Math.round((totalCost - distributed) * 100) / 100;
      if (remainder !== 0) {
        const primarySplit = splits.find((s) => s.project_id === primaryMember.project_id);
        if (primarySplit) {
          primarySplit.amount = Math.round((primarySplit.amount + remainder) * 100) / 100;
        } else {
          splits.push({ project_id: primaryMember.project_id, amount: remainder });
        }
      }

      const inserts = splits
        .filter((s) => s.amount > 0)
        .map((s) => ({
          resource_id,
          project_id: s.project_id,
          expense_date: monthStart,
          category: "operational" as const,
          amount: s.amount,
          currency: "EUR",
          is_billable: false,
          approval_status: "approved" as const,
          description: `${descPrefix} ${descSuffix}`,
        }));

      if (inserts.length > 0) {
        const { error: insErr } = await admin.from("expense_entries").insert(inserts);
        if (insErr) {
          errors.push(`Insert failed for ${resource_id}: ${insErr.message}`);
          continue;
        }
        totalAllocated += inserts.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        allocated: totalAllocated,
        overheadPool,
        eligibleResources: eligible.length,
        overheadPerResource: Math.round(overheadPerResource * 100) / 100,
        errors: errors.length > 0 ? errors : undefined,
        message: `Allocated costs for ${totalAllocated} project-resource pairs (overhead pool €${overheadPool.toFixed(2)} split across ${eligible.length} resources)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
