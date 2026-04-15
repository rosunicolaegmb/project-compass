

## Show Resource Costs on Dashboard

### Root Causes
1. **The dashboard ignores `resource_monthly_costs`** — it only calculates cost from `time_entries.cost_rate × hours` (which is now null) and `expense_entries.amount`.
2. **"Run Allocation" was never clicked** for February — so no salary expense entries were created in `expense_entries`.
3. **Dragos has zero time entries** for Feb, so the allocation edge function would skip him even if run.

### Solution

Two-part fix to make salary costs flow to the dashboard automatically:

**Part 1: Dashboard reads `resource_monthly_costs` directly**

Add a new query in `Dashboard.tsx` to fetch `resource_monthly_costs`. For each resource-month, convert the amount to EUR using `toEur()`, then allocate it proportionally across projects using `project_members` allocation percentages (same logic as the edge function, but read-only for display).

This means the dashboard shows salary costs immediately after saving — no need to run allocation first.

**Part 2: Fix the cost calculation**

The current `totalActualCost` sums `hours × cost_rate` from time entries, but `cost_rate` is now always null. Update the cost calculation to:
- Use `resource_monthly_costs` as the primary source of labor cost (salary + overhead)
- Keep expense entries as a secondary cost source (non-salary expenses)
- Stop relying on `time_entries.cost_rate` for cost (it's effectively deprecated)

### Files to edit
- `src/pages/Dashboard.tsx` — add query for `resource_monthly_costs` and `project_members`, rewrite cost calculation in the `metrics` useMemo

### Technical detail

```text
New cost calculation:
  Labor Cost = Σ (resource_monthly_costs.amount + overhead) converted to EUR
               allocated per project via project_members.allocation_percentage
  Expense Cost = Σ expense_entries.amount (non-salary) converted to EUR
  Total Actual Cost = Labor Cost + Expense Cost
```

The dashboard will fetch:
- `resource_monthly_costs` (filtered by period range months)
- `project_members` (to map resources → projects with allocation %)

For each resource-month cost, distribute to projects using the same allocation logic as the edge function. This gives immediate visibility without requiring the allocation step.

