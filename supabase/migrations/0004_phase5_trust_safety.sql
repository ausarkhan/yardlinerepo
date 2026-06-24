-- YardLine Phase 5 — Trust, Safety, Messaging, Reviews, Admin, Compliance
--
-- ADDITIVE and non-breaking. Renames nothing, drops no data. Every statement is
-- guarded so the file is safe to re-run.
--
-- This environment has no direct DB access (anon key only), so apply via the
-- Supabase SQL editor (or `supabase db push`). Until applied, the Phase 5
-- features that depend on NEW tables stay dormant; reviews already work against
-- the existing `reviews` table.
--
-- Reused existing tables (NOT recreated): profiles, reviews, bookings, events,
-- event_attendees, service_providers, services, yardtix_orders, yardtix_tickets.
-- Existing soft-delete columns reused: events.is_hidden, service_providers.is_hidden.

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

-- Seed the first admin. Change the email to promote a different account; the
-- account must already have a profiles row (i.e. have signed in at least once).
update profiles set role = 'admin' where lower(email) = lower('markmurphy235@gmail.com');

-- is_admin(): used by every admin RLS policy below. SECURITY DEFINER so it can
-- read profiles regardless of the caller's row-level visibility.
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Admins may read every profile and update moderation columns (suspend/reinstate
-- /promote). Additive — existing self-access policies are untouched.
do $$ begin
  create policy "profiles: admin read" on profiles for select using (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "profiles: admin update" on profiles for update using (public.is_admin());
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- 1. Messaging — conversations + messages (1:1 only)
-- ===========================================================================
-- participant_a is always the lexicographically-smaller uuid so a pair maps to
-- one row regardless of who starts it. context_* ties a thread to its origin.
create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  participant_a   uuid not null,
  participant_b   uuid not null,
  context_type    text not null default 'direct',  -- direct | provider | booking | event
  context_id      text,
  last_message    text,
  last_message_at timestamptz,
  last_sender_id  uuid,
  created_at      timestamptz not null default now(),
  constraint conversations_distinct check (participant_a <> participant_b),
  constraint conversations_ordered  check (participant_a < participant_b)
);

create unique index if not exists conversations_pair_ctx_idx
  on conversations (participant_a, participant_b, context_type, coalesce(context_id, ''));
create index if not exists conversations_a_idx on conversations (participant_a, last_message_at desc);
create index if not exists conversations_b_idx on conversations (participant_b, last_message_at desc);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on messages (conversation_id, created_at);
create index if not exists messages_unread_idx on messages (conversation_id, sender_id, read_at);

alter table conversations enable row level security;
alter table messages enable row level security;

