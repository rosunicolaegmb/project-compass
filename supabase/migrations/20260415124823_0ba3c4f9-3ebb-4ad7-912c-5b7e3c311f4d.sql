
CREATE TABLE public.one_time_revenues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  revenue_month date NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.one_time_revenues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage one time revenues"
  ON public.one_time_revenues FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admins can manage one time revenues"
  ON public.one_time_revenues FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Authenticated can view one time revenues"
  ON public.one_time_revenues FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_one_time_revenues_updated_at
  BEFORE UPDATE ON public.one_time_revenues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
