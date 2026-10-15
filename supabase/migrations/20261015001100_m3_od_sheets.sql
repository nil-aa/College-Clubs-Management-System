create table public.od_sheets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(event_id) on delete restrict,
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null check (length(trim(title)) >= 2),
  student_fields text[] not null,
  event_fields text[] not null default array[]::text[],
  event_data jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index od_sheets_club_created_idx on public.od_sheets(club_id, created_at desc);
create index od_sheets_event_created_idx on public.od_sheets(event_id, created_at desc);

create table public.od_sheet_students (
  id uuid primary key default gen_random_uuid(),
  od_sheet_id uuid not null references public.od_sheets(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete restrict,
  attendance_status public.attendance_status not null default 'PRESENT'
    check (attendance_status = 'PRESENT'),
  student_data jsonb not null,
  created_at timestamptz not null default now(),
  constraint od_sheet_students_sheet_student_key unique (od_sheet_id, student_id)
);

create index od_sheet_students_student_created_idx
  on public.od_sheet_students(student_id, created_at desc);

create or replace function public.generate_od_sheet(
  p_event_id uuid,
  p_title text,
  p_student_fields text[],
  p_event_fields text[] default array[]::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_session public.event_attendance_sessions;
  v_sheet_id uuid;
  v_event_data jsonb;
  v_event_snapshot jsonb := '{}'::jsonb;
  v_profile_data jsonb;
  v_student_data jsonb;
  v_field text;
  v_student_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_title is null or length(trim(p_title)) < 2 then
    raise exception 'OD sheet title must contain at least two characters.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_student_fields), 0) = 0 then
    raise exception 'Select at least one student detail.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_student_fields) as fields(field_name)
    where field_name is null
      or field_name not in ('full_name', 'roll_number', 'department', 'year_of_study', 'email', 'phone')
  ) then
    raise exception 'Unsupported student detail field.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_event_fields, array[]::text[])) as fields(field_name)
    where field_name is null
      or field_name not in ('title', 'club_name', 'venue', 'category', 'start_time', 'end_time', 'registration_deadline', 'description')
  ) then
    raise exception 'Unsupported event detail field.' using errcode = '22023';
  end if;

  select * into v_session
  from public.event_attendance_sessions s
  where s.event_id = p_event_id;
  if not found then
    raise exception 'Attendance has not been recorded for this event.' using errcode = '22023';
  end if;
  if v_session.status <> 'FINALIZED' then
    raise exception 'OD sheets can only use finalized attendance.' using errcode = '55000';
  end if;

  v_club_id := v_session.club_id;
  perform public.assert_event_manager(v_club_id);

  select to_jsonb(e) || jsonb_build_object('club_name', c.name)
  into v_event_data
  from public.events e
  join public.clubs c on c.id = e.club_id
  where e.event_id = p_event_id;
  if v_event_data is null then
    raise exception 'Event not found.' using errcode = '22023';
  end if;

  foreach v_field in array coalesce(p_event_fields, array[]::text[]) loop
    v_event_snapshot := v_event_snapshot || jsonb_build_object(v_field, v_event_data -> v_field);
  end loop;

  insert into public.od_sheets(
    event_id, club_id, title, student_fields, event_fields, event_data, created_by
  )
  values (
    p_event_id, v_club_id, trim(p_title), p_student_fields,
    coalesce(p_event_fields, array[]::text[]), v_event_snapshot, auth.uid()
  )
  returning id into v_sheet_id;

  for v_student_id in
    select ea.student_id
    from public.event_attendance ea
    where ea.event_id = p_event_id and ea.status = 'PRESENT'
    order by ea.student_id
  loop
    select to_jsonb(p) into v_profile_data
    from public.profiles p
    where p.id = v_student_id;

    v_student_data := jsonb_build_object('attendance_status', 'PRESENT');
    foreach v_field in array p_student_fields loop
      v_student_data := v_student_data || jsonb_build_object(v_field, v_profile_data -> v_field);
    end loop;

    insert into public.od_sheet_students(od_sheet_id, student_id, student_data)
    values (v_sheet_id, v_student_id, v_student_data);
  end loop;

  perform public.log_audit(
    'od_sheet.generated',
    'od_sheet',
    v_sheet_id,
    jsonb_build_object('event_id', p_event_id, 'session_id', v_session.id)
  );
  return v_sheet_id;
end;
$$;

alter table public.od_sheets enable row level security;
alter table public.od_sheet_students enable row level security;

revoke all on public.od_sheets, public.od_sheet_students from anon, authenticated;
grant select on public.od_sheets, public.od_sheet_students to authenticated;

create policy od_sheets_event_manager_select
  on public.od_sheets
  for select to authenticated
  using (public.has_permission('events.manage', club_id));

create policy od_sheet_students_event_manager_select
  on public.od_sheet_students
  for select to authenticated
  using (
    exists (
      select 1 from public.od_sheets s
      where s.id = od_sheet_students.od_sheet_id
        and public.has_permission('events.manage', s.club_id)
    )
  );

revoke all on function public.generate_od_sheet(uuid, text, text[], text[])
  from public, anon, authenticated;
grant execute on function public.generate_od_sheet(uuid, text, text[], text[])
  to authenticated;

comment on table public.od_sheet_students is
  'Immutable student and finalized present-attendance snapshot for an OD sheet.';
