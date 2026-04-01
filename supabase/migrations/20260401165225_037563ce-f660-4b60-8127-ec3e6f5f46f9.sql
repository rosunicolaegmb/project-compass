
-- Delete the ghost auth user created by the old inviteUserByEmail flow
-- This user was never properly signed up, just auto-created by the invite API
DELETE FROM auth.users WHERE id = '7408f1d7-cd78-4a08-af76-77a185d8ddb8';

-- Reset the resource invitation status so it can be re-invited
UPDATE public.resources 
SET invitation_status = 'not_invited', user_id = NULL 
WHERE id = 'a7223d3c-8b25-44cf-99bf-e574066f040c';
