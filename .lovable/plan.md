

## Replace Cost Rate with Daily Rate in Timesheet Forms

### Changes

Both `TimeEntryFormDialog.tsx` and `MonthlyTimeEntryDialog.tsx` will be updated identically:

1. **Remove Cost Rate field** from the form UI (keep `cost_rate` in the schema/payload so existing DB column still gets a value — set it to `null` or `0` on submit)

2. **Add Daily Rate field** alongside Bill Rate (hr). New field `daily_rate` added to the form schema (not stored in DB — it's a UI-only computed field)

3. **Auto-conversion logic** (8 hours/day):
   - When user types a **Bill Rate** → `Daily Rate = Bill Rate × 8`
   - When user types a **Daily Rate** → `Bill Rate = Daily Rate / 8`
   - Use a flag to track which field the user is currently editing to avoid infinite loops

4. **Auto-fill from resource**: When resource changes, set `bill_rate` from resource defaults and compute `daily_rate = bill_rate × 8`. No longer auto-fill `cost_rate`.

### UI Layout
The rate section becomes two fields side by side:
- **Bill Rate ({sym}/hr)**
- **Daily Rate ({sym}/day)**

Cost Rate is hidden from the UI. The `cost_rate` value in the DB payload will be set to `null`.

### Files to edit
- `src/components/timesheets/TimeEntryFormDialog.tsx`
- `src/components/timesheets/MonthlyTimeEntryDialog.tsx`

