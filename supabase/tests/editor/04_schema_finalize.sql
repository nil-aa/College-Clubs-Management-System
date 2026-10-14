-- Run this entire file in the hosted Supabase SQL Editor.
-- All setup and assertions run in one transaction; the final rollback leaves no data behind.
-- Only finish() is returned as the editor result set.

begin;

do $$
begin
  perform plan(12);
end;
$$;

reset role;
insert into public.clubs (id, name, slug, description, is_active, created_by)
values ('20000000-0000-0000-0000-000000000003', 'Inactive Test Club', 'inactive-test-club', 'Temporary RLS fixture.', false, '10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.notifications (user_id, type, title, message, is_read)
values
  ('10000000-0000-0000-0000-000000000003', 'event_published', 'Own notification', 'Visible to the target student.', false),
  ('10000000-0000-0000-0000-000000000004', 'event_published', 'Other notification', 'Not visible to the target student.', false);

set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
  perform is((select count(*) from public.profiles), 1::bigint, 'a student can read only their own profile');
  perform is((select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000004'::uuid), 0::bigint, 'a student cannot read another student profile');
  perform is((select count(*) from public.notifications), 1::bigint, 'a student can read only their own notifications');
  perform is((select count(*) from public.notifications where user_id = '10000000-0000-0000-0000-000000000004'::uuid), 0::bigint, 'a student cannot read another student notification');
  perform is((select count(*) from public.clubs), 2::bigint, 'a student can read active clubs but not inactive clubs');
  perform ok(not public.can_manage_club('20000000-0000-0000-0000-000000000002'::uuid), 'a student cannot manage another club');

  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  perform throws_ok($q$insert into public.audit_logs(action, entity_type, entity_id, details) values ('direct.insert', 'test', '30000000-0000-0000-0000-000000000001'::uuid, '{}'::jsonb)$q$, '42501', 'audit logs can only be inserted through log_audit');
  perform throws_ok($q$update public.audit_logs set details = '{"changed":true}'::jsonb where id = (select max(id) from public.audit_logs)$q$, '42501', 'audit logs cannot be updated');
  perform throws_ok($q$delete from public.audit_logs where id = (select max(id) from public.audit_logs)$q$, '42501', 'audit logs cannot be deleted');

  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  perform ok(public.can_manage_club('20000000-0000-0000-0000-000000000001'::uuid), 'a Club Head can manage club A');
  perform ok(not public.can_manage_club('20000000-0000-0000-0000-000000000002'::uuid), 'a Club Head cannot manage club B');
end;
$$;

reset role;
insert into public.user_roles (user_id, role_id, club_id, assigned_by)
select '10000000-0000-0000-0000-000000000003'::uuid, r.id, '20000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid
from public.roles r where r.code = 'club_head';

do $$
begin
  perform throws_ok($q$insert into public.user_roles (user_id, role_id, club_id, assigned_by)
    select '10000000-0000-0000-0000-000000000003'::uuid, r.id, '20000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid
    from public.roles r where r.code = 'club_head'$q$, '23505', 'duplicate active Club Head assignments are rejected');
end;
$$;

select * from finish();
rollback;
