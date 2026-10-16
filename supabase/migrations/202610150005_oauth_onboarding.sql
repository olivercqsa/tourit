-- Allow OAuth identities to be created before Tourit account type is selected.
-- Apply after migrations 001-004. Pending accounts remain private and cannot use
-- role-specific features until complete_oauth_onboarding is called.
begin;

alter table public.profiles alter column account_type drop not null;

create or replace function public.create_tourit_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_type text;
  chosen_name text;
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
    -- OAuth accounts are completed through the authenticated onboarding RPC.
    insert into public.profiles(id,display_name,account_type)
      values(new.id,chosen_name,null);
    return new;
  end if;

  insert into public.profiles(id,display_name,account_type)
    values(new.id,chosen_name,chosen_type);
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

create or replace function public.complete_oauth_onboarding(
  p_account_type text,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_type text;
  chosen_name text := btrim(p_display_name);
  organisation uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to finish account setup';
  end if;
  if p_account_type is null or p_account_type not in ('talent','host') then
    raise exception 'Choose talent or host as your account type';
  end if;
  if chosen_name is null or char_length(chosen_name) not between 1 and 100 then
    raise exception 'Display name must contain 1 to 100 characters';
  end if;

  select p.account_type into current_type
    from public.profiles p where p.id = current_user_id for update;
  if not found then
    raise exception 'Tourit profile was not created';
  end if;
  if current_type is not null then
    raise exception 'Your Tourit account is already set up';
  end if;

  update public.profiles
    set display_name = chosen_name, account_type = p_account_type
    where id = current_user_id;
  if p_account_type = 'talent' then
    insert into public.talent_profiles(user_id) values(current_user_id);
  else
    insert into public.organisations(name) values(chosen_name) returning id into organisation;
    insert into public.organisation_members(organisation_id,user_id,member_role)
      values(organisation,current_user_id,'owner');
  end if;
end;
$$;
revoke all on function public.complete_oauth_onboarding(text,text) from public, anon;
grant execute on function public.complete_oauth_onboarding(text,text) to authenticated;

commit;
