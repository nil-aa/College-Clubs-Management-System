-- Faculty is a global account classification. OD approval authority remains a
-- separate club-scoped faculty_coordinator assignment.
insert into public.roles (code, name, description, is_global, is_system)
values (
  'faculty',
  'Faculty',
  'Faculty account without club-scoped OD review authority.',
  true,
  true
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_global = excluded.is_global,
    is_system = excluded.is_system;

create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(trim(p_role));
  v_role_id uuid;
  v_old_role text;
  v_assignment_id uuid;
  v_admin_count integer;
begin
  if not public.has_permission('users.manage') then
    raise exception 'Only an admin can change user roles.' using errcode = '42501';
  end if;
  if v_role not in ('student', 'faculty', 'club_head', 'admin') then
    raise exception 'Role must be student, faculty, club_head, or admin.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(2147483646);

  select r.code into v_old_role
  from public.user_roles ur join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user_id and ur.status = 'active' and ur.club_id is null
    and r.code in ('student', 'faculty', 'club_head', 'admin', 'global_admin')
  order by case r.code
    when 'admin' then 1
    when 'global_admin' then 2
    when 'faculty' then 3
    when 'club_head' then 4
    else 5
  end
  limit 1;

  if v_old_role in ('admin', 'global_admin') and v_role <> 'admin' then
    select count(*) into v_admin_count
    from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.status = 'active' and ur.club_id is null and r.code in ('admin', 'global_admin');
    if v_admin_count <= 1 then
      raise exception 'The last admin cannot be demoted.' using errcode = '23514';
    end if;
  end if;

  if v_role <> 'club_head' and exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and ur.status = 'active'
      and ur.club_id is not null and r.code = 'club_head'
  ) then
    raise exception 'Revoke club-head assignments before changing this user to a non-Club-Head role.' using errcode = '42501';
  end if;

  select id into v_role_id from public.roles where code = v_role;
  if v_role_id is null then
    raise exception 'Role catalogue is missing %.', v_role using errcode = '22023';
  end if;

  update public.user_roles ur
  set status = 'inactive', deactivated_at = coalesce(deactivated_at, now()), deactivated_by = auth.uid()
  where ur.user_id = p_user_id and ur.club_id is null
    and ur.status = 'active' and ur.role_id <> v_role_id;

  update public.user_roles
  set status = 'active', deactivated_at = null, deactivated_by = null, assigned_by = auth.uid()
  where user_id = p_user_id and role_id = v_role_id and club_id is null
  returning id into v_assignment_id;
  if v_assignment_id is null then
    insert into public.user_roles (user_id, role_id, club_id, assigned_by, status)
    values (p_user_id, v_role_id, null, auth.uid(), 'active')
    returning id into v_assignment_id;
  end if;

  perform public.log_audit('user_role.changed', 'user_roles', v_assignment_id,
    jsonb_build_object('user_id', p_user_id, 'old_role', v_old_role, 'new_role', v_role));
  perform public.send_notification(p_user_id, 'user_role.changed', 'Role updated',
    format('Your role is now %s.', v_role), array['in_app']::text[],
    jsonb_build_object('role', v_role));
  return v_assignment_id;
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public, anon, authenticated;
grant execute on function public.set_user_role(uuid, text) to authenticated;
