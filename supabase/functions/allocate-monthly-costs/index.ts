import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
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

    // Verify caller is admin/office_admin
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

    // Parse input
    const { year, month } = await req.json();
    if (!year || !month || month < 1 || month > 12) {
      return new Response(JSON.stringify({ error: "Valid year and month (1-12) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    // Last day of the month
    const nextMonth = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1);
    nextMonth.setDate(nextMonth.getDate() - 1);
    const monthEnd = nextMonth.toISOString().split("T")[0];
    const descPrefix = "Salary allocation";
    const descSuffix = `- ${new Date(year, month - 1).toLocaleString("en-US", { month: "short" })} ${year}`;

    // 1. Get all resource_monthly_costs for this month
    const { data: monthlyCosts, error: mcErr } = await admin
      .from("resource_monthly_costs")
      .select("resource_id, amount, overhead, currency")
      .eq("year", year)
      .eq("month", month);
    if (mcErr) throw mcErr;

    if (!monthlyCosts || monthlyCosts.length === 0) {
      return new Response(JSON.stringify({ message: "No salary data for this month", allocated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalAllocated = 0;
    const errors: string[] = [];

    for (const cost of monthlyCosts) {
      const totalCost = Number(cost.amount) + Number(cost.overhead);
      if (totalCost <= 0) continue;

      // 2. Check if resource has any time_entries this month
      const { count: teCount, error: teErr } = await admin
        .from("time_entries")
        .select("id", { count: "exact", head: true })
        .eq("resource_id", cost.resource_id)
        .gte("entry_date", monthStart)
        .lte("entry_date", monthEnd)
        .is("deleted_at", null);
      if (teErr) {
        errors.push(`Time entries check failed for ${cost.resource_id}: ${teErr.message}`);
        continue;
      }
      if (!teCount || teCount === 0) continue;

      // 3. Get active project_members for this month
      const { data: members, error: memErr } = await admin
        .from("project_members")
        .select("project_id, allocation_percentage, is_primary")
        .eq("resource_id", cost.resource_id)
        .or(`start_date.is.null,start_date.lte.${monthEnd}`)
        .or(`end_date.is.null,end_date.gte.${monthStart}`);
      if (memErr) {
        errors.push(`Members query failed for ${cost.resource_id}: ${memErr.message}`);
        continue;
      }
      if (!members || members.length === 0) continue;

      // 4. Calculate allocation split
      const totalAlloc = members.reduce((s, m) => s + Number(m.allocation_percentage || 0), 0);
      if (totalAlloc <= 0) continue;

      const primaryMember = members.find((m) => m.is_primary) || members[0];

      // Normalize if > 100%, use as-is if <= 100%
      const multiplier = totalAlloc > 100 ? 100 / totalAlloc : 1;

      const splits: { project_id: string; amount: number }[] = [];
      let distributed = 0;

      for (const m of members) {
        const share = (Number(m.allocation_percentage || 0) * multiplier) / 100;
        const amt = Math.round(totalCost * share * 100) / 100;
        splits.push({ project_id: m.project_id, amount: amt });
        distributed += amt;
      }

      // Remainder (from rounding or < 100% allocation) goes to primary
      const remainder = Math.round((totalCost - distributed) * 100) / 100;
      if (remainder > 0) {
        const primarySplit = splits.find((s) => s.project_id === primaryMember.project_id);
        if (primarySplit) {
          primarySplit.amount = Math.round((primarySplit.amount + remainder) * 100) / 100;
        } else {
          splits.push({ project_id: primaryMember.project_id, amount: remainder });
        }
      }

      // 5. Delete existing salary allocation entries for this resource/month
      const { error: delErr } = await admin
        .from("expense_entries")
        .delete()
        .eq("resource_id", cost.resource_id)
        .eq("category", "operational")
        .gte("expense_date", monthStart)
        .lte("expense_date", monthEnd)
        .like("description", `${descPrefix}%`);
      if (delErr) {
        errors.push(`Delete failed for ${cost.resource_id}: ${delErr.message}`);
        continue;
      }

      // 6. Insert new expense entries
      const inserts = splits
        .filter((s) => s.amount > 0)
        .map((s) => ({
          resource_id: cost.resource_id,
          project_id: s.project_id,
          expense_date: monthStart,
          category: "operational" as const,
          amount: s.amount,
          currency: cost.currency || "EUR",
          is_billable: false,
          approval_status: "approved" as const,
          description: `${descPrefix} ${descSuffix}`,
        }));

      if (inserts.length > 0) {
        const { error: insErr } = await admin.from("expense_entries").insert(inserts);
        if (insErr) {
          errors.push(`Insert failed for ${cost.resource_id}: ${insErr.message}`);
          continue;
        }
        totalAllocated += inserts.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        allocated: totalAllocated,
        errors: errors.length > 0 ? errors : undefined,
        message: `Allocated costs for ${totalAllocated} project-resource pairs`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
