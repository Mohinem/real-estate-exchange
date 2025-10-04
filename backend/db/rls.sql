grant select on app_public.users to anonymous, app_user, app_admin;
grant usage, select on all sequences in schema app_public to app_user, app_admin;