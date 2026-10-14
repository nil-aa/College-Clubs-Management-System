-- Student registration workflows. Every registration mutation takes the event
-- row lock before reading registration state, serializing capacity decisions,
-- cancellations, reactivations, and event capacity updates.

create or replace function public.assert_active_event_student()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
begin
  if v_student_id is null
      or not exists (
        select 1 from public.profiles p
        where p.id = v_student_id and p.is_active
      )
      or not public.has_role('student') then
    raise exception 'Only active students can use event registration.'
      using errcode = '42501';
  end if;
  return v_student_id;
end;
$$;

create or replace function public.register_for_event(p_event_id uuid)
returns table (
  registration_id uuid,
  event_id uuid,
  status text,
  registered_at timestamptz,
  registration_count bigint,
  capacity integer,
  registration_availability text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
  v_has_registration boolean;
  v_registration_count bigint;
begin
  v_student_id := public.assert_active_event_student();

  select e.* into v_event
  from public.events e
  join public.clubs c on c.id = e.club_id and c.is_active
  where e.event_id = p_event_id
  for update of e;
  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;

  if v_event.status <> 'PUBLISHED' or v_event.published_at is null then
    raise exception 'Event is not currently accepting registrations.'
      using errcode = '22023';
  end if;
  if v_event.registration_deadline <= statement_timestamp()
      or v_event.start_time <= statement_timestamp() then
    raise exception 'The registration deadline has passed.' using errcode = '22023';
  end if;

  select er.* into v_registration
  from public.event_registrations er
  where er.event_id = p_event_id and er.student_id = v_student_id
  for update;
  v_has_registration := found;
  if v_has_registration and v_registration.status = 'REGISTERED' then
    raise exception 'You are already registered for this event.' using errcode = '23505';
  end if;

  select count(*) into v_registration_count
  from public.event_registrations er
  where er.event_id = p_event_id and er.status = 'REGISTERED';
  if v_registration_count >= v_event.capacity then
    raise exception 'Event is at capacity.' using errcode = '23514';
  end if;

  if v_has_registration then
    update public.event_registrations er
    set status = 'REGISTERED', registered_at = statement_timestamp()
    where er.registration_id = v_registration.registration_id
    returning er.* into v_registration;
  else
    insert into public.event_registrations (event_id, student_id)
    values (p_event_id, v_student_id)
    returning * into v_registration;
  end if;

  select count(*) into v_registration_count
  from public.event_registrations er
  where er.event_id = p_event_id and er.status = 'REGISTERED';

  perform public.log_audit(
    case when v_has_registration then 'event.registration.reactivated'
         else 'event.registration.created' end,
    'event_registrations',
    v_registration.registration_id,
    jsonb_build_object('event_id', p_event_id, 'student_id', v_student_id)
  );

  return query select
    v_registration.registration_id,
    p_event_id,
    v_registration.status,
    v_registration.registered_at,
    v_registration_count,
    v_event.capacity,
    case when v_registration_count >= v_event.capacity then 'FULL' else 'AVAILABLE' end;
end;
$$;

create or replace function public.cancel_event_registration(p_event_id uuid)
returns table (
  registration_id uuid,
  event_id uuid,
  status text,
  registered_at timestamptz,
  registration_count bigint,
  capacity integer,
  registration_availability text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
  v_registration_count bigint;
begin
  v_student_id := public.assert_active_event_student();

  select e.* into v_event
  from public.events e
  where e.event_id = p_event_id
  for update;
  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;

  select er.* into v_registration
  from public.event_registrations er
  where er.event_id = p_event_id and er.student_id = v_student_id
  for update;
  if not found then
    raise exception 'Registration not found.' using errcode = 'P0002';
  end if;

  if v_registration.status <> 'CANCELLED' then
    update public.event_registrations er
    set status = 'CANCELLED'
    where er.registration_id = v_registration.registration_id
    returning er.* into v_registration;

    perform public.log_audit(
      'event.registration.cancelled',
      'event_registrations',
      v_registration.registration_id,
      jsonb_build_object('event_id', p_event_id, 'student_id', v_student_id)
    );
  end if;

  select count(*) into v_registration_count
  from public.event_registrations er
  where er.event_id = p_event_id and er.status = 'REGISTERED';

  return query select
    v_registration.registration_id,
    p_event_id,
    v_registration.status,
    v_registration.registered_at,
    v_registration_count,
    v_event.capacity,
    case
      when v_event.status <> 'PUBLISHED'
          or v_event.registration_deadline <= statement_timestamp()
          or v_event.start_time <= statement_timestamp()
        then 'CLOSED'
      when v_registration_count >= v_event.capacity then 'FULL'
      else 'AVAILABLE'
    end;
end;
$$;

create or replace function public.list_my_event_registrations(
  p_upcoming_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  registration_id uuid,
  event_id uuid,
  club_id uuid,
  club_name text,
  club_is_active boolean,
  title varchar(200),
  description text,
  venue varchar(300),
  category text,
  start_time timestamptz,
  end_time timestamptz,
  registration_deadline timestamptz,
  capacity integer,
  event_status text,
  registration_status text,
  registered_at timestamptz,
  updated_at timestamptz,
  registration_count bigint,
  registration_availability text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
begin
  v_student_id := public.assert_active_event_student();
  if p_limit is null or p_limit < 1 or p_limit > 100
      or p_offset is null or p_offset < 0 then
    raise exception 'Limit must be between 1 and 100 and offset cannot be negative.'
      using errcode = '22023';
  end if;

  return query
  select
    er.registration_id,
    e.event_id,
    e.club_id,
    c.name,
    c.is_active,
    e.title,
    e.description,
    e.venue,
    e.category,
    e.start_time,
    e.end_time,
    e.registration_deadline,
    e.capacity,
    e.status,
    er.status,
    er.registered_at,
    er.updated_at,
    count(active.registration_id),
    case
      when e.status <> 'PUBLISHED'
          or e.registration_deadline <= statement_timestamp()
          or e.start_time <= statement_timestamp()
        then 'CLOSED'
      when count(active.registration_id) >= e.capacity then 'FULL'
      else 'AVAILABLE'
    end
  from public.event_registrations er
  join public.events e on e.event_id = er.event_id
  join public.clubs c on c.id = e.club_id
  left join public.event_registrations active
    on active.event_id = e.event_id and active.status = 'REGISTERED'
  where er.student_id = v_student_id
    and (
      not coalesce(p_upcoming_only, false)
      or (
        er.status = 'REGISTERED'
        and e.status in ('PUBLISHED', 'POSTPONED')
        and e.start_time > statement_timestamp()
        and c.is_active
      )
    )
  group by er.registration_id, e.event_id, c.name, c.is_active
  order by
    case when coalesce(p_upcoming_only, false) then e.start_time end asc nulls last,
    er.registered_at desc,
    er.registration_id desc
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.assert_active_event_student() from public, anon, authenticated;
revoke all on function public.register_for_event(uuid) from public, anon, authenticated;
revoke all on function public.cancel_event_registration(uuid) from public, anon, authenticated;
revoke all on function public.list_my_event_registrations(boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.register_for_event(uuid) to authenticated;
grant execute on function public.cancel_event_registration(uuid) to authenticated;
grant execute on function public.list_my_event_registrations(boolean, integer, integer)
  to authenticated;

comment on function public.register_for_event(uuid) is
  'Registers auth.uid() as an active student, serializing capacity checks on the event row and reactivating an existing cancelled registration.';
comment on function public.cancel_event_registration(uuid) is
  'Cancels the auth.uid() student registration in place, taking the event lock shared with registration.';
comment on function public.list_my_event_registrations(boolean, integer, integer) is
  'Lists the authenticated active student registration history; upcoming_only returns active registrations for future published or postponed events at active clubs.';
