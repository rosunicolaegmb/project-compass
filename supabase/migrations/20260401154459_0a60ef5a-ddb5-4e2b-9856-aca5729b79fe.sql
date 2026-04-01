-- Function to auto-link a user to a resource by email
CREATE OR REPLACE FUNCTION public.link_resource_by_email(_user_id uuid, _email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resource_id uuid;
BEGIN
  SELECT id INTO v_resource_id
  FROM public.resources
  WHERE lower(email) = lower(_email)
    AND (user_id IS NULL OR user_id = _user_id)
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_resource_id IS NOT NULL THEN
    UPDATE public.resources SET user_id = _user_id WHERE id = v_resource_id AND (user_id IS NULL OR user_id = _user_id);
  END IF;

  RETURN v_resource_id;
END;
$$;

-- Reporter can view projects they are allocated to (read-only)
CREATE POLICY "Reporters can view allocated projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'reporter'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_members pm
    JOIN public.resources r ON r.id = pm.resource_id
    WHERE pm.project_id = projects.id
      AND r.user_id = auth.uid()
  )
);

-- Reporter can view project phases on allocated projects
CREATE POLICY "Reporters can view phases on allocated projects"
ON public.project_phases
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'reporter'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.project_members pm
    JOIN public.resources r ON r.id = pm.resource_id
    WHERE pm.project_id = project_phases.project_id
      AND r.user_id = auth.uid()
  )
);

-- Reporter can view own resource record
CREATE POLICY "Reporters can view own resource"
ON public.resources
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'reporter'::app_role)
  AND user_id = auth.uid()
);

-- Reporter can view own project allocations
CREATE POLICY "Reporters can view own project allocations"
ON public.project_members
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'reporter'::app_role)
  AND resource_id = get_resource_id_for_user(auth.uid())
);

-- Reporter time entry policies (own entries only, on allocated projects)
CREATE POLICY "Reporters can view own time entries"
ON public.time_entries
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'reporter'::app_role)
  AND resource_id = get_resource_id_for_user(auth.uid())
);

CREATE POLICY "Reporters can insert own time entries"
ON public.time_entries
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'reporter'::app_role)
  AND resource_id = get_resource_id_for_user(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = time_entries.project_id
      AND pm.resource_id = time_entries.resource_id
  )
);

CREATE POLICY "Reporters can update own time entries"
ON public.time_entries
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'reporter'::app_role)
  AND resource_id = get_resource_id_for_user(auth.uid())
);

CREATE POLICY "Reporters can delete own time entries"
ON public.time_entries
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'reporter'::app_role)
  AND resource_id = get_resource_id_for_user(auth.uid())
);