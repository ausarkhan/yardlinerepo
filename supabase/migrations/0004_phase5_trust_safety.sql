-- YardLine Phase 5 - Trust, Safety, Messaging, Reviews, Admin, Compliance
--
-- Production-compatible revision.
-- The live project stores profiles.id as text while auth.uid() returns uuid.
-- Phase 5-owned user identity columns are therefore stored as text and compared
-- to auth.uid()::text. The notification helper keeps a uuid overload so Phase 6
-- can continue calling public.notify(uuid, ...).

create extension if not exists pgcrypto;

-- ===========================================================================
-- 0. Admin role + suspension state on the existing profiles table
-- ===========================================================================
alter table profiles add column if not exists role text not null default 'user';
alter table profiles add column if not exists status text not null default 'active';
alter table profiles add column if not exists suspended_at timestamptz;
alter table profiles add column if not exists suspension_reason text;

do $$ begin
  alter table profiles add constraint profiles_role_check check (role in ('user', 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table profiles add constraint profiles_status_check check (status in ('active', 'suspended'));
exception when duplicate_object then null; end $$;

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'email'
  ) then
    update profiles
       set role = 'admin'
     where lower(email) = lower('markmurphy235@gmail.com');
  end if;
end $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from profiles
     where id::text = auth.uid()::text
       and role = 'admin'
  );
$$;

alter table profiles enable row level security;

drop policy if exists "profiles: admin read" on profiles;
create policy "profiles: admin read" on profiles
  for select using (public.is_admin());

drop policy if exists "profiles: admin update" on profiles;
create policy "profiles: admin update" on profiles
  for update using (public.is_admin());

-- ===========================================================================
-- 1. Messaging - conversations + messages (1:1 only)
-- ===========================================================================
create table if not exists conversations (
  id uuid primary key default gen_random_uuid()
);

do $$ begin
  alter table conversations drop constraint if exists conversations_ordered;
  alter table conversations drop constraint if exists conversations_distinct;
end $$;

alter table conversations add column if not exists participant_a text;
alter table conversations add column if not exists participant_b text;
alter table conversations add column if not exists context_type text default 'direct';
alter table conversations add column if not exists context_id text;
alter table conversations add column if not exists last_message text;
alter table conversations add column if not exists last_message_at timestamptz;
alter table conversations add column if not exists last_sender_id text;
alter table conversations add column if not exists created_at timestamptz default now();

alter table conversations alter column participant_a type text using participant_a::text;
alter table conversations alter column participant_b type text using participant_b::text;
alter table conversations alter column last_sender_id type text using last_sender_id::text;

update conversations set context_type = 'direct' where context_type is null;

alter table conversations alter column participant_a set not null;
alter table conversations alter column participant_b set not null;
alter table conversations alter column context_type set not null;
alter table conversations alter column context_type set default 'direct';
alter table conversations alter column created_at set not null;
alter table conversations alter column created_at set default now();

do $$ begin
  alter table conversations add constraint conversations_distinct check (participant_a <> participant_b);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table conversations add constraint conversations_ordered check (participant_a < participant_b);
exception when duplicate_object then null; end $$;

create unique index if not exists conversations_pair_ctx_idx
  on conversations (participant_a, participant_b, context_type, coalesce(context_id, ''));
create index if not exists conversations_a_idx on conversations (participant_a, last_message_at desc);
create index if not exists conversations_b_idx on conversations (participant_b, last_message_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid()
);

alter table messages add column if not exists conversation_id uuid;
alter table messages add column if not exists sender_id text;
alter table messages add column if not exists body text;
alter table messages add column if not exists read_at timestamptz;
alter table messages add column if not exists created_at timestamptz default now();

alter table messages alter column sender_id type text using sender_id::text;

alter table messages alter column conversation_id set not null;
alter table messages alter column sender_id set not null;
alter table messages alter column body set not null;
alter table messages alter column created_at set not null;
alter table messages alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_class r on r.oid = c.confrelid
      join pg_namespace n on n.oid = t.relnamespace
     where c.contype = 'f'
       and n.nspname = 'public'
       and t.relname = 'messages'
       and r.relname = 'conversations'
       and c.conkey = array[
         (select attnum::smallint from pg_attribute where attrelid = t.oid and attname = 'conversation_id')
       ]
  ) then
    alter table messages add constraint messages_conversation_fk
      foreign key (conversation_id) references conversations(id) on delete cascade;
  end if;
