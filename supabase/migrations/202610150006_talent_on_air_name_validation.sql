-- Restrict talent on-air names to short, plain-text handles.
-- Hosts retain the existing 1–100 character organisation-name allowance.
begin;

do $$
begin
  if exists (
    select 1 from public.profiles p
    where p.account_type = 'talent'
      and not (
        char_length(p.display_name) between 1 and 16
        and p.display_name ~ '^[A-Za-z0-9]([A-Za-z0-9 ._-]{0,14}[A-Za-z0-9])?$'
      )
  ) then
    raise exception 'Existing talent display names need to be updated to 1–16 safe characters before this validation migration can be applied';
  end if;
end;
$$;

alter table public.profiles
  add constraint profiles_talent_on_air_name_check
  check (
    account_type is distinct from 'talent'
    or (
      char_length(display_name) between 1 and 16
      and display_name ~ '^[A-Za-z0-9]([A-Za-z0-9 ._-]{0,14}[A-Za-z0-9])?$'
    )
  );

commit;
