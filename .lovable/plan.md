

## Fix: Use correct currency symbols in Resources table

The `fmtRate` and `fmtMonthly` helper functions in `src/pages/Resources.tsx` have hardcoded `$` signs. They should use the resource's actual currency (`currency`, `cost_rate_currency`, `bill_rate_currency` fields).

### Changes

**File: `src/pages/Resources.tsx`**

1. Import `CURRENCY_SYMBOLS` from `@/lib/currency`
2. Update `fmtRate` to accept a currency parameter and look up the correct symbol
3. Update `fmtMonthly` to default to the resource's currency symbol
4. In the table rows, pass each resource's currency fields:
   - Cost column: use `r.currency` for full-time (monthly cost) or `r.cost_rate_currency` for hourly cost rate
   - Bill Rate column: use `r.bill_rate_currency`
   - Overhead column: already uses `€` correctly (overhead is always EUR)

