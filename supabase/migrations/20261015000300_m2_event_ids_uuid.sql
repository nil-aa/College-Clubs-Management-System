-- Convert Member 2 event identifiers to UUIDs without rewriting applied
-- migration 012. Existing registration and audit references are remapped.
-- The related_event_id notification column is already UUID-compatible.

drop policy if exists events_select_published_or_manager on public.events;
drop policy if exists event_registrations_select_own_or_manager on public.event_registrations;

drop function if exists public.create_event(
  uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, integer
);
drop function if exists public.list_managed_events(uuid, integer, integer);
drop function if exists public.get_managed_event(bigint);
drop function if exists public.update_event(
  bigint, text, text, text, text, timestamptz, timestamptz, timestamptz, integer
);
drop function if exists public.publish_event(bigint);
drop function if exists public.postpone_event(bigint, timestamptz, timestamptz, timestamptz);
drop function if exists public.cancel_event(bigint);

create temporary table _m2_event_id_map on commit drop as
select event_id as old_event_id, gen_random_uuid() as new_event_id
from public.events;

alter table public.event_registrations
  drop constraint event_registrations_event_id_fkey,
  drop constraint event_registrations_event_student_key,
  drop constraint event_registrations_pkey;
alter table public.events drop constraint events_pkey;
drop index if exists public.event_registrations_event_status_idx;

alter table public.events add column event_id_uuid uuid;
update public.events e
set event_id_uuid = m.new_event_id
from _m2_event_id_map m
where m.old_event_id = e.event_id;
alter table public.events alter column event_id_uuid set not null;

alter table public.event_registrations
  add column registration_id_uuid uuid,
  add column event_id_uuid uuid;
update public.event_registrations er
set registration_id_uuid = gen_random_uuid();
update public.event_registrations er
set event_id_uuid = m.new_event_id
from _m2_event_id_map m
where m.old_event_id = er.event_id;
alter table public.event_registrations
  alter column registration_id_uuid set not null,
  alter column event_id_uuid set not null;

-- Preserve references from Member 2 audit records written before conversion.
update public.audit_logs a
set entity_id = m.new_event_id,
    details = jsonb_set(a.details, '{event_id}', to_jsonb(m.new_event_id::text), true)
from _m2_event_id_map m
where a.entity_type = 'events'
  and a.details ->> 'event_id' ~ '^[0-9]+$'
  and (a.details ->> 'event_id')::bigint = m.old_event_id;

alter table public.events alter column event_id drop identity if exists;
alter table public.event_registrations
  alter column registration_id drop identity if exists;

alter table public.event_registrations
  drop column event_id,
  drop column registration_id;
alter table public.events drop column event_id;

alter table public.events
  rename column event_id_uuid to event_id;
alter table public.event_registrations
  rename column registration_id_uuid to registration_id;
alter table public.event_registrations
  rename column event_id_uuid to event_id;

alter table public.events
  alter column event_id set default gen_random_uuid(),
  add constraint events_pkey primary key (event_id);
alter table public.event_registrations
  alter column registration_id set default gen_random_uuid(),
  add constraint event_registrations_pkey primary key (registration_id),
  add constraint event_registrations_event_id_fkey
    foreign key (event_id) references public.events(event_id),
  add constraint event_registrations_event_student_key
    unique (event_id, student_id);

create index event_registrations_event_status_idx
  on public.event_registrations(event_id, status);

create policy events_select_published_or_manager on public.events
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.clubs c on c.id = events.club_id and c.is_active
      where p.id = auth.uid() and p.is_active
        and (events.status = 'PUBLISHED'
          or public.has_permission('events.manage', events.club_id))
    )
  );

create policy event_registrations_select_own_or_manager on public.event_registrations
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.events e on e.event_id = event_registrations.event_id
      join public.clubs c on c.id = e.club_id and c.is_active
      where p.id = auth.uid() and p.is_active
        and (event_registrations.student_id = auth.uid()
          or public.has_permission('events.manage', e.club_id))
    )
  );

comment on column public.events.event_id is
  'UUID event identifier shared with notification and audit references.';
comment on column public.event_registrations.registration_id is
  'UUID registration identifier.';

