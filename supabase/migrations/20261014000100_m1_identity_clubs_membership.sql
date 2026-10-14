create extension if not exists "pgcrypto";

create type public.profile_status as enum ('active', 'suspended', 'deactivated');
create type public.club_status as enum ('active', 'archived');
create type public.membership_status as enum ('pending', 'active', 'rejected', 'suspended', 'left');
create type public.application_status as enum ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn');
create type public.form_status as enum ('draft', 'published', 'closed');
create type public.assignment_status as enum ('active', 'inactive', 'completed');
create type public.volunteer_opening_status as enum ('draft', 'open', 'closed', 'cancelled');
create type public.notification_status as enum ('unread', 'read', 'archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  phone text,
  bio text,
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = lower(code) and code ~ '^[a-z0-9_.-]+$'),
  name text not null,
  description text,
  is_global boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = lower(code) and code ~ '^[a-z0-9_.-]+$'),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  logo_path text,
  status public.club_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index user_roles_user_role_global_key on public.user_roles(user_id, role_id) where club_id is null;
create unique index user_roles_user_role_club_key on public.user_roles(user_id, role_id, club_id) where club_id is not null;

create table public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.membership_status not null default 'pending',
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id),
  check (left_at is null or joined_at is null or left_at >= joined_at)
);

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  applicant_user_id uuid not null references public.profiles(id) on delete cascade,
  status public.application_status not null default 'draft',
  motivation text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index membership_applications_open_key on public.membership_applications(club_id, applicant_user_id)
  where status in ('draft', 'submitted', 'under_review');

create table public.recruitment_forms (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  description text,
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  status public.form_status not null default 'draft',
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at)
);

create table public.recruitment_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.recruitment_forms(id) on delete cascade,
  applicant_user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  status public.application_status not null default 'submitted',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, applicant_user_id)
);

create table public.committee_designations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  description text,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  unique (club_id, name)
);

create table public.committee_assignments (
  id uuid primary key default gen_random_uuid(),
  designation_id uuid not null references public.committee_designations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.assignment_status not null default 'active',
  term_start date not null,
  term_end date,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (term_end is null or term_end >= term_start),
  unique (designation_id, user_id, term_start)
);

create table public.event_volunteer_openings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  event_id uuid not null,
  title text not null,
  description text,
  slots integer not null default 1 check (slots > 0),
  status public.volunteer_opening_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.event_volunteer_openings.event_id is 'Intentionally an unvalidated uuid until the events module adds its table.';

create table public.volunteer_applications (
  id uuid primary key default gen_random_uuid(),
  opening_id uuid not null references public.event_volunteer_openings(id) on delete cascade,
  applicant_user_id uuid not null references public.profiles(id) on delete cascade,
  status public.application_status not null default 'submitted',
  note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opening_id, applicant_user_id)
);

create table public.volunteer_assignments (
  id uuid primary key default gen_random_uuid(),
  opening_id uuid not null references public.event_volunteer_openings(id) on delete cascade,
  volunteer_user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.volunteer_applications(id) on delete set null,
  status public.assignment_status not null default 'active',
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (opening_id, volunteer_user_id)
);

