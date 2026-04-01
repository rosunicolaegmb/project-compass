
ALTER TABLE public.resources DROP CONSTRAINT resources_employee_id_key;

CREATE UNIQUE INDEX resources_employee_id_active_key 
ON public.resources (employee_id) 
WHERE deleted_at IS NULL AND employee_id IS NOT NULL;
