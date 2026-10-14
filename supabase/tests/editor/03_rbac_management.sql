-- Run this entire file in the hosted Supabase SQL Editor.
-- All setup and assertions run in one transaction; the final rollback leaves no data behind.
-- Only finish() is returned as the editor result set.

begin;

do $$
begin
  perform plan(10);
end;
$$;

reset role;
insert into public.clubs (id, name, slug, description, created_by)
values ('20000000-0000-0000-0000-000000000002', 'Second Test Club', 'second-test-club', 'Temporary pgTAP club.', '10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
  perform throws_ok($q$select public.assign_club_head('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002'::uuid)$q$, '42501', 'a student cannot assign a Club Head');
  perform throws_ok($q$select public.revoke_club_head('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001'::uuid)$q$, '42501', 'a student cannot revoke a Club Head');
  perform throws_ok($q$select public.set_user_role('10000000-0000-0000-0000-000000000003', 'admin')$q$, '42501', 'a student cannot change roles');
  perform ok(not public.can_manage_club('20000000-0000-0000-0000-000000000002'::uuid), 'a student cannot manage a club');

  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  perform ok(public.can_manage_club('20000000-0000-0000-0000-000000000001'::uuid), 'a Club Head can manage the assigned club');
  perform ok(not public.can_manage_club('20000000-0000-0000-0000-000000000002'::uuid), 'a Club Head cannot manage another club');

  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  perform throws_ok($q$select public.set_user_role('10000000-0000-0000-0000-000000000001', 'student')$q$, '23514', 'the last admin cannot be demoted');
  perform throws_ok($q$select public.assign_club_head('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'::uuid)$q$, '42501', 'an admin cannot receive a Club Head scope');
  perform lives_ok($q$select public.assign_club_head('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002'::uuid)$q$, 'an admin can assign a Club Head scope');
  perform is(
    (select count(*) from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = '10000000-0000-0000-0000-000000000003'::uuid and ur.club_id = '20000000-0000-0000-0000-000000000002'::uuid and ur.status = 'active' and r.code = 'club_head'),
    1::bigint,
    'a user has only one active Club Head assignment per club'
  );
end;
$$;

select * from finish();
rollback;
