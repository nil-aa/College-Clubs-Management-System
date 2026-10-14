-- Finalize Member 1 identity, club, and Club Head assignment contracts.
-- Existing legacy columns are retained for compatibility with earlier migrations.

alter table public.profiles
  add column if not exists email text,
  add column if not exists roll_number text,
  add column if not exists is_active boolean not null default true;

alter table public.profiles
  alter column year_of_study type smallint using year_of_study::smallint;

update public.profiles p
set email = coalesce(u.email, ''),
    is_active = (p.status = 'active')
from auth.users u
where u.id = p.id;

alter table public.profiles
  alter column email set not null;

create unique index if not exists profiles_roll_number_key
  on public.profiles(roll_number)
  where roll_number is not null;

comment on column public.profiles.email is
  'Email snapshot from auth.users; authentication remains owned by Supabase Auth.';
comment on column public.profiles.is_active is
  'Canonical application active flag; legacy status is retained for compatibility.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_role uuid;
begin
  insert into public.profiles (id, full_name, email, avatar_url, is_active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'avatar_url',
    true
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

alter table public.clubs
  add column if not exists category text,
  add column if not exists contact_email text,
  add column if not exists is_active boolean not null default true;

update public.clubs
set is_active = (status = 'active');

create unique index if not exists clubs_name_key
  on public.clubs(name);

comment on column public.clubs.is_active is
  'Clubs are deactivated instead of deleted.';

create or replace function public.sync_club_active_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.status = case when new.is_active then 'active'::public.club_status else 'archived'::public.club_status end;
  elsif new.is_active is distinct from old.is_active then
    new.status = case when new.is_active then 'active'::public.club_status else 'archived'::public.club_status end;
  elsif new.status is distinct from old.status then
    new.is_active = (new.status = 'active');
  end if;
  return new;
end;
$$;

drop trigger if exists clubs_sync_active_state on public.clubs;
create trigger clubs_sync_active_state
  before insert or update on public.clubs
  for each row execute function public.sync_club_active_state();

create or replace function public.prevent_club_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Clubs cannot be deleted; set is_active to false.' using errcode = '42501';
end;
$$;

drop trigger if exists clubs_prevent_delete on public.clubs;
create trigger clubs_prevent_delete
  before delete on public.clubs
  for each row execute function public.prevent_club_delete();

drop policy if exists clubs_select on public.clubs;
drop policy if exists clubs_select_active_or_admin on public.clubs;
create policy clubs_select_active_or_admin on public.clubs
  for select to authenticated
  using (is_active or public.has_role('admin'));

revoke delete on public.clubs from anon, authenticated;

alter table public.user_roles
  add column if not exists assigned_at timestamptz not null default now(),
  add column if not exists is_active boolean not null default true;

update public.user_roles
set assigned_at = coalesce(assigned_at, created_at),
    is_active = (status = 'active');

create or replace function public.sync_user_role_assignment_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.assigned_at = coalesce(new.assigned_at, now());
  elsif old.status is distinct from new.status and new.status = 'active' then
    new.assigned_at = now();
  end if;
  new.is_active = (new.status = 'active');
  return new;
end;
$$;

drop trigger if exists user_roles_sync_assignment_state on public.user_roles;
create trigger user_roles_sync_assignment_state
  before insert or update on public.user_roles
  for each row execute function public.sync_user_role_assignment_state();

create unique index if not exists user_roles_active_club_assignment_key
  on public.user_roles(club_id, user_id)
  where club_id is not null and status = 'active' and is_active;

create index if not exists user_roles_active_club_heads_idx
  on public.user_roles(club_id, user_id)
  where club_id is not null and status = 'active' and is_active;

comment on table public.user_roles is
  'Club Head assignments are active club-scoped rows with role code club_head; no second assignment table is used.';
comment on column public.user_roles.assigned_at is
  'Canonical assignment timestamp; created_at is retained for compatibility.';
comment on column public.user_roles.is_active is
  'Canonical active flag synchronized from the legacy status column.';
