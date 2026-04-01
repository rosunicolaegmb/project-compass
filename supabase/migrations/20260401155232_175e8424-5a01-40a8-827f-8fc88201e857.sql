CREATE UNIQUE INDEX idx_resources_unique_email
ON public.resources (lower(email))
WHERE deleted_at IS NULL AND email IS NOT NULL;