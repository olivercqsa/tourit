-- Recoverable job deletion with a strict 24-hour restoration window.
begin;

alter table public.jobs add column deleted_at timestamptz;
create index jobs_deleted_expiry_idx on public.jobs(deleted_at)
  where deleted_at is not null;

drop policy jobs_public_read on public.jobs;
create policy jobs_public_read on public.jobs for select to anon
  using (deleted_at is null and status='open' and application_deadline >= current_date);

drop policy jobs_signedin_read on public.jobs;
create policy jobs_signedin_read on public.jobs for select to authenticated
  using ((deleted_at is null and status='open' and application_deadline >= current_date)
    or exists (
      select 1 from public.organisation_members m
      where m.organisation_id=jobs.organisation_id and m.user_id=(select auth.uid())
    ));

-- A recruiter can soft-delete and recover their own organisation's listings,
-- but can never bypass the recovery window with a direct SQL/API update.
create function public.enforce_job_recovery_window()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    new.deleted_at := statement_timestamp();
  elsif old.deleted_at is not null and new.deleted_at is null then
    if statement_timestamp() >= old.deleted_at + interval '24 hours' then
      raise exception 'This job recovery period has expired.' using errcode='check_violation';
    end if;
  elsif old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'The job deletion time cannot be changed.' using errcode='check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_job_recovery_window() from public,anon,authenticated;
create trigger enforce_job_recovery_window
  before update of deleted_at on public.jobs
  for each row execute function public.enforce_job_recovery_window();

-- Permanent removal is reserved for the scheduled service-role cleanup job.
drop policy jobs_member_delete on public.jobs;
revoke delete on public.jobs from authenticated;

commit;
