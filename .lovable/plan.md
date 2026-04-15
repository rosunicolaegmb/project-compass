

## Fix: Timezone Bug in Dashboard Period Filtering

### Root Cause
`getPeriodRange()` converts dates using `toISOString().substring(0, 10)`, which shifts to UTC. In timezones east of UTC (e.g. Romania UTC+2), `new Date(2026, 3, 1)` (April 1 local) becomes `"2026-03-31"` in UTC. This causes the last day of the previous month to leak into the current month's view.

This explains exactly what you see in April:
- **€660 revenue** = one leaked March 31 time entry (8h × €52.50 + 8h × €30)
- **€14.88K cost** = all March salary costs leak in because the monthly costs date comparison also uses `new Date()` with UTC shifting

### Fix

**File: `src/pages/Dashboard.tsx`**

1. Replace `toISOString().substring(0, 10)` in `getPeriodRange` with a local date formatter:
```typescript
function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
```

2. Update `getPeriodRange` to use `toLocalDate()` instead of `toISOString().substring(0, 10)`.

3. Also fix the quarterly and yearly `to = now` case — `now` also needs local formatting.

### Scope
Single file change: `src/pages/Dashboard.tsx`, ~5 lines modified.

