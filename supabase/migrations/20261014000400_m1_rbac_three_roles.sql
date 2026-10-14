alter table public.user_roles
  add column if not exists status public.assignment_status not null default 'active',
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid references public.profiles(id) on delete set null;

drop index if exists public.user_roles_user_role_global_key;
drop index if exists public.user_roles_user_role_club_key;

create unique index user_roles_active_global_key
  on public.user_roles(user_id, role_id)
  where club_id is null and status = 'active';

create unique index user_roles_active_club_key
  on public.user_roles(user_id, role_id, club_id)
  where club_id is not null and status = 'active';

create index if not exists user_roles_user_status_idx
  on public.user_roles(user_id, status, role_id);

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
  ('users.read', 'Read users', 'Search users and read role assignments.'),
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
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'student' and p.code in ('clubs.read', 'notifications.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'club_head' and p.code in ('clubs.read', 'clubs.manage', 'notifications.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'admin'
  and p.code in (
    'profiles.read', 'users.read', 'users.manage', 'roles.read', 'permissions.read',
    'clubs.read', 'clubs.manage', 'notifications.read', 'audit.read'
  )
on conflict do nothing;

create or replace function public.has_role(p_role text, p_club_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.status = 'active'
      and (
        (lower(p_role) = 'admin' and r.code in ('admin', 'global_admin') and ur.club_id is null)
        or (r.code = lower(p_role) and r.code = 'club_head' and p_club_id is not null and ur.club_id = p_club_id)
        or (r.code = lower(p_role) and r.code <> 'club_head' and ur.club_id is null)
      )
  );
$$;

create or replace function public.has_permission(p_permission text, p_club_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and ur.status = 'active'
      and (
        r.code in ('admin', 'global_admin')
        or (
          p.code = lower(p_permission)
          and case
            when r.code = 'club_head' then p_club_id is not null and ur.club_id = p_club_id
            else ur.club_id is null or ur.club_id = p_club_id
          end
        )
      )
  )
  or exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.status = 'active'
      and r.code in ('admin', 'global_admin')
      and p_permission is not null
  );
$$;

create or replace function public.can_manage_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_club_id is not null
    and (public.has_role('admin') or public.has_role('club_head', p_club_id));
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_role uuid;
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  select id into v_student_role from public.roles where code = 'student';
  if v_student_role is not null then
    insert into public.user_roles (user_id, role_id, club_id, assigned_by, status)
    values (new.id, v_student_role, null, new.id, 'active')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop policy if exists roles_select on public.roles;
drop policy if exists roles_select_authenticated on public.roles;
drop policy if exists permissions_select on public.permissions;
drop policy if exists permissions_select_authenticated on public.permissions;
drop policy if exists role_permissions_select on public.role_permissions;
drop policy if exists role_permissions_select_authenticated on public.role_permissions;
drop policy if exists user_roles_select on public.user_roles;
drop policy if exists user_roles_select_self_or_role_manager on public.user_roles;
drop policy if exists profiles_select_role_manager on public.profiles;
drop policy if exists profiles_select_role_manager on public.profiles;

create policy roles_select_authenticated on public.roles
  for select to authenticated using (true);

create policy permissions_select_authenticated on public.permissions
  for select to authenticated using (true);

create policy role_permissions_select_authenticated on public.role_permissions
  for select to authenticated using (true);

create policy user_roles_select_self_or_admin on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('users.read'));

create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_permission('users.read'));

revoke insert, update, delete on public.roles, public.permissions, public.role_permissions, public.user_roles
  from anon, authenticated;
grant select on public.roles, public.permissions, public.role_permissions, public.user_roles, public.clubs
  to authenticated;

