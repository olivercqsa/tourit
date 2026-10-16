-- Shared listings, availability, saved jobs, shortlists and applications.
begin;

create table public.talent_availability (
  user_id uuid not null references public.talent_profiles(user_id) on delete cascade,
  available_on date not null,
  is_available boolean not null,
  primary key (user_id, available_on)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 160),
  game text not null,
  role text not null,
  payment_type text not null check (payment_type in ('Paid','Unpaid','Volunteer','Negotiable')),
  budget_minor integer not null default 0 check (budget_minor >= 0),
  currency text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  location text not null default 'Remote',
  work_mode text not null check (work_mode in ('Remote','On-site')),
  event_date date not null,
  application_deadline date not null,
  min_experience integer not null default 0 check (min_experience between 0 and 100),
  description text not null check (char_length(description) between 10 and 12000),
  cover_path text,
  status text not null default 'open' check (status in ('draft','open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (application_deadline <= event_date)
);
create index jobs_public_listing_idx on public.jobs(status, application_deadline, created_at desc);
create index jobs_org_idx on public.jobs(organisation_id, created_at desc);

create table public.saved_jobs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id,job_id)
);

create table public.shortlisted_talent (
  recruiter_id uuid not null references public.profiles(id) on delete cascade,
  talent_id uuid not null references public.talent_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recruiter_id,talent_id),
  check (recruiter_id <> talent_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  talent_id uuid not null references public.talent_profiles(user_id) on delete cascade,
  message text not null check (char_length(message) between 10 and 5000),
  experience text not null default '' check (char_length(experience) <= 3000),
  portfolio_url text not null check (portfolio_url ~ '^https?://'),
  status text not null default 'Submitted'
    check (status in ('Submitted','Under Review','Shortlisted','Accepted','Rejected')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id,talent_id)
);
create index applications_job_idx on public.applications(job_id,submitted_at desc);
create index applications_talent_idx on public.applications(talent_id,submitted_at desc);

create table public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  changed_by uuid not null references public.profiles(id),
  old_status text,
  new_status text not null check (new_status in ('Submitted','Under Review','Shortlisted','Accepted','Rejected')),
  changed_at timestamptz not null default now()
);

alter table public.talent_availability enable row level security;
alter table public.jobs enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.shortlisted_talent enable row level security;
alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;

revoke all on public.talent_availability,public.jobs,public.saved_jobs,
  public.shortlisted_talent,public.applications,public.application_status_history
  from anon,authenticated;
grant select on public.talent_availability,public.jobs to anon,authenticated;
grant insert,update,delete on public.talent_availability to authenticated;
grant insert,update,delete on public.jobs to authenticated;
grant select,insert,update,delete on public.saved_jobs,public.shortlisted_talent to authenticated;
grant select,insert on public.applications to authenticated;
grant update(status) on public.applications to authenticated;
grant select on public.application_status_history to authenticated;

create policy availability_public_read on public.talent_availability for select to anon,authenticated
  using (exists (select 1 from public.talent_profiles t where t.user_id=talent_availability.user_id and t.published)
    or user_id=(select auth.uid()));
create policy availability_owner_write on public.talent_availability for all to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy jobs_public_read on public.jobs for select to anon
  using (status='open' and application_deadline >= current_date);
create policy jobs_signedin_read on public.jobs for select to authenticated
  using (status='open' and application_deadline >= current_date or exists (
    select 1 from public.organisation_members m where m.organisation_id=jobs.organisation_id and m.user_id=(select auth.uid())
  ));
create policy jobs_member_insert on public.jobs for insert to authenticated
  with check (created_by=(select auth.uid()) and exists (
    select 1 from public.organisation_members m where m.organisation_id=jobs.organisation_id and m.user_id=(select auth.uid())
  ));
create policy jobs_member_update on public.jobs for update to authenticated
  using (exists (select 1 from public.organisation_members m where m.organisation_id=jobs.organisation_id and m.user_id=(select auth.uid())))
  with check (exists (select 1 from public.organisation_members m where m.organisation_id=jobs.organisation_id and m.user_id=(select auth.uid())));
create policy jobs_member_delete on public.jobs for delete to authenticated
  using (exists (select 1 from public.organisation_members m where m.organisation_id=jobs.organisation_id and m.user_id=(select auth.uid())));

create policy saved_owner_all on public.saved_jobs for all to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy shortlist_owner_all on public.shortlisted_talent for all to authenticated
  using (recruiter_id=(select auth.uid()) and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='host'))
  with check (recruiter_id=(select auth.uid()) and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='host'));

create policy applications_visible_to_parties on public.applications for select to authenticated
  using (talent_id=(select auth.uid()) or exists (
    select 1 from public.jobs j join public.organisation_members m on m.organisation_id=j.organisation_id
    where j.id=applications.job_id and m.user_id=(select auth.uid())
  ));
create policy applications_submit on public.applications for insert to authenticated
  with check (status='Submitted' and talent_id=(select auth.uid()) and exists (
    select 1 from public.talent_profiles t where t.user_id=(select auth.uid()) and t.published
  ) and exists (
    select 1 from public.jobs j where j.id=applications.job_id and j.status='open'
      and j.application_deadline >= current_date
  ));
create policy applications_recruiter_update on public.applications for update to authenticated
  using (exists (
    select 1 from public.jobs j join public.organisation_members m on m.organisation_id=j.organisation_id
    where j.id=applications.job_id and m.user_id=(select auth.uid())
  )) with check (exists (
    select 1 from public.jobs j join public.organisation_members m on m.organisation_id=j.organisation_id
    where j.id=applications.job_id and m.user_id=(select auth.uid())
  ));
create policy application_history_party_read on public.application_status_history for select to authenticated
  using (exists (
    select 1 from public.applications a where a.id=application_status_history.application_id
      and (a.talent_id=(select auth.uid()) or exists (
        select 1 from public.jobs j join public.organisation_members m on m.organisation_id=j.organisation_id
        where j.id=a.job_id and m.user_id=(select auth.uid())
      ))
  ));

-- Status changes are recorded by the database; clients cannot forge history.
create function public.record_application_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.application_status_history(application_id,changed_by,old_status,new_status)
    values(new.id,(select auth.uid()),old.status,new.status);
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.record_application_status_change() from public,anon,authenticated;
create trigger application_status_audit before update on public.applications
  for each row execute function public.record_application_status_change();

commit;