do $$ begin
  create policy "conversations: participant read" on conversations for select
    using (auth.uid() = participant_a or auth.uid() = participant_b or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "conversations: participant insert" on conversations for insert
    with check (auth.uid() = participant_a or auth.uid() = participant_b);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "conversations: participant update" on conversations for update
    using (auth.uid() = participant_a or auth.uid() = participant_b);
exception when duplicate_object then null; end $$;

-- Message access flows through conversation membership.
do $$ begin
  create policy "messages: participant read" on messages for select
    using (exists (
      select 1 from conversations c where c.id = conversation_id
        and (auth.uid() = c.participant_a or auth.uid() = c.participant_b or public.is_admin())
    ));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "messages: sender insert" on messages for insert
    with check (auth.uid() = sender_id and exists (
      select 1 from conversations c where c.id = conversation_id
        and (auth.uid() = c.participant_a or auth.uid() = c.participant_b)
    ));
exception when duplicate_object then null; end $$;
-- Recipient may update (mark read) messages in their conversations.
do $$ begin
  create policy "messages: participant update" on messages for update
    using (exists (
      select 1 from conversations c where c.id = conversation_id
        and (auth.uid() = c.participant_a or auth.uid() = c.participant_b)
    ));
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- 2. Waiver / legal acceptance
-- ===========================================================================
create table if not exists waiver_acceptances (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  document        text not null,        -- terms | privacy | waiver
  waiver_version  text not null,        -- version string accepted
  accepted_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists waiver_user_idx on waiver_acceptances (user_id, document);

alter table waiver_acceptances enable row level security;
do $$ begin
  create policy "waivers: owner read" on waiver_acceptances for select
    using (auth.uid() = user_id or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "waivers: owner insert" on waiver_acceptances for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- 3. Reports (moderation queue)
-- ===========================================================================
create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null,
  target_type  text not null,   -- event | provider | user | message
  target_id    text not null,
  category     text not null,   -- spam | harassment | scam | safety | inappropriate | other
  details      text,
  status       text not null default 'open',  -- open | dismissed | actioned
  resolution   text,
  resolved_by  uuid,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint reports_status_check check (status in ('open', 'dismissed', 'actioned')),
  constraint reports_category_check check (
    category in ('spam', 'harassment', 'scam', 'safety', 'inappropriate', 'other'))
);
create index if not exists reports_status_idx on reports (status, created_at desc);
create index if not exists reports_reporter_idx on reports (reporter_id, created_at desc);

alter table reports enable row level security;
do $$ begin
  create policy "reports: reporter insert" on reports for insert
    with check (auth.uid() = reporter_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "reports: reporter read" on reports for select
    using (auth.uid() = reporter_id or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "reports: admin update" on reports for update using (public.is_admin());
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- 4. Moderation audit log (never deleted)
-- ===========================================================================
create table if not exists moderation_actions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null,
  action       text not null,   -- suspend_user | reinstate_user | hide_event | restore_event |
                                 -- disable_provider | restore_provider | dismiss_report | resolve_report
  target_type  text not null,
  target_id    text not null,
  reason       text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists moderation_actions_idx on moderation_actions (created_at desc);
create index if not exists moderation_actions_target_idx on moderation_actions (target_type, target_id);

alter table moderation_actions enable row level security;
do $$ begin
  create policy "moderation: admin read" on moderation_actions for select using (public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "moderation: admin insert" on moderation_actions for insert with check (public.is_admin());
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- 5. Notifications
-- ===========================================================================
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,             -- recipient
  type       text not null,             -- message | booking_accepted | booking_declined |
                                        -- booking_completed | review_received | event_reminder |
                                        -- report_update | admin_action
  title      text not null,
  body       text,
  link       text,
  data       jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;
do $$ begin
  create policy "notifications: owner read" on notifications for select
    using (auth.uid() = user_id or public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "notifications: owner update" on notifications for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
-- You may create a notification for yourself; admins may notify anyone. All other
-- cross-user notifications are produced by the SECURITY DEFINER triggers below.
do $$ begin
  create policy "notifications: self or admin insert" on notifications for insert
    with check (auth.uid() = user_id or public.is_admin());
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 5a. Triggers that generate notifications (SECURITY DEFINER → bypass RLS so we
--     can notify the *other* party). Helper keeps inserts terse.
-- ---------------------------------------------------------------------------
create or replace function public.notify(
  p_user uuid, p_type text, p_title text, p_body text, p_link text, p_data jsonb
) returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link, data)
  values (p_user, p_type, p_title, p_body, p_link, p_data);
$$;

-- New message → notify the recipient + roll up the conversation preview.
create or replace function public.on_message_insert() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  c conversations%rowtype;
  recipient uuid;
begin
  select * into c from conversations where id = new.conversation_id;
  recipient := case when new.sender_id = c.participant_a then c.participant_b else c.participant_a end;

  update conversations
     set last_message = left(new.body, 140),
         last_message_at = new.created_at,
         last_sender_id = new.sender_id
   where id = new.conversation_id;

  perform public.notify(
    recipient, 'message', 'New message', left(new.body, 140),
    '/chat/' || new.conversation_id::text,
    jsonb_build_object('conversation_id', new.conversation_id, 'sender_id', new.sender_id));
  return new;
end $$;

drop trigger if exists trg_on_message_insert on messages;
create trigger trg_on_message_insert after insert on messages
  for each row execute function public.on_message_insert();

-- Booking status change → notify the customer.
create or replace function public.on_booking_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and new.status in ('confirmed', 'declined', 'completed')
     and new.customer_id is not null then
    perform public.notify(
      new.customer_id,
      'booking_' || new.status,
      case new.status
        when 'confirmed' then 'Booking accepted'
        when 'declined'  then 'Booking declined'
        else 'Booking completed' end,
      null, '/bookings',
      jsonb_build_object('booking_id', new.id, 'status', new.status));
  end if;
  return new;
end $$;

drop trigger if exists trg_on_booking_update on bookings;
create trigger trg_on_booking_update after update on bookings
  for each row execute function public.on_booking_update();

-- New review → notify the target (provider's user id, or event host).
create or replace function public.on_review_insert() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  recipient uuid;
begin
  if new.target_type = 'provider' then
    -- reviews.target_id for providers is the service_providers row id; map it to
    -- the owning user to notify them.
    select user_id into recipient from service_providers where id = new.target_id::uuid;
  elsif new.target_type = 'event' then
    select host_id into recipient from events where id = new.target_id::uuid;
  end if;

  if recipient is not null and recipient <> coalesce(new.reviewer_id, '00000000-0000-0000-0000-000000000000') then
    perform public.notify(
      recipient, 'review_received', 'New review',
      'You received a ' || coalesce(new.score::text, '?') || '/10 review.',
      case when new.target_type = 'event' then '/event/' || new.target_id else '/provider/' || new.target_id end,
      jsonb_build_object('review_id', new.id, 'target_type', new.target_type, 'score', new.score));
  end if;
  return new;
exception when others then
  -- Never block a review insert on notification issues (e.g. non-uuid target).
  return new;
end $$;

drop trigger if exists trg_on_review_insert on reviews;
create trigger trg_on_review_insert after insert on reviews
  for each row execute function public.on_review_insert();

-- Report resolved → notify the reporter.
create or replace function public.on_report_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('dismissed', 'actioned') then
    perform public.notify(
      new.reporter_id, 'report_update', 'Report reviewed',
      'Your report was ' || new.status || '.', '/messages',
      jsonb_build_object('report_id', new.id, 'status', new.status));
  end if;
  return new;
end $$;

drop trigger if exists trg_on_report_update on reports;
create trigger trg_on_report_update after update on reports
  for each row execute function public.on_report_update();

-- ===========================================================================
-- 6. Realtime — stream messages, conversations, notifications to the client
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
