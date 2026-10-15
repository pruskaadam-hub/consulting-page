-- First create this user's account in Supabase Authentication (without public signup).
-- Run in the Supabase SQL Editor, never expose a service key in the frontend.
insert into public.admin_users(user_id)
select id from auth.users where lower(email)='pruskaadam@me.com'
on conflict do nothing;
-- Must return exactly one row. Zero rows means the Auth user has not been created yet.
select user_id from public.admin_users where user_id in (
  select id from auth.users where lower(email)='pruskaadam@me.com'
);
