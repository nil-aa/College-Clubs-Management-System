-- Club Heads can participate in events as themselves, including events owned
-- by other clubs. Management permissions remain separately club-scoped.
create or replace function public.assert_active_event_student()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_is_club_head boolean;
begin
  if v_student_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_student_id and p.is_active
  ) then
    raise exception 'Only active students or club heads can use event registration.'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.clubs c on c.id = ur.club_id and c.is_active
    where ur.user_id = v_student_id
      and ur.status = 'active'
      and ur.club_id is not null
      and r.code = 'club_head'
  ) into v_is_club_head;

  if not public.has_role('student') and not v_is_club_head then
    raise exception 'Only active students or club heads can use event registration.'
      using errcode = '42501';
  end if;
  return v_student_id;
end;
$$;

revoke all on function public.assert_active_event_student() from public, anon, authenticated;
comment on function public.assert_active_event_student() is
  'Returns auth.uid() for an active student or active club head; internal registration guard only.';