end $$;

create index if not exists messages_conv_idx on messages (conversation_id, created_at);
create index if not exists messages_unread_idx on messages (conversation_id, sender_id, read_at);

alter table conversations enable row level security;
alter table messages enable row level security;

drop policy if exists "conversations: participant read" on conversations;
create policy "conversations: participant read" on conversations
  for select using (
    auth.uid()::text = participant_a
    or auth.uid()::text = participant_b
    or public.is_admin()
  );

drop policy if exists "conversations: participant insert" on conversations;
create policy "conversations: participant insert" on conversations
  for insert with check (
    auth.uid()::text = participant_a
    or auth.uid()::text = participant_b
  );

drop policy if exists "conversations: participant update" on conversations;
create policy "conversations: participant update" on conversations
  for update using (
    auth.uid()::text = participant_a
    or auth.uid()::text = participant_b
  );

drop policy if exists "messages: participant read" on messages;
create policy "messages: participant read" on messages
  for select using (exists (
    select 1
      from conversations c
     where c.id = conversation_id
       and (
         auth.uid()::text = c.participant_a
         or auth.uid()::text = c.participant_b
         or public.is_admin()
       )
  ));

drop policy if exists "messages: sender insert" on messages;
create policy "messages: sender insert" on messages
  for insert with check (
    auth.uid()::text = sender_id
    and exists (
      select 1
        from conversations c
       where c.id = conversation_id
         and (
           auth.uid()::text = c.participant_a
           or auth.uid()::text = c.participant_b
         )
    )
  );

drop policy if exists "messages: participant update" on messages;
create policy "messages: participant update" on messages
  for update using (exists (
    select 1
      from conversations c
     where c.id = conversation_id
       and (
         auth.uid()::text = c.participant_a
         or auth.uid()::text = c.participant_b
       )
  ));

-- ===========================================================================
-- 2. Waiver / legal acceptance
-- ===========================================================================
create table if not exists waiver_acceptances (
  id uuid primary key default gen_random_uuid()
);

alter table waiver_acceptances add column if not exists user_id text;
alter table waiver_acceptances add column if not exists document text;
alter table waiver_acceptances add column if not exists waiver_version text;
alter table waiver_acceptances add column if not exists accepted_at timestamptz default now();
alter table waiver_acceptances add column if not exists created_at timestamptz default now();

alter table waiver_acceptances alter column user_id type text using user_id::text;
alter table waiver_acceptances alter column user_id set not null;
alter table waiver_acceptances alter column document set not null;
alter table waiver_acceptances alter column waiver_version set not null;
alter table waiver_acceptances alter column accepted_at set not null;
alter table waiver_acceptances alter column accepted_at set default now();
alter table waiver_acceptances alter column created_at set not null;
alter table waiver_acceptances alter column created_at set default now();

create index if not exists waiver_user_idx on waiver_acceptances (user_id, document);

alter table waiver_acceptances enable row level security;

drop policy if exists "waivers: owner read" on waiver_acceptances;
create policy "waivers: owner read" on waiver_acceptances
  for select using (
    auth.uid()::text = user_id
    or public.is_admin()
  );

drop policy if exists "waivers: owner insert" on waiver_acceptances;
create policy "waivers: owner insert" on waiver_acceptances
  for insert with check (auth.uid()::text = user_id);

-- ===========================================================================
-- 3. Reports (moderation queue)
-- ===========================================================================
create table if not exists reports (
  id uuid primary key default gen_random_uuid()
);

alter table reports add column if not exists reporter_id text;
alter table reports add column if not exists target_type text;
alter table reports add column if not exists target_id text;
alter table reports add column if not exists category text;
alter table reports add column if not exists details text;
alter table reports add column if not exists status text default 'open';
alter table reports add column if not exists resolution text;
alter table reports add column if not exists resolved_by text;
alter table reports add column if not exists resolved_at timestamptz;
alter table reports add column if not exists created_at timestamptz default now();

alter table reports alter column reporter_id type text using reporter_id::text;
alter table reports alter column resolved_by type text using resolved_by::text;

