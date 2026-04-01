
-- Add invitation_status column
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS invitation_status text NOT NULL DEFAULT 'not_invited';

-- Set existing linked resources to active
UPDATE public.resources SET invitation_status = 'active' WHERE user_id IS NOT NULL AND invitation_status = 'not_invited';

-- Update handle_new_user to auto-assign reporter role for invited resources
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resource record;
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- Check if this user was invited as a resource
  SELECT * INTO v_resource
  FROM public.resources
  WHERE lower(email) = lower(NEW.email)
    AND invitation_status = 'invitation_sent'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_resource IS NOT NULL THEN
    -- Assign reporter role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'reporter')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Link resource to user and set active
    UPDATE public.resources
    SET user_id = NEW.id, invitation_status = 'active'
    WHERE id = v_resource.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Update link_resource_by_email to also set invitation_status to active
CREATE OR REPLACE FUNCTION public.link_resource_by_email(_user_id uuid, _email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    UPDATE public.resources
    SET user_id = _user_id, invitation_status = 'active'
    WHERE id = v_resource_id AND (user_id IS NULL OR user_id = _user_id);
  END IF;

  RETURN v_resource_id;
END;
$$;
