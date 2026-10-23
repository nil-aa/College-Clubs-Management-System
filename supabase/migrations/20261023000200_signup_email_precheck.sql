create or replace function public.check_signup_email_eligibility(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(btrim(coalesce(p_email, ''))) !~ '^[^[:space:]@.][^[:space:]@]*(\.[^[:space:]@.][^[:space:]@]*)*@[^[:space:]@]+\.[^[:space:]@]+$' then false
    when split_part(lower(btrim(p_email)), '@', 1) like '%..%' then false
    else exists (
      select 1
      from public.allowed_signup_email_domains d
      where d.domain = substring(lower(btrim(p_email)) from '@([^@]+)$')
    )
  end;
$$;

revoke all on function public.check_signup_email_eligibility(text) from public;
grant execute on function public.check_signup_email_eligibility(text) to anon, authenticated;

comment on function public.check_signup_email_eligibility(text) is
  'Signup-only precheck; returns eligibility for the supplied email without exposing the configured domain list. The auth.users trigger remains authoritative.';
