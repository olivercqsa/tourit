-- Private conversations, inbox notifications and scoped media object access.
begin;

alter table public.profiles add column avatar_path text;
grant update(avatar_path) on public.profiles to authenticated;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_low uuid not null references public.profiles(id) on delete cascade,
  participant_high uuid not null references public.profiles(id) on delete cascade,
  related_job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (participant_low < participant_high)
);
create unique index conversations_direct_pair on public.conversations(participant_low,participant_high)
  where related_job_id is null;
create unique index conversations_job_pair on public.conversations(participant_low,participant_high,related_job_id)
  where related_job_id is not null;

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id,user_id)
);
create index conversation_members_user_idx on public.conversation_members(user_id,conversation_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_conversation_time_idx on public.messages(conversation_id,created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('message','application_status')),
  message text not null check (char_length(message) between 1 and 500),
  related_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_inbox_idx on public.notifications(user_id,created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

revoke all on public.conversations,public.conversation_members,public.messages,public.notifications from anon,authenticated;
grant select on public.conversations,public.conversation_members,public.messages,public.notifications to authenticated;
grant update(last_read_at) on public.conversation_members to authenticated;
grant insert(conversation_id,sender_id,body) on public.messages to authenticated;
grant update(read_at) on public.notifications to authenticated;

create policy conversation_member_read on public.conversations for select to authenticated
  using (exists(select 1 from public.conversation_members cm where cm.conversation_id=conversations.id and cm.user_id=(select auth.uid())));
create policy conversation_members_own_read on public.conversation_members for select to authenticated
  using (user_id=(select auth.uid()));
create policy conversation_read_marker on public.conversation_members for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy messages_member_read on public.messages for select to authenticated
  using (exists(select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=(select auth.uid())));
create policy messages_member_send on public.messages for insert to authenticated
  with check (sender_id=(select auth.uid()) and exists(
    select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=(select auth.uid())
  ));
create policy notifications_own_read on public.notifications for select to authenticated
  using (user_id=(select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

-- A direct message can only start between two different, existing accounts.
-- Job-linked contact additionally requires the caller to be a recruiter on
-- that job or the talent applicant for it.
create function public.start_conversation(p_other_user_id uuid,p_related_job_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := (select auth.uid());
  low_id uuid;
  high_id uuid;
  result_id uuid;
begin
  if current_user_id is null or p_other_user_id is null or current_user_id=p_other_user_id then
    raise exception 'Choose another signed-in user';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_other_user_id) then
    raise exception 'Account not found';
  end if;
  if p_related_job_id is not null and not exists(
    select 1 from public.jobs j where j.id=p_related_job_id and (
      exists(select 1 from public.organisation_members m where m.organisation_id=j.organisation_id and m.user_id=current_user_id)
      or exists(select 1 from public.applications a where a.job_id=j.id and a.talent_id=current_user_id)
    ) and (
      exists(select 1 from public.organisation_members m where m.organisation_id=j.organisation_id and m.user_id=p_other_user_id)
      or exists(select 1 from public.applications a where a.job_id=j.id and a.talent_id=p_other_user_id)
    )
  ) then raise exception 'You are not a participant in this job'; end if;
  low_id := least(current_user_id,p_other_user_id);
  high_id := greatest(current_user_id,p_other_user_id);
  select c.id into result_id from public.conversations c
    where c.participant_low=low_id and c.participant_high=high_id
      and c.related_job_id is not distinct from p_related_job_id limit 1;
  if result_id is null then
    insert into public.conversations(participant_low,participant_high,related_job_id)
      values(low_id,high_id,p_related_job_id) returning id into result_id;
  end if;
  insert into public.conversation_members(conversation_id,user_id)
    values(result_id,low_id),(result_id,high_id) on conflict do nothing;
  return result_id;
end;
$$;
revoke all on function public.start_conversation(uuid,uuid) from public,anon;
grant execute on function public.start_conversation(uuid,uuid) to authenticated;

create function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(user_id,kind,message,related_id)
    select cm.user_id,'message','New message',new.conversation_id
    from public.conversation_members cm
    where cm.conversation_id=new.conversation_id and cm.user_id<>new.sender_id;
  update public.conversations set updated_at=now() where id=new.conversation_id;
  return new;
end;
$$;
revoke all on function public.notify_new_message() from public,anon,authenticated;
create trigger message_notification after insert on public.messages
  for each row execute function public.notify_new_message();

create function public.notify_application_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications(user_id,kind,message,related_id)
      select new.talent_id,'application_status','Your application status changed to '||new.status,new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.notify_application_status() from public,anon,authenticated;
create trigger application_status_notification after update on public.applications
  for each row execute function public.notify_application_status();

-- Conversation participants can see one another's display names only after a
-- conversation exists. Membership rows themselves remain private.
create policy profile_conversation_peer_read on public.profiles for select to authenticated
  using (exists(
    select 1 from public.conversation_members mine
    join public.conversation_members theirs on theirs.conversation_id=mine.conversation_id
    where mine.user_id=(select auth.uid()) and theirs.user_id=profiles.id
  ));

-- Create these three buckets in Storage before using media uploads:
-- tourit-avatars (public), tourit-job-covers (public), tourit-private (private).
-- Upload paths must begin with the authenticated user's UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('tourit-avatars','tourit-avatars',true,5242880,array['image/jpeg','image/png','image/webp']),
  ('tourit-job-covers','tourit-job-covers',true,8388608,array['image/jpeg','image/png','image/webp']),
  ('tourit-private','tourit-private',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy avatar_public_read on storage.objects for select to anon,authenticated
  using (bucket_id='tourit-avatars');
create policy avatar_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id='tourit-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_owner_update on storage.objects for update to authenticated
  using (bucket_id='tourit-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check (bucket_id='tourit-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_owner_delete on storage.objects for delete to authenticated
  using (bucket_id='tourit-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy job_cover_public_read on storage.objects for select to anon,authenticated
  using (bucket_id='tourit-job-covers');
create policy job_cover_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id='tourit-job-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy job_cover_owner_update on storage.objects for update to authenticated
  using (bucket_id='tourit-job-covers' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check (bucket_id='tourit-job-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy job_cover_owner_delete on storage.objects for delete to authenticated
  using (bucket_id='tourit-job-covers' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy private_application_read on storage.objects for select to authenticated
  using (bucket_id='tourit-private' and exists(
    select 1 from public.applications a join public.jobs j on j.id=a.job_id
    where a.id::text=(storage.foldername(name))[1]
      and (a.talent_id=(select auth.uid()) or exists(
        select 1 from public.organisation_members m where m.organisation_id=j.organisation_id and m.user_id=(select auth.uid())
      ))
  ));
create policy private_application_insert on storage.objects for insert to authenticated
  with check (bucket_id='tourit-private' and exists(
    select 1 from public.applications a where a.id::text=(storage.foldername(name))[1] and a.talent_id=(select auth.uid())
  ));

commit;
