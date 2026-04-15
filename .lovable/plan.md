

## New Cost Allocation Model via Backend Function

### How it works

Each month is processed independently. The edge function accepts `{ year, month }` and uses only the allocations that were **active during that specific month** (based on `project_members.start_date` and `end_date`). Changing a resource's allocation for next month has zero impact on previously allocated months.

```text
Resource monthly cost = amount + overhead (from resource_monthly_costs)

For each resource with ≥1 timesheet entry that month:
  1. Get project_members WHERE start_date <= month_end AND (end_date >= month_start OR end_date IS NULL)
  2. Sum allocation percentages of those active memberships
  
  Case A: Total = 100% → Split proportionally
  Case B: Total < 100% → Split proportionally, remainder to primary project
  Case C: Total > 100% → Normalize to 100%, split proportionally, rounding remainder to primary
```

### Changes

**1. Create edge function: `supabase/functions/allocate-monthly-costs/index.ts`**
- Accepts `{ year, month }`, uses service role key
- For each resource with `resource_monthly_costs` entry and ≥1 `time_entries` that month:
  - Query `project_members` filtered by date overlap with the target month
  - Calculate cost split per allocation rules
  - Delete existing "Salary allocation" expense entries for that resource/month, then insert new ones as `operational` category in `expense_entries`

**2. Database migration**
- Remove the "Monthly labor cost" auto-creation from `auto_create_monthly_overhead` trigger (the edge function now handles labor cost allocation)

**3. Frontend: `src/pages/SalariesPage.tsx`**
- Add "Run Allocation" button to invoke the edge function for the selected month/year
- Show progress/result feedback

**4. Frontend: `src/components/resources/ResourceFormDialog.tsx`**
- Remove `max="100"` on allocation percentage input to allow over-allocation

**5. No changes to `budget-calculations.ts`**
- Labor costs will flow through `expense_entries` (operational category), which is already summed in actual expenses on Dashboard/ProjectDetail

### Key guarantee: Month isolation
The edge function filters `project_members` by date range overlap with the target month. If a resource moves from Project A to Project B next month, re-running allocation for the previous month still uses the old allocation. Each month is a self-contained snapshot.

