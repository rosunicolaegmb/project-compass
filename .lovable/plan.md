

# Timesheets Cost Auto-Calculation

## What changes

The "Cost" column and summary stat will switch from `hours × cost_rate` (per-row) to a monthly auto-calculated total per resource/project/month:

- **Full Time**: Cost = `resource.monthly_cost` + `resource.overhead_cost_eur`
- **Contractor**: Cost = `resource.default_cost_rate × total_month_hours` + `resource.overhead_cost_eur`

Cost becomes read-only — no manual input. The cost_rate and currency fields are removed from both the single-entry and monthly-entry forms.

## Plan

### 1. Expand the resources query in Timesheets.tsx

Add `employment_type, monthly_cost, overhead_cost_eur` to the resources select on line 109. Also expand the time_entries join (line 82) to fetch `resources(display_name, employment_type, monthly_cost, overhead_cost_eur, default_cost_rate)`.

### 2. Create a cost calculation helper

Add a `useMemo` block that groups filtered entries by `resource_id + month` and computes monthly cost per group:

- Sum total hours per resource/month
- Look up resource fields from the joined data
- Full-time: `(monthly_cost || 0) + (overhead_cost_eur || 0)`
- Contractor: `(default_cost_rate || 0) × totalMonthHours + (overhead_cost_eur || 0)`
- Store result in a `Map<resourceId-month, { monthlyCost, overhead, baseCost }>` for display

### 3. Update the daily table (line 408)

Replace per-row `hours × cost_rate` with the monthly cost lookup. Since cost is now a monthly aggregate (not per-row), show the monthly cost **once** on the first row for each resource/month group, and show "—" on subsequent rows. Alternatively, display the full monthly cost on every row with a tooltip explaining it's a monthly total.

Decision: Show the monthly cost on every row for that resource/month with a small "monthly" label to avoid confusion.

### 4. Update summary stats (lines 190-193)

- **Total Cost**: Sum of unique resource/month costs (deduplicated, not per-row)
- Keep Total Hours, Billable Hours, T&M Revenue as-is

### 5. Update CSV export (lines 247-254)

Change the "Cost" column to output the monthly cost for each row's resource/month.

### 6. Remove cost_rate from forms

**TimeEntryFormDialog.tsx**: Remove the `cost_rate` form field, schema entry, and auto-fill logic. Keep `bill_rate` and `currency`.

**MonthlyTimeEntryDialog.tsx**: Same — remove `cost_rate` field. Keep `bill_rate`.

### 7. Handle nulls safely

- `monthly_cost ?? 0`, `overhead_cost_eur ?? 0`, `default_cost_rate ?? 0`
- If employment_type is null, default to contractor logic

### Files to modify

| File | Changes |
|------|---------|
| `src/pages/Timesheets.tsx` | Expand queries, new cost calc, update table/stats/export |
| `src/components/timesheets/TimeEntryFormDialog.tsx` | Remove cost_rate field |
| `src/components/timesheets/MonthlyTimeEntryDialog.tsx` | Remove cost_rate field |

No database changes needed — all source fields already exist on the resources table.

