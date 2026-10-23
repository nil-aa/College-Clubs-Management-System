begin;
select plan(15);

select is(
  (select domain from public.allowed_signup_email_domains where domain = 'ssn.edu.in'),
  'ssn.edu.in', 'the initial college domain is enabled'
);
set local role anon;
select is(public.check_signup_email_eligibility('Student@SSN.EDU.IN'), true, 'public signup precheck accepts the approved domain');
select is(public.check_signup_email_eligibility('student@ssn.edu.in.example.com'), false, 'public signup precheck rejects deceptive suffixes');
reset role;

select throws_ok(
  $$insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'person@gmail.com', '', now(), '{}', '{}', now(), now())$$,
  '23514', 'direct auth inserts reject unapproved email domains'
);
select throws_ok(
  $$insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'person@ssn.edu.in.example.com', '', now(), '{}', '{}', now(), now())$$,
  '23514', 'deceptive suffix domains are rejected'
);
select throws_ok(
  $$insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'malformed-email', '', now(), '{}', '{}', now(), now())$$,
  '22023', 'malformed email addresses are rejected'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select throws_ok($$select public.add_allowed_signup_email_domain('newcollege.edu')$$, '42501', 'ordinary users cannot change the allowlist');
select throws_ok($$select * from public.list_allowed_signup_email_domains()$$, '42501', 'ordinary users cannot read the allowlist');

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select lives_ok($$select public.add_allowed_signup_email_domain(' NewCollege.edu ')$$, 'administrators can add normalized domains');
select is((select count(*) from public.allowed_signup_email_domains where domain = 'newcollege.edu'), 1::bigint, 'added domain is available to the signup trigger');
select lives_ok(
  $$insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@ssn.edu.in', '', now(), '{}', '{}', now(), now())$$,
  'a direct auth insert succeeds for the initial approved domain'
);
select lives_ok(
  $$insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('11000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@newcollege.edu', '', now(), '{}', '{}', now(), now())$$,
  'a direct auth insert succeeds after an administrator adds the domain'
);
select lives_ok($$select public.remove_allowed_signup_email_domain('newcollege.edu')$$, 'administrators can remove a domain');
select throws_ok(
  $$insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('11000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@newcollege.edu', '', now(), '{}', '{}', now(), now())$$,
  '23514', 'signup is rejected after an administrator removes the domain'
);
select throws_ok($$select public.remove_allowed_signup_email_domain('ssn.edu.in')$$, '23514', 'the last allowed domain cannot be removed');

select * from finish();
rollback;
