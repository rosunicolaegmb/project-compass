
CREATE TABLE public.resource_monthly_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(resource_id, year, month)
);

ALTER TABLE public.resource_monthly_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage resource monthly costs"
ON public.resource_monthly_costs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admins can manage resource monthly costs"
ON public.resource_monthly_costs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Authenticated can view resource monthly costs"
ON public.resource_monthly_costs FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER update_resource_monthly_costs_updated_at
BEFORE UPDATE ON public.resource_monthly_costs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
