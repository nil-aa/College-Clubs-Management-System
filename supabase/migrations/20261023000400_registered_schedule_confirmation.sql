-- Require managers to acknowledge schedule changes that affect active registrations.
create or replace function public.require_registered_schedule_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time
      or new.registration_deadline is distinct from old.registration_deadline)
      and exists (
        select 1 from public.event_registrations er
        where er.event_id = old.event_id and er.status = 'REGISTERED'
      )
      and current_setting('app.confirm_registered_schedule_change', true) is distinct from 'true' then
    raise exception 'This event has registered participants. Confirm the schedule change so they can be notified.'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger events_require_registered_schedule_confirmation
before update of start_time, end_time, registration_deadline on public.events
for each row execute function public.require_registered_schedule_confirmation();
revoke all on function public.require_registered_schedule_confirmation() from public, anon, authenticated;

create or replace function public.update_event_with_confirmation(
  p_event_id uuid, p_title text, p_description text, p_venue text, p_category text,
  p_start_time timestamptz, p_end_time timestamptz, p_registration_deadline timestamptz,
  p_capacity integer, p_confirm_registered_schedule_change boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_schedule_changed boolean;
  v_has_registrations boolean;
  v_recipients uuid[];
begin
  select * into v_event from public.events where event_id = p_event_id for update;
  if not found then raise exception 'Event not found.' using errcode = 'P0002'; end if;
  perform public.assert_event_manager(v_event.club_id);

  v_schedule_changed := v_event.start_time is distinct from p_start_time
    or v_event.end_time is distinct from p_end_time
    or v_event.registration_deadline is distinct from p_registration_deadline;
  select exists (
    select 1 from public.event_registrations er
    where er.event_id = p_event_id and er.status = 'REGISTERED'
  ) into v_has_registrations;
  if v_schedule_changed and v_has_registrations
      and not coalesce(p_confirm_registered_schedule_change, false) then
    raise exception 'This event has registered participants. Confirm the schedule change so they can be notified.'
      using errcode = '55000';
  end if;

  perform set_config('app.confirm_registered_schedule_change',
    case when coalesce(p_confirm_registered_schedule_change, false) then 'true' else 'false' end, true);
  perform public.update_event(p_event_id, p_title, p_description, p_venue, p_category,
    p_start_time, p_end_time, p_registration_deadline, p_capacity);
  perform set_config('app.confirm_registered_schedule_change', 'false', true);

  if v_schedule_changed and v_has_registrations then
    select coalesce(array_agg(er.student_id), array[]::uuid[]) into v_recipients
    from public.event_registrations er
    join public.profiles p on p.id = er.student_id and p.is_active
    where er.event_id = p_event_id and er.status = 'REGISTERED';
    perform public.send_notification_bulk(v_recipients, 'event_schedule_updated', 'Event schedule updated',
      format('The schedule for "%s" changed. New start: %s UTC; new end: %s UTC.',
        v_event.title,
        to_char(p_start_time at time zone 'UTC', 'YYYY-MM-DD HH24:MI'),
        to_char(p_end_time at time zone 'UTC', 'YYYY-MM-DD HH24:MI')),
      p_event_id);
  end if;
  return p_event_id;
end;
$$;

create or replace function public.postpone_event_with_confirmation(
  p_event_id uuid, p_start_time timestamptz default null, p_end_time timestamptz default null,
  p_registration_deadline timestamptz default null,
  p_confirm_registered_schedule_change boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_deadline timestamptz;
  v_changed boolean;
  v_has_registrations boolean;
  v_result uuid;
begin
  select * into v_event from public.events where event_id = p_event_id for update;
  if not found then raise exception 'Event not found.' using errcode = 'P0002'; end if;
  perform public.assert_event_manager(v_event.club_id);
  v_start_time := coalesce(p_start_time, v_event.start_time);
  v_end_time := coalesce(p_end_time, v_event.end_time);
  v_deadline := coalesce(p_registration_deadline, v_event.registration_deadline);
  v_changed := v_start_time is distinct from v_event.start_time
    or v_end_time is distinct from v_event.end_time
    or v_deadline is distinct from v_event.registration_deadline;
  select exists (
    select 1 from public.event_registrations er
    where er.event_id = p_event_id and er.status = 'REGISTERED'
  ) into v_has_registrations;
  if v_changed and v_has_registrations
      and not coalesce(p_confirm_registered_schedule_change, false) then
    raise exception 'This event has registered participants. Confirm the schedule change so they can be notified.'
      using errcode = '55000';
  end if;
  perform set_config('app.confirm_registered_schedule_change',
    case when coalesce(p_confirm_registered_schedule_change, false) then 'true' else 'false' end, true);
  v_result := public.postpone_event(p_event_id, p_start_time, p_end_time, p_registration_deadline);
  perform set_config('app.confirm_registered_schedule_change', 'false', true);
  return v_result;
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
  if not found then raise exception 'Event not found.' using errcode = 'P0002'; end if;
  perform public.assert_event_manager(v_club_id);
  select * into v_event from public.events where event_id = p_event_id for update;
  if not found then raise exception 'Event not found.' using errcode = 'P0002'; end if;
  perform public.assert_event_manager(v_event.club_id);
  if v_event.status not in ('DRAFT', 'POSTPONED') then
    raise exception 'Only draft or postponed events can be published.' using errcode = '22023';
  end if;
  if v_event.end_time <= clock_timestamp() then
    raise exception 'This event has already ended. Edit the schedule before publishing it.'
      using errcode = '22023';
  end if;
  perform public.validate_event_fields(v_event.title, v_event.venue, v_event.start_time,
    v_event.end_time, v_event.registration_deadline, v_event.capacity);
  update public.events set status = 'PUBLISHED', published_at = coalesce(published_at, now())
  where event_id = p_event_id;
  perform public.log_audit('event.published', 'events', p_event_id,
    jsonb_build_object('event_id', p_event_id, 'club_id', v_event.club_id));
  perform public.send_notification_bulk(
    array(select s.student_id from public.get_active_student_ids() as s(student_id)),
    'event_published', 'Event published', format('A new event is available: %s', v_event.title), p_event_id);
  return p_event_id;
end;
$$;

-- Use a distinct notification label for schedule edits (postponements keep their existing type).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'event_published', 'registration_confirmed', 'registration_cancelled', 'event_postponed',
  'event_cancelled', 'club_head.assigned', 'club_head.revoked', 'user_role.changed',
  'event_schedule_updated'
)) not valid;

create or replace function public.send_notification_bulk(
  p_user_ids uuid[], p_type text, p_title text, p_message text,
  p_related_event_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if p_type is null or p_type not in ('event_published', 'registration_confirmed',
      'registration_cancelled', 'event_postponed', 'event_cancelled', 'event_schedule_updated') then
    raise exception 'Unsupported notification type.' using errcode = '22023';
  end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_message), '') is null then
    raise exception 'Notification title and message are required.' using errcode = '22023';
  end if;
  insert into public.notifications(user_id, type, title, message, related_event_id, channels, metadata, is_read)
  select distinct recipient_id, p_type, trim(p_title), trim(p_message), p_related_event_id,
    array['in_app']::text[], '{}'::jsonb, false
  from unnest(coalesce(p_user_ids, array[]::uuid[])) as recipients(recipient_id)
  where recipient_id is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.update_event_with_confirmation(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, integer, boolean) from public, anon, authenticated;
revoke all on function public.postpone_event_with_confirmation(uuid, timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.update_event_with_confirmation(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, integer, boolean) to authenticated;
grant execute on function public.postpone_event_with_confirmation(uuid, timestamptz, timestamptz, timestamptz, boolean) to authenticated;
