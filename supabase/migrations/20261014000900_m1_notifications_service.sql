-- Member 1 notification service and user-facing read-state RPCs.
-- events does not exist yet, so related_event_id remains an unconstrained uuid.

create or replace function public.send_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_related_event_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_message text := trim(coalesce(p_message, ''));
begin
  if p_type is null or p_type not in (
    'event_published',
    'registration_confirmed',
    'registration_cancelled',
    'event_postponed',
    'event_cancelled'
  ) then
    raise exception 'Unsupported notification type.' using errcode = '22023';
  end if;
  if v_title = '' then
    raise exception 'Notification title is required.' using errcode = '22023';
  end if;
  if v_message = '' then
    raise exception 'Notification message is required.' using errcode = '22023';
  end if;

  insert into public.notifications(user_id, type, title, message, related_event_id, channels, metadata, is_read)
  values (
    p_user_id, p_type, v_title, v_message, p_related_event_id,
    array['in_app']::text[], '{}'::jsonb, false
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.send_notification_bulk(
  p_user_ids uuid[],
  p_type text,
  p_title text,
  p_message text,
  p_related_event_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := trim(coalesce(p_title, ''));
  v_message text := trim(coalesce(p_message, ''));
  v_count integer;
begin
  if p_type is null or p_type not in (
    'event_published',
    'registration_confirmed',
    'registration_cancelled',
    'event_postponed',
    'event_cancelled'
  ) then
    raise exception 'Unsupported notification type.' using errcode = '22023';
  end if;
  if v_title = '' then
    raise exception 'Notification title is required.' using errcode = '22023';
  end if;
  if v_message = '' then
    raise exception 'Notification message is required.' using errcode = '22023';
  end if;

  insert into public.notifications(user_id, type, title, message, related_event_id, channels, metadata, is_read)
  select distinct recipient_id, p_type, v_title, v_message, p_related_event_id,
         array['in_app']::text[], '{}'::jsonb, false
  from unnest(coalesce(p_user_ids, array[]::uuid[])) as recipients(recipient_id)
  where recipient_id is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.get_active_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  join public.roles r on r.id = ur.role_id
  where r.code = 'student'
    and ur.club_id is null
    and ur.status = 'active'
    and ur.is_active
    and p.is_active;
$$;

create or replace function public.mark_notification_read(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set is_read = true
  where id = p_id
    and user_id = auth.uid()
    and not is_read;
  return found;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.notifications
  set is_read = true
  where user_id = auth.uid()
    and not is_read;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Compatibility overload used only by the earlier RBAC assignment RPCs. It is
-- not part of the teammate-facing contract and is not executable by clients.
create or replace function public.send_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_channels text[],
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_message text := trim(coalesce(p_message, ''));
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_related_event_id uuid;
begin
  if p_type is null or p_type not in (
    'event_published', 'registration_confirmed', 'registration_cancelled',
    'event_postponed', 'event_cancelled', 'club_head.assigned',
    'club_head.revoked', 'user_role.changed'
  ) then
    raise exception 'Unsupported notification type.' using errcode = '22023';
  end if;
  if v_title = '' then
    raise exception 'Notification title is required.' using errcode = '22023';
  end if;
  if v_message = '' then
    raise exception 'Notification message is required.' using errcode = '22023';
  end if;
  if v_metadata ? 'event_id' then
    v_related_event_id := (v_metadata ->> 'event_id')::uuid;
  end if;
  insert into public.notifications(
    user_id, type, title, message, related_event_id, channels, metadata, is_read
  ) values (
    p_user_id, p_type, v_title, v_message, v_related_event_id,
    coalesce(p_channels, array['in_app']::text[]), v_metadata, false
  ) returning id into v_id;
  return v_id;
end;
$$;

-- Only trusted SECURITY DEFINER RPCs and the server-side service role may call
-- the notification service. SECURITY DEFINER callers run these functions as
-- their owner, so Member 2's SECURITY DEFINER event/registration RPCs can call
-- them without exposing execute access to browser sessions.
revoke all on function public.send_notification(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.send_notification_bulk(uuid[], text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.get_active_student_ids() from public, anon, authenticated;
revoke all on function public.send_notification(uuid, text, text, text, text[], jsonb) from public, anon, authenticated;
grant execute on function public.send_notification(uuid, text, text, text, uuid) to service_role;
grant execute on function public.send_notification_bulk(uuid[], text, text, text, uuid) to service_role;
grant execute on function public.get_active_student_ids() to service_role;
grant execute on function public.send_notification(uuid, text, text, text, text[], jsonb) to service_role;

revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;

drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_no_direct_update on public.notifications;
create policy notifications_no_direct_update on public.notifications
  for update to authenticated
  using (false)
  with check (false);

revoke update on public.notifications from anon, authenticated;
