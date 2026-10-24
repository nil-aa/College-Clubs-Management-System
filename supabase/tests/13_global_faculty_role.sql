begin;

select plan(3);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.set_user_role('10000000-0000-0000-0000-000000000004'::uuid, 'faculty')$$,
  'an administrator can assign the global Faculty role'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select ok(public.has_role('faculty'), 'the account has the global Faculty role');
select ok(
  not public.has_role('faculty_coordinator'),
  'the global Faculty role alone does not grant club-scoped OD review access'
);

select * from finish();
rollback;
