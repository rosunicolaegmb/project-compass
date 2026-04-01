
ALTER TABLE public.resources
  ADD COLUMN cost_rate_currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN bill_rate_currency text NOT NULL DEFAULT 'EUR';

-- Initialize from existing currency column
UPDATE public.resources SET cost_rate_currency = currency, bill_rate_currency = currency;
