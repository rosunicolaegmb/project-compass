
CREATE TABLE public.general_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  year integer NOT NULL,
  month integer NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.general_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage general expenses"
ON public.general_expenses FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Office admins can manage general expenses"
ON public.general_expenses FOR ALL TO authenticated
USING (has_role(auth.uid(), 'office_admin'::app_role));

CREATE POLICY "Authenticated can view general expenses"
ON public.general_expenses FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER update_general_expenses_updated_at
BEFORE UPDATE ON public.general_expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
