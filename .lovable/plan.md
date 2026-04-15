

## Clean Up Database — Fresh Start (revised)

Delete all business/transactional data while preserving:
- Your user account and profile
- User roles
- Currency conversion rates
- System settings

### Tables to TRUNCATE (all rows removed)

```sql
TRUNCATE TABLE
  time_entries, expense_entries, approvals,
  project_members, project_phases, project_budget_baselines, project_budget_revisions,
  monthly_forecasts, quarterly_forecasts, yearly_forecasts,
  resource_monthly_costs, resource_rate_history,
  projects, clients, resources, delivery_roles,
  general_expenses, audit_logs
CASCADE;
```

### Tables LEFT UNTOUCHED
- `profiles` — your user profile
- `user_roles` — role assignments
- `currency_conversion_rates` — kept as requested
- `system_settings` — app configuration (default currency, fiscal year, approval rules, etc.)

### Implementation
One database migration with a single `TRUNCATE` statement. No code changes needed.

