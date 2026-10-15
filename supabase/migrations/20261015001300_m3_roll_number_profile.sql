-- roll_number is the current schema's text field for a student's register number.
-- Validate inserted or changed values without blocking updates to legacy rows.
alter table public.profiles
  drop constraint if exists profiles_roll_number_check;

grant update (roll_number) on public.profiles to authenticated;

create or replace function public.validate_profile_roll_number()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_roll_number_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_roll_number_changed := new.roll_number is not null;
  else
    v_roll_number_changed := new.roll_number is distinct from old.roll_number;
  end if;

  if v_roll_number_changed
      and new.roll_number is not null
      and new.roll_number !~ '^[0-9]{10}$' then
    raise exception 'Register number must contain exactly 10 digits.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_profile_roll_number() from public, anon, authenticated;
drop trigger if exists profiles_validate_roll_number on public.profiles;
create trigger profiles_validate_roll_number
  before insert or update of roll_number on public.profiles
  for each row execute function public.validate_profile_roll_number();

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
  if new.roll_number is distinct from old.roll_number then
    changed_fields := array_append(changed_fields, 'roll_number');
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