update reports set status = 'open' where status is null;

alter table reports alter column reporter_id set not null;
alter table reports alter column target_type set not null;
alter table reports alter column target_id set not null;
alter table reports alter column category set not null;
alter table reports alter column status set not null;
alter table reports alter column status set default 'open';
alter table reports alter column created_at set not null;
alter table reports alter column created_at set default now();

do $$ begin
  alter table reports add constraint reports_status_check check (status in ('open', 'dismissed', 'actioned'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table reports add constraint reports_category_check check (
    category in ('spam', 'harassment', 'scam', 'safety', 'inappropriate', 'other'));
exception when duplicate_object then null; end $$;

create index if not exists reports_status_idx on reports (status, created_at desc);
create index if not exists reports_reporter_idx on reports (reporter_id, created_at desc);

alter table reports enable row level security;

drop policy if exists "reports: reporter insert" on reports;
create policy "reports: reporter insert" on reports
  for insert with check (auth.uid()::text = reporter_id);

drop policy if exists "reports: reporter read" on reports;
create policy "reports: reporter read" on reports
  for select using (
    auth.uid()::text = reporter_id
    or public.is_admin()
  );

drop policy if exists "reports: admin update" on reports;
create policy "reports: admin update" on reports
  for update using (public.is_admin());

-- ===========================================================================
-- 4. Moderation audit log (never deleted)
-- ===========================================================================
create table if not exists moderation_actions (
  id uuid primary key default gen_random_uuid()
);

alter table moderation_actions add column if not exists admin_id text;
alter table moderation_actions add column if not exists action text;
alter table moderation_actions add column if not exists target_type text;
alter table moderation_actions add column if not exists target_id text;
alter table moderation_actions add column if not exists reason text;
alter table moderation_actions add column if not exists metadata jsonb;
alter table moderation_actions add column if not exists created_at timestamptz default now();

alter table moderation_actions alter column admin_id type text using admin_id::text;

alter table moderation_actions alter column admin_id set not null;
alter table moderation_actions alter column action set not null;
alter table moderation_actions alter column target_type set not null;
alter table moderation_actions alter column target_id set not null;
alter table moderation_actions alter column created_at set not null;
alter table moderation_actions alter column created_at set default now();

create index if not exists moderation_actions_idx on moderation_actions (created_at desc);
create index if not exists moderation_actions_target_idx on moderation_actions (target_type, target_id);

alter table moderation_actions enable row level security;

drop policy if exists "moderation: admin read" on moderation_actions;
create policy "moderation: admin read" on moderation_actions
  for select using (public.is_admin());

drop policy if exists "moderation: admin insert" on moderation_actions;
create policy "moderation: admin insert" on moderation_actions
  for insert with check (public.is_admin());

-- ===========================================================================
-- 5. Notifications
-- ===========================================================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid()
);

alter table notifications add column if not exists user_id text;
alter table notifications add column if not exists type text;
alter table notifications add column if not exists title text;
alter table notifications add column if not exists body text;
alter table notifications add column if not exists link text;
alter table notifications add column if not exists data jsonb;
alter table notifications add column if not exists read_at timestamptz;
alter table notifications add column if not exists created_at timestamptz default now();

alter table notifications alter column user_id type text using user_id::text;

alter table notifications alter column user_id set not null;
alter table notifications alter column type set not null;
alter table notifications alter column title set not null;
alter table notifications alter column created_at set not null;
alter table notifications alter column created_at set default now();

create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "notifications: owner read" on notifications;
create policy "notifications: owner read" on notifications
  for select using (
    auth.uid()::text = user_id
    or public.is_admin()
  );

drop policy if exists "notifications: owner update" on notifications;
create policy "notifications: owner update" on notifications
  for update using (auth.uid()::text = user_id);

drop policy if exists "notifications: self or admin insert" on notifications;
create policy "notifications: self or admin insert" on notifications
  for insert with check (
    auth.uid()::text = user_id
    or public.is_admin()
  );

-- Helper used by Phase 5 triggers and Phase 6 organization notifications.
create or replace function public.notify(
  p_user text, p_type text, p_title text, p_body text, p_link text, p_data jsonb
) returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link, data)
  values (p_user, p_type, p_title, p_body, p_link, p_data);
