-- Authentication foundation only. Apply once through Supabase SQL Editor.
-- Jobs, applications, messaging and Storage follow in separate migrations.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  account_type text not null check (account_type in ('talent', 'host')),
  created_at timestamptz not null default now()
);

create table public.talent_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'Play-by-play Caster',
  games text[] not null default '{}',
  languages text[] not null default '{English}',
  location text not null default '',
  region text not null default 'EU',
  experience_years integer not null default 0 check (experience_years between 0 and 100),
  work_mode text not null default 'Both' check (work_mode in ('Remote','On-site','Both')),
  brief text not null default '' check (char_length(brief) <= 140),
  bio text not null default '' check (char_length(bio) <= 20000),
  portfolio_url text not null default '' check (portfolio_url = '' or portfolio_url ~ '^https?://'),
  past_events text[] not null default '{}',
  published boolean not null default false
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '',
  website text not null default '' check (website = '' or website ~ '^https?://'),
  past_productions text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.organisation_members (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'owner' check (member_role in ('owner','recruiter')),
  primary key (organisation_id,user_id)
);
create index organisation_members_user_idx on public.organisation_members(user_id);

alter table public.profiles enable row level security;
alter table public.talent_profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;

-- Explicit grants: RLS selects rows; column grants limit what can be changed.
revoke all on public.profiles, public.talent_profiles, public.organisations,
  public.organisation_members from anon, authenticated;
grant select on public.profiles, public.talent_profiles, public.organisations to anon, authenticated;
grant select on public.organisation_members to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant update(role,games,languages,location,region,experience_years,work_mode,
  brief,bio,portfolio_url,past_events,published) on public.talent_profiles to authenticated;
grant update(name,description,website,past_productions,published) on public.organisations to authenticated;

create policy talent_read on public.talent_profiles for select
  using (published or user_id = (select auth.uid()));
create policy talent_edit on public.talent_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy membership_read on public.organisation_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy organisation_public_read on public.organisations for select to anon
  using (published);
create policy organisation_member_read on public.organisations for select to authenticated
  using (published or exists (
    select 1 from public.organisation_members m
    where m.organisation_id = organisations.id and m.user_id = (select auth.uid())
  ));
create policy organisation_edit on public.organisations for update to authenticated
  using (exists (
    select 1 from public.organisation_members m
    where m.organisation_id = organisations.id and m.user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.organisation_members m
    where m.organisation_id = organisations.id and m.user_id = (select auth.uid())
  ));
create policy profile_read on public.profiles for select
  using (id = (select auth.uid()) or exists (
    select 1 from public.talent_profiles t where t.user_id = profiles.id and t.published
  ));
create policy profile_edit on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Account type is selected once at signup. Organisation membership is created
-- here, never accepted from client-supplied organisation IDs or role claims.
create function public.create_tourit_account()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  chosen_type text;
  chosen_name text;
  organisation uuid;
begin
  chosen_type := new.raw_user_meta_data ->> 'account_type';
  chosen_name := btrim(new.raw_user_meta_data ->> 'display_name');
  if chosen_type is null or chosen_type not in ('talent','host') then
    raise exception 'Choose talent or host as your account type';
  end if;
  if chosen_name is null or char_length(chosen_name) not between 1 and 100 then
    raise exception 'Display name must contain 1 to 100 characters';
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
create trigger create_tourit_account after insert on auth.users
  for each row execute function public.create_tourit_account();

commit;
