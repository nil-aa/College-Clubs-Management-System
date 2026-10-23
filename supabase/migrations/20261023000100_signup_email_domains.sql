create table public.allowed_signup_email_domains (
  domain text primary key,
  created_at timestamptz not null default now(),
  constraint allowed_signup_email_domains_format check (
    domain = lower(btrim(domain))
    and length(domain) between 3 and 253
    and domain !~ '(^|\.)[a-z0-9-]{64,}(\.|$)'
    and domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  )
);

insert into public.allowed_signup_email_domains(domain) values ('ssn.edu.in')
on conflict (domain) do nothing;

alter table public.allowed_signup_email_domains enable row level security;
revoke all on public.allowed_signup_email_domains from anon, authenticated;

create or replace function public.list_allowed_signup_email_domains()
returns table(domain text)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_permission('users.manage') then
    raise exception 'Not authorized to manage signup domains.' using errcode = '42501';
  end if;
  return query select d.domain from public.allowed_signup_email_domains d order by d.domain;
end;
$$;

create or replace function public.add_allowed_signup_email_domain(p_domain text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_domain text := lower(btrim(coalesce(p_domain, '')));
begin
  if not public.has_permission('users.manage') then
    raise exception 'Not authorized to manage signup domains.' using errcode = '42501';
  end if;
  if length(v_domain) not between 3 and 253
     or v_domain ~ '(^|\.)[a-z0-9-]{64,}(\.|$)'
     or v_domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
    raise exception 'Enter a valid domain name, such as ssn.edu.in.' using errcode = '22023';
  end if;
  insert into public.allowed_signup_email_domains(domain) values (v_domain)
  on conflict (domain) do nothing;
  if not found then raise exception 'That domain is already allowed.' using errcode = '23505'; end if;
  return v_domain;
end;
$$;

create or replace function public.remove_allowed_signup_email_domain(p_domain text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_domain text := lower(btrim(coalesce(p_domain, '')));
begin
  if not public.has_permission('users.manage') then
    raise exception 'Not authorized to manage signup domains.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('allowed_signup_email_domains', 0));
  perform 1 from public.allowed_signup_email_domains where domain = v_domain for update;
  if not found then raise exception 'That domain is not currently allowed.' using errcode = 'P0002'; end if;
  if (select count(*) from public.allowed_signup_email_domains) <= 1 then
    raise exception 'At least one signup domain must remain allowed.' using errcode = '23514';
  end if;
  delete from public.allowed_signup_email_domains where domain = v_domain;
  return v_domain;
end;
$$;

create or replace function public.enforce_signup_email_domain()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_email text := lower(btrim(coalesce(new.email, ''))); v_domain text;
begin
  if v_email !~ '^[^[:space:]@.][^[:space:]@]*(\.[^[:space:]@.][^[:space:]@]*)*@[^[:space:]@]+\.[^[:space:]@]+$'
     or split_part(v_email, '@', 1) like '%..%' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  v_domain := substring(v_email from '@([^@]+)$');
  if not exists (select 1 from public.allowed_signup_email_domains d where d.domain = v_domain) then
    raise exception 'This email domain is not approved for sign-up. Use an approved college email address.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_signup_email_domain on auth.users;
create trigger enforce_signup_email_domain
  before insert on auth.users
  for each row execute function public.enforce_signup_email_domain();

revoke all on function public.list_allowed_signup_email_domains() from public, anon;
revoke all on function public.add_allowed_signup_email_domain(text) from public, anon;
revoke all on function public.remove_allowed_signup_email_domain(text) from public, anon;
grant execute on function public.list_allowed_signup_email_domains() to authenticated;
grant execute on function public.add_allowed_signup_email_domain(text) to authenticated;
grant execute on function public.remove_allowed_signup_email_domain(text) to authenticated;

comment on table public.allowed_signup_email_domains is
  'Private allowlist used by the auth.users insert trigger and permission-checked admin RPCs.';
