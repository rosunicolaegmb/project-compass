

## Add "Missing Timesheet" alert for past months

### Problem
The current alert logic has no check for resources that are allocated to projects but have **zero timesheet entries** for completed past months. Dragos, Claudiu, and David all have allocations starting Feb 16, but only Claudiu logged time in Feb — and nobody logged time for March.

### Solution
Add alert #11: **"Missing Timesheet"** — for each active resource with a project allocation in a past month, check if they have any `time_entries` for that month. If not, raise a warning.

### Logic
```text
For each active resource:
  For each past month (from their earliest allocation start_date to last completed month):
    If resource had an active allocation that month AND zero time entries → alert
```

- Only check **completed months** (not the current month, which is still in progress)
- Only check months where the resource had an **active project allocation**
- Severity: **warning**
- Message example: `"Dragos Filastacheanu has no timesheet entries for 2026-03"`

### File changes
- **Edit**: `src/pages/Alerts.tsx` — add the new check inside `generateAlerts()`, after the existing 10 checks

### Technical detail
The check iterates active resources, determines which past months they were allocated (using `project_members.start_date` / `end_date`), then checks if `time_entries` contains any rows for that resource+month. No new queries needed — all data is already fetched.

