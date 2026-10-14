-- Run this entire file in the hosted Supabase SQL Editor.
-- The assertions execute inside one transaction; the final rollback removes test writes.
-- Only the result of finish() is returned, so the editor shows one TAP result set.

begin;

do $$
begin
  perform plan(7);
end;
$$;

set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
end;
$$;

do $$
begin
  perform ok(
    (select full_name from public.profiles where id = '10000000-0000-0000-0000-000000000002'::uuid) = 'Club President',
    'a user can read their own profile'
  );
  perform ok(
    (select count(*) from public.profiles) = 1,
    'a user cannot read another user profile'
  );
  perform lives_ok(
    $$ update public.profiles
       set full_name = 'Updated President', department = 'Computing', year_of_study = 2, phone = '+1 555 0100'
     where id = '10000000-0000-0000-0000-000000000002'::uuid $$,
    'a user can update their own editable profile fields'
  );
  perform throws_ok(
    $$ update public.profiles set status = 'suspended' where id = '10000000-0000-0000-0000-000000000002'::uuid $$,
    '42501',
    'a user cannot update the privileged status field'
  );
  perform throws_ok(
    $$ update public.profiles set id = '10000000-0000-0000-0000-000000000099'::uuid where id = '10000000-0000-0000-0000-000000000002'::uuid $$,
    '42501',
    'a user cannot update the profile identity link'
  );
  perform lives_ok(
    $$ update public.profiles set full_name = 'Should Not Change' where id = '10000000-0000-0000-0000-000000000003'::uuid $$,
    'an update against another user affects no rows'
  );
end;
$$;

reset role;

do $$
begin
  perform ok(
    (select full_name from public.profiles where id = '10000000-0000-0000-0000-000000000003'::uuid) = 'Regular Member',
    'another user profile remains unchanged by the update attempt'
  );
end;
$$;

select * from finish();
rollback;
