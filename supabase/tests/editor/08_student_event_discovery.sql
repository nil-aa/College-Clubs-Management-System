begin;
select plan(23);

reset role;
insert into public.clubs (id, name, slug, description, category, is_active, created_by)
values (
  '20000000-0000-0000-0000-000000000020',
  'Inactive Discovery Test Club',
  'inactive-discovery-test-club',
  'Fixture club that should not appear in student discovery.',
  'Technology',
  false,
  '10000000-0000-0000-0000-000000000001'
)
on conflict (id) do update set is_active = false;

insert into public.events (
  event_id, club_id, created_by, title, description, venue, category,
  start_time, end_time, registration_deadline, capacity, status, published_at
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Robotics Summit', 'Build small drones together.', 'Engineering Hall', 'Technology',
    now() + interval '2 days', now() + interval '2 days 2 hours',
    now() + interval '1 day', 2, 'PUBLISHED', now()
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Night Sky Lab', 'Learn constellations with the astronomy group.', 'Observatory', 'Science',
    now() + interval '3 days', now() + interval '3 days 2 hours',
    now() + interval '2 days', 1, 'PUBLISHED', now()
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Cancelled Art Fair', 'The art fair has been cancelled.', 'Student Center', 'Culture',
    now() + interval '4 days', now() + interval '4 days 2 hours',
    now() + interval '3 days', 50, 'CANCELLED', now()
  ),
  (
    '50000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Postponed Culture Night', 'New date to be announced.', 'Main Quad', 'Culture',
    now() + interval '5 days', now() + interval '5 days 2 hours',
    now() + interval '4 days', 50, 'POSTPONED', now()
  ),
  (
    '50000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Alumni Lecture', 'A completed alumni lecture.', 'Lecture Hall', 'Alumni',
    now() + interval '6 days', now() + interval '6 days 2 hours',
    now() + interval '5 days', 100, 'COMPLETED', now()
  ),
  (
    '50000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Draft Robotics Meetup', 'A draft must stay private.', 'Workshop Room', 'Technology',
    now() + interval '7 days', now() + interval '7 days 2 hours',
    now() + interval '6 days', 20, 'DRAFT', null
  ),
  (
    '50000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000020',
    '10000000-0000-0000-0000-000000000001',
    'Inactive Club Event', 'This club is deactivated.', 'Old Hall', 'Technology',
    now() + interval '9 days', now() + interval '9 days 2 hours',
    now() + interval '7 days', 20, 'PUBLISHED', now()
  ),
  (
    '50000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Registration Deadline Passed', 'The deadline has passed.', 'Room 8', 'Deadline',
    now() + interval '8 days', now() + interval '8 days 2 hours',
    now() - interval '1 hour', 25, 'PUBLISHED', now()
  );

insert into public.event_registrations (event_id, student_id)
values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003');

select tests.authenticate_as('member@example.test');

