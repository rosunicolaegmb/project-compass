
ALTER TABLE public.projects
  ADD COLUMN planned_budget NUMERIC(14,2),
  ADD COLUMN revised_budget NUMERIC(14,2),
  ADD COLUMN revenue_model TEXT,
  ADD COLUMN notes TEXT;
