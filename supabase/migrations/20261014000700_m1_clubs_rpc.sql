-- Member 1 club administration RPCs.
-- Clients may read through RLS, but all club writes go through these functions.

create unique index if not exists clubs_lower_name_key
  on public.clubs (lower(name));

drop policy if exists clubs_insert on public.clubs;
drop policy if exists clubs_update on public.clubs;
drop policy if exists clubs_delete on public.clubs;
drop policy if exists clubs_no_direct_insert on public.clubs;
drop policy if exists clubs_no_direct_update on public.clubs;
drop policy if exists clubs_no_direct_delete on public.clubs;

create policy clubs_no_direct_insert on public.clubs
  for insert to authenticated
  with check (false);

create policy clubs_no_direct_update on public.clubs
  for update to authenticated
  using (false)
  with check (false);

create policy clubs_no_direct_delete on public.clubs
  for delete to authenticated
  using (false);

revoke insert, update, delete on public.clubs from anon, authenticated;
grant select on public.clubs to authenticated;

create or replace function public.create_club(
  p_name text,
  p_description text default null,
  p_category text default null,
  p_contact_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text;
begin
  if not public.has_role('admin') then
    raise exception 'Only admins can create clubs.' using errcode = '42501';
  end if;
  if length(v_name) < 2 then
    raise exception 'Club name must be at least 2 characters.' using errcode = '22023';
  end if;
  if exists (select 1 from public.clubs where lower(name) = lower(v_name)) then
    raise exception 'A club with this name already exists.' using errcode = '23505';
  end if;

  v_slug := regexp_replace(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g');
  if v_slug = '' then
    v_slug := 'club-' || substr(md5(v_name), 1, 12);
  end if;
  if exists (select 1 from public.clubs where slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(v_name), 1, 8);
  end if;

  insert into public.clubs(name, slug, description, category, contact_email, created_by, is_active)
  values (v_name, v_slug, nullif(trim(p_description), ''), nullif(trim(p_category), ''),
          nullif(trim(p_contact_email), ''), auth.uid(), true)
  returning id into v_id;

  perform public.log_audit(
    'club.created', 'clubs', v_id,
    jsonb_build_object('name', v_name, 'category', nullif(trim(p_category), ''))
  );
  return v_id;
end;
$$;

create or replace function public.update_club(
  p_club_id uuid,
  p_name text,
  p_description text default null,
  p_category text default null,
  p_contact_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_slug text;
begin
  if not public.has_role('admin') then
    raise exception 'Only admins can update clubs.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clubs where id = p_club_id) then
    raise exception 'Club not found.' using errcode = 'P0002';
  end if;
  if length(v_name) < 2 then
    raise exception 'Club name must be at least 2 characters.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.clubs
    where lower(name) = lower(v_name) and id <> p_club_id
  ) then
    raise exception 'A club with this name already exists.' using errcode = '23505';
  end if;

  v_slug := regexp_replace(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g');
  if v_slug = '' then
    v_slug := 'club-' || substr(md5(v_name), 1, 12);
  end if;
  if exists (select 1 from public.clubs where slug = v_slug and id <> p_club_id) then
    v_slug := v_slug || '-' || substr(md5(v_name), 1, 8);
  end if;

  update public.clubs
  set name = v_name,
      slug = v_slug,
      description = nullif(trim(p_description), ''),
      category = nullif(trim(p_category), ''),
      contact_email = nullif(trim(p_contact_email), '')
  where id = p_club_id;

  perform public.log_audit(
    'club.updated', 'clubs', p_club_id,
    jsonb_build_object('name', v_name, 'category', nullif(trim(p_category), ''))
  );
  return p_club_id;
end;
$$;

create or replace function public.set_club_active(
  p_club_id uuid,
  p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Only admins can activate or deactivate clubs.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.clubs where id = p_club_id) then
    raise exception 'Club not found.' using errcode = 'P0002';
  end if;

  update public.clubs set is_active = p_is_active where id = p_club_id;
  perform public.log_audit(
    case when p_is_active then 'club.activated' else 'club.deactivated' end,
    'clubs', p_club_id,
    jsonb_build_object('is_active', p_is_active)
  );
  return p_is_active;
end;
$$;

revoke all on function public.create_club(text, text, text, text) from public, anon, authenticated;
revoke all on function public.update_club(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.set_club_active(uuid, boolean) from public, anon, authenticated;
grant execute on function public.create_club(text, text, text, text) to authenticated;
grant execute on function public.update_club(uuid, text, text, text, text) to authenticated;
grant execute on function public.set_club_active(uuid, boolean) to authenticated;
