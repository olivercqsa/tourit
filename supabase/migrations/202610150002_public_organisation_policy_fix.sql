-- Repairs the initial organisation read policy if the first migration was
-- already applied before its anonymous-read policy was corrected.
begin;

drop policy if exists organisation_read on public.organisations;
drop policy if exists organisation_public_read on public.organisations;
drop policy if exists organisation_member_read on public.organisations;

create policy organisation_public_read on public.organisations for select to anon
  using (published);
create policy organisation_member_read on public.organisations for select to authenticated
  using (published or exists (
    select 1 from public.organisation_members m
    where m.organisation_id = organisations.id and m.user_id = (select auth.uid())
  ));

commit;
