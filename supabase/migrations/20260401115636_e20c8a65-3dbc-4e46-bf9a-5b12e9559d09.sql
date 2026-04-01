
-- Add sow_expired to project_status enum
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'sow_expired';

-- Remove revised_budget column from projects
ALTER TABLE public.projects DROP COLUMN IF EXISTS revised_budget;

-- Create function to auto-expire projects where end_date <= current_date
CREATE OR REPLACE FUNCTION public.auto_expire_sow_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.projects
  SET status = 'sow_expired', updated_at = now()
  WHERE end_date IS NOT NULL
    AND end_date <= CURRENT_DATE
    AND status NOT IN ('completed', 'archived', 'cancelled', 'sow_expired')
    AND deleted_at IS NULL;
END;
$$;

-- Create trigger function that checks on project insert/update
CREATE OR REPLACE FUNCTION public.check_sow_expiry_on_save()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.end_date IS NOT NULL
     AND NEW.end_date <= CURRENT_DATE
     AND NEW.status NOT IN ('completed', 'archived', 'cancelled', 'sow_expired')
  THEN
    NEW.status := 'sow_expired';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_sow_expiry
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.check_sow_expiry_on_save();
