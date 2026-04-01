
CREATE TABLE public.currency_conversion_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  from_currency text NOT NULL DEFAULT 'GBP',
  to_currency text NOT NULL DEFAULT 'EUR',
  rate numeric NOT NULL DEFAULT 1.15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month, from_currency, to_currency)
);

ALTER TABLE public.currency_conversion_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view rates" ON public.currency_conversion_rates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage rates" ON public.currency_conversion_rates
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_currency_rates_updated_at
  BEFORE UPDATE ON public.currency_conversion_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pre-populate 2026 with 1.15
INSERT INTO public.currency_conversion_rates (year, month, rate)
VALUES
  (2026, 1, 1.15), (2026, 2, 1.15), (2026, 3, 1.15),
  (2026, 4, 1.15), (2026, 5, 1.15), (2026, 6, 1.15),
  (2026, 7, 1.15), (2026, 8, 1.15), (2026, 9, 1.15),
  (2026, 10, 1.15), (2026, 11, 1.15), (2026, 12, 1.15);
