begin;

select plan(7);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select is(
  (select full_name from public.profiles where id = '10000000-0000-0000-0000-000000000002'::uuid),
  'Club President'::text,
  'a user can read their own profile'
);
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'a user cannot read another user profile'
);
select lives_ok(
  $$ update public.profiles
     set full_name = 'Updated President', department = 'Computing', year_of_study = 2, phone = '+1 555 0100'
   where id = '10000000-0000-0000-0000-000000000002'::uuid $$,
  'a user can update their own editable profile fields'
);
select throws_ok(
  $$ update public.profiles set status = 'suspended' where id = '10000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'a user cannot update the privileged status field'
);
select throws_ok(
  $$ update public.profiles set id = '10000000-0000-0000-0000-000000000099'::uuid where id = '10000000-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'a user cannot update the profile identity link'
);
select lives_ok(
  $$ update public.profiles set full_name = 'Should Not Change' where id = '10000000-0000-0000-0000-000000000003'::uuid $$,
  'an update against another user affects no rows'
);

reset role;
select ok(
  (select full_name from public.profiles where id = '10000000-0000-0000-0000-000000000003'::uuid) = 'Regular Member',
  'another user profile remains unchanged by the update attempt'
);

select * from finish();
rollback;
