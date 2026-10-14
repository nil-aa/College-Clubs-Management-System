alter table public.profiles
  add column if not exists department text,
  add column if not exists year_of_study integer;

alter table public.profiles
  drop constraint if exists profiles_year_of_study_check,
  add constraint profiles_year_of_study_check
    check (year_of_study is null or year_of_study between 1 and 10);

drop policy if exists profiles_select_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, department, year_of_study, phone) on public.profiles to authenticated;

create or replace function public.audit_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_fields text[] := array[]::text[];
begin
  if new.full_name is distinct from old.full_name then
    changed_fields := array_append(changed_fields, 'full_name');
  end if;
  if new.department is distinct from old.department then
    changed_fields := array_append(changed_fields, 'department');
  end if;
  if new.year_of_study is distinct from old.year_of_study then
    changed_fields := array_append(changed_fields, 'year_of_study');
  end if;
  if new.phone is distinct from old.phone then
    changed_fields := array_append(changed_fields, 'phone');
  end if;

  if cardinality(changed_fields) > 0 then
    perform public.log_audit(
      'profile.updated',
      'profiles',
      new.id,
      jsonb_build_object('changed_fields', changed_fields)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_audit_update on public.profiles;
create trigger profiles_audit_update
  after update on public.profiles
  for each row execute function public.audit_profile_update();
