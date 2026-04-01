
-- Fix the current test user: assign reporter role and link resource
INSERT INTO public.user_roles (user_id, role)
VALUES ('6e738ce1-0749-4e0a-a934-f6c204da7adf', 'reporter')
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.resources
SET user_id = '6e738ce1-0749-4e0a-a934-f6c204da7adf', invitation_status = 'active'
WHERE email = 'nicolae.rosu86@yahoo.com' AND invitation_status = 'invitation_sent' AND deleted_at IS NULL;

-- Update handle_new_user to also match not_invited status
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resource record;
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- Check if this user was invited as a resource (match by email)
  SELECT * INTO v_resource
  FROM public.resources
  WHERE lower(email) = lower(NEW.email)
    AND invitation_status IN ('invitation_sent', 'not_invited')
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_resource IS NOT NULL THEN
    -- Assign reporter role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'reporter')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Link resource to user and set status to active
    UPDATE public.resources
    SET user_id = NEW.id, invitation_status = 'active'
    WHERE id = v_resource.id;
  END IF;

  RETURN NEW;
END;
$function$;
