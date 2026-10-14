-- Member 2 event management RPCs.
-- All writes go through SECURITY DEFINER functions with active profile,
-- active club, and club-scoped events.manage checks.

create or replace function public.assert_event_manager(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  ) then
    raise exception 'An active authenticated profile is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.clubs c where c.id = p_club_id and c.is_active
  ) then
    raise exception 'Active club not found.' using errcode = '22023';
  end if;

  if not public.has_permission('events.manage', p_club_id) then
    raise exception 'You are not authorized to manage events for this club.'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.validate_event_fields(
  p_title text,
  p_venue text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_registration_deadline timestamptz,
  p_capacity integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(p_title), '') is null then
    raise exception 'Event title is required.' using errcode = '22023';
  end if;
  if char_length(trim(p_title)) > 200 then
    raise exception 'Event title must be 200 characters or fewer.' using errcode = '22023';
  end if;
  if nullif(trim(p_venue), '') is null then
    raise exception 'Event venue is required.' using errcode = '22023';
  end if;
  if char_length(trim(p_venue)) > 300 then
    raise exception 'Event venue must be 300 characters or fewer.' using errcode = '22023';
  end if;
  if p_start_time is null or p_end_time is null or p_registration_deadline is null then
    raise exception 'Event start, end, and registration deadline are required.'
      using errcode = '22023';
  end if;
  if p_capacity is null or p_capacity <= 0 then
    raise exception 'Event capacity must be positive.' using errcode = '22023';
  end if;
  if p_end_time <= p_start_time then
    raise exception 'Event end time must be later than start time.' using errcode = '22023';
  end if;
  if p_registration_deadline > p_start_time then
    raise exception 'Registration deadline must be no later than event start.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.create_event(
  p_club_id uuid,
  p_title text,
  p_description text,
  p_venue text,
  p_category text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_registration_deadline timestamptz,
  p_capacity integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  perform public.assert_event_manager(p_club_id);
  perform public.validate_event_fields(
    p_title, p_venue, p_start_time, p_end_time, p_registration_deadline, p_capacity
  );

  insert into public.events (
    club_id, created_by, title, description, venue, category,
    start_time, end_time, registration_deadline, capacity
  ) values (
    p_club_id, auth.uid(), trim(p_title), p_description, trim(p_venue), p_category,
    p_start_time, p_end_time, p_registration_deadline, p_capacity
  ) returning event_id into v_event_id;

  perform public.log_audit(
    'event.created', 'events', v_event_id,
    jsonb_build_object('event_id', v_event_id, 'club_id', p_club_id)
  );
  return v_event_id;
end;
$$;

create or replace function public.list_managed_events(
  p_club_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  event_id uuid,
  club_id uuid,
  created_by uuid,
  title varchar(200),
  description text,
  venue varchar(300),
  category text,
  start_time timestamptz,
  end_time timestamptz,
  registration_deadline timestamptz,
  capacity integer,
  status text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  registration_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  ) then
    raise exception 'An active authenticated profile is required.' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or p_offset is null or p_offset < 0 then
    raise exception 'Limit must be between 1 and 100 and offset cannot be negative.'
      using errcode = '22023';
  end if;
  if p_club_id is not null then
    perform public.assert_event_manager(p_club_id);
  elsif not exists (
    select 1
    from public.clubs c
    where c.is_active
      and public.has_permission('events.manage', c.id)
  ) then
    raise exception 'You are not authorized to manage events.' using errcode = '42501';
  end if;

  return query
  select e.event_id, e.club_id, e.created_by, e.title, e.description, e.venue,
         e.category, e.start_time, e.end_time, e.registration_deadline, e.capacity,
         e.status, e.published_at, e.created_at, e.updated_at,
         count(er.registration_id) filter (where er.status = 'REGISTERED')
  from public.events e
  join public.clubs c on c.id = e.club_id and c.is_active
  left join public.event_registrations er on er.event_id = e.event_id
  where (p_club_id is null or e.club_id = p_club_id)
    and public.has_permission('events.manage', e.club_id)
  group by e.event_id
  order by e.start_time desc, e.event_id desc
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.get_managed_event(p_event_id uuid)
returns table (
  event_id uuid,
  club_id uuid,
  created_by uuid,
  title varchar(200),
  description text,
  venue varchar(300),
  category text,
  start_time timestamptz,
  end_time timestamptz,
  registration_deadline timestamptz,
  capacity integer,
  status text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  registration_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_active
  ) then
    raise exception 'An active authenticated profile is required.' using errcode = '42501';
  end if;

  select e.club_id into v_club_id
  from public.events e
  join public.clubs c on c.id = e.club_id and c.is_active
  where e.event_id = p_event_id;
  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
  perform public.assert_event_manager(v_club_id);

  return query
  select e.event_id, e.club_id, e.created_by, e.title, e.description, e.venue,
         e.category, e.start_time, e.end_time, e.registration_deadline, e.capacity,
         e.status, e.published_at, e.created_at, e.updated_at,
         count(er.registration_id) filter (where er.status = 'REGISTERED')
  from public.events e
  left join public.event_registrations er on er.event_id = e.event_id
  where e.event_id = p_event_id
  group by e.event_id;
