-- Run this entire file in Supabase SQL Editor; all fixtures are rolled back.
begin;

select plan(25);

reset role;
insert into public.clubs (id, name, slug, description, is_active, created_by)
values (
  '20000000-0000-0000-0000-000000000020',
  'Inactive Event Test Club',
  'inactive-event-test-club',
  'Temporary event RPC fixture.',
  false,
  '10000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

insert into public.user_roles (user_id, role_id, club_id, assigned_by, status)
select
  '10000000-0000-0000-0000-000000000008',
  r.id,
  '20000000-0000-0000-0000-000000000020',
  '10000000-0000-0000-0000-000000000001',
  'active'
from public.roles r
where r.code = 'club_head'
on conflict do nothing;

select tests.authenticate_as('president@example.test');
select lives_ok(
  $$select public.create_event(
    '20000000-0000-0000-0000-000000000001',
    'M2 backend test event',
    'Test description',
    'Main Hall',
    'Technology',
    now() + interval '3 days',
    now() + interval '3 days 2 hours',
    now() + interval '2 days',
    25
  )$$,
  'an assigned club head can create a valid draft event'
);
select is(
  (select status from public.events where title = 'M2 backend test event'),
  'DRAFT',
  'new events start as drafts'
);
select is(
  (select registration_count from public.list_managed_events(
    '20000000-0000-0000-0000-000000000001', 10, 0
  ) where title = 'M2 backend test event'),
  0::bigint,
  'managed event listings include registration counts'
);
select is(
  (select count(*)::integer from public.get_managed_event(
    (select event_id from public.events where title = 'M2 backend test event')
  )),
  1,
  'an assigned club head can retrieve event details'
);
select throws_ok(
  $$select public.create_event(
    '20000000-0000-0000-0000-000000000001', 'Bad time event', null, 'Room',
    null, now() + interval '3 days', now() + interval '2 days',
    now() + interval '1 day', 10
  )$$,
  '22023',
  'Event end time must be later than start time.',
  'invalid time ordering is rejected by the backend'
);
select throws_ok(
  $$select public.create_event(
    '20000000-0000-0000-0000-000000000001', 'Bad capacity event', null, 'Room',
    null, now() + interval '3 days', now() + interval '3 days 2 hours',
    now() + interval '1 day', 0
  )$$,
  '22023',
  'Event capacity must be positive.',
  'non-positive capacity is rejected by the backend'
);
select throws_ok(
  $$select * from public.list_managed_events(null, 101, 0)$$,
  '22023',
  'Limit must be between 1 and 100 and offset cannot be negative.',
  'managed event pagination has a bounded page size'
);

reset role;
select set_config(
  'test.event_id',
  (select event_id::text from public.events where title = 'M2 backend test event'),
  true
);
select tests.authenticate_as('member@example.test');
select throws_ok(
  $$select public.create_event(
    '20000000-0000-0000-0000-000000000001', 'Student event', null, 'Room',
    null, now() + interval '3 days', now() + interval '3 days 2 hours',
    now() + interval '1 day', 10
  )$$,
  '42501',
  'You are not authorized to manage events for this club.',
  'students cannot create events'
);
select throws_ok(
  $$select * from public.list_managed_events(null, 10, 0)$$,
  '42501',
  'You are not authorized to manage events.',
  'students cannot use the managed-event listing'
);
select is(
  (select count(*)::integer from public.events where event_id = current_setting('test.event_id')::uuid),
  0,
  'students cannot read draft events'
);
select throws_ok(
  $$update public.events set title = 'Direct write' where event_id = current_setting('test.event_id')::uuid$$,
  '42501',
  'permission denied for table events',
  'authenticated clients cannot bypass event write RPCs'
);

select tests.authenticate_as('club-head-two@example.test');
select throws_ok(
  $$select * from public.get_managed_event(current_setting('test.event_id')::uuid)$$,
  '42501',
  'You are not authorized to manage events for this club.',
  'a club head cannot retrieve another club event'
);
select throws_ok(
  $$select * from public.list_managed_events('20000000-0000-0000-0000-000000000001', 10, 0)$$,
  '42501',
  'You are not authorized to manage events for this club.',
  'a club head cannot list another club events'
);
select throws_ok(
  $$select public.create_event(
    '20000000-0000-0000-0000-000000000020', 'Inactive club event', null, 'Room',
    null, now() + interval '3 days', now() + interval '3 days 2 hours',
    now() + interval '1 day', 10
  )$$,
  '22023',
  'Active club not found.',
  'events cannot be created for a deactivated club'
);

select tests.authenticate_as('president@example.test');
select lives_ok(
  $$select public.publish_event(current_setting('test.event_id')::uuid)$$,
  'a club head can publish a draft event'
);
select ok(
  (select published_at is not null from public.events
   where event_id = current_setting('test.event_id')::uuid),
  'first publication records published_at'
);
select throws_ok(
  $$select public.publish_event(current_setting('test.event_id')::uuid)$$,
  '22023',
  'Only draft or postponed events can be published.',
  'already published events cannot be published twice'
);
select lives_ok(
  $$select public.postpone_event(current_setting('test.event_id')::uuid)$$,
  'a club head can postpone a published event'
);
select is(
  (select status from public.events where event_id = current_setting('test.event_id')::uuid),
  'POSTPONED',
  'postponement updates the event status'
);
select lives_ok(
  $$select public.publish_event(current_setting('test.event_id')::uuid)$$,
  'a postponed event can be republished'
);
select lives_ok(
  $$select public.cancel_event(current_setting('test.event_id')::uuid)$$,
  'a club head can cancel a published event'
);
select is(
  (select status from public.events where event_id = current_setting('test.event_id')::uuid),
  'CANCELLED',
  'cancellation updates the event status'
);
select throws_ok(
  $$select public.publish_event(current_setting('test.event_id')::uuid)$$,
  '22023',
  'Only draft or postponed events can be published.',
  'cancelled events are terminal'
);
select ok(
  exists (
    select 1 from public.audit_logs
    where entity_type = 'events'
      and action = 'event.published'
      and details ->> 'event_id' = current_setting('test.event_id')
  ),
  'event lifecycle changes are sent to the shared audit helper'
);

reset role;
update public.profiles set is_active = false
where id = '10000000-0000-0000-0000-000000000002';
select tests.authenticate_as('president@example.test');
select throws_ok(
  $$select public.list_managed_events(null, 10, 0)$$,
  '42501',
  'An active authenticated profile is required.',
  'inactive profiles cannot use event management RPCs'
);
reset role;
update public.profiles set is_active = true
where id = '10000000-0000-0000-0000-000000000002';

select * from finish();
rollback;


