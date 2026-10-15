create type public.attendance_status as enum ('PRESENT', 'ABSENT', 'EXCUSED');
create type public.attendance_session_status as enum ('OPEN', 'FINALIZED');

create table public.event_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(event_id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  status public.attendance_session_status not null default 'OPEN',
  finalized_by uuid references public.profiles(id) on delete set null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  constraint event_attendance_sessions_finalized_check
    check (
      (status = 'OPEN' and finalized_at is null)
      or (status = 'FINALIZED' and finalized_at is not null)
    )
);

create table public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(event_id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete restrict,
  status public.attendance_status not null,
  notes text,
  marked_by uuid not null references public.profiles(id) on delete restrict,
  marked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_attendance_event_student_key unique (event_id, student_id)
);

create index event_attendance_student_marked_at_idx
  on public.event_attendance(student_id, marked_at desc);
create index event_attendance_event_status_idx
  on public.event_attendance(event_id, status);

alter table public.event_attendance_sessions enable row level security;
alter table public.event_attendance enable row level security;

revoke all on public.event_attendance_sessions, public.event_attendance from anon, authenticated;
grant select on public.event_attendance_sessions, public.event_attendance to authenticated;

create policy event_attendance_sessions_manager_select
  on public.event_attendance_sessions
  for select to authenticated
  using (public.has_permission('events.manage', club_id));

create policy event_attendance_manager_or_self_select
  on public.event_attendance
  for select to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1
      from public.events e
      where e.event_id = event_attendance.event_id
        and public.has_permission('events.manage', e.club_id)
    )
  );

create or replace function public.mark_event_attendance(
  p_event_id uuid,
  p_student_id uuid,
  p_status public.attendance_status,
  p_notes text default null
)
returns public.event_attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_session public.event_attendance_sessions;
  v_attendance public.event_attendance;
  v_registration_status text;
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

  insert into public.event_attendance_sessions(event_id, club_id)
  values (p_event_id, v_club_id)
  on conflict (event_id) do nothing;

  select * into v_session
  from public.event_attendance_sessions s
  where s.event_id = p_event_id
  for update;

  if v_session.status = 'FINALIZED' then
    raise exception 'Finalized attendance cannot be changed.' using errcode = '55000';
  end if;

  select er.status into v_registration_status
  from public.event_registrations er
  where er.event_id = p_event_id
    and er.student_id = p_student_id
  for update;

  if v_registration_status is distinct from 'REGISTERED' then
    raise exception 'Attendance can only be marked for a currently registered participant.'
      using errcode = '22023';
  end if;

  insert into public.event_attendance(event_id, student_id, status, notes, marked_by)
  values (p_event_id, p_student_id, p_status, nullif(trim(p_notes), ''), auth.uid())
  on conflict (event_id, student_id) do update
    set status = excluded.status,
        notes = excluded.notes,
        marked_by = excluded.marked_by,
        marked_at = now(),
        updated_at = now()
  returning * into v_attendance;

  perform public.log_audit(
    'attendance.marked',
    'event_attendance',
    v_attendance.id,
    jsonb_build_object(
      'event_id', p_event_id,
      'student_id', p_student_id,
      'status', p_status
    )
  );

  return v_attendance;
end;
$$;

create or replace function public.finalize_event_attendance(p_event_id uuid)
returns public.event_attendance_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_session public.event_attendance_sessions;
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

  insert into public.event_attendance_sessions(event_id, club_id)
  values (p_event_id, v_club_id)
  on conflict (event_id) do nothing;

  select * into v_session
  from public.event_attendance_sessions s
  where s.event_id = p_event_id
  for update;

  if v_session.status = 'FINALIZED' then
    raise exception 'Attendance is already finalized.' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.event_registrations er
    where er.event_id = p_event_id
      and er.status = 'REGISTERED'
      and not exists (
        select 1
        from public.event_attendance ea
        where ea.event_id = er.event_id
          and ea.student_id = er.student_id
      )
  ) then
    raise exception 'Mark attendance for every registered participant before finalizing.'
      using errcode = '22023';
  end if;

  update public.event_attendance_sessions
  set status = 'FINALIZED',
      finalized_by = auth.uid(),
      finalized_at = now()
  where id = v_session.id
  returning * into v_session;

  perform public.log_audit(
    'attendance.finalized',
    'event_attendance_session',
    v_session.id,
    jsonb_build_object('event_id', p_event_id)
  );

  return v_session;
end;
$$;

revoke all on function public.mark_event_attendance(uuid, uuid, public.attendance_status, text)
  from public, anon, authenticated;
revoke all on function public.finalize_event_attendance(uuid)
  from public, anon, authenticated;
grant execute on function public.mark_event_attendance(uuid, uuid, public.attendance_status, text)
  to authenticated;
grant execute on function public.finalize_event_attendance(uuid)
  to authenticated;

comment on table public.event_attendance is
  'One guarded attendance record per event and currently registered student.';
comment on table public.event_attendance_sessions is
  'Event-level attendance finalization lock.';
