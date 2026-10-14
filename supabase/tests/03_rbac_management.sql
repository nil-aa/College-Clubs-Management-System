begin;

select plan(10);

reset role;
insert into public.clubs (id, name, slug, description, created_by)
values (
  '20000000-0000-0000-0000-000000000002',
  'Second Test Club', 'second-test-club', 'Temporary pgTAP club.',
  '10000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$select public.assign_club_head('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002'::uuid)$$,
  '42501', 'a student cannot assign a Club Head'
);
select throws_ok(
  $$select public.revoke_club_head('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001'::uuid)$$,
  '42501', 'a student cannot revoke a Club Head'
);
select throws_ok(
  $$select public.set_user_role('10000000-0000-0000-0000-000000000003', 'admin')$$,
  '42501', 'a student cannot change roles'
);
select ok(
  not public.can_manage_club('20000000-0000-0000-0000-000000000002'::uuid),
  'a student cannot manage a club'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select ok(
  public.can_manage_club('20000000-0000-0000-0000-000000000001'::uuid),
  'a Club Head can manage the assigned club'
);
select ok(
  not public.can_manage_club('20000000-0000-0000-0000-000000000002'::uuid),
  'a Club Head cannot manage another club'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.set_user_role('10000000-0000-0000-0000-000000000001', 'student')$$,
  '23514', 'the last admin cannot be demoted'
);
select throws_ok(
  $$select public.assign_club_head('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'::uuid)$$,
  '42501', 'an admin cannot receive a Club Head scope'
);
select lives_ok(
  $$select public.assign_club_head('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002'::uuid)$$,
  'an admin can assign a Club Head scope'
);
select is(
  (select count(*) from public.user_roles ur join public.roles r on r.id = ur.role_id
   where ur.user_id = '10000000-0000-0000-0000-000000000003'::uuid
     and ur.club_id = '20000000-0000-0000-0000-000000000002'::uuid
     and ur.status = 'active' and r.code = 'club_head'),
  1::bigint,
  'a user has only one active Club Head assignment per club'
);

select * from finish();
rollback;
