-- Extend the API database role to the complete schema after M2/M3 migrations
-- are present. Business authorization remains in apps/api; RLS is a safety net.

grant usage on schema public to club_api;
grant usage on type public.attendance_status, public.attendance_session_status to club_api;
grant select, insert, update, delete on all tables in schema public to club_api;
grant usage, select, update on all sequences in schema public to club_api;

-- Audit logs remain append-only even for the API role.
revoke update, delete on public.audit_logs from club_api;
grant select, insert on public.audit_logs to club_api;

-- Views are covered by the table grant above, but keep this explicit for any
-- view or materialized view created by a teammate.
do $$
declare
  object_name text;
begin
  for object_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('v', 'm', 'f')
  loop
    execute format('grant select on public.%I to club_api', object_name);
  end loop;
end
$$;

-- Policies cannot be defaulted, so install an explicit API policy on every
-- current public table. The audit table gets a narrower policy.
do $$
declare
  table_name text;
begin
  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists api_club_api_full on public.%I', table_name);
    execute format('drop policy if exists api_club_api_audit_select on public.%I', table_name);
    execute format('drop policy if exists api_club_api_audit_insert on public.%I', table_name);

    if table_name = 'audit_logs' then
      execute format(
        'create policy api_club_api_audit_select on public.%I for select to club_api using (true)',
        table_name
      );
      execute format(
        'create policy api_club_api_audit_insert on public.%I for insert to club_api with check (true)',
        table_name
      );
    else
      execute format(
        'create policy api_club_api_full on public.%I for all to club_api using (true) with check (true)',
        table_name
      );
    end if;
  end loop;
end
$$;

-- Future tables created by the migration owner receive the table/sequence
-- grants. Future migrations still need the check:api-grants script because
-- PostgreSQL has no default-policy facility.
alter default privileges in schema public
  grant select, insert, update, delete on tables to club_api;
alter default privileges in schema public
  grant usage, select, update on sequences to club_api;

comment on role club_api is
  'Least-privilege API role for the complete project schema; authorization is enforced in apps/api.';
