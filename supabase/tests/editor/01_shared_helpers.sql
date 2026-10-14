-- Run this entire file in the hosted Supabase SQL Editor.
-- The assertions execute inside one transaction; the final rollback removes test writes.
-- Only the result of finish() is returned, so the editor shows one TAP result set.

begin;

do $$
begin
  perform plan(10);

  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  perform ok(
    public.has_role('president', '20000000-0000-0000-0000-000000000001'::uuid),
    'president role is true in its assigned club'
  );
  perform ok(
    not public.has_role('president', '20000000-0000-0000-0000-000000000099'::uuid),
    'president role is false in another club'
  );
  perform ok(
    public.has_permission('memberships.manage', '20000000-0000-0000-0000-000000000001'::uuid),
    'president has a club-scoped management permission in its club'
  );
  perform ok(
    not public.has_permission('memberships.manage', '20000000-0000-0000-0000-000000000099'::uuid),
    'president cannot use the same permission in another club'
  );
  perform ok(
    public.is_club_member('20000000-0000-0000-0000-000000000001'::uuid),
    'active club member is detected'
  );

  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
  perform ok(
    not public.has_permission('memberships.manage', '20000000-0000-0000-0000-000000000001'::uuid),
    'regular member does not have manage permission'
  );

  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  perform ok(
    public.has_permission('anything.not.seeded', '20000000-0000-0000-0000-000000000099'::uuid),
    'global admin passes an arbitrary permission check in another club'
  );
  perform ok(
    public.has_permission('anything.not.seeded'),
    'global admin passes a global permission check'
  );

  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  perform ok(
    public.log_audit('test.action', 'test_entity', '30000000-0000-0000-0000-000000000001'::uuid, '{"source":"pgtap"}'::jsonb) is not null,
    'log_audit returns an audit id'
  );
  perform ok(
    public.send_notification('10000000-0000-0000-0000-000000000002'::uuid, 'test', 'Test notification', 'Hello', array['in_app'], '{}'::jsonb) is not null,
    'send_notification returns a notification id'
  );
end;
$$;

select * from finish();
rollback;
