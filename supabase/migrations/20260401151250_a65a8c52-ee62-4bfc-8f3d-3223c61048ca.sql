
INSERT INTO public.currency_conversion_rates (year, month, from_currency, to_currency, rate)
SELECT 2026, m, 'RON', 'EUR', 0.20
FROM generate_series(1, 12) AS m
ON CONFLICT (year, month, from_currency, to_currency) DO NOTHING;
