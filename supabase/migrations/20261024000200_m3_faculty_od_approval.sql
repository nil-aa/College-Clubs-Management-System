-- Faculty reviewers are assigned to a specific club. They can review OD
-- participation snapshots only after a Club Head closes the list.
insert into public.roles (code, name, description, is_global, is_system)
values (
  'faculty_coordinator',
  'Faculty Coordinator',
  'Reviews and approves closed event participation lists for assigned clubs.',
  false,
  true
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_global = excluded.is_global,
    is_system = excluded.is_system;

insert into public.permissions (code, name, description)
values (
  'od_sheets.review',
  'Review OD sheets',
  'Review and approve closed participation lists for assigned clubs.'
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'faculty_coordinator'
  and p.code = 'od_sheets.review'
on conflict do nothing;

-- A faculty assignment is club-scoped; a null club id is never a grant.
create or replace function public.has_role(p_role text, p_club_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.status = 'active'
      and ur.is_active
      and (
        (lower(p_role) = 'admin' and r.code in ('admin', 'global_admin') and ur.club_id is null)
        or (r.code = lower(p_role) and r.code = 'club_head'
            and p_club_id is not null and ur.club_id = p_club_id)
        or (r.code = lower(p_role) and r.code = 'faculty_coordinator'
            and ur.club_id is not null
            and (p_club_id is null or ur.club_id = p_club_id))
        or (r.code = lower(p_role)
            and r.code not in ('club_head', 'faculty_coordinator')
            and ur.club_id is null)
      )
  );
$$;

alter table public.od_sheets
  add column status text not null default 'OPEN',
  add column closed_by uuid references public.profiles(id) on delete restrict,
  add column closed_at timestamptz,
  add column approved_by uuid references public.profiles(id) on delete restrict,
  add column approved_at timestamptz,
  add constraint od_sheets_status_check check (status in ('OPEN', 'CLOSED', 'APPROVED')),
  add constraint od_sheets_lifecycle_metadata_check check (
    (status = 'OPEN' and closed_by is null and closed_at is null
      and approved_by is null and approved_at is null)
    or (status = 'CLOSED' and closed_by is not null and closed_at is not null
      and approved_by is null and approved_at is null)
    or (status = 'APPROVED' and closed_by is not null and closed_at is not null
      and approved_by is not null and approved_at is not null)
  );

create index od_sheets_review_queue_idx
  on public.od_sheets(club_id, status, created_at desc);

create or replace function public.guard_od_sheet_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'APPROVED' and (
    new.title is distinct from old.title
    or new.student_fields is distinct from old.student_fields
    or new.event_fields is distinct from old.event_fields
    or new.event_data is distinct from old.event_data
    or new.event_id is distinct from old.event_id
    or new.club_id is distinct from old.club_id
    or new.created_by is distinct from old.created_by
    or new.closed_by is distinct from old.closed_by
    or new.closed_at is distinct from old.closed_at
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
  ) then
    raise exception 'Approved OD sheets are immutable.' using errcode = '55000';
  end if;

  if old.status = 'CLOSED' and (
    new.closed_by is distinct from old.closed_by
    or new.closed_at is distinct from old.closed_at
  ) then
    raise exception 'Closed OD sheet ownership cannot be changed.' using errcode = '55000';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'OPEN' and new.status = 'CLOSED')
    or (old.status = 'CLOSED' and new.status = 'APPROVED')
  ) then
    raise exception 'OD sheet status transition is not allowed.' using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists od_sheets_guard_lifecycle on public.od_sheets;
create trigger od_sheets_guard_lifecycle
before update on public.od_sheets
for each row execute function public.guard_od_sheet_lifecycle();

revoke all on function public.guard_od_sheet_lifecycle() from public, anon, authenticated;

drop policy if exists od_sheets_faculty_review_select on public.od_sheets;
create policy od_sheets_faculty_review_select
  on public.od_sheets
  for select to authenticated
  using (
    status in ('CLOSED', 'APPROVED')
    and public.has_permission('od_sheets.review', club_id)
  );

drop policy if exists od_sheet_students_faculty_review_select on public.od_sheet_students;
create policy od_sheet_students_faculty_review_select
  on public.od_sheet_students
  for select to authenticated
  using (
    exists (
      select 1
      from public.od_sheets s
      where s.id = od_sheet_students.od_sheet_id
        and s.status in ('CLOSED', 'APPROVED')
        and public.has_permission('od_sheets.review', s.club_id)
    )
  );

comment on column public.od_sheets.status is
  'OPEN participation list; CLOSED awaiting faculty approval; APPROVED and downloadable as an OD sheet.';
