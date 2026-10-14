-- Run this entire file in the hosted Supabase SQL Editor.
-- The final result set is the TAP output; rollback leaves no fixtures behind.

begin;
select plan(10);

reset role;
insert into public.clubs(id, name, is_active, created_by)
values
  ('20000000-0000-0000-0000-000000000009', 'Inactive Head Club', false, '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000010', 'Other Inactive Club', false, '10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;
insert into public.user_roles(user_id, role_id, club_id, assigned_by, status)
select '10000000-0000-0000-0000-000000000008', r.id,
       '20000000-0000-0000-0000-000000000009',
       '10000000-0000-0000-0000-000000000001', 'active'
from public.roles r where r.code = 'club_head'
on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select throws_ok($$select public.create_club('Student Cannot Create')$$, '42501', 'Only admins can create clubs.', 'non-admins cannot call create_club');
select is((select count(*) from public.clubs where is_active = false), 0::bigint, 'students cannot see inactive clubs');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select throws_ok($$select public.create_club('Demo Computing Club')$$, '23505', 'A club with this name already exists.', 'duplicate club names are rejected');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000008', true);
select is((select count(*) from public.clubs where id = '20000000-0000-0000-0000-000000000009'), 1::bigint, 'a head sees the inactive club assigned to them');
select is((select count(*) from public.clubs where id = '20000000-0000-0000-0000-000000000010'), 0::bigint, 'a head cannot see another inactive club');
select ok(not public.can_manage_club('20000000-0000-0000-0000-000000000010'::uuid), 'a head cannot manage another club');
select ok((select count(*) from public.get_club_heads('20000000-0000-0000-0000-000000000009')) = 1, 'head lookup returns the assigned head');
select ok((select to_jsonb(h) - 'id' - 'full_name' from public.get_club_heads('20000000-0000-0000-0000-000000000009') h limit 1) = '{}'::jsonb, 'head lookup exposes only id and full_name');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select lives_ok($$select public.set_club_active('20000000-0000-0000-0000-000000000009', true)$$, 'admins can activate clubs through the RPC');
select is((select count(*) from public.audit_logs where action = 'club.activated' and entity_id = '20000000-0000-0000-0000-000000000009'), 1::bigint, 'activation is audited');

select * from finish();
rollback;
