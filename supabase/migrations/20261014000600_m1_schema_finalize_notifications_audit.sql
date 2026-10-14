-- Finalize Member 1 notifications and append-only audit log contracts.

alter table public.notifications
  add column if not exists related_event_id uuid,
  add column if not exists is_read boolean not null default false;

update public.notifications
set is_read = (status = 'read');

comment on column public.notifications.related_event_id is
  'Intentionally an unvalidated uuid until the events module adds its table.';

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'event_published',
    'registration_confirmed',
    'registration_cancelled',
    'event_postponed',
    'event_cancelled'
  )) not valid;

create index if not exists notifications_user_read_created_idx
  on public.notifications(user_id, is_read, created_at desc);

create or replace function public.sync_notification_read_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'read' then
    new.is_read = true;
  end if;

  if new.is_read then
    new.status = 'read';
    new.read_at = coalesce(new.read_at, now());
  else
    new.status = 'unread';
    new.read_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_sync_read_state on public.notifications;
create trigger notifications_sync_read_state
  before insert or update on public.notifications
  for each row execute function public.sync_notification_read_state();

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
  -- Role-management notifications from the earlier scaffold used types that
  -- are outside the reduced event-notification contract. They are ignored;
  -- event notifications are persisted and returned normally.
  if p_type is null or p_type not in (
    'event_published',
    'registration_confirmed',
    'registration_cancelled',
    'event_postponed',
    'event_cancelled'
  ) then
    return null;
  end if;

  if v_metadata ? 'event_id' then
    v_related_event_id := (v_metadata ->> 'event_id')::uuid;
  end if;

  insert into public.notifications(
    user_id,
    type,
    title,
    message,
    related_event_id,
    channels,
    metadata,
    is_read
  )
  values (
    p_user_id,
    p_type,
    p_title,
    p_message,
    v_related_event_id,
    coalesce(p_channels, array['in_app']::text[]),
    v_metadata,
    false
  )
  returning id into v_id;
  return v_id;
end;
$$;

alter table public.audit_logs
  rename column actor_user_id to actor;

alter table public.audit_logs
  rename column metadata to details;

create or replace function public.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.audit_logs(actor, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Audit logs are append-only.' using errcode = '42501';
end;
$$;

drop trigger if exists audit_logs_prevent_update on public.audit_logs;
create trigger audit_logs_prevent_update
  before update on public.audit_logs
  for each row execute function public.prevent_audit_log_mutation();

drop trigger if exists audit_logs_prevent_delete on public.audit_logs;
create trigger audit_logs_prevent_delete
  before delete on public.audit_logs
  for each row execute function public.prevent_audit_log_mutation();

drop policy if exists audit_logs_select on public.audit_logs;
drop policy if exists audit_logs_no_direct_insert on public.audit_logs;
drop policy if exists audit_logs_no_direct_update on public.audit_logs;
drop policy if exists audit_logs_no_direct_delete on public.audit_logs;

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (actor = auth.uid() or public.has_permission('audit.read'));

create policy audit_logs_no_direct_insert on public.audit_logs
  for insert to authenticated
  with check (false);

create policy audit_logs_no_direct_update on public.audit_logs
  for update to authenticated
  using (false)
  with check (false);

create policy audit_logs_no_direct_delete on public.audit_logs
  for delete to authenticated
  using (false);

drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_no_direct_insert on public.notifications;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_no_direct_insert on public.notifications
  for insert to authenticated
  with check (false);

grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant select on public.audit_logs to authenticated;

revoke insert, update, delete on public.audit_logs from anon, authenticated;
revoke insert, delete on public.notifications from anon, authenticated;
revoke update on public.notifications from anon;
