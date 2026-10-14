-- Local development seed only. These accounts all use the obviously dev-only password: Test1234!
create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;

do $$
declare
  installed_schema text;
begin
  select n.nspname
    into installed_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pgcrypto';

  if installed_schema is not null and installed_schema <> 'extensions' then
    alter extension "pgcrypto" set schema extensions;
  end if;
end $$;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'global-admin@example.test', extensions.crypt('Test1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Global Admin"}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'president@example.test', extensions.crypt('Test1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Club President"}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'member@example.test', extensions.crypt('Test1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Regular Member"}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'club-admin@example.test', extensions.crypt('Test1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Club Admin"}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'volunteer-coordinator@example.test', extensions.crypt('Test1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Volunteer Coordinator"}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'recruitment-manager@example.test', extensions.crypt('Test1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Recruitment Manager"}'::jsonb, now(), now()),
  ('10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'committee-member@example.test', extensions.crypt('Test1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Committee Member"}'::jsonb, now(), now())
on conflict (id) do nothing;

-- Seed email identities separately so existing auth.users from a failed/partial run can log in.
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '{"sub":"10000000-0000-0000-0000-000000000001","email":"global-admin@example.test"}'::jsonb, 'email', now(), now(), now()),
  ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '{"sub":"10000000-0000-0000-0000-000000000002","email":"president@example.test"}'::jsonb, 'email', now(), now(), now()),
  ('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '{"sub":"10000000-0000-0000-0000-000000000003","email":"member@example.test"}'::jsonb, 'email', now(), now(), now()),
  ('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '{"sub":"10000000-0000-0000-0000-000000000004","email":"club-admin@example.test"}'::jsonb, 'email', now(), now(), now()),
  ('11000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', '{"sub":"10000000-0000-0000-0000-000000000005","email":"volunteer-coordinator@example.test"}'::jsonb, 'email', now(), now(), now()),
  ('11000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', '{"sub":"10000000-0000-0000-0000-000000000006","email":"recruitment-manager@example.test"}'::jsonb, 'email', now(), now(), now()),
  ('11000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007', '{"sub":"10000000-0000-0000-0000-000000000007","email":"committee-member@example.test"}'::jsonb, 'email', now(), now(), now())
on conflict do nothing;

-- The signup trigger creates these for new users; this idempotent repair covers a partial seed.
insert into public.profiles (id, full_name, avatar_url)
select id, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)), raw_user_meta_data ->> 'avatar_url'
from auth.users
where id in (
  '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000007'
)
on conflict (id) do nothing;

insert into public.roles (code, name, description, is_global) values
  ('global_admin', 'Global administrator', 'Unrestricted platform administrator.', true),
  ('club_admin', 'Club administrator', 'Manages one club and its operational data.', false),
  ('president', 'President', 'Leads one club.', false),
  ('recruitment_manager', 'Recruitment manager', 'Manages membership recruitment for one club.', false),
  ('volunteer_coordinator', 'Volunteer coordinator', 'Manages volunteer openings and assignments for one club.', false),
  ('committee_member', 'Committee member', 'Participates in a club committee.', false),
  ('member', 'Member', 'Regular club member.', false)
on conflict (code) do nothing;

insert into public.permissions (code, name, description) values
  ('profiles.read', 'Read profiles', 'Read profile records.'),
  ('roles.read', 'Read roles', 'Read role and assignment records.'),
  ('permissions.read', 'Read permissions', 'Read permission definitions.'),
  ('clubs.read', 'Read clubs', 'Read club records.'),
  ('clubs.manage', 'Manage clubs', 'Create and update clubs.'),
  ('memberships.read', 'Read memberships', 'Read club memberships.'),
  ('memberships.manage', 'Manage memberships', 'Approve and update memberships.'),
  ('recruitment.read', 'Read recruitment', 'Read recruitment forms and responses.'),
  ('recruitment.manage', 'Manage recruitment', 'Manage recruitment workflows.'),
  ('committee.read', 'Read committees', 'Read committee assignments.'),
  ('committee.manage', 'Manage committees', 'Manage committee designations and assignments.'),
  ('volunteers.read', 'Read volunteers', 'Read volunteer openings and assignments.'),
  ('volunteers.manage', 'Manage volunteers', 'Manage volunteer openings and assignments.'),
  ('audit.read', 'Read audit logs', 'Read audit history.'),
  ('notifications.read', 'Read notifications', 'Read in-app notifications.')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'club_admin'
  and p.code in ('profiles.read','roles.read','permissions.read','clubs.read','clubs.manage','memberships.read','memberships.manage','recruitment.read','recruitment.manage','committee.read','committee.manage','volunteers.read','volunteers.manage','audit.read','notifications.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'president'
  and p.code in ('profiles.read','clubs.read','memberships.read','memberships.manage','recruitment.read','recruitment.manage','committee.read','committee.manage','volunteers.read','volunteers.manage','notifications.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'recruitment_manager'
  and p.code in ('profiles.read','clubs.read','memberships.read','memberships.manage','recruitment.read','recruitment.manage','notifications.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'volunteer_coordinator'
  and p.code in ('profiles.read','clubs.read','volunteers.read','volunteers.manage','notifications.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'committee_member'
  and p.code in ('profiles.read','clubs.read','committee.read','volunteers.read','notifications.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'member'
  and p.code in ('profiles.read','clubs.read','memberships.read','recruitment.read','volunteers.read','notifications.read')
on conflict do nothing;

insert into public.clubs (id, name, slug, description, created_by)
values ('20000000-0000-0000-0000-000000000001', 'Demo Computing Club', 'demo-computing-club', 'Local development club.', '10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.club_memberships (club_id, user_id, status, joined_at)
select '20000000-0000-0000-0000-000000000001', id, 'active', now()
from public.profiles
where id in (
  '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000007'
)
on conflict (club_id, user_id) do nothing;

insert into public.user_roles (user_id, role_id, club_id, assigned_by)
select '10000000-0000-0000-0000-000000000001', r.id, null, '10000000-0000-0000-0000-000000000001'
from public.roles r where r.code = 'global_admin'
on conflict do nothing;

insert into public.user_roles (user_id, role_id, club_id, assigned_by)
select x.user_id, r.id, '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'
from (values
  ('10000000-0000-0000-0000-000000000002'::uuid, 'president'),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'member'),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'club_admin'),
  ('10000000-0000-0000-0000-000000000005'::uuid, 'volunteer_coordinator'),
  ('10000000-0000-0000-0000-000000000006'::uuid, 'recruitment_manager'),
  ('10000000-0000-0000-0000-000000000007'::uuid, 'committee_member')
) as x(user_id, role_code)
join public.roles r on r.code = x.role_code
on conflict do nothing;
