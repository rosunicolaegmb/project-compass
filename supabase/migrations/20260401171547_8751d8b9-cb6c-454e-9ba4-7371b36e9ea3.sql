
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resource_id uuid;
BEGIN
  -- Always create profile
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT DO NOTHING;

  -- Check if this user was invited as a resource (match by email)
  SELECT id INTO v_resource_id
  FROM public.resources
  WHERE lower(email) = lower(NEW.email)
    AND invitation_status IN ('invitation_sent', 'not_invited')
    AND deleted_at IS NULL
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_resource_id IS NOT NULL THEN
    -- Assign reporter role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'reporter')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Link resource to user and set status to active
    UPDATE public.resources
    SET user_id = NEW.id, invitation_status = 'active'
    WHERE id = v_resource_id;
    
    RAISE LOG 'handle_new_user: linked user % to resource %, assigned reporter role', NEW.id, v_resource_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error for user %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;
