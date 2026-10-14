-- Run this entire file in the hosted Supabase SQL Editor.
-- It returns the TAP result set and rolls back all notification fixtures.

begin;
select plan(16);

reset role;
insert into public.notifications (id, user_id, type, title, message, is_read)
values
  ('31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'event_published', 'Test own notification', 'Own row.', false),
  ('31000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'event_published', 'Test other notification', 'Other row.', false)
on conflict (id) do update set is_read = false;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.notifications where id = '31000000-0000-0000-0000-000000000001'), 1::bigint, 'a user can read their own notification');
select is((select count(*) from public.notifications where id = '31000000-0000-0000-0000-000000000002'), 0::bigint, 'a user cannot read another user notification');
select is(public.mark_notification_read('31000000-0000-0000-0000-000000000002'), false, 'a user cannot mark another user notification as read');
reset role;
select is((select is_read from public.notifications where id = '31000000-0000-0000-0000-000000000002'), false, 'another user notification remains unread');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select throws_ok($$select public.send_notification('10000000-0000-0000-0000-000000000003', 'event_published', 'Nope', 'Nope', null::uuid)$$, '42501', 'permission denied for function send_notification', 'authenticated users cannot call send_notification directly');
select throws_ok($$select public.send_notification_bulk(array['10000000-0000-0000-0000-000000000003'::uuid], 'event_published', 'Nope', 'Nope', null::uuid)$$, '42501', 'permission denied for function send_notification_bulk', 'authenticated users cannot call send_notification_bulk directly');
select throws_ok($$select public.get_active_student_ids()$$, '42501', 'permission denied for function get_active_student_ids', 'authenticated users cannot call get_active_student_ids directly');

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select throws_ok($$select public.send_notification('10000000-0000-0000-0000-000000000003', 'not_allowed', 'Bad', 'Bad', null::uuid)$$, '22023', 'Unsupported notification type.', 'invalid notification types are rejected');
reset role;
select lives_ok($$select public.send_notification(
  '10000000-0000-0000-0000-000000000003',
  'club_head.assigned',
  'Club assignment message test',
  'You are now a club head for Regular Member.',
  array['in_app']::text[],
  jsonb_build_object('club_id', '20000000-0000-0000-0000-000000000001')
)$$, 'internal club-head notification creation succeeds');
select is((select message from public.notifications where user_id = '10000000-0000-0000-0000-000000000003' and title = 'Club assignment message test' order by created_at desc limit 1), 'You are now a club head for Demo Computing Club.', 'club-head assignment notifications use the club name');
select is(public.send_notification_bulk(array['10000000-0000-0000-0000-000000000003'::uuid, null::uuid, '10000000-0000-0000-0000-000000000003'::uuid, '10000000-0000-0000-0000-000000000004'::uuid], 'event_published', 'Bulk test', 'Bulk body', null::uuid), 2, 'bulk delivery skips null and duplicate ids');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select ok(public.mark_notification_read('31000000-0000-0000-0000-000000000001'), 'a user can mark their own notification read');
select is((select is_read from public.notifications where id = '31000000-0000-0000-0000-000000000001'), true, 'the own notification is now read');
select ok(public.mark_all_notifications_read() >= 1, 'mark_all marks the caller rows');
reset role;
select is((select is_read from public.notifications where id = '31000000-0000-0000-0000-000000000002'), false, 'mark_all does not touch another user row');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select throws_ok($$update public.notifications set title = 'changed' where id = '31000000-0000-0000-0000-000000000001'$$, '42501', 'permission denied for table notifications', 'authenticated users cannot directly update notification content');

select * from finish();
rollback;
