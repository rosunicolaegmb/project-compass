
CREATE TYPE public.forecast_scenario AS ENUM ('best_case', 'expected', 'worst_case');

ALTER TABLE public.monthly_forecasts
  ADD COLUMN scenario_type forecast_scenario NOT NULL DEFAULT 'expected';

ALTER TABLE public.quarterly_forecasts
  ADD COLUMN scenario_type forecast_scenario NOT NULL DEFAULT 'expected';

ALTER TABLE public.yearly_forecasts
  ADD COLUMN scenario_type forecast_scenario NOT NULL DEFAULT 'expected';
