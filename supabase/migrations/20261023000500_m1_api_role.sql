-- API database role for the backend boundary.
-- Set the password manually in the SQL Editor after applying this migration.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'club_api') then
    execute 'create role club_api login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls';
  end if;
end
$$;

-- Do not ALTER ROLE here. Hosted Supabase does not grant the migration role
-- permission to alter superuser-related attributes, even when the requested
-- values are the least-privilege values. The CREATE ROLE statement above
-- applies these attributes when this migration creates club_api.
grant connect on database postgres to club_api;
grant usage on schema public to club_api;
grant usage on type public.profile_status, public.club_status, public.assignment_status,
  public.membership_status, public.notification_status to club_api;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'roles', 'permissions', 'role_permissions', 'user_roles',
    'clubs', 'club_memberships', 'notifications', 'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end
$$;

-- The API owns authorization in TypeScript. RLS remains enabled, and these
-- policies give only the dedicated database role the data path it needs.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'roles', 'permissions', 'role_permissions', 'user_roles',
    'clubs', 'club_memberships', 'notifications'
  ] loop
    execute format('drop policy if exists api_club_api_full on public.%I', table_name);
    execute format(
      'create policy api_club_api_full on public.%I for all to club_api using (true) with check (true)',
      table_name
    );
  end loop;
end
$$;

drop policy if exists api_club_api_audit_select on public.audit_logs;
drop policy if exists api_club_api_audit_insert on public.audit_logs;
create policy api_club_api_audit_select on public.audit_logs
  for select to club_api using (true);
create policy api_club_api_audit_insert on public.audit_logs
  for insert to club_api with check (true);

revoke all on public.profiles, public.roles, public.permissions, public.role_permissions,
  public.user_roles, public.clubs, public.club_memberships, public.notifications,
  public.audit_logs from club_api;
grant select, insert, update, delete on public.profiles, public.roles, public.permissions,
  public.role_permissions, public.user_roles, public.clubs, public.club_memberships,
  public.notifications to club_api;
grant select, insert on public.audit_logs to club_api;

do $$
begin
  if to_regclass('public.audit_logs_id_seq') is not null then
    grant usage, select on sequence public.audit_logs_id_seq to club_api;
  end if;
end
$$;

comment on role club_api is
  'Least-privilege application role. Business authorization is enforced by apps/api.';