create table public.audit_logs (
  id bigint generated by default as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  channels text[] not null default array['in_app']::text[] check (cardinality(channels) > 0),
  metadata jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'unread',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index user_roles_club_idx on public.user_roles(club_id, user_id);
create index memberships_user_status_idx on public.club_memberships(user_id, status);
create index memberships_club_status_idx on public.club_memberships(club_id, status);
create index membership_applications_club_status_idx on public.membership_applications(club_id, status);
create index recruitment_forms_club_status_idx on public.recruitment_forms(club_id, status);
create index recruitment_responses_form_status_idx on public.recruitment_responses(form_id, status);
create index committee_assignments_user_idx on public.committee_assignments(user_id, status);
create index volunteer_openings_event_idx on public.event_volunteer_openings(event_id, status);
create index volunteer_applications_opening_status_idx on public.volunteer_applications(opening_id, status);
create index volunteer_assignments_user_idx on public.volunteer_assignments(volunteer_user_id, status);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_user_id, created_at desc);
create index notifications_user_status_idx on public.notifications(user_id, status, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger clubs_set_updated_at before update on public.clubs for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at before update on public.club_memberships for each row execute function public.set_updated_at();
create trigger membership_applications_set_updated_at before update on public.membership_applications for each row execute function public.set_updated_at();
create trigger recruitment_forms_set_updated_at before update on public.recruitment_forms for each row execute function public.set_updated_at();
create trigger recruitment_responses_set_updated_at before update on public.recruitment_responses for each row execute function public.set_updated_at();
create trigger volunteer_openings_set_updated_at before update on public.event_volunteer_openings for each row execute function public.set_updated_at();
create trigger volunteer_applications_set_updated_at before update on public.volunteer_applications for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.has_role(p_role text, p_club_id uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = lower(p_role)
      and (ur.club_id is null or ur.club_id = p_club_id)
      and (p_club_id is not null or ur.club_id is null)
  );
$$;

create or replace function public.has_permission(p_permission text, p_club_id uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    left join public.role_permissions rp on rp.role_id = r.id
    left join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and (r.code = 'global_admin' or p.code = lower(p_permission))
      and (ur.club_id is null or ur.club_id = p_club_id)
      and (p_club_id is not null or ur.club_id is null)
  );
$$;

create or replace function public.is_club_member(p_club_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_memberships cm
    where cm.club_id = p_club_id and cm.user_id = auth.uid() and cm.status = 'active'
  );
$$;

create or replace function public.log_audit(
  p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb
)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.send_notification(
  p_user_id uuid, p_type text, p_title text, p_message text,
  p_channels text[], p_metadata jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.notifications(user_id, type, title, message, channels, metadata)
  values (p_user_id, p_type, p_title, p_message, coalesce(p_channels, array['in_app']::text[]), coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
grant execute on function public.has_role(text, uuid), public.has_permission(text, uuid), public.is_club_member(uuid) to anon, authenticated;
grant execute on function public.log_audit(text, text, uuid, jsonb), public.send_notification(uuid, text, text, text, text[], jsonb) to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','roles','permissions','role_permissions','user_roles','clubs','club_memberships',
    'membership_applications','recruitment_forms','recruitment_responses','committee_designations',
    'committee_assignments','event_volunteer_openings','volunteer_applications','volunteer_assignments',
    'audit_logs','notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy profiles_select_self on public.profiles for select to authenticated using (id = auth.uid() or public.has_permission('profiles.read'));
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy roles_select on public.roles for select to authenticated using (public.has_permission('roles.read'));
create policy permissions_select on public.permissions for select to authenticated using (public.has_permission('permissions.read'));
create policy role_permissions_select on public.role_permissions for select to authenticated using (public.has_permission('roles.read'));
create policy user_roles_select on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_permission('roles.read', club_id));

create policy clubs_select on public.clubs for select to authenticated using (public.is_club_member(id) or public.has_permission('clubs.read', id));
create policy clubs_insert on public.clubs for insert to authenticated with check (public.has_permission('clubs.manage'));
create policy clubs_update on public.clubs for update to authenticated using (public.has_permission('clubs.manage', id)) with check (public.has_permission('clubs.manage', id));

create policy memberships_select on public.club_memberships for select to authenticated using (user_id = auth.uid() or public.has_permission('memberships.read', club_id));
create policy memberships_insert on public.club_memberships for insert to authenticated with check (user_id = auth.uid() or public.has_permission('memberships.manage', club_id));
create policy memberships_update on public.club_memberships for update to authenticated using (user_id = auth.uid() or public.has_permission('memberships.manage', club_id)) with check (user_id = auth.uid() or public.has_permission('memberships.manage', club_id));

create policy membership_applications_select on public.membership_applications for select to authenticated using (applicant_user_id = auth.uid() or public.has_permission('recruitment.read', club_id));
create policy membership_applications_insert on public.membership_applications for insert to authenticated with check (applicant_user_id = auth.uid());
create policy membership_applications_update on public.membership_applications for update to authenticated using (applicant_user_id = auth.uid() or public.has_permission('recruitment.manage', club_id));

create policy recruitment_forms_select on public.recruitment_forms for select to authenticated using (public.is_club_member(club_id) or public.has_permission('recruitment.read', club_id));
create policy recruitment_forms_manage on public.recruitment_forms for all to authenticated using (public.has_permission('recruitment.manage', club_id)) with check (public.has_permission('recruitment.manage', club_id));
create policy recruitment_responses_select on public.recruitment_responses for select to authenticated using (applicant_user_id = auth.uid() or public.has_permission('recruitment.read', (select club_id from public.recruitment_forms f where f.id = form_id)));
create policy recruitment_responses_insert on public.recruitment_responses for insert to authenticated with check (applicant_user_id = auth.uid());
create policy recruitment_responses_update on public.recruitment_responses for update to authenticated using (applicant_user_id = auth.uid() or public.has_permission('recruitment.manage', (select club_id from public.recruitment_forms f where f.id = form_id)));

create policy committee_designations_select on public.committee_designations for select to authenticated using (public.is_club_member(club_id) or public.has_permission('committee.read', club_id));
create policy committee_designations_manage on public.committee_designations for all to authenticated using (public.has_permission('committee.manage', club_id)) with check (public.has_permission('committee.manage', club_id));
create policy committee_assignments_select on public.committee_assignments for select to authenticated using (user_id = auth.uid() or public.has_permission('committee.read', (select club_id from public.committee_designations d where d.id = designation_id)));
create policy committee_assignments_manage on public.committee_assignments for all to authenticated using (public.has_permission('committee.manage', (select club_id from public.committee_designations d where d.id = designation_id))) with check (public.has_permission('committee.manage', (select club_id from public.committee_designations d where d.id = designation_id)));

create policy volunteer_openings_select on public.event_volunteer_openings for select to authenticated using (public.is_club_member(club_id) or public.has_permission('volunteers.read', club_id));
create policy volunteer_openings_manage on public.event_volunteer_openings for all to authenticated using (public.has_permission('volunteers.manage', club_id)) with check (public.has_permission('volunteers.manage', club_id));
create policy volunteer_applications_select on public.volunteer_applications for select to authenticated using (applicant_user_id = auth.uid() or public.has_permission('volunteers.read', (select club_id from public.event_volunteer_openings o where o.id = opening_id)));
create policy volunteer_applications_insert on public.volunteer_applications for insert to authenticated with check (applicant_user_id = auth.uid());
create policy volunteer_applications_update on public.volunteer_applications for update to authenticated using (applicant_user_id = auth.uid() or public.has_permission('volunteers.manage', (select club_id from public.event_volunteer_openings o where o.id = opening_id)));
create policy volunteer_assignments_select on public.volunteer_assignments for select to authenticated using (volunteer_user_id = auth.uid() or public.has_permission('volunteers.read', (select club_id from public.event_volunteer_openings o where o.id = opening_id)));
create policy volunteer_assignments_manage on public.volunteer_assignments for all to authenticated using (public.has_permission('volunteers.manage', (select club_id from public.event_volunteer_openings o where o.id = opening_id))) with check (public.has_permission('volunteers.manage', (select club_id from public.event_volunteer_openings o where o.id = opening_id)));

create policy audit_logs_select on public.audit_logs for select to authenticated using (actor_user_id = auth.uid() or public.has_permission('audit.read'));
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
