begin;

select plan(12);

reset role;
insert into public.clubs (id, name, slug, description, is_active, created_by)
values (
  '20000000-0000-0000-0000-000000000003',
  'Inactive Test Club', 'inactive-test-club', 'Temporary RLS fixture.', false,
  '10000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

insert into public.notifications (user_id, type, title, message, is_read)
values (
  '10000000-0000-0000-0000-000000000003',
  'event_published', 'Own notification', 'Visible to the target student.', false
), (
  '10000000-0000-0000-0000-000000000004',
  'event_published', 'Other notification', 'Not visible to the target student.', false
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'a student can read only their own profile'
);
select is(
  (select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000004'::uuid),
  0::bigint,
  'a student cannot read another student profile'
);
select is(
  (select count(*) from public.notifications),
  1::bigint,
  'a student can read only their own notifications'
);
select is(
  (select count(*) from public.notifications where user_id = '10000000-0000-0000-0000-000000000004'::uuid),
  0::bigint,
  'a student cannot read another student notification'
);
select is(
  (select count(*) from public.clubs),
  2::bigint,
  'a student can read active clubs but not inactive clubs'
);
select ok(
  not public.can_manage_club('20000000-0000-0000-0000-000000000002'::uuid),
  'a student cannot manage another club'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$insert into public.audit_logs(action, entity_type, entity_id, details)
    values ('direct.insert', 'test', '30000000-0000-0000-0000-000000000001'::uuid, '{}'::jsonb)$$,
  '42501',
  'audit logs can only be inserted through log_audit'
);
select throws_ok(
  $$update public.audit_logs set details = '{"changed":true}'::jsonb
    where id = (select max(id) from public.audit_logs)$$,
  '42501',
  'audit logs cannot be updated'
);
select throws_ok(
  $$delete from public.audit_logs where id = (select max(id) from public.audit_logs)$$,
  '42501',
  'audit logs cannot be deleted'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select ok(
  public.can_manage_club('20000000-0000-0000-0000-000000000001'::uuid),
  'a Club Head can manage club A'
);
select ok(
  not public.can_manage_club('20000000-0000-0000-0000-000000000002'::uuid),
  'a Club Head cannot manage club B'
);

reset role;
insert into public.user_roles (user_id, role_id, club_id, assigned_by)
select '10000000-0000-0000-0000-000000000003'::uuid,
       r.id,
       '20000000-0000-0000-0000-000000000001'::uuid,
       '10000000-0000-0000-0000-000000000001'::uuid
from public.roles r
where r.code = 'club_head';
select throws_ok(
  $$insert into public.user_roles (user_id, role_id, club_id, assigned_by)
    select '10000000-0000-0000-0000-000000000003'::uuid,
           r.id,
           '20000000-0000-0000-0000-000000000001'::uuid,
           '10000000-0000-0000-0000-000000000001'::uuid
    from public.roles r where r.code = 'club_head'$$,
  '23505',
  'duplicate active Club Head assignments are rejected'
);

select * from finish();
rollback;