select is(
  (select count(*)::integer from public.list_student_events()),
  6,
  'discovery includes published, postponed, cancelled, and completed events for active clubs'
);
select is(
  (select count(*)::integer from public.list_student_events(p_search => 'Robotics')),
  1,
  'search matches event titles'
);
select is(
  (select count(*)::integer from public.list_student_events(p_search => 'constellations')),
  1,
  'search matches event descriptions'
);
select is(
  (select count(*)::integer from public.list_student_events(
    p_club_id => '20000000-0000-0000-0000-000000000002'
  )),
  1,
  'club filter scopes discovery results'
);
select is(
  (select count(*)::integer from public.list_student_events(p_category => 'technology')),
  1,
  'category filter matches without case sensitivity'
);
select is(
  (select count(*)::integer from public.list_student_events(
    p_start_from => now() + interval '1 day',
    p_start_to => now() + interval '3 days 1 hour'
  )),
  2,
  'date filters apply to event start times with an exclusive upper bound'
);
select is(
  (select array_agg(event_id) from public.list_student_events()),
  array[
    '50000000-0000-0000-0000-000000000001'::uuid,
    '50000000-0000-0000-0000-000000000002'::uuid,
    '50000000-0000-0000-0000-000000000003'::uuid,
    '50000000-0000-0000-0000-000000000004'::uuid,
    '50000000-0000-0000-0000-000000000005'::uuid,
    '50000000-0000-0000-0000-000000000008'::uuid
  ],
  'discovery sorts by ascending start time with a stable event id tie-breaker'
);
select is(
  (select event_id from public.list_student_events(p_limit => 1, p_offset => 1)),
  '50000000-0000-0000-0000-000000000002'::uuid,
  'discovery pagination follows the sorted event order'
);
select is(
  (select registration_count::integer from public.list_student_events()
   where event_id = '50000000-0000-0000-0000-000000000001'),
  1,
  'registered count is computed from registration rows'
);
select is(
  (select registration_availability from public.list_student_events()
   where event_id = '50000000-0000-0000-0000-000000000001'),
  'AVAILABLE',
  'registration is available below capacity before the deadline'
);
select is(
  (select registration_availability from public.list_student_events()
   where event_id = '50000000-0000-0000-0000-000000000002'),
  'FULL',
  'registration is full at authoritative registered capacity'
);
select is(
  (select registration_availability from public.list_student_events()
   where event_id = '50000000-0000-0000-0000-000000000008'),
  'CLOSED',
  'registration closes when the stored deadline has passed'
);
select is(
  (select count(*)::integer from public.list_student_events()
   where status in ('POSTPONED', 'CANCELLED', 'COMPLETED')
     and registration_availability = 'CLOSED'),
  3,
  'postponed, cancelled, and completed events remain visible with registration closed'
);
select is(
  (select status from public.get_student_event('50000000-0000-0000-0000-000000000003')),
  'CANCELLED',
  'student event details include the current event status'
);
select is(
  (select venue from public.get_student_event('50000000-0000-0000-0000-000000000001')),
  'Engineering Hall',
  'student event details include the venue'
);
select is(
  (select registration_count::integer
   from public.get_student_event('50000000-0000-0000-0000-000000000001')),
  1,
  'student event details include the database registration count'
);
select is(
  (select registration_availability
   from public.get_student_event('50000000-0000-0000-0000-000000000002')),
  'FULL',
  'student event details include registration availability'
);
select is(
  (select count(*)::integer from public.events
   where event_id in (
     '50000000-0000-0000-0000-000000000006',
     '50000000-0000-0000-0000-000000000007'
   )),
  0,
  'RLS hides drafts and events from deactivated clubs'
);
select throws_ok(
  $$select * from public.get_student_event('50000000-0000-0000-0000-000000000006')$$,
  'P0002',
  'Event not found.',
  'draft event details are hidden from students'
);
select throws_ok(
  $$select * from public.list_student_events(
    p_start_from => now() + interval '3 days',
    p_start_to => now() + interval '2 days'
  )$$,
  '22023',
  'The end of the date range must be later than its start.',
  'invalid date ranges are rejected'
);
select throws_ok(
  $$select * from public.list_student_events(p_limit => 101)$$,
  '22023',
  'Limit must be between 1 and 100 and offset cannot be negative.',
  'pagination limits are validated'
);
select throws_ok(
  $$select * from public.list_student_events(p_search => repeat('x', 201))$$,
  '22023',
  'Search text must be 200 characters or fewer.',
  'excessively long search text is rejected'
);

reset role;
update public.profiles set is_active = false
where id = '10000000-0000-0000-0000-000000000003';
select tests.authenticate_as('member@example.test');
select throws_ok(
  $$select * from public.list_student_events()$$,
  '42501',
  'An active authenticated profile is required.',
  'inactive profiles cannot discover events'
);
reset role;
update public.profiles set is_active = true
where id = '10000000-0000-0000-0000-000000000003';

select * from finish();
rollback;
