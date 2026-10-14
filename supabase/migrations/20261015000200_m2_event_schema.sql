-- Member 2 event and registration schema.
-- Event mutations and registration writes will be exposed through guarded
-- transactional RPCs; authenticated clients receive read access only here.

create table public.events (
  event_id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs(id),
  created_by uuid not null references public.profiles(id),
  title varchar(200) not null,
  description text,
  venue varchar(300) not null,
  category text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  registration_deadline timestamptz not null,
  capacity integer not null,
  status text not null default 'DRAFT',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_status_check
    check (status in ('DRAFT', 'PUBLISHED', 'POSTPONED', 'CANCELLED', 'COMPLETED')),
  constraint events_capacity_positive_check
    check (capacity > 0),
  constraint events_end_after_start_check
    check (end_time > start_time),
  constraint events_registration_deadline_check
    check (registration_deadline <= start_time)
);

create table public.event_registrations (
  registration_id bigint generated always as identity primary key,
  event_id bigint not null references public.events(event_id),
  student_id uuid not null references public.profiles(id),
  status text not null default 'REGISTERED',
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_registrations_status_check
    check (status in ('REGISTERED', 'CANCELLED')),
  constraint event_registrations_event_student_key
    unique (event_id, student_id)
);

create index events_status_start_time_idx
  on public.events(status, start_time);
create index events_club_status_start_time_idx
  on public.events(club_id, status, start_time);
create index event_registrations_event_status_idx
  on public.event_registrations(event_id, status);
create index event_registrations_student_status_registered_at_idx
  on public.event_registrations(student_id, status, registered_at desc);

-- Reuse the shared timestamp trigger function created by Member 1.
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
create trigger event_registrations_set_updated_at
  before update on public.event_registrations
  for each row execute function public.set_updated_at();

-- Add the club-scoped permission to the existing RBAC catalog. Admins already
-- pass public.has_permission globally; Club Heads receive it through their
-- club-scoped role assignment.
insert into public.permissions (code, name, description)
values (
  'events.manage',
  'Manage events',
  'Create and manage events for assigned clubs.'
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'events.manage'
where r.code = 'club_head'
on conflict do nothing;

alter table public.events enable row level security;
alter table public.event_registrations enable row level security;

revoke all on public.events, public.event_registrations from anon, authenticated;
grant select on public.events, public.event_registrations to authenticated;

create policy events_select_published_or_manager
  on public.events
  for select to authenticated
  using (
    status = 'PUBLISHED'
    or public.has_permission('events.manage', club_id)
  );

create policy event_registrations_select_own_or_manager
  on public.event_registrations
  for select to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1
      from public.events e
      where e.event_id = event_registrations.event_id
        and public.has_permission('events.manage', e.club_id)
    )
  );

comment on table public.events is
  'Event records owned by Member 2. Mutations are reserved for guarded transactional workflows.';
comment on table public.event_registrations is
  'One persistent registration row per event and student; cancellation updates status and re-registration reactivates the row.';
