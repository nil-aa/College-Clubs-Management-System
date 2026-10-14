-- Correct the internal Club Head assignment notification message.
-- The earlier RPC passes club_id in metadata; use that club's name instead
-- of the affected user's profile name.

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
  v_club_name text;
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

  if p_type = 'club_head.assigned'
     and (v_metadata ->> 'club_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select name into v_club_name
    from public.clubs
    where id = (v_metadata ->> 'club_id')::uuid;
    if v_club_name is not null then
      v_message := format('You are now a club head for %s.', v_club_name);
    end if;
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

-- Repair existing internal assignment notices where the club id is available.
update public.notifications n
set message = format('You are now a club head for %s.', c.name)
from public.clubs c
where n.type = 'club_head.assigned'
  and (n.metadata ->> 'club_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and c.id = (n.metadata ->> 'club_id')::uuid;
