alter table public.roles
  add column if not exists is_system boolean not null default true;

insert into public.permissions (code, name, description)
values ('roles.manage', 'Manage roles', 'Create roles, edit permissions, and assign roles.')
on conflict (code) do nothing;

drop policy if exists roles_select on public.roles;
drop policy if exists permissions_select on public.permissions;
drop policy if exists role_permissions_select on public.role_permissions;
drop policy if exists user_roles_select on public.user_roles;
drop policy if exists profiles_select_role_manager on public.profiles;

create policy roles_select_authenticated on public.roles
  for select to authenticated using (true);

create policy permissions_select_authenticated on public.permissions
  for select to authenticated using (true);

create policy role_permissions_select_authenticated on public.role_permissions
  for select to authenticated using (true);

create policy user_roles_select_self_or_role_manager on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('roles.read', club_id));

create policy profiles_select_role_manager on public.profiles
  for select to authenticated
  using (public.has_permission('roles.manage'));

revoke insert, update, delete on public.roles, public.permissions, public.role_permissions, public.user_roles
  from anon, authenticated;
grant select on public.roles, public.permissions, public.role_permissions, public.user_roles, public.clubs
  to authenticated;

create or replace function public.assign_role(
  p_user_id uuid,
  p_role_id uuid,
  p_club_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_id uuid;
  v_role public.roles%rowtype;
  v_permission record;
begin
  if not public.has_permission('roles.manage') then
    raise exception 'You do not have permission to manage roles.' using errcode = '42501';
  end if;

  select * into v_role from public.roles where id = p_role_id;
  if not found then
    raise exception 'Role not found.' using errcode = '22023';
  end if;

  if v_role.code = 'global_admin' and p_club_id is not null then
    raise exception 'The global_admin role cannot be club-scoped.' using errcode = '22023';
  end if;

  for v_permission in
    select p.code
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_id = p_role_id
  loop
    if not public.has_permission(v_permission.code, p_club_id) then
      raise exception 'Cannot assign a role carrying permission % that you do not hold.', v_permission.code
        using errcode = '42501';
    end if;
  end loop;

  insert into public.user_roles (user_id, role_id, club_id, assigned_by)
  values (p_user_id, p_role_id, p_club_id, auth.uid())
  on conflict do nothing
  returning id into v_assignment_id;

  if v_assignment_id is null then
    select id into v_assignment_id
    from public.user_roles
    where user_id = p_user_id
      and role_id = p_role_id
      and club_id is not distinct from p_club_id;
    return v_assignment_id;
  end if;

  perform public.log_audit(
    'role.assigned',
    'user_roles',
    v_assignment_id,
    jsonb_build_object('user_id', p_user_id, 'role_id', p_role_id, 'club_id', p_club_id)
  );
  perform public.send_notification(
    p_user_id,
    'role.assigned',
    'Role assigned',
    format('You have been assigned the %s role%s.', v_role.name, case when p_club_id is null then '' else ' for a club' end),
    array['in_app']::text[],
    jsonb_build_object('role_id', p_role_id, 'club_id', p_club_id)
  );
  return v_assignment_id;
end;
$$;

create or replace function public.revoke_role(
  p_user_id uuid,
  p_role_id uuid,
  p_club_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.user_roles%rowtype;
  v_role public.roles%rowtype;
  v_admin_count integer;
begin
  if not public.has_permission('roles.manage') then
    raise exception 'You do not have permission to manage roles.' using errcode = '42501';
  end if;

  select * into v_role from public.roles where id = p_role_id;
  if not found then
    raise exception 'Role not found.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(2147483647);
  select * into v_assignment
  from public.user_roles
  where user_id = p_user_id
    and role_id = p_role_id
    and club_id is not distinct from p_club_id
  for update;

  if not found then
    return false;
  end if;

  if v_role.code = 'global_admin' and p_club_id is null then
    select count(*) into v_admin_count
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.code = 'global_admin' and ur.club_id is null;
    if v_admin_count <= 1 then
      raise exception 'The last global admin cannot be removed.' using errcode = '23514';
    end if;
  end if;

  delete from public.user_roles where id = v_assignment.id;
  perform public.log_audit(
    'role.revoked',
    'user_roles',
    v_assignment.id,
    jsonb_build_object('user_id', p_user_id, 'role_id', p_role_id, 'club_id', p_club_id)
  );
  perform public.send_notification(
    p_user_id,
    'role.revoked',
    'Role revoked',
    format('Your %s role%s has been revoked.', v_role.name, case when p_club_id is null then '' else ' for a club' end),
    array['in_app']::text[],
    jsonb_build_object('role_id', p_role_id, 'club_id', p_club_id)
  );
  return true;
end;
$$;

create or replace function public.create_role(
  p_code text,
  p_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
  v_code text := lower(trim(p_code));
  v_name text := trim(p_name);
begin
  if not public.has_permission('roles.manage') then
    raise exception 'You do not have permission to manage roles.' using errcode = '42501';
  end if;
  if v_code = '' or v_name = '' then
    raise exception 'Role code and name are required.' using errcode = '22023';
  end if;

  insert into public.roles (code, name, description, is_global, is_system)
  values (v_code, v_name, nullif(trim(p_description), ''), false, false)
  returning id into v_role_id;

  perform public.log_audit(
    'role.created', 'roles', v_role_id,
    jsonb_build_object('code', v_code, 'name', v_name)
  );
  return v_role_id;
end;
$$;

create or replace function public.update_role(
  p_role_id uuid,
  p_name text,
  p_code text default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.roles%rowtype;
  v_code text;
  v_name text := trim(p_name);
begin
  if not public.has_permission('roles.manage') then
    raise exception 'You do not have permission to manage roles.' using errcode = '42501';
  end if;

  select * into v_role from public.roles where id = p_role_id for update;
  if not found then
    raise exception 'Role not found.' using errcode = '22023';
  end if;
  if v_role.is_system then
    raise exception 'System roles cannot be edited.' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'Role name is required.' using errcode = '22023';
  end if;

  v_code := lower(trim(coalesce(nullif(p_code, ''), v_role.code)));
  update public.roles
  set code = v_code,
      name = v_name,
      description = nullif(trim(p_description), '')
  where id = p_role_id;

  perform public.log_audit(
    'role.updated', 'roles', p_role_id,
    jsonb_build_object('old_name', v_role.name, 'new_name', v_name, 'old_code', v_role.code, 'new_code', v_code)
  );
  return p_role_id;
end;
$$;

create or replace function public.update_role_permissions(
  p_role_id uuid,
  p_permission_ids uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.roles%rowtype;
  v_permission record;
begin
  if not public.has_permission('roles.manage') then
    raise exception 'You do not have permission to manage roles.' using errcode = '42501';
  end if;

  select * into v_role from public.roles where id = p_role_id for update;
  if not found then
    raise exception 'Role not found.' using errcode = '22023';
  end if;
  if v_role.is_system then
    raise exception 'System roles cannot be edited.' using errcode = '42501';
  end if;

  for v_permission in
    select p.code
    from public.permissions p
    where p.id = any(coalesce(p_permission_ids, array[]::uuid[]))
  loop
    if not public.has_permission(v_permission.code) then
      raise exception 'Cannot grant permission % that you do not hold.', v_permission.code
        using errcode = '42501';
    end if;
  end loop;

  if exists (
    select 1
    from unnest(coalesce(p_permission_ids, array[]::uuid[])) requested(id)
    left join public.permissions p on p.id = requested.id
    where p.id is null
  ) then
    raise exception 'One or more permissions do not exist.' using errcode = '22023';
  end if;

  delete from public.role_permissions where role_id = p_role_id;
  insert into public.role_permissions (role_id, permission_id)
  select p_role_id, permission_id
  from unnest(coalesce(p_permission_ids, array[]::uuid[])) permission_id
  on conflict do nothing;

  perform public.log_audit(
    'role.permissions_updated', 'roles', p_role_id,
    jsonb_build_object('permission_ids', coalesce(p_permission_ids, array[]::uuid[]))
  );
  return true;
end;
$$;

create or replace function public.delete_role(p_role_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.roles%rowtype;
  v_assignment_count integer;
begin
  if not public.has_permission('roles.manage') then
    raise exception 'You do not have permission to manage roles.' using errcode = '42501';
  end if;

  select * into v_role from public.roles where id = p_role_id for update;
  if not found then
    raise exception 'Role not found.' using errcode = '22023';
  end if;
  if v_role.is_system then
    raise exception 'System roles cannot be deleted.' using errcode = '42501';
  end if;

  select count(*) into v_assignment_count from public.user_roles where role_id = p_role_id;
  if v_assignment_count > 0 then
    raise exception 'This role is still assigned to % user(s) and cannot be deleted.', v_assignment_count
      using errcode = '23514';
  end if;

  delete from public.roles where id = p_role_id;
  perform public.log_audit(
    'role.deleted', 'roles', p_role_id,
    jsonb_build_object('code', v_role.code, 'name', v_role.name)
  );
  return true;
end;
$$;

revoke all on function public.assign_role(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.revoke_role(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_role(text, text, text) from public, anon, authenticated;
revoke all on function public.update_role(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.update_role_permissions(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.delete_role(uuid) from public, anon, authenticated;
grant execute on function public.assign_role(uuid, uuid, uuid) to authenticated;
grant execute on function public.revoke_role(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_role(text, text, text) to authenticated;
grant execute on function public.update_role(uuid, text, text, text) to authenticated;
grant execute on function public.update_role_permissions(uuid, uuid[]) to authenticated;
grant execute on function public.delete_role(uuid) to authenticated;