end;
$$;

create or replace function public.update_event(
  p_event_id uuid,
  p_title text,
  p_description text,
  p_venue text,
  p_category text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_registration_deadline timestamptz,
  p_capacity integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_club_id uuid;
  v_registration_count bigint;
begin
  select club_id into v_club_id from public.events where event_id = p_event_id;
  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
  perform public.assert_event_manager(v_club_id);
  select * into v_event from public.events where event_id = p_event_id for update;
  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
  perform public.assert_event_manager(v_event.club_id);
  if v_event.status not in ('DRAFT', 'PUBLISHED', 'POSTPONED') then
    raise exception 'This event status does not allow editing.' using errcode = '22023';
  end if;
  perform public.validate_event_fields(
    p_title, p_venue, p_start_time, p_end_time, p_registration_deadline, p_capacity
  );

  select count(*) into v_registration_count
  from public.event_registrations er
  where er.event_id = p_event_id and er.status = 'REGISTERED';
  if p_capacity < v_registration_count then
    raise exception 'Capacity cannot be lower than the number of active registrations.'
      using errcode = '22023';
  end if;

  update public.events
  set title = trim(p_title), description = p_description, venue = trim(p_venue),
      category = p_category, start_time = p_start_time, end_time = p_end_time,
      registration_deadline = p_registration_deadline, capacity = p_capacity
  where event_id = p_event_id;

  perform public.log_audit(
    'event.updated', 'events', p_event_id,
    jsonb_build_object('event_id', p_event_id, 'club_id', v_event.club_id)
  );
  return p_event_id;
end;
$$;

create or replace function public.publish_event(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_club_id uuid;
begin
  select club_id into v_club_id from public.events where event_id = p_event_id;
  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
  perform public.assert_event_manager(v_club_id);
  select * into v_event from public.events where event_id = p_event_id for update;
  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
  perform public.assert_event_manager(v_event.club_id);
  if v_event.status not in ('DRAFT', 'POSTPONED') then
    raise exception 'Only draft or postponed events can be published.' using errcode = '22023';
  end if;
  perform public.validate_event_fields(
    v_event.title, v_event.venue, v_event.start_time, v_event.end_time,
    v_event.registration_deadline, v_event.capacity
  );

  update public.events
  set status = 'PUBLISHED', published_at = coalesce(published_at, now())
  where event_id = p_event_id;
  perform public.log_audit(
    'event.published', 'events', p_event_id,
    jsonb_build_object('event_id', p_event_id, 'club_id', v_event.club_id)
  );
  perform public.send_notification_bulk(
    array(select s.student_id from public.get_active_student_ids() as s(student_id)),
    'event_published',
    'Event published',
    format('A new event is available: %s', v_event.title),
    p_event_id
  );
  return p_event_id;
end;
$$;

create or replace function public.postpone_event(
  p_event_id uuid,
  p_start_time timestamptz default null,
  p_end_time timestamptz default null,
  p_registration_deadline timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_club_id uuid;
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_deadline timestamptz;
  v_recipient_ids uuid[];
begin
  select club_id into v_club_id from public.events where event_id = p_event_id;
  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
  perform public.assert_event_manager(v_club_id);
  select * into v_event from public.events where event_id = p_event_id for update;
  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
  perform public.assert_event_manager(v_event.club_id);
  if v_event.status <> 'PUBLISHED' then
    raise exception 'Only published events can be postponed.' using errcode = '22023';
  end if;
  if num_nonnulls(p_start_time, p_end_time, p_registration_deadline) not in (0, 3) then
    raise exception 'Provide all three replacement event times or none.' using errcode = '22023';
  end if;

  v_start_time := coalesce(p_start_time, v_event.start_time);
  v_end_time := coalesce(p_end_time, v_event.end_time);
  v_deadline := coalesce(p_registration_deadline, v_event.registration_deadline);
  perform public.validate_event_fields(
    v_event.title, v_event.venue, v_start_time, v_end_time, v_deadline, v_event.capacity
  );

  update public.events
  set status = 'POSTPONED', start_time = v_start_time, end_time = v_end_time,
      registration_deadline = v_deadline
  where event_id = p_event_id;
  perform public.log_audit(
    'event.postponed', 'events', p_event_id,
    jsonb_build_object('event_id', p_event_id, 'club_id', v_event.club_id)
  );
  select coalesce(array_agg(er.student_id), array[]::uuid[])
  into v_recipient_ids
  from public.event_registrations er
  join public.profiles p on p.id = er.student_id and p.is_active
  where er.event_id = p_event_id and er.status = 'REGISTERED';
  perform public.send_notification_bulk(
    v_recipient_ids,
    'event_postponed',
    'Event postponed',
    format('The event "%s" has been postponed.', v_event.title),
    p_event_id
  );
  return p_event_id;
end;
$$;

create or replace function public.cancel_event(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_club_id uuid;
  v_recipient_ids uuid[];
begin
  select club_id into v_club_id from public.events where event_id = p_event_id;
  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
  perform public.assert_event_manager(v_club_id);
  select * into v_event from public.events where event_id = p_event_id for update;
  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
  perform public.assert_event_manager(v_event.club_id);
  if v_event.status not in ('PUBLISHED', 'POSTPONED') then
    raise exception 'Only published or postponed events can be cancelled.'
      using errcode = '22023';
  end if;

  update public.events set status = 'CANCELLED' where event_id = p_event_id;
  perform public.log_audit(
    'event.cancelled', 'events', p_event_id,
    jsonb_build_object('event_id', p_event_id, 'club_id', v_event.club_id)
  );
  select coalesce(array_agg(er.student_id), array[]::uuid[])
  into v_recipient_ids
  from public.event_registrations er
  join public.profiles p on p.id = er.student_id and p.is_active
  where er.event_id = p_event_id and er.status = 'REGISTERED';
  perform public.send_notification_bulk(
    v_recipient_ids,
    'event_cancelled',
    'Event cancelled',
    format('The event "%s" has been cancelled.', v_event.title),
    p_event_id
  );
  return p_event_id;
end;
$$;

-- Tighten read policies to exclude inactive profiles and deactivated clubs.
drop policy if exists events_select_published_or_manager on public.events;
create policy events_select_published_or_manager on public.events
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.clubs c on c.id = events.club_id and c.is_active
      where p.id = auth.uid() and p.is_active
        and (events.status = 'PUBLISHED'
          or public.has_permission('events.manage', events.club_id))
    )
  );

drop policy if exists event_registrations_select_own_or_manager on public.event_registrations;
create policy event_registrations_select_own_or_manager on public.event_registrations
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.events e on e.event_id = event_registrations.event_id
      join public.clubs c on c.id = e.club_id and c.is_active
      where p.id = auth.uid() and p.is_active
        and (event_registrations.student_id = auth.uid()
          or public.has_permission('events.manage', e.club_id))
    )
  );

revoke all on function public.assert_event_manager(uuid) from public, anon, authenticated;
revoke all on function public.validate_event_fields(text, text, timestamptz, timestamptz, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.create_event(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.list_managed_events(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.get_managed_event(uuid) from public, anon, authenticated;
revoke all on function public.update_event(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.publish_event(uuid) from public, anon, authenticated;
revoke all on function public.postpone_event(uuid, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.cancel_event(uuid) from public, anon, authenticated;

grant execute on function public.create_event(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, integer)
  to authenticated;
grant execute on function public.list_managed_events(uuid, integer, integer) to authenticated;
grant execute on function public.get_managed_event(uuid) to authenticated;
grant execute on function public.update_event(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, integer)
  to authenticated;
grant execute on function public.publish_event(uuid) to authenticated;
grant execute on function public.postpone_event(uuid, timestamptz, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.cancel_event(uuid) to authenticated;


