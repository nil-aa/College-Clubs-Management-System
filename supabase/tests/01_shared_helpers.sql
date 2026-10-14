begin;

select plan(12);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select ok(
  public.has_role('club_head', '20000000-0000-0000-0000-000000000001'::uuid),
  'club head role is true in its assigned club'
);
select ok(
  not public.has_role('club_head', '20000000-0000-0000-0000-000000000099'::uuid),
  'club head role is false in another club'
);
select ok(
  public.has_permission('clubs.manage', '20000000-0000-0000-0000-000000000001'::uuid),
  'club head has a club-scoped management permission in its club'
);
select ok(
  not public.has_permission('clubs.manage', '20000000-0000-0000-0000-000000000099'::uuid),
  'club head cannot use the same permission in another club'
);
select ok(
  public.can_manage_club('20000000-0000-0000-0000-000000000001'::uuid),
  'club head can manage their assigned club'
);
select ok(
  not public.can_manage_club('20000000-0000-0000-0000-000000000099'::uuid),
  'club head cannot manage another club'
);
select ok(
  public.is_club_member('20000000-0000-0000-0000-000000000001'::uuid),
  'active club member is detected'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select ok(
  not public.has_permission('clubs.manage', '20000000-0000-0000-0000-000000000001'::uuid),
  'regular member does not have manage permission'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select ok(
  public.has_permission('anything.not.seeded', '20000000-0000-0000-0000-000000000099'::uuid),
  'global admin passes an arbitrary permission check in another club'
);
select ok(
  public.has_permission('anything.not.seeded'),
  'global admin passes a global permission check'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select ok(
  public.log_audit('test.action', 'test_entity', '30000000-0000-0000-0000-000000000001'::uuid, '{"source":"pgtap"}'::jsonb) is not null,
  'log_audit returns an audit id'
);
select ok(
  public.send_notification('10000000-0000-0000-0000-000000000002'::uuid, 'event_published', 'Test notification', 'Hello', array['in_app'], '{"event_id":"30000000-0000-0000-0000-000000000001"}'::jsonb) is not null,
  'send_notification returns a notification id'
);

select * from finish();
rollback;
