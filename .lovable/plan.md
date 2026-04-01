

## Plan: Add Interactive Day Picker to Monthly Time Entry Dialog

### What changes

Replace the current automatic working-days calculation with an interactive month calendar where all working days are pre-selected but the user can toggle individual days on/off.

### Implementation

**File: `src/components/timesheets/MonthlyTimeEntryDialog.tsx`**

1. **Add `selectedDates` state** (`Date[]`) — initialized from `workingDays` whenever month or skip-weekends changes.

2. **Add a `Calendar` component** (from `src/components/ui/calendar.tsx`) in `mode="multiple"` between the month picker and hours field:
   - Shows the full month view
   - Pre-selects all working days (weekdays if skip-weekends is on)
   - User can click to deselect/reselect individual days
   - Constrained to only the selected month (disable navigation, disable days outside month)

3. **Update `workingDays`** to be derived from `selectedDates` instead of the pure calculation — the calculated days become the *initial* selection, user toggles override it.

4. **Update `totalHours` and summary badge** to reflect `selectedDates.length` instead of `workingDays.length`.

5. **Update mutation** to use `selectedDates` for the dates array sent to Supabase.

6. **Sync logic**: When month or skip-weekends changes, reset `selectedDates` to the new computed working days. Add a "Select All / Deselect All" toggle above the calendar for convenience.

**File: `src/components/ui/calendar.tsx`**
- Ensure `pointer-events-auto` class is present (per shadcn datepicker guidelines).

### UI Layout
The calendar will appear as an inline month grid (not in a popover) within the dialog, showing day numbers with selected days highlighted. Compact sizing to fit within the dialog's max-height.

