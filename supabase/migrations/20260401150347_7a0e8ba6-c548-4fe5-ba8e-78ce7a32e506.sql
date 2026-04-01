-- Add currency to resources (for default_bill_rate and default_cost_rate)
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';

-- Add currency to time_entries (for bill_rate and cost_rate on each entry)
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';

-- Add currency to project_members (for rate overrides)
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';

-- Add currency to resource_rate_history
ALTER TABLE public.resource_rate_history ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';

-- Change projects default currency from USD to EUR
ALTER TABLE public.projects ALTER COLUMN currency SET DEFAULT 'EUR';

-- Update existing records from USD to EUR
UPDATE public.projects SET currency = 'EUR' WHERE currency = 'USD';
UPDATE public.expense_entries SET currency = 'EUR' WHERE currency = 'USD';
