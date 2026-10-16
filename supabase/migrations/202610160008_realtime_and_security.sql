-- Add inbox/notification tables to Realtime and narrow an exposed DDL helper.
-- This migration is intentionally not applied as part of this task.
begin;

do $$
declare table_name text;
begin
  foreach table_name in array array['messages','notifications','conversation_members'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end;
$$;

revoke execute on function public.rls_auto_enable() from public,anon,authenticated;

commit;
