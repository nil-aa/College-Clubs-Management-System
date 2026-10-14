-- Student event discovery. Events are visible after first publication and
-- remain discoverable when postponed, cancelled, or completed so students
-- can see their current status. Only PUBLISHED events can accept registrations.

drop policy if exists events_select_published_or_manager on public.events;
create policy events_select_published_or_manager on public.events
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      join public.clubs c on c.id = events.club_id and c.is_active
      where p.id = auth.uid() and p.is_active
        and (
          (
            events.published_at is not null
            and events.status in ('PUBLISHED', 'POSTPONED', 'CANCELLED', 'COMPLETED')
          )
          or public.has_permission('events.manage', events.club_id)
        )
    )
  );

create or replace function public.list_student_events(
  p_search text default null,
  p_club_id uuid default null,
  p_category text default null,
  p_start_from timestamptz default null,
  p_start_to timestamptz default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  event_id uuid,
  club_id uuid,
  club_name text,
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
  registration_count bigint,
  registration_availability text
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

  if p_limit is null or p_limit < 1 or p_limit > 100
      or p_offset is null or p_offset < 0 then
    raise exception 'Limit must be between 1 and 100 and offset cannot be negative.'
      using errcode = '22023';
  end if;
  if p_search is not null and char_length(trim(p_search)) > 200 then
    raise exception 'Search text must be 200 characters or fewer.' using errcode = '22023';
  end if;
  if p_start_from is not null and p_start_to is not null
      and p_start_to <= p_start_from then
    raise exception 'The end of the date range must be later than its start.'
      using errcode = '22023';
  end if;

  return query
  select
    e.event_id,
    e.club_id,
    c.name,
    e.title,
    e.description,
    e.venue,
    e.category,
    e.start_time,
    e.end_time,
    e.registration_deadline,
    e.capacity,
    e.status,
    e.published_at,
    count(er.registration_id) filter (where er.status = 'REGISTERED'),
    case
      when e.status <> 'PUBLISHED' or e.registration_deadline <= statement_timestamp()
        then 'CLOSED'
      when count(er.registration_id) filter (where er.status = 'REGISTERED') >= e.capacity
        then 'FULL'
      else 'AVAILABLE'
    end
  from public.events e
  join public.clubs c on c.id = e.club_id and c.is_active
  left join public.event_registrations er on er.event_id = e.event_id
  where e.published_at is not null
    and e.status in ('PUBLISHED', 'POSTPONED', 'CANCELLED', 'COMPLETED')
    and (p_club_id is null or e.club_id = p_club_id)
    and (nullif(trim(p_category), '') is null
      or lower(e.category) = lower(trim(p_category)))
    and (nullif(trim(p_search), '') is null
      or e.title ilike '%' || trim(p_search) || '%'
      or coalesce(e.description, '') ilike '%' || trim(p_search) || '%')
    and (p_start_from is null or e.start_time >= p_start_from)
    and (p_start_to is null or e.start_time < p_start_to)
  group by e.event_id, c.name
  order by e.start_time asc, e.event_id asc
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.get_student_event(p_event_id uuid)
returns table (
  event_id uuid,
  club_id uuid,
  club_name text,
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
  registration_count bigint,
  registration_availability text
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

  return query
  select
    e.event_id,
    e.club_id,
    c.name,
    e.title,
    e.description,
    e.venue,
    e.category,
    e.start_time,
    e.end_time,
    e.registration_deadline,
    e.capacity,
    e.status,
    e.published_at,
    count(er.registration_id) filter (where er.status = 'REGISTERED'),
    case
      when e.status <> 'PUBLISHED' or e.registration_deadline <= statement_timestamp()
        then 'CLOSED'
      when count(er.registration_id) filter (where er.status = 'REGISTERED') >= e.capacity
        then 'FULL'
      else 'AVAILABLE'
    end
  from public.events e
  join public.clubs c on c.id = e.club_id and c.is_active
  left join public.event_registrations er on er.event_id = e.event_id
  where e.event_id = p_event_id
    and e.published_at is not null
    and e.status in ('PUBLISHED', 'POSTPONED', 'CANCELLED', 'COMPLETED')
  group by e.event_id, c.name;

  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.list_student_events(text, uuid, text, timestamptz, timestamptz, integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_student_event(uuid) from public, anon, authenticated;
grant execute on function public.list_student_events(text, uuid, text, timestamptz, timestamptz, integer, integer)
  to authenticated;
grant execute on function public.get_student_event(uuid) to authenticated;

comment on function public.list_student_events(text, uuid, text, timestamptz, timestamptz, integer, integer) is
  'Lists published events and their later postponed, cancelled, or completed states. Drafts and events from inactive clubs are hidden. Date filters apply to start_time.';
comment on function public.get_student_event(uuid) is
  'Returns details only for events that have been published and belong to an active club; drafts and hidden events return not found.';
