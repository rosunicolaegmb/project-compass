

## Reorder Project/Resource Fields and Filter Resources by Project Allocation

### What changes
In both `TimeEntryFormDialog` and `MonthlyTimeEntryDialog`:
1. Move the **Project** dropdown above the **Resource** dropdown
2. When a project is selected, filter the Resource dropdown to only show resources allocated to that project (via `project_members` table)
3. Clear the resource selection when the project changes (since the previous resource may not be allocated)

### How

**1. Fetch `project_members` in `src/pages/Timesheets.tsx`**
- Add a new query: `supabase.from("project_members").select("project_id, resource_id")` 
- Pass the resulting array as a new `projectMembers` prop to both `TimeEntryFormDialog` and `MonthlyTimeEntryDialog`

**2. Update `src/components/timesheets/TimeEntryFormDialog.tsx`**
- Add `projectMembers` to props interface
- Swap the Project and Resource `FormField` blocks in the JSX (Project first, Resource second)
- Compute `filteredResources`: when a project is selected, filter `resources` to only those whose `id` appears in `projectMembers` for that project. If no project selected, show all.
- When project changes, reset `resource_id` to `""` (and also reset `phase_id` as it already does)
- Auto-fill rate logic: keep the existing resource-change effect, it will still work after reorder

**3. Update `src/components/timesheets/MonthlyTimeEntryDialog.tsx`**
- Same changes as above: add `projectMembers` prop, swap field order, filter resources by project allocation, reset resource on project change

### Files to edit
- `src/pages/Timesheets.tsx` — add project_members query, pass as prop
- `src/components/timesheets/TimeEntryFormDialog.tsx` — reorder fields, filter resources
- `src/components/timesheets/MonthlyTimeEntryDialog.tsx` — reorder fields, filter resources

