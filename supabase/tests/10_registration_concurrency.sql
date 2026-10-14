-- Exercise the capacity lock with two database sessions racing for one seat.
-- dblink is test-only; it is not required by the application migration.
create extension if not exists dblink with schema extensions;

begin;
select plan(3);

reset role;
create or replace function public.test_register_for_event_race(p_event_id uuid)
returns text
language plpgsql
as $$
begin
  perform public.register_for_event(p_event_id);
  return 'REGISTERED';
exception when check_violation then
  return 'FULL';
end;
$$;
grant execute on function public.test_register_for_event_race(uuid) to authenticated;

insert into public.events (
  event_id, club_id, created_by, title, venue, start_time, end_time,
  registration_deadline, capacity, status, published_at
)
values (
  '52000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Concurrent Last Seat', 'Main Hall', now() + interval '3 days',
  now() + interval '3 days 2 hours', now() + interval '2 days',
  1, 'PUBLISHED', now()
);
commit;

select extensions.dblink_connect('registration_racer_a', 'dbname=' || current_database());
select extensions.dblink_connect('registration_racer_b', 'dbname=' || current_database());
select extensions.dblink_exec('registration_racer_a', 'set role authenticated');
select extensions.dblink_exec('registration_racer_b', 'set role authenticated');
select extensions.dblink_exec(
  'registration_racer_a',
  'set request.jwt.claim.sub = ''10000000-0000-0000-0000-000000000003'''
);
select extensions.dblink_exec(
  'registration_racer_b',
  'set request.jwt.claim.sub = ''10000000-0000-0000-0000-000000000004'''
);

-- Both remote registration calls begin while this transaction owns the event
-- lock. Releasing it lets the calls race for the same last seat.
begin;
select event_id from public.events
where event_id = '52000000-0000-0000-0000-000000000001'
for update;
select extensions.dblink_send_query(
  'registration_racer_a',
  $$select public.test_register_for_event_race('52000000-0000-0000-0000-000000000001')$$
);
select extensions.dblink_send_query(
  'registration_racer_b',
  $$select public.test_register_for_event_race('52000000-0000-0000-0000-000000000001')$$
);
commit;

create temporary table registration_race_results(result text);
insert into registration_race_results
select status from extensions.dblink_get_result('registration_racer_a') as t(status text);
insert into registration_race_results
select status from extensions.dblink_get_result('registration_racer_b') as t(status text);

select is(
  (select count(*)::integer from registration_race_results where result = 'REGISTERED'),
  1,
  'exactly one concurrent student gets the last seat'
);
select is(
  (select count(*)::integer from registration_race_results where result = 'FULL'),
  1,
  'the other concurrent student sees the event as full'
);
select is(
  (select count(*)::integer from public.event_registrations
   where event_id = '52000000-0000-0000-0000-000000000001'
     and status = 'REGISTERED'),
  1,
  'the persisted active registration count never exceeds capacity'
);

select extensions.dblink_disconnect('registration_racer_a');
select extensions.dblink_disconnect('registration_racer_b');
reset role;
delete from public.event_registrations
where event_id = '52000000-0000-0000-0000-000000000001';
delete from public.events
where event_id = '52000000-0000-0000-0000-000000000001';
drop function public.test_register_for_event_race(uuid);
select * from finish();
commit;
