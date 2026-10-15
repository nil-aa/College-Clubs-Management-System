-- Return only the participant details needed by the event operations screen.
-- Profile and registration data stays behind the club-scoped manager check.
create or replace function public.list_event_participants(p_event_id uuid)
returns table (
  registration_id uuid,
  student_id uuid,
  full_name text,
  department text,
  roll_number text,
  registration_status text,
  registered_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select e.club_id into v_club_id
  from public.events e
  where e.event_id = p_event_id;

  if v_club_id is null then
    raise exception 'Event not found.' using errcode = '22023';
  end if;

  perform public.assert_event_manager(v_club_id);

  return query
  select
    er.registration_id,
    er.student_id,
    p.full_name,
    p.department,
    p.roll_number,
    er.status,
    er.registered_at
  from public.event_registrations er
  join public.profiles p on p.id = er.student_id
  where er.event_id = p_event_id
  order by
    case when er.status = 'REGISTERED' then 0 else 1 end,
    lower(p.full_name),
    er.registered_at desc;
end;
$$;

revoke all on function public.list_event_participants(uuid) from public, anon, authenticated;
grant execute on function public.list_event_participants(uuid) to authenticated;

comment on function public.list_event_participants(uuid) is
  'Lists event registration status and participant academic details for authorized event managers.';
