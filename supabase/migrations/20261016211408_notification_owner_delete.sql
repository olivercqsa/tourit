begin;

grant delete on public.notifications to authenticated;

create policy notifications_own_delete on public.notifications
  for delete to authenticated
  using (user_id=(select auth.uid()));

commit;
