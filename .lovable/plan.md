

## Rename Audit Log to Alerts — Live alert detection page

Replace the static Audit Log page with a dynamic **Alerts** page that queries existing tables in real-time and surfaces actionable warnings/issues.

### Proposed alerts (computed on the frontend from existing data)

| # | Alert | Logic | Severity |
|---|-------|-------|----------|
| 1 | **Unallocated resource** | Resource has no `project_members` entries (or all ended) | Warning |
| 2 | **Project ending soon** | `projects.end_date` is within 30 days from today | Warning |
| 3 | **Late timesheet submission** | Resource has timesheet entries created within the last 2 days of the month for that month | Info |
| 4 | **SOW expired** | Project status = `sow_expired` | Critical |
| 5 | **Over-allocated resource** | Sum of `project_members.allocation_percentage` > 100% for active memberships | Warning |
| 6 | **No salary data** | Active resource has no `resource_monthly_costs` entry for the current month | Warning |
| 7 | **Missing conversion rates** | Current month has no `currency_conversion_rates` entry for currencies in use | Warning |
| 8 | **Pending approvals** | Timesheets or expenses stuck in `pending` status for more than 7 days | Info |
| 9 | **Budget overrun** | Project actual expenses exceed `total_budget` | Critical |
| 10 | **Resource without primary project** | Resource has project memberships but none marked `is_primary` | Warning |

### Changes

**1. Rename route and sidebar**
- `src/App.tsx`: Change route from `/audit-log` to `/alerts`, update import name
- `src/pages/AuditLog.tsx` → rename to `src/pages/Alerts.tsx`
- `src/components/AppSidebar.tsx`: Change title from "Audit Log" to "Alerts", icon from `ScrollText` to `Bell`
- `src/lib/auth-helpers.ts`: Rename `auditLog` key to `alerts` in PERMISSIONS (keep admin-only, or broaden to PM/executive)

**2. Build the Alerts page (`src/pages/Alerts.tsx`)**
- Query `resources`, `project_members`, `projects`, `resource_monthly_costs`, `time_entries`, `expense_entries`, `currency_conversion_rates` on page load
- Run each alert check function against the data
- Display a table with columns: Severity, Alert Type, Description, Date Detected, Entity link
- Each alert is computed client-side — no new database tables needed
- Add severity color badges (Critical = red, Warning = amber, Info = blue)
- Sort by severity (critical first), then date

**3. Files to modify**
- **Rename**: `src/pages/AuditLog.tsx` → `src/pages/Alerts.tsx` (full rewrite)
- **Edit**: `src/App.tsx` — update route + import
- **Edit**: `src/components/AppSidebar.tsx` — rename nav item + icon
- **Edit**: `src/lib/auth-helpers.ts` — rename `auditLog` → `alerts`

### Technical detail

Each alert is a pure function: `(data) => Alert[]` where `Alert = { severity, type, message, date, entityId? }`. All 10 checks run against data already fetched via React Query. No new tables, no edge functions — purely frontend computation from existing data.