create or replace function public.assign_club_head(p_user_id uuid, p_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
  v_assignment_id uuid;
  v_name text;
begin
  if not public.has_permission('users.manage') then
    raise exception 'Only an admin can assign club heads.' using errcode = '42501';
  end if;
  if p_club_id is null then
    raise exception 'A club is required for a club-head assignment.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.clubs where id = p_club_id) then
    raise exception 'Club not found.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and ur.status = 'active' and ur.club_id is null
      and r.code in ('admin', 'global_admin')
  ) then
    raise exception 'An admin cannot be assigned a club-head scope.' using errcode = '42501';
  end if;

  select id into v_role_id from public.roles where code = 'club_head';
  select full_name into v_name from public.profiles where id = p_user_id;

  update public.user_roles ur
  set status = 'inactive', deactivated_at = coalesce(deactivated_at, now()), deactivated_by = auth.uid()
  from public.roles r
  where ur.user_id = p_user_id and ur.club_id is null and ur.status = 'active'
    and ur.role_id = r.id and r.code = 'student';

  update public.user_roles
  set status = 'active', deactivated_at = null, deactivated_by = null, assigned_by = auth.uid()
  where user_id = p_user_id and role_id = v_role_id and club_id is null;
  if not found then
    insert into public.user_roles (user_id, role_id, club_id, assigned_by, status)
    values (p_user_id, v_role_id, null, auth.uid(), 'active');
  end if;

  update public.user_roles
  set status = 'active', deactivated_at = null, deactivated_by = null, assigned_by = auth.uid()
  where user_id = p_user_id and role_id = v_role_id and club_id = p_club_id
  returning id into v_assignment_id;
  if v_assignment_id is null then
    insert into public.user_roles (user_id, role_id, club_id, assigned_by, status)
    values (p_user_id, v_role_id, p_club_id, auth.uid(), 'active')
    returning id into v_assignment_id;
  end if;

  perform public.log_audit('club_head.assigned', 'user_roles', v_assignment_id,
    jsonb_build_object('user_id', p_user_id, 'club_id', p_club_id));
  perform public.send_notification(p_user_id, 'club_head.assigned', 'Club head assignment',
    format('You are now a club head%s.', case when v_name is null then '' else ' for ' || v_name end),
    array['in_app']::text[], jsonb_build_object('club_id', p_club_id));
  return v_assignment_id;
end;
$$;

create or replace function public.revoke_club_head(p_user_id uuid, p_club_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.user_roles%rowtype;
  v_role_name text;
begin
  if not public.has_permission('users.manage') then
    raise exception 'Only an admin can revoke club heads.' using errcode = '42501';
  end if;

  select ur.* into v_assignment
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user_id and ur.club_id = p_club_id
    and ur.status = 'active' and r.code = 'club_head'
  for update;
  if not found then
    return false;
  end if;

  update public.user_roles
  set status = 'inactive', deactivated_at = now(), deactivated_by = auth.uid()
  where id = v_assignment.id;

  select name into v_role_name from public.roles where id = v_assignment.role_id;
  perform public.log_audit('club_head.revoked', 'user_roles', v_assignment.id,
    jsonb_build_object('user_id', p_user_id, 'club_id', p_club_id));
  perform public.send_notification(p_user_id, 'club_head.revoked', 'Club head assignment revoked',
    format('Your %s assignment for a club has been revoked.', coalesce(v_role_name, 'Club Head')),
    array['in_app']::text[], jsonb_build_object('club_id', p_club_id));
  return true;
end;
$$;

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
  if v_role not in ('student', 'club_head', 'admin') then
    raise exception 'Role must be student, club_head, or admin.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(2147483646);

  select r.code into v_old_role
  from public.user_roles ur join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user_id and ur.status = 'active' and ur.club_id is null
    and r.code in ('student', 'club_head', 'admin', 'global_admin')
  order by case r.code when 'admin' then 1 when 'global_admin' then 2 when 'club_head' then 3 else 4 end
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
    where ur.user_id = p_user_id and ur.status = 'active' and ur.club_id is not null and r.code = 'club_head'
  ) then
    raise exception 'Revoke club-head assignments before changing this user to a non-Club-Head role.' using errcode = '42501';
  end if;

  select id into v_role_id from public.roles where code = v_role;
  if v_role_id is null then
    raise exception 'Role catalogue is missing %.', v_role using errcode = '22023';
  end if;

  update public.user_roles ur
  set status = 'inactive', deactivated_at = coalesce(deactivated_at, now()), deactivated_by = auth.uid()
  where ur.user_id = p_user_id and ur.club_id is null and ur.status = 'active' and ur.role_id <> v_role_id;

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

revoke all on function public.assign_club_head(uuid, uuid) from public, anon, authenticated;
revoke all on function public.revoke_club_head(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_user_role(uuid, text) from public, anon, authenticated;
grant execute on function public.assign_club_head(uuid, uuid) to authenticated;
grant execute on function public.revoke_club_head(uuid, uuid) to authenticated;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- Legacy custom-role RPCs remain in the database for compatibility with the
-- earlier migration, but are no longer callable by application users under
-- the reduced three-role scope.
revoke all on function public.assign_role(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.revoke_role(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_role(text, text, text) from public, anon, authenticated;
revoke all on function public.update_role(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.update_role_permissions(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.delete_role(uuid) from public, anon, authenticated;
