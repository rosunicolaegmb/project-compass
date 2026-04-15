

## Fix: Replace hardcoded USD with resource's actual currency

The `auto_create_monthly_overhead` database trigger has `'USD'` hardcoded in two places when creating monthly labor cost expense entries. It should use `v_resource.currency` instead.

### Steps

1. **Database migration** — Update the `auto_create_monthly_overhead` function to replace both occurrences of `'USD'` with `v_resource.currency`
2. **Fix existing data** — Update any existing `expense_entries` rows that were incorrectly created with `currency = 'USD'` to use the correct resource currency
3. **Verify** — Confirm the Dashboard no longer shows the USD missing rates warning

### Technical detail

In the function body, two lines change:
- The `WHERE` clause checking `AND currency = 'USD'` → `AND currency = v_resource.currency`
- The `INSERT` values using `'USD'` → `v_resource.currency`

