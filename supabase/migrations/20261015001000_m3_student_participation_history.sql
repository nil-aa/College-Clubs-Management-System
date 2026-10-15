create or replace function public.list_my_event_participation()
returns table (
  registration_id uuid,
  event_id uuid,
  event_title text,
  club_name text,
  venue text,
  starts_at timestamptz,
  registration_status text,
  attendance_status public.attendance_status,
  attendance_finalized boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
  ) then
    raise exception 'An active authenticated profile is required.' using errcode = '42501';
  end if;

  return query
  select
    er.registration_id,
    e.event_id,
    e.title::text,
    c.name::text,
    e.venue::text,
    e.start_time,
    er.status,
    ea.status,
    coalesce(s.status = 'FINALIZED', false)
  from public.event_registrations er
  join public.events e on e.event_id = er.event_id
  join public.clubs c on c.id = e.club_id
  left join public.event_attendance ea
    on ea.event_id = er.event_id and ea.student_id = er.student_id
  left join public.event_attendance_sessions s on s.event_id = er.event_id
  where er.student_id = auth.uid()
  order by e.start_time desc, er.registered_at desc;
end;
$$;

revoke all on function public.list_my_event_participation() from public, anon, authenticated;
grant execute on function public.list_my_event_participation() to authenticated;

comment on function public.list_my_event_participation() is
  'Lists the authenticated student’s event registrations and attendance history.';
