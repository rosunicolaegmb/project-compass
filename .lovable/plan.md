

## One-Time Revenue Feature

### Overview
Add a "One-Time Revenue" button to the Timesheets page that lets users record ad-hoc revenue entries for a project. These entries are stored in a new dedicated table and automatically included in Dashboard KPIs and Project Detail revenue calculations.

### Database
Create a new `one_time_revenues` table:
- `id` (uuid, PK)
- `project_id` (uuid, NOT NULL)
- `revenue_month` (date, NOT NULL) — first of the month
- `amount` (numeric, NOT NULL)
- `currency` (text, NOT NULL, default 'EUR')
- `reason` (text)
- `created_at`, `updated_at` (timestamps)

RLS: Admins and office admins can CRUD. Authenticated can SELECT.

### UI Changes

**1. `src/pages/Timesheets.tsx`**
- Add a "One-Time Revenue" button next to "Log Month" / "Log Time"
- Add state for dialog open/close
- Render the new dialog component

**2. New `src/components/timesheets/OneTimeRevenueDialog.tsx`**
- Dialog form with fields:
  - Project (select from projects list)
  - Month picker (month/year selector)
  - Amount (number input) + Currency selector (EUR/RON/GBP)
  - Reason (textarea)
- On save: insert into `one_time_revenues`, invalidate queries, show toast

**3. `src/pages/Dashboard.tsx`**
- Fetch `one_time_revenues`, filter by period range
- Convert amounts to EUR using `toEur()`
- Add to `totalActualRevenue` alongside the existing time-entry-based revenue

**4. `src/pages/ProjectDetail.tsx`**
- Fetch `one_time_revenues` for that project
- Display them in the revenue section as line items
- Include in project revenue totals

### Files to create
- `src/components/timesheets/OneTimeRevenueDialog.tsx`

### Files to edit
- `src/pages/Timesheets.tsx` — add button + dialog state
- `src/pages/Dashboard.tsx` — fetch and include one-time revenues in metrics
- `src/pages/ProjectDetail.tsx` — show one-time revenues in project detail

