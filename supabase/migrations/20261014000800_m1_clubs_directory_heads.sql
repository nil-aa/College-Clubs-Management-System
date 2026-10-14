-- Safe, minimal club-head read contract for the public club directory.

drop policy if exists clubs_select_active_or_admin on public.clubs;
create policy clubs_select_active_or_admin on public.clubs
  for select to authenticated
  using (
    is_active
    or public.has_role('admin')
    or public.has_role('club_head', id)
  );

create or replace function public.get_club_heads(p_club_id uuid)
returns table(id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.user_id
  where ur.club_id = p_club_id
    and r.code = 'club_head'
    and ur.status = 'active'
    and ur.is_active
    and p.is_active;
$$;

revoke all on function public.get_club_heads(uuid) from public, anon, authenticated;
grant execute on function public.get_club_heads(uuid) to authenticated;

-- The existing assignment RPCs send these internal notifications. Keep those
-- notifications durable instead of silently dropping them after the reduced
-- event-only notification contract was introduced.
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'event_published',
    'registration_confirmed',
    'registration_cancelled',
    'event_postponed',
    'event_cancelled',
    'club_head.assigned',
    'club_head.revoked',
    'user_role.changed'
  )) not valid;

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
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_related_event_id uuid;
begin
  if p_type is null or p_type not in (
    'event_published', 'registration_confirmed', 'registration_cancelled',
    'event_postponed', 'event_cancelled', 'club_head.assigned',
    'club_head.revoked', 'user_role.changed'
  ) then
    return null;
  end if;
  if v_metadata ? 'event_id' then
    v_related_event_id := (v_metadata ->> 'event_id')::uuid;
  end if;
  insert into public.notifications(
    user_id, type, title, message, related_event_id, channels, metadata, is_read
  ) values (
    p_user_id, p_type, p_title, p_message, v_related_event_id,
    coalesce(p_channels, array['in_app']::text[]), v_metadata, false
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.send_notification(uuid, text, text, text, text[], jsonb)
  from public, anon, authenticated;
grant execute on function public.send_notification(uuid, text, text, text, text[], jsonb)
  to authenticated;

