
ALTER TABLE public.resources
  ADD COLUMN overhead_cost_eur numeric DEFAULT NULL,
  ADD COLUMN monthly_cost numeric DEFAULT NULL;

COMMENT ON COLUMN public.resources.overhead_cost_eur IS 'Monthly overhead cost in EUR, added as expense regardless of days worked';
COMMENT ON COLUMN public.resources.monthly_cost IS 'Monthly cost for full-time resources (replaces hourly cost rate)';
