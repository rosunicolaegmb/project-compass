/**
 * Labor cost allocation engine.
 *
 * MODEL (pool-based overhead):
 *  - For each month:
 *    1. Pool = sum of `general_expenses` for that month (converted to EUR)
 *    2. Eligible resources = those with `resource_monthly_costs.amount` (salary) > 0 in that month
 *    3. overheadPerResource = pool / count(eligible resources)
 *    4. For each eligible resource: cost = salaryEur + overheadPerResource
 *    5. Distribute that cost across the resource's project_members in that month,
 *       using allocation_percentage (normalized if total > 100).
 *       Rounding remainder goes to the primary member.
 *
 * NOTE: `resource_monthly_costs.overhead` is intentionally IGNORED — overhead is
 * now a company-level pool from `general_expenses`, not a per-resource value.
 */
import { toEur } from "./currency";

export interface MonthlyCostRow {
  resource_id: string;
  year: number;
  month: number;
  amount: number | string | null;
  currency?: string | null;
  // overhead column intentionally not used
}

export interface ProjectMemberRow {
  resource_id: string;
  project_id: string;
  allocation_percentage: number | string | null;
  is_primary: boolean;
  start_date?: string | null;
  end_date?: string | null;
}

export interface GeneralExpenseRow {
  amount: number | string | null;
  currency?: string | null;
  year: number;
  month: number;
}

export interface AllocationInput {
  monthlyCosts: MonthlyCostRow[];
  projectMembers: ProjectMemberRow[];
  generalExpenses: GeneralExpenseRow[];
}

export interface AllocationResult {
  /** Total labor cost (EUR) per project across all months in the input */
  laborCostByProject: Record<string, number>;
  /** Total labor cost (EUR) per "YYYY-MM" key */
  laborCostByMonth: Record<string, number>;
  /** Per-month breakdown for debugging / per-period queries */
  perMonth: Record<string, {
    overheadPool: number;
    eligibleResourceCount: number;
    overheadPerResource: number;
    splitsByProject: Record<string, number>;
  }>;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateLaborCostAllocation(input: AllocationInput): AllocationResult {
  const { monthlyCosts, projectMembers, generalExpenses } = input;

  // 1. Group monthly_costs by month-key
  const costsByMonth = new Map<string, MonthlyCostRow[]>();
  for (const mc of monthlyCosts) {
    const key = `${mc.year}-${String(mc.month).padStart(2, "0")}`;
    const arr = costsByMonth.get(key) ?? [];
    arr.push(mc);
    costsByMonth.set(key, arr);
  }

  // 2. Build overhead pool per month from general_expenses
  const overheadPoolByMonth = new Map<string, number>();
  for (const ge of generalExpenses) {
    const key = `${ge.year}-${String(ge.month).padStart(2, "0")}`;
    const dateStr = `${ge.year}-${String(ge.month).padStart(2, "0")}-15`;
    const eur = toEur(Number(ge.amount || 0), ge.currency || "EUR", dateStr);
    overheadPoolByMonth.set(key, (overheadPoolByMonth.get(key) ?? 0) + eur);
  }

  const laborCostByProject: Record<string, number> = {};
  const laborCostByMonth: Record<string, number> = {};
  const perMonth: AllocationResult["perMonth"] = {};

  // 3. For each month, compute per-resource cost and distribute on projects
  for (const [monthKey, rows] of costsByMonth.entries()) {
    const [yearStr, monthStr] = monthKey.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const monthMid = `${monthKey}-15`;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    // Eligible = salary > 0 (in EUR)
    const eligible = rows
      .map((mc) => ({
        mc,
        salaryEur: toEur(Number(mc.amount || 0), mc.currency || "EUR", monthMid),
      }))
      .filter((r) => r.salaryEur > 0);

    if (eligible.length === 0) continue;

    const overheadPool = overheadPoolByMonth.get(monthKey) ?? 0;
    const overheadPerResource = overheadPool / eligible.length;

    const splitsByProject: Record<string, number> = {};

    for (const { mc, salaryEur } of eligible) {
      const costEur = salaryEur + overheadPerResource;

      // Active project_members for this resource in this month
      const members = projectMembers.filter((pm) =>
        pm.resource_id === mc.resource_id &&
        (!pm.start_date || new Date(pm.start_date) <= monthEnd) &&
        (!pm.end_date || new Date(pm.end_date) >= monthStart)
      );
      if (members.length === 0) continue;

      const totalAlloc = members.reduce((s, m) => s + Number(m.allocation_percentage || 0), 0);
      if (totalAlloc <= 0) continue;
      const multiplier = totalAlloc > 100 ? 100 / totalAlloc : 1;
      const primary = members.find((m) => m.is_primary) ?? members[0];

      let distributed = 0;
      const splits: { project_id: string; amount: number }[] = [];
      for (const m of members) {
        const share = (Number(m.allocation_percentage || 0) * multiplier) / 100;
        const amt = r2(costEur * share);
        splits.push({ project_id: m.project_id, amount: amt });
        distributed += amt;
      }
      const remainder = r2(costEur - distributed);
      if (remainder !== 0) {
        const ps = splits.find((s) => s.project_id === primary.project_id);
        if (ps) ps.amount = r2(ps.amount + remainder);
        else splits.push({ project_id: primary.project_id, amount: remainder });
      }

      for (const s of splits) {
        laborCostByProject[s.project_id] = r2((laborCostByProject[s.project_id] ?? 0) + s.amount);
        laborCostByMonth[monthKey] = r2((laborCostByMonth[monthKey] ?? 0) + s.amount);
        splitsByProject[s.project_id] = r2((splitsByProject[s.project_id] ?? 0) + s.amount);
      }
    }

    perMonth[monthKey] = {
      overheadPool,
      eligibleResourceCount: eligible.length,
      overheadPerResource,
      splitsByProject,
    };
  }

  return { laborCostByProject, laborCostByMonth, perMonth };
}
