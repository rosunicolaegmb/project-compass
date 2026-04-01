
-- Delete related data first
DELETE FROM public.user_roles WHERE user_id = '1d857919-6ae3-45ef-aeab-bf0efa21336c';
DELETE FROM public.profiles WHERE user_id = '1d857919-6ae3-45ef-aeab-bf0efa21336c';

-- Delete auth user
DELETE FROM auth.users WHERE id = '1d857919-6ae3-45ef-aeab-bf0efa21336c';

-- Reset resource
UPDATE public.resources
SET invitation_status = 'not_invited', user_id = NULL
WHERE email = 'nicolae.rosu86@yahoo.com' AND deleted_at IS NULL;
