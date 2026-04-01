
CREATE OR REPLACE FUNCTION public.auto_create_monthly_overhead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resource RECORD;
  v_month_start date;
  v_existing_overhead uuid;
  v_existing_monthly uuid;
BEGIN
  -- Only trigger when approval_status changes to 'approved'
  IF NEW.approval_status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.approval_status = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Get resource details
  SELECT * INTO v_resource FROM public.resources WHERE id = NEW.resource_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Calculate first day of the entry month
  v_month_start := date_trunc('month', NEW.entry_date)::date;

  -- Create overhead expense (EUR) if resource has overhead_cost_eur
  IF v_resource.overhead_cost_eur IS NOT NULL AND v_resource.overhead_cost_eur > 0 THEN
    SELECT id INTO v_existing_overhead
    FROM public.expense_entries
    WHERE resource_id = NEW.resource_id
      AND project_id = NEW.project_id
      AND category = 'operational'
      AND currency = 'EUR'
      AND date_trunc('month', expense_date) = v_month_start
      AND description LIKE '%Monthly overhead%'
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_overhead IS NULL THEN
      INSERT INTO public.expense_entries (
        resource_id, project_id, phase_id, expense_date, category, amount,
        is_billable, approval_status, currency, description
      ) VALUES (
        NEW.resource_id, NEW.project_id, NEW.phase_id, v_month_start, 'operational',
        v_resource.overhead_cost_eur, false, 'approved', 'EUR',
        'Monthly overhead - ' || to_char(v_month_start, 'Mon YYYY')
      );
    END IF;
  END IF;

  -- Create monthly cost expense for full-time resources
  IF v_resource.employment_type = 'full_time' AND v_resource.monthly_cost IS NOT NULL AND v_resource.monthly_cost > 0 THEN
    SELECT id INTO v_existing_monthly
    FROM public.expense_entries
    WHERE resource_id = NEW.resource_id
      AND project_id = NEW.project_id
      AND category = 'operational'
      AND currency = 'USD'
      AND date_trunc('month', expense_date) = v_month_start
      AND description LIKE '%Monthly labor cost%'
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing_monthly IS NULL THEN
      INSERT INTO public.expense_entries (
        resource_id, project_id, phase_id, expense_date, category, amount,
        is_billable, approval_status, currency, description
      ) VALUES (
        NEW.resource_id, NEW.project_id, NEW.phase_id, v_month_start, 'operational',
        v_resource.monthly_cost, false, 'approved', 'USD',
        'Monthly labor cost - ' || to_char(v_month_start, 'Mon YYYY')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_monthly_overhead
  AFTER INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_monthly_overhead();
