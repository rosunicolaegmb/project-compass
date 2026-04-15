

## Fix Dashboard Cost Double-Counting and Period Display

### Problem
1. **Double-counting bug**: The dashboard reads labor costs from `resource_monthly_costs` AND includes ALL `expense_entries` (line 225-228 has `return true`). If the "Run Allocation" edge function is ever used, salary-related expense entries (description starting with "Salary allocation") would be counted twice.
2. **Monthly view confusion**: When selecting "monthly" in April, no data exists for April yet. The KPIs show 0 but the monthly trends chart may still show all-time data, which could be confusing.

### Fix

**File: `src/pages/Dashboard.tsx`**

1. **Filter out salary allocation expense entries** — Change the `nonSalaryExpenses` filter (line 225-228) to exclude entries where `description LIKE 'Salary allocation%'` or `category = 'operational'` with salary-related descriptions. This prevents double-counting since labor costs are already derived from `resource_monthly_costs`.

2. **Clarify monthly trends chart scope** — Ensure the monthly trends chart only shows data within the selected period range, not all-time data (it already does this via `filteredTime` and `filteredExpenses`, but verify the `laborCostByMonth` entries are also period-scoped — they are, since they come from `filteredMonthlyCosts`).

3. **Add expense description to the query** — The expense query (line 90) doesn't fetch `description` or `category`, which are needed to filter out salary allocations. Add these fields to the select.

### Changes summary
- Add `description, category` to the expense_entries query select
- Filter `nonSalaryExpenses` to exclude entries with description starting with "Salary allocation"
- This ensures labor costs come only from `resource_monthly_costs` and expense costs come only from non-salary expense entries

