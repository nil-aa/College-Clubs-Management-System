-- Reject newly created events that have already ended. Comparing against the
-- database clock keeps API callers from bypassing the form check. An event
-- already in progress remains valid as long as its end is still in the future.
alter table public.events drop constraint events_registration_deadline_check;
alter table public.events
  add constraint events_registration_deadline_check check (registration_deadline <= end_time);

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
  if p_registration_deadline > p_end_time then
    raise exception 'Registration deadline must be no later than event end.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.reject_ended_event_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.end_time <= clock_timestamp() then
    raise exception 'Event end time must be in the future.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger events_reject_ended_insert
before insert on public.events
for each row execute function public.reject_ended_event_insert();

create trigger events_reject_ended_schedule_change
before update of start_time, end_time on public.events
for each row
when (
  new.start_time is distinct from old.start_time
  or new.end_time is distinct from old.end_time
)
execute function public.reject_ended_event_insert();

revoke all on function public.reject_ended_event_insert() from public, anon, authenticated;

comment on function public.reject_ended_event_insert() is
  'Prevents creation or schedule changes that end in the past; permits events already in progress and metadata-only edits.';

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
  if v_event.end_time <= statement_timestamp() then
    raise exception 'This event has already ended.' using errcode = '22023';
  end if;
  if v_event.registration_deadline <= statement_timestamp() then
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

  select e.* into v_event from public.events e where e.event_id = p_event_id for update;
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
      'event.registration.cancelled', 'event_registrations', v_registration.registration_id,
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
          or v_event.end_time <= statement_timestamp()
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
          or e.end_time <= statement_timestamp()
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
        and e.end_time > statement_timestamp()
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
