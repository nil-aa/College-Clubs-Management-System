begin;

select plan(12);

reset role;
insert into public.audit_logs(actor, action, entity_type, entity_id, details)
select
  '10000000-0000-0000-0000-000000000001'::uuid,
  'audit.limit_test',
  'test_entity',
  '40000000-0000-0000-0000-000000000001'::uuid,
  jsonb_build_object('n', n)
from generate_series(1, 105) n;
insert into public.audit_logs(actor, action, entity_type, entity_id, details)
values (
  '10000000-0000-0000-0000-000000000001',
  'audit.filter_test',
  'test_entity',
  '40000000-0000-0000-0000-000000000002',
  '{"source":"pgtap"}'::jsonb
);

select tests.authenticate_as('member@example.test');
select throws_ok(
  $$select * from public.list_audit_logs(null, null, null, null, null, 25, 0)$$,
  '42501',
  'Only admins can view audit logs.',
  'non-admins cannot call list_audit_logs'
);
select throws_ok(
  $$select public.get_admin_dashboard_stats()$$,
  '42501',
  'Only admins can view admin dashboard statistics.',
  'non-admins cannot call get_admin_dashboard_stats'
);
select throws_ok(
  $$select count(*) from public.audit_logs$$,
  '42501',
  'permission denied for table audit_logs',
  'authenticated users cannot read audit_logs directly'
);

select tests.authenticate_as('global-admin@example.test');
select is(
  (select count(*)::integer from public.list_audit_logs('audit.filter_test', 'test_entity', '10000000-0000-0000-0000-000000000001', now() - interval '1 hour', now() + interval '1 hour', 25, 0)),
  1,
  'audit filters match action, entity, actor and date range'
);
select is(
  (select actor_name from public.list_audit_logs('audit.filter_test', null, null, null, null, 25, 0) limit 1),
  'Global Admin',
  'audit rows include the actor name'
);
select is(
  (select count(*)::integer from public.list_audit_logs('audit.limit_test', null, null, null, null, 1000, 0)),
  100,
  'audit list caps the requested limit at 100'
);
select is(
  (select max(total_count)::integer from public.list_audit_logs('audit.limit_test', null, null, null, null, 5, 0)),
  105,
  'audit list returns the filtered total count'
);
select ok(
  (public.get_admin_dashboard_stats() ->> 'active_club_count') is not null,
  'admin dashboard stats returns club counts'
);
select ok(
  jsonb_array_length(public.get_admin_dashboard_stats() -> 'recent_audit_logs') <= 5,
  'admin dashboard stats returns at most five recent audit entries'
);
select throws_ok(
  $$update public.audit_logs set action = 'changed' where action = 'audit.filter_test'$$,
  '42501',
  'permission denied for table audit_logs',
  'audit logs cannot be updated'
);
select throws_ok(
  $$delete from public.audit_logs where action = 'audit.filter_test'$$,
  '42501',
  'permission denied for table audit_logs',
  'audit logs cannot be deleted'
);

select * from finish();
rollback;
