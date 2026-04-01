ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS default_bill_rate numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_cost_rate numeric DEFAULT NULL;