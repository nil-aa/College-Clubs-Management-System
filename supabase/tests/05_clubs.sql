begin;

select plan(10);

reset role;
insert into public.clubs(id, name, is_active, created_by)
values ('20000000-0000-0000-0000-000000000009', 'Inactive Head Club', false,
        '10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;
select tests.authenticate_as('member@example.test');
select throws_ok(
  $$select public.create_club('Student Cannot Create')$$,
  '42501',
  'Only admins can create clubs.',
  'non-admins cannot call create_club'
);
select is(
  (select count(*)::integer from public.clubs where id = '20000000-0000-0000-0000-000000000009'),
  0,
  'a student cannot see an inactive club'
);

select tests.authenticate_as('global-admin@example.test');
select throws_ok(
  $$select public.create_club('Demo Computing Club')$$,
  '23505',
  'A club with this name already exists.',
  'duplicate club names are rejected'
);

reset role;
insert into public.clubs(id, name, is_active, created_by)
values
  ('20000000-0000-0000-0000-000000000009', 'Inactive Head Club', false,
   '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000010', 'Other Inactive Club', false,
   '10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;
insert into public.user_roles(user_id, role_id, club_id, assigned_by, status)
select '10000000-0000-0000-0000-000000000008', r.id,
       '20000000-0000-0000-0000-000000000009',
       '10000000-0000-0000-0000-000000000001', 'active'
from public.roles r where r.code = 'club_head'
on conflict do nothing;
select tests.authenticate_as('club-head-two@example.test');
select is(
  (select count(*)::integer from public.clubs where id = '20000000-0000-0000-0000-000000000009'),
  1,
  'a club head can see their assigned inactive club'
);
select is(
  (select count(*)::integer from public.clubs where id = '20000000-0000-0000-0000-000000000010'),
  0,
  'a club head cannot see another inactive club'
);
select ok(
  not public.can_manage_club('20000000-0000-0000-0000-000000000010'),
  'a club head cannot manage another club'
);
select ok(
  (select count(*) from public.get_club_heads('20000000-0000-0000-0000-000000000009')) = 1,
  'club head lookup returns the active head'
);
select ok(
  (select to_jsonb(h) - 'id' - 'full_name' from public.get_club_heads('20000000-0000-0000-0000-000000000009') h limit 1) = '{}'::jsonb,
  'club head lookup exposes only id and full_name'
);

select tests.authenticate_as('global-admin@example.test');
select lives_ok(
  $$select public.set_club_active('20000000-0000-0000-0000-000000000009', true)$$,
  'admins can activate clubs through the RPC'
);
select is(
  (select count(*)::integer from public.audit_logs where action = 'club.activated' and entity_id = '20000000-0000-0000-0000-000000000009'),
  1,
  'club activation is audited'
);

select * from finish();
rollback;
