begin;

-- Enforce the message send limit in the database so it cannot be bypassed by
-- refreshing the page or sending directly through the Data API.
create index messages_sender_time_idx on public.messages(sender_id,created_at desc);

create function public.enforce_message_send_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent_count integer;
begin
  if (select auth.uid()) is null or new.sender_id is distinct from (select auth.uid()) then
    raise exception 'You can only send messages from your signed-in account.' using errcode='42501';
  end if;

  -- Serialize concurrent sends from the same account before counting the
  -- preceding minute, while keeping other senders independent.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tourit:message-rate-limit:'||new.sender_id::text,0)
  );

  select count(*) into recent_count
  from public.messages m
  where m.sender_id=new.sender_id
    and m.created_at>pg_catalog.clock_timestamp()-interval '1 minute';

  if recent_count>=10 then
    raise exception 'You have reached the message limit of 10 per minute. Please wait before sending another message.' using errcode='P0001';
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_message_send_rate_limit() from public,anon,authenticated;
create trigger message_send_rate_limit
  before insert on public.messages
  for each row execute function public.enforce_message_send_rate_limit();

-- Update existing generic notifications with the sender's display name when
-- the matching message is still available.
update public.notifications n
set message='New message from '||coalesce((
  select p.display_name
  from public.messages m
  join public.profiles p on p.id=m.sender_id
  where m.conversation_id=n.related_id
    and m.sender_id<>n.user_id
    and m.created_at<=n.created_at
  order by m.created_at desc,m.id desc
  limit 1
),'a Tourit member')
where n.kind='message' and n.message='New message';

create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications(user_id,kind,message,related_id)
    select cm.user_id,'message','New message from '||coalesce(sender.display_name,'a Tourit member'),new.conversation_id
    from public.conversation_members cm
    cross join public.profiles sender
    where sender.id=new.sender_id
      and cm.conversation_id=new.conversation_id and cm.user_id<>new.sender_id;
  update public.conversations set updated_at=pg_catalog.now() where id=new.conversation_id;
  return new;
end;
$$;

commit;
