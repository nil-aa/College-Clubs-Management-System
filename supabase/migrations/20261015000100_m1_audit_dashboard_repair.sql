-- Repair hosted projects where the audit/dashboard migration history is ahead
-- of the exposed functions, and backfill default student roles for older
-- profiles created before the signup role trigger existed.

create index if not exists audit_logs_created_at_desc_idx
  on public.audit_logs (created_at desc);

create index if not exists audit_logs_action_idx
  on public.audit_logs (action);

insert into public.user_roles (user_id, role_id, club_id, assigned_by, status)
select p.id, r.id, null, p.id, 'active'
from public.profiles p
cross join public.roles r
where p.is_active
  and r.code = 'student'
  and not exists (
    select 1
    from public.user_roles ur
    join public.roles existing_role on existing_role.id = ur.role_id
    where ur.user_id = p.id
      and ur.status = 'active'
      and existing_role.code in ('student', 'club_head', 'admin', 'global_admin')
  )
on conflict do nothing;

drop function if exists public.list_audit_logs(text, text, uuid, timestamptz, timestamptz, integer, integer);

create function public.list_audit_logs(
  p_action text default null,
  p_entity_type text default null,
  p_actor uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  actor_id uuid,
  actor_name text,
  action text,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.has_permission('audit.read') then
    raise exception 'Only admins can view audit logs.' using errcode = '42501';
  end if;

  return query
  select
    a.actor,
    p.full_name,
    a.action,
    a.entity_type,
    a.entity_id,
    a.details,
    a.created_at,
    count(*) over ()
  from public.audit_logs a
  left join public.profiles p on p.id = a.actor
  where (nullif(trim(p_action), '') is null or a.action = trim(p_action))
    and (nullif(trim(p_entity_type), '') is null or a.entity_type = trim(p_entity_type))
    and (p_actor is null or a.actor = p_actor)
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at < p_to)
  order by a.created_at desc, a.id desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.get_admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stats jsonb;
  v_recent jsonb;
  v_users_by_role jsonb;
begin
  if not public.has_permission('audit.read') then
    raise exception 'Only admins can view admin dashboard statistics.' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('role', role_code, 'count', user_count)
      order by role_code
    ),
    '[]'::jsonb
  )
  into v_users_by_role
  from (
    select r.code as role_code, count(distinct ur.user_id)::integer as user_count
    from public.roles r
    left join public.user_roles ur
      on ur.role_id = r.id and ur.status = 'active' and ur.club_id is null
    where r.code in ('student', 'club_head', 'admin', 'global_admin')
    group by r.code
  ) role_counts;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'actor_id', recent.actor_id,
        'actor_name', recent.actor_name,
        'action', recent.action,
        'entity_type', recent.entity_type,
        'entity_id', recent.entity_id,
        'details', recent.details,
        'created_at', recent.created_at
      )
      order by recent.created_at desc, recent.audit_id desc
    ),
    '[]'::jsonb
  )
  into v_recent
  from (
    select
      a.id as audit_id,
      a.actor as actor_id,
      p.full_name as actor_name,
      a.action,
      a.entity_type,
      a.entity_id,
      a.details,
      a.created_at
    from public.audit_logs a
    left join public.profiles p on p.id = a.actor
    order by a.created_at desc, a.id desc
    limit 5
  ) recent;

  select jsonb_build_object(
    'active_club_count', count(*) filter (where c.is_active),
    'inactive_club_count', count(*) filter (where not c.is_active),
    'clubs_without_head_count', count(*) filter (
      where not exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.club_id = c.id
          and ur.status = 'active'
          and r.code = 'club_head'
      )
    )
  )
  into v_stats
  from public.clubs c;

  return v_stats || jsonb_build_object(
    'users_by_role', v_users_by_role,
    'recent_audit_logs', v_recent
  );
end;
$$;

revoke all on function public.list_audit_logs(text, text, uuid, timestamptz, timestamptz, integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_admin_dashboard_stats() from public, anon, authenticated;
grant execute on function public.list_audit_logs(text, text, uuid, timestamptz, timestamptz, integer, integer)
  to authenticated;
grant execute on function public.get_admin_dashboard_stats() to authenticated;

notify pgrst, 'reload schema';
