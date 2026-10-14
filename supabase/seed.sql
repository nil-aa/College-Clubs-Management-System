-- Local development seed only.
-- All seeded accounts use the obviously dev-only password: Test1234!
-- Never reuse these credentials in production.

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

insert into public.roles (code, name, description, is_global, is_system)
values
  ('student', 'Student', 'A student account with student-facing access.', true, true),
  ('club_head', 'Club Head', 'Manages clubs to which the user is assigned.', false, true),
  ('admin', 'Admin', 'Unrestricted platform administrator.', true, true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_global = excluded.is_global,
    is_system = excluded.is_system;

insert into public.permissions (code, name, description)
values
  ('profiles.read', 'Read profiles', 'Read permitted profile records.'),
  ('users.read', 'Read users', 'Search users and read their role assignments.'),
  ('users.manage', 'Manage users and roles', 'Assign roles and club heads.'),
  ('roles.read', 'Read roles', 'Read role definitions.'),
  ('permissions.read', 'Read permissions', 'Read permission definitions.'),
  ('clubs.read', 'Read clubs', 'Read club directory and club details.'),
  ('clubs.manage', 'Manage clubs', 'Create and update clubs.'),
  ('notifications.read', 'Read notifications', 'Read in-app notifications.'),
  ('audit.read', 'Read audit logs', 'Read audit history.')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'student' and p.code in ('clubs.read', 'notifications.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'club_head' and p.code in ('clubs.read', 'clubs.manage', 'notifications.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'admin'
  and p.code in (
    'profiles.read', 'users.read', 'users.manage', 'roles.read', 'permissions.read',
    'clubs.read', 'clubs.manage', 'notifications.read', 'audit.read'
  )
on conflict do nothing;

do $$
declare
  v record;
  v_user_id uuid;
begin
  for v in
    select *
    from (values
      ('10000000-0000-0000-0000-000000000001'::uuid, 'global-admin@example.test', 'Global Admin', null, null, null::smallint),
      ('10000000-0000-0000-0000-000000000002'::uuid, 'president@example.test', 'Club President', 'CH001', 'Computing', 3::smallint),
      ('10000000-0000-0000-0000-000000000003'::uuid, 'member@example.test', 'Regular Member', 'STU001', 'Computing', 2::smallint),
      ('10000000-0000-0000-0000-000000000004'::uuid, 'club-admin@example.test', 'Student Four', 'STU002', 'Electronics', 1::smallint),
      ('10000000-0000-0000-0000-000000000005'::uuid, 'volunteer-coordinator@example.test', 'Student Five', 'STU003', 'Mechanical', 4::smallint),
      ('10000000-0000-0000-0000-000000000006'::uuid, 'recruitment-manager@example.test', 'Student Six', 'STU004', 'Civil', 2::smallint),
      ('10000000-0000-0000-0000-000000000007'::uuid, 'committee-member@example.test', 'Student Seven', 'STU005', 'Mathematics', 3::smallint),
      ('10000000-0000-0000-0000-000000000008'::uuid, 'club-head-two@example.test', 'Club Head Two', 'CH002', 'Design', 3::smallint)
    ) as seed(id, email, full_name, roll_number, department, year_of_study)
  loop
    select id into v_user_id
    from auth.users
    where lower(email) = lower(v.email)
    order by created_at
    limit 1;

    if v_user_id is null then
      v_user_id := v.id;
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        confirmation_token, recovery_token, email_change, email_change_token_current,
        email_change_token_new, phone_change, phone_change_token,
        reauthentication_token, raw_app_meta_data,
        raw_user_meta_data, created_at, updated_at
      )
      values (
        '00000000-0000-0000-0000-000000000000'::uuid,
        v_user_id, 'authenticated', 'authenticated', v.email,
        extensions.crypt('Test1234!', extensions.gen_salt('bf')), now(),
        '', '', '', '', '', '', '', '',
        jsonb_build_object('provider', 'email', 'providers', array['email']),
        jsonb_build_object('full_name', v.full_name), now(), now()
      );
    else
      update auth.users
      set encrypted_password = extensions.crypt('Test1234!', extensions.gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          confirmation_token = '', recovery_token = '', email_change = '',
          email_change_token_current = '', email_change_token_new = '',
          phone_change = '', phone_change_token = '',
          reauthentication_token = '',
          raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', array['email']),
          raw_user_meta_data = jsonb_build_object('full_name', v.full_name),
          updated_at = now()
      where id = v_user_id;
    end if;

    update auth.identities
    set provider_id = v_user_id::text,
        identity_data = jsonb_build_object('sub', v_user_id::text, 'email', v.email),
        updated_at = now()
    where user_id = v_user_id and provider = 'email';

    if not found then
      insert into auth.identities (
        user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      )
      values (
        v_user_id, v_user_id::text,
        jsonb_build_object('sub', v_user_id::text, 'email', v.email),
        'email', null, now(), now()
      );
    end if;

    insert into public.profiles (id, full_name, email, roll_number, department, year_of_study, is_active)
    values (v_user_id, v.full_name, v.email, v.roll_number, v.department, v.year_of_study, true)
    on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        roll_number = excluded.roll_number,
        department = excluded.department,
        year_of_study = excluded.year_of_study,
        is_active = true;
  end loop;
end $$;

insert into public.clubs (id, name, slug, description, category, contact_email, is_active, created_by)
values (
  '20000000-0000-0000-0000-000000000001',
  'Demo Computing Club', 'demo-computing-club', 'Local development club.',
  'Technology', 'computing@example.test', true,
  '10000000-0000-0000-0000-000000000001'
)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    contact_email = excluded.contact_email,
    is_active = excluded.is_active;

insert into public.clubs (id, name, slug, description, category, contact_email, is_active, created_by)
values (
  '20000000-0000-0000-0000-000000000002',
  'Demo Design Club', 'demo-design-club', 'Second local development club.',
  'Design', 'design@example.test', true,
  '10000000-0000-0000-0000-000000000001'
)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    contact_email = excluded.contact_email,
    is_active = excluded.is_active;

insert into public.club_memberships (club_id, user_id, status, joined_at)
select '20000000-0000-0000-0000-000000000001', id, 'active', now()
from public.profiles
where id in (
  '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000007'
)
on conflict (club_id, user_id) do nothing;

insert into public.club_memberships (club_id, user_id, status, joined_at)
select '20000000-0000-0000-0000-000000000002', id, 'active', now()
from public.profiles
where id in (
  '10000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005'
)
on conflict (club_id, user_id) do nothing;

insert into public.user_roles (user_id, role_id, club_id, assigned_by)
select '10000000-0000-0000-0000-000000000001', r.id, null, '10000000-0000-0000-0000-000000000001'
from public.roles r where r.code = 'admin'
on conflict do nothing;

update public.user_roles ur
set status = 'active', deactivated_at = null, deactivated_by = null,
    assigned_by = '10000000-0000-0000-0000-000000000001'
from public.roles r
where ur.role_id = r.id and ur.user_id = '10000000-0000-0000-0000-000000000001'
  and r.code = 'admin' and ur.club_id is null
  and not exists (
    select 1 from public.user_roles live
    where live.user_id = ur.user_id and live.role_id = ur.role_id
      and live.club_id is not distinct from ur.club_id and live.status = 'active'
  );

update public.user_roles ur
set status = 'inactive', deactivated_at = coalesce(deactivated_at, now()),
    deactivated_by = '10000000-0000-0000-0000-000000000001'
from public.roles r
where ur.role_id = r.id and ur.user_id = '10000000-0000-0000-0000-000000000001'
  and r.code = 'student' and ur.club_id is null;

insert into public.user_roles (user_id, role_id, club_id, assigned_by)
select '10000000-0000-0000-0000-000000000002', r.id, null, '10000000-0000-0000-0000-000000000001'
from public.roles r where r.code = 'club_head'
on conflict do nothing;

update public.user_roles ur
set status = 'active', deactivated_at = null, deactivated_by = null,
    assigned_by = '10000000-0000-0000-0000-000000000001'
from public.roles r
where ur.role_id = r.id and ur.user_id = '10000000-0000-0000-0000-000000000002'
  and r.code = 'club_head' and ur.club_id is null
  and not exists (
    select 1 from public.user_roles live
    where live.user_id = ur.user_id and live.role_id = ur.role_id
      and live.club_id is not distinct from ur.club_id and live.status = 'active'
  );

update public.user_roles ur
set status = 'inactive', deactivated_at = coalesce(deactivated_at, now()),
    deactivated_by = '10000000-0000-0000-0000-000000000001'
from public.roles r
where ur.role_id = r.id and ur.user_id = '10000000-0000-0000-0000-000000000002'
  and r.code = 'student' and ur.club_id is null;

insert into public.user_roles (user_id, role_id, club_id, assigned_by)
select '10000000-0000-0000-0000-000000000002', r.id,
       '20000000-0000-0000-0000-000000000001',
       '10000000-0000-0000-0000-000000000001'
from public.roles r where r.code = 'club_head'
on conflict do nothing;

update public.user_roles ur
set status = 'active', deactivated_at = null, deactivated_by = null,
    assigned_by = '10000000-0000-0000-0000-000000000001'
from public.roles r
where ur.role_id = r.id and ur.user_id = '10000000-0000-0000-0000-000000000002'
  and r.code = 'club_head'
  and ur.club_id = '20000000-0000-0000-0000-000000000001'
  and not exists (
    select 1 from public.user_roles live
    where live.user_id = ur.user_id and live.role_id = ur.role_id
      and live.club_id is not distinct from ur.club_id and live.status = 'active'
  );

insert into public.user_roles (user_id, role_id, club_id, assigned_by)
select '10000000-0000-0000-0000-000000000008', r.id, null,
       '10000000-0000-0000-0000-000000000001'
from public.roles r where r.code = 'club_head'
on conflict do nothing;

update public.user_roles ur
set status = 'active', deactivated_at = null, deactivated_by = null,
    assigned_by = '10000000-0000-0000-0000-000000000001'
from public.roles r
where ur.role_id = r.id and ur.user_id = '10000000-0000-0000-0000-000000000008'
  and r.code = 'club_head' and ur.club_id is null
  and not exists (
    select 1 from public.user_roles live
    where live.user_id = ur.user_id and live.role_id = ur.role_id
      and live.club_id is not distinct from ur.club_id and live.status = 'active'
  );

update public.user_roles ur
set status = 'inactive', deactivated_at = coalesce(deactivated_at, now()),
    deactivated_by = '10000000-0000-0000-0000-000000000001'
from public.roles r
where ur.role_id = r.id and ur.user_id = '10000000-0000-0000-0000-000000000008'
  and r.code = 'student' and ur.club_id is null;

insert into public.user_roles (user_id, role_id, club_id, assigned_by)
select '10000000-0000-0000-0000-000000000008', r.id,
       '20000000-0000-0000-0000-000000000002',
       '10000000-0000-0000-0000-000000000001'
from public.roles r where r.code = 'club_head'
on conflict do nothing;

update public.user_roles ur
set status = 'active', deactivated_at = null, deactivated_by = null,
    assigned_by = '10000000-0000-0000-0000-000000000001'
from public.roles r
where ur.role_id = r.id and ur.user_id = '10000000-0000-0000-0000-000000000008'
  and r.code = 'club_head'
  and ur.club_id = '20000000-0000-0000-0000-000000000002'
  and not exists (
    select 1 from public.user_roles live
    where live.user_id = ur.user_id and live.role_id = ur.role_id
      and live.club_id is not distinct from ur.club_id and live.status = 'active'
  );

insert into public.user_roles (user_id, role_id, club_id, assigned_by)
select p.id, r.id, null, '10000000-0000-0000-0000-000000000001'
from public.profiles p cross join public.roles r
where r.code = 'student'
  and p.id not in (
    '10000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    '10000000-0000-0000-0000-000000000008'::uuid
  )
on conflict do nothing;