$$;

create or replace function public.notify(
  p_user uuid, p_type text, p_title text, p_body text, p_link text, p_data jsonb
) returns void language sql security definer set search_path = public as $$
  select public.notify(p_user::text, p_type, p_title, p_body, p_link, p_data);
$$;

-- ===========================================================================
-- 5a. Notification triggers
-- ===========================================================================
create or replace function public.on_message_insert() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  c conversations%rowtype;
  recipient text;
begin
  select * into c from conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  recipient := case
    when new.sender_id::text = c.participant_a then c.participant_b
    else c.participant_a
  end;

  update conversations
     set last_message = left(new.body, 140),
         last_message_at = new.created_at,
         last_sender_id = new.sender_id::text
   where id = new.conversation_id;

  if recipient is not null then
    perform public.notify(
      recipient, 'message', 'New message', left(new.body, 140),
      '/chat/' || new.conversation_id::text,
      jsonb_build_object('conversation_id', new.conversation_id, 'sender_id', new.sender_id::text));
  end if;

  return new;
exception when others then
  return new;
end $$;

drop trigger if exists trg_on_message_insert on messages;
create trigger trg_on_message_insert after insert on messages
  for each row execute function public.on_message_insert();

create or replace function public.on_booking_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and new.status in ('confirmed', 'declined', 'completed')
     and new.customer_id is not null then
    perform public.notify(
      new.customer_id::text,
      'booking_' || new.status,
      case new.status
        when 'confirmed' then 'Booking accepted'
        when 'declined' then 'Booking declined'
        else 'Booking completed' end,
      null, '/bookings',
      jsonb_build_object('booking_id', new.id, 'status', new.status));
  end if;
  return new;
exception when others then
  return new;
end $$;

do $$
begin
  if to_regclass('public.bookings') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'status')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'customer_id') then
    drop trigger if exists trg_on_booking_update on bookings;
    create trigger trg_on_booking_update after update on bookings
      for each row execute function public.on_booking_update();
  end if;
end $$;

create or replace function public.on_review_insert() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  recipient text;
begin
  if new.target_type = 'provider' then
    if to_regclass('public.service_providers') is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'service_providers' and column_name = 'id')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'service_providers' and column_name = 'user_id') then
      select sp.user_id::text into recipient
        from service_providers sp
       where sp.id::text = new.target_id::text
       limit 1;
    end if;
  elsif new.target_type = 'event' then
    if to_regclass('public.events') is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name = 'id')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name = 'host_id') then
      select e.host_id::text into recipient
        from events e
       where e.id::text = new.target_id::text
       limit 1;
    end if;
  end if;

  if recipient is not null
     and recipient <> coalesce(new.reviewer_id::text, '') then
    perform public.notify(
      recipient, 'review_received', 'New review',
      'You received a ' || coalesce(new.score::text, '?') || '/10 review.',
      case when new.target_type = 'event' then '/event/' || new.target_id::text else '/provider/' || new.target_id::text end,
      jsonb_build_object('review_id', new.id, 'target_type', new.target_type, 'score', new.score));
  end if;
  return new;
exception when others then
  return new;
end $$;

do $$
begin
  if to_regclass('public.reviews') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reviews' and column_name = 'target_type')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reviews' and column_name = 'target_id')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reviews' and column_name = 'reviewer_id')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'reviews' and column_name = 'score') then
    drop trigger if exists trg_on_review_insert on reviews;
    create trigger trg_on_review_insert after insert on reviews
      for each row execute function public.on_review_insert();
  end if;
end $$;

create or replace function public.on_report_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('dismissed', 'actioned') then
    perform public.notify(
      new.reporter_id::text, 'report_update', 'Report reviewed',
      'Your report was ' || new.status || '.', '/messages',
      jsonb_build_object('report_id', new.id, 'status', new.status));
  end if;
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists trg_on_report_update on reports;
create trigger trg_on_report_update after update on reports
  for each row execute function public.on_report_update();

-- ===========================================================================
-- 6. Realtime - stream messages, conversations, notifications to the client
-- ===========================================================================
do $$ begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table conversations;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table notifications;
exception when duplicate_object then null; when undefined_object then null; end $$;
