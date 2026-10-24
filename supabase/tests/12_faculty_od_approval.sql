begin;

select plan(5);

reset role;
insert into public.user_roles (user_id, role_id, club_id, assigned_by)
select
  '10000000-0000-0000-0000-000000000004'::uuid,
  r.id,
  '20000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid
from public.roles r
where r.code = 'faculty_coordinator'
on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);

select ok(
  public.has_role('faculty_coordinator', '20000000-0000-0000-0000-000000000001'::uuid),
  'Faculty Coordinator has their assigned club scope'
);
select ok(
  public.has_role('faculty_coordinator'),
  'Faculty Coordinator can identify that at least one club is assigned'
);
select ok(
  not public.has_role('faculty_coordinator', '20000000-0000-0000-0000-000000000002'::uuid),
  'Faculty Coordinator does not have a different club scope'
);
select ok(
  public.has_permission('od_sheets.review', '20000000-0000-0000-0000-000000000001'::uuid),
  'Faculty Coordinator can review OD sheets in the assigned club'
);
select ok(
  not public.has_permission('od_sheets.review', '20000000-0000-0000-0000-000000000002'::uuid),
  'Faculty Coordinator cannot review OD sheets in another club'
);

select * from finish();
rollback;
