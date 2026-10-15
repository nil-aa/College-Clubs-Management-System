create or replace function public.list_attendance_dashboard(
  p_club_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  event_id uuid,
  club_id uuid,
  club_name text,
  event_title text,
  starts_at timestamptz,
  event_status text,
  registered_count bigint,
  present_count bigint,
  absent_count bigint,
  excused_count bigint,
  unmarked_count bigint,
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
  if p_limit is null or p_limit < 1 or p_limit > 500
      or p_offset is null or p_offset < 0 then
    raise exception 'Limit must be between 1 and 500 and offset cannot be negative.'
      using errcode = '22023';
  end if;
  if p_club_id is not null and not public.has_permission('events.manage', p_club_id) then
    raise exception 'Not authorized to view attendance for this club.' using errcode = '42501';
  end if;

  return query
  select
    e.event_id,
    e.club_id,
    c.name::text,
    e.title::text,
    e.start_time,
    e.status,
    coalesce(attendance_counts.registered_count, 0),
    coalesce(attendance_counts.present_count, 0),
    coalesce(attendance_counts.absent_count, 0),
    coalesce(attendance_counts.excused_count, 0),
    coalesce(attendance_counts.unmarked_count, 0),
    coalesce(s.status = 'FINALIZED', false)
  from public.events e
  join public.clubs c on c.id = e.club_id
  left join public.event_attendance_sessions s on s.event_id = e.event_id
  left join lateral (
    select
      count(*) filter (where er.status = 'REGISTERED') as registered_count,
      count(*) filter (where er.status = 'REGISTERED' and ea.status = 'PRESENT') as present_count,
      count(*) filter (where er.status = 'REGISTERED' and ea.status = 'ABSENT') as absent_count,
      count(*) filter (where er.status = 'REGISTERED' and ea.status = 'EXCUSED') as excused_count,
      count(*) filter (where er.status = 'REGISTERED' and ea.id is null) as unmarked_count
    from public.event_registrations er
    left join public.event_attendance ea
      on ea.event_id = er.event_id and ea.student_id = er.student_id
    where er.event_id = e.event_id
  ) attendance_counts on true
  where (p_club_id is null or e.club_id = p_club_id)
    and public.has_permission('events.manage', e.club_id)
  order by e.start_time desc, e.event_id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.list_attendance_dashboard(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.list_attendance_dashboard(uuid, integer, integer)
  to authenticated;

comment on function public.list_attendance_dashboard(uuid, integer, integer) is
  'Returns cross-event attendance counts only for clubs the caller is authorized to manage.';
