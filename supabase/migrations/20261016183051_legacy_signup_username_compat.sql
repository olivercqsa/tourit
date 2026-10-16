-- Keep older signup clients working during the rollout. The updated app requires
-- usernames; accounts created by older clients remain username-less and are routed
-- through the required username setup screen on their next sign-in.
create or replace function public.create_tourit_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_type text;
  chosen_name text;
  chosen_username text;
  organisation uuid;
  provider_name text;
begin
  chosen_type := new.raw_user_meta_data ->> 'account_type';
  provider_name := new.raw_app_meta_data ->> 'provider';
  chosen_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'preferred_username'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'New Tourit member'
  );
  chosen_name := left(chosen_name, 100);

  if chosen_type is null or chosen_type not in ('talent','host') then
    if provider_name = 'email' or chosen_type is not null then
      raise exception 'Choose talent or host as your account type';
    end if;
    insert into public.profiles(id,display_name,account_type)
      values(new.id,chosen_name,null);
    return new;
  end if;

  chosen_username := nullif(lower(btrim(new.raw_user_meta_data ->> 'username')), '');
  if chosen_username is not null and (
    char_length(chosen_username) not between 3 and 24
    or chosen_username !~ '^[a-z0-9]([a-z0-9_]{1,22}[a-z0-9])$'
  ) then
    raise exception 'Username must be 3–24 lowercase letters, numbers or underscores, with a letter or number at each end';
  end if;
  if chosen_username is not null and exists (
    select 1 from public.profiles p where lower(p.username) = chosen_username
  ) then
    raise exception 'That username is already in use. Choose another one.'
      using errcode = '23505', constraint = 'profiles_username_unique_idx';
  end if;

  insert into public.profiles(id,display_name,account_type,username)
    values(new.id,chosen_name,chosen_type,chosen_username);
  if chosen_type = 'talent' then
    insert into public.talent_profiles(user_id) values(new.id);
  else
    insert into public.organisations(name) values(chosen_name) returning id into organisation;
    insert into public.organisation_members(organisation_id,user_id,member_role)
      values(organisation,new.id,'owner');
  end if;
  return new;
end;
$$;
revoke all on function public.create_tourit_account() from public, anon, authenticated;
