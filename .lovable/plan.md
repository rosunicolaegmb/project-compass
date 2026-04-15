

## Add One-Time Revenue Management Table

### What
Add a new tab or section in the Timesheets page that lists all one-time revenue records in a table, with edit and delete capabilities.

### Implementation

**1. `src/pages/Timesheets.tsx`**
- Add a new query to fetch all `one_time_revenues` joined with project names
- Add a new tab "One-Time Revenues" to the existing Tabs component
- Render a table with columns: Project, Month, Amount, Currency, Reason, Actions (edit/delete)
- Add edit button that opens `OneTimeRevenueDialog` pre-filled with existing data
- Add delete button with `DeleteConfirmDialog` confirmation
- Add delete mutation and edit mutation

**2. `src/components/timesheets/OneTimeRevenueDialog.tsx`**
- Accept an optional `editData` prop with existing revenue record
- Pre-fill form fields when editing
- Use upsert or update instead of insert when editing
- Reset form on close

### Files to edit
- `src/components/timesheets/OneTimeRevenueDialog.tsx` — add edit mode support
- `src/pages/Timesheets.tsx` — add revenues tab with table, edit/delete actions

