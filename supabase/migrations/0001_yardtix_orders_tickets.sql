-- YardLine Phase 2 — YardTix orders & tickets
--
-- Inspect-first policy: the existing YardLine Supabase project already has
--   events, event_attendees, profiles, service_providers, services, reviews,
--   bookings, stripe_connect_accounts
-- and the storage buckets avatars / event-photos / provider-photos.
--
-- Ticket TIERS are stored in events.ticket_types (jsonb) and are NOT duplicated here.
-- Free RSVPs continue to live in event_attendees (source = 'rsvp').
--
-- This migration ONLY adds what is missing: a richer order/ticket ledger for
-- paid YardTix, preparing for Stripe checkout in Phase 4. It is additive and
-- non-breaking — it renames nothing and drops nothing.
--
-- NOTE: This environment has no direct database access (no service password,
-- no exec RPC), so this file is delivered as a migration to run with the
-- Supabase CLI / SQL editor when DB access is available:
--     supabase db push        (or paste into the Supabase SQL editor)
-- Until then, the web app runs on the existing event_attendees table.

-- ---------------------------------------------------------------------------
-- Enums (guarded so re-runs are safe)
-- ---------------------------------------------------------------------------
do $$ begin
  create type yardtix_order_status as enum
    ('created', 'pending', 'confirmed', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type yardtix_ticket_status as enum
    ('created', 'confirmed', 'used', 'refunded', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Human-readable number generators:  YO-YYYY-NNNNNN  /  YT-YYYY-NNNNNN
-- ---------------------------------------------------------------------------
create sequence if not exists yardtix_order_seq;
create sequence if not exists yardtix_ticket_seq;

create or replace function yardtix_next_order_number() returns text as $$
  select 'YO-' || to_char(now(), 'YYYY') || '-' ||
         lpad((nextval('yardtix_order_seq') % 1000000)::text, 6, '0');
$$ language sql volatile;

create or replace function yardtix_next_ticket_number() returns text as $$
  select 'YT-' || to_char(now(), 'YYYY') || '-' ||
         lpad((nextval('yardtix_ticket_seq') % 1000000)::text, 6, '0');
$$ language sql volatile;

-- ---------------------------------------------------------------------------
-- Orders: one row per checkout/reservation (a "cart")
-- ---------------------------------------------------------------------------
create table if not exists yardtix_orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text unique not null default yardtix_next_order_number(),
  event_id          uuid not null references events(id) on delete cascade,
  buyer_id          uuid not null,                       -- auth.users.id
  status            yardtix_order_status not null default 'created',
  quantity          integer not null default 0,
  subtotal_cents    integer not null default 0,
  platform_fee_cents integer not null default 0,
  total_cents       integer not null default 0,
  -- Stripe (Phase 4) — nullable for now
  payment_intent_id text,
  payment_status    text,
  receipt_url       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists yardtix_orders_event_idx on yardtix_orders(event_id);
create index if not exists yardtix_orders_buyer_idx on yardtix_orders(buyer_id);

-- ---------------------------------------------------------------------------
-- Tickets: one row per issued ticket (a "YardTix")
-- ---------------------------------------------------------------------------
create table if not exists yardtix_tickets (
  id              uuid primary key default gen_random_uuid(),
  ticket_number   text unique not null default yardtix_next_ticket_number(),
  order_id        uuid references yardtix_orders(id) on delete cascade,
  event_id        uuid not null references events(id) on delete cascade,
  holder_id       uuid not null,                         -- auth.users.id
  tier_id         text,                                  -- matches events.ticket_types[].id
  tier_name       text,
  price_cents     integer not null default 0,
  status          yardtix_ticket_status not null default 'created',
  qr_token        uuid not null default gen_random_uuid(),  -- scanned in a later phase
  used_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists yardtix_tickets_event_idx on yardtix_tickets(event_id);
create index if not exists yardtix_tickets_holder_idx on yardtix_tickets(holder_id);
create index if not exists yardtix_tickets_order_idx on yardtix_tickets(order_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table yardtix_orders  enable row level security;
alter table yardtix_tickets enable row level security;

-- Buyers manage their own orders; event hosts can read orders for their events.
create policy "orders: buyer read"   on yardtix_orders for select
  using (auth.uid() = buyer_id);
create policy "orders: host read"    on yardtix_orders for select
  using (exists (select 1 from events e where e.id = event_id and e.host_id = auth.uid()));
create policy "orders: buyer insert" on yardtix_orders for insert
  with check (auth.uid() = buyer_id);
create policy "orders: buyer update" on yardtix_orders for update
  using (auth.uid() = buyer_id);

-- Holders manage their own tickets; event hosts can read tickets for their events.
create policy "tickets: holder read" on yardtix_tickets for select
  using (auth.uid() = holder_id);
create policy "tickets: host read"   on yardtix_tickets for select
  using (exists (select 1 from events e where e.id = event_id and e.host_id = auth.uid()));
create policy "tickets: holder insert" on yardtix_tickets for insert
  with check (auth.uid() = holder_id);
create policy "tickets: holder update" on yardtix_tickets for update
  using (auth.uid() = holder_id);
