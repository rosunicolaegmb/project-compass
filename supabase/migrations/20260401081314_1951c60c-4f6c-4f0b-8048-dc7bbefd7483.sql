
-- Add employment_type enum
CREATE TYPE public.employment_type AS ENUM ('full_time', 'part_time', 'contractor', 'vendor');

-- Add missing columns to resources
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS employment_type public.employment_type DEFAULT 'full_time';

-- Seed default delivery roles (only if table is empty)
INSERT INTO public.delivery_roles (name, level, description)
SELECT * FROM (VALUES
  ('Developer', 'Mid', 'Software development and engineering'),
  ('QA', 'Mid', 'Quality assurance and testing'),
  ('PM', 'Senior', 'Project management and delivery oversight'),
  ('BA', 'Mid', 'Business analysis and requirements'),
  ('Architect', 'Senior', 'Solution and technical architecture'),
  ('DevOps', 'Senior', 'Infrastructure and CI/CD'),
  ('Support', 'Junior', 'Technical support and maintenance'),
  ('Other', NULL, 'Other delivery roles')
) AS v(name, level, description)
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_roles LIMIT 1);
