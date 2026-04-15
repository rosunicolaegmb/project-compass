
CREATE OR REPLACE FUNCTION public.auto_create_monthly_overhead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resource RECORD;
  v_month_start date;
  v_existing_overhead uuid;
  v_existing_monthly uuid;
BEGIN
  IF NEW.approval_status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.approval_status = 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_resource FROM public.resources WHERE id = NEW.resource_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_month_start := date_trunc('month', NEW.entry_date)::date;

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

  IF v_resource.employment_type = 'full_time' AND v_resource.monthly_cost IS NOT NULL AND v_resource.monthly_cost > 0 THEN
    SELECT id INTO v_existing_monthly
    FROM public.expense_entries
    WHERE resource_id = NEW.resource_id
      AND project_id = NEW.project_id
      AND category = 'operational'
      AND currency = v_resource.currency
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
        v_resource.monthly_cost, false, 'approved', v_resource.currency,
        'Monthly labor cost - ' || to_char(v_month_start, 'Mon YYYY')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
