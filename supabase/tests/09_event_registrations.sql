begin;
select plan(25);

reset role;
insert into public.events (
  event_id, club_id, created_by, title, description, venue, category,
  start_time, end_time, registration_deadline, capacity, status, published_at
)
values
  (
    '51000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Registration Open Event', 'Open registration fixture.', 'Main Hall', 'Technology',
    now() + interval '2 days', now() + interval '2 days 2 hours',
    now() + interval '1 day', 2, 'PUBLISHED', now()
  ),
  (
    '51000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Registration Full Event', 'Full registration fixture.', 'Main Hall', 'Technology',
    now() + interval '3 days', now() + interval '3 days 2 hours',
    now() + interval '2 days', 1, 'PUBLISHED', now()
  ),
  (
    '51000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Registration Deadline Event', 'Deadline fixture.', 'Main Hall', 'Technology',
    now() + interval '4 days', now() + interval '4 days 2 hours',
    now() - interval '1 hour', 10, 'PUBLISHED', now()
  ),
  (
    '51000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Registration Draft Event', 'Draft fixture.', 'Main Hall', 'Technology',
    now() + interval '5 days', now() + interval '5 days 2 hours',
    now() + interval '4 days', 10, 'DRAFT', null
  ),
  (
    '51000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Registration Cancelled Event', 'Cancelled fixture.', 'Main Hall', 'Technology',
    now() + interval '6 days', now() + interval '6 days 2 hours',
    now() + interval '5 days', 10, 'CANCELLED', now()
  ),
  (
    '51000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Registration Postponed Event', 'Postponed fixture.', 'Main Hall', 'Technology',
    now() + interval '7 days', now() + interval '7 days 2 hours',
    now() + interval '6 days', 10, 'POSTPONED', now()
  ),
  (
    '51000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Other Club Registration Event', 'Club head participation fixture.', 'West Hall', 'Arts',
    now() + interval '8 days', now() + interval '8 days 2 hours',
    now() + interval '7 days', 10, 'PUBLISHED', now()
  );

insert into public.event_registrations (event_id, student_id)
values (
  '51000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000004'
);

select tests.authenticate_as('member@example.test');
select lives_ok(
  $$select * from public.register_for_event('51000000-0000-0000-0000-000000000001')$$,
  'an active student can register for an open published event'
);
select is(
  (select status from public.event_registrations
   where event_id = '51000000-0000-0000-0000-000000000001'
     and student_id = '10000000-0000-0000-0000-000000000003'),
  'REGISTERED',
  'registration is stored as registered'
);
select is(
  (select count(*)::integer from public.event_registrations
   where event_id = '51000000-0000-0000-0000-000000000001'
     and status = 'REGISTERED'),
  1,
  'registered count reflects the authoritative database state'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.assert_active_event_student()', 'EXECUTE'
  ),
  'authenticated clients cannot call the internal identity helper'
);
select throws_ok(
  $$select * from public.register_for_event('51000000-0000-0000-0000-000000000001')$$,
  '23505',
  'You are already registered for this event.',
  'a duplicate active registration is rejected'
);
select throws_ok(
  $$select * from public.register_for_event('51000000-0000-0000-0000-000000000002')$$,
  '23514',
  'Event is at capacity.',
  'a full event rejects registration'
);
select throws_ok(
  $$select * from public.register_for_event('51000000-0000-0000-0000-000000000003')$$,
  '22023',
  'The registration deadline has passed.',
  'registration after the deadline is rejected'
);
select throws_ok(
  $$select * from public.register_for_event('51000000-0000-0000-0000-000000000004')$$,
  '22023',
  'Event is not currently accepting registrations.',
  'draft events cannot accept registrations'
);
select throws_ok(
  $$select * from public.register_for_event('51000000-0000-0000-0000-000000000005')$$,
  '22023',
  'Event is not currently accepting registrations.',
  'cancelled events cannot accept registrations'
);
select throws_ok(
  $$select * from public.register_for_event('51000000-0000-0000-0000-000000000006')$$,
  '22023',
  'Event is not currently accepting registrations.',
  'postponed events cannot accept registrations until republished'
);
select set_config(
  'test.registration_id',
  (select registration_id::text from public.event_registrations
   where event_id = '51000000-0000-0000-0000-000000000001'
     and student_id = '10000000-0000-0000-0000-000000000003'),
  true
);
select is(
  (select count(*)::integer from public.list_my_event_registrations()),
  1,
  'registration history is scoped to the authenticated student'
);
select is(
  (select count(*)::integer from public.list_my_event_registrations(true)),
  1,
  'upcoming registrations include the active future registration'
);
select is(
  (select count(*)::integer from public.list_managed_events(
    '20000000-0000-0000-0000-000000000001', 100, 0
  ) where event_id = '51000000-0000-0000-0000-000000000001'),
  0,
  'students cannot access club-head event dashboards'
);

select lives_ok(
  $$select * from public.cancel_event_registration('51000000-0000-0000-0000-000000000001')$$,
  'a student can cancel their own registration'
);
select is(
  (select status from public.event_registrations
   where registration_id = current_setting('test.registration_id')::uuid),
  'CANCELLED',
  'cancellation updates the existing row instead of deleting it'
);
select is(
  (select count(*)::integer from public.list_my_event_registrations()
   where registration_status = 'CANCELLED'),
  1,
  'registration history retains cancelled registrations'
);
select is(
  (select registration_count::integer
   from public.cancel_event_registration('51000000-0000-0000-0000-000000000001')),
  1,
  'cancellation decrements the current registered count'
);
select lives_ok(
  $$select * from public.register_for_event('51000000-0000-0000-0000-000000000001')$$,
  'a student can re-register after cancellation'
);
select is(
  (select registration_id::text from public.event_registrations
   where event_id = '51000000-0000-0000-0000-000000000001'
     and student_id = '10000000-0000-0000-0000-000000000003'),
  current_setting('test.registration_id'),
  're-registration reactivates the same unique registration row'
);
select is(
  (select count(*)::integer from public.list_my_upcoming_event_registrations()),
  1,
  'upcoming registrations are returned by the dedicated convenience RPC'
);

select tests.authenticate_as('president@example.test');
select lives_ok(
  $$select * from public.register_for_event('51000000-0000-0000-0000-000000000007')$$,
  'a club head can register for an event outside their assigned club'
);
select is(
  (select count(*)::integer from public.list_my_event_registrations()
   where event_id = '51000000-0000-0000-0000-000000000007'),
  1,
  'club heads can see their own registrations in My Registrations'
);

select tests.authenticate_as('global-admin@example.test');
select throws_ok(
  $$select * from public.register_for_event('51000000-0000-0000-0000-000000000007')$$,
  '42501',
  'Only active students or club heads can use event registration.',
  'admins without a student or club-head role cannot register'
);

select tests.authenticate_as('member@example.test');
select throws_ok(
  $$select * from public.cancel_event_registration('51000000-0000-0000-0000-000000000002')$$,
  'P0002',
  'Registration not found.',
  'a student cannot cancel another student registration'
);

reset role;
update public.profiles set is_active = false
where id = '10000000-0000-0000-0000-000000000003';
select tests.authenticate_as('member@example.test');
select throws_ok(
  $$select * from public.list_my_event_registrations()$$,
  '42501',
  'Only active students or club heads can use event registration.',
  'inactive profiles cannot use registration workflows'
);
reset role;
update public.profiles set is_active = true
where id = '10000000-0000-0000-0000-000000000003';

select * from finish();
rollback;
