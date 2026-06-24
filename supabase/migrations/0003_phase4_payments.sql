-- YardLine Phase 4 — Stripe payments finalization support
--
-- ADDITIVE and non-breaking. Renames nothing, drops no data.
--
-- PREREQUISITES (apply first, in order):
--   0001_yardtix_orders_tickets.sql   — creates yardtix_orders / yardtix_tickets
--   0002_booking_lifecycle.sql        — adds the expanded bookings.status values
-- Those two were never applied to the live DB; Phase 4 ticketing depends on them.
--
-- This environment has no direct DB access, so apply via the Supabase SQL editor
-- (or `supabase db push`).

-- ---------------------------------------------------------------------------
-- 1. yardtix_orders — Stripe Checkout session id + currency for receipts.
--    (payment_intent_id / payment_status / receipt_url already exist from 0001.)
-- ---------------------------------------------------------------------------
alter table yardtix_orders
  add column if not exists checkout_session_id text;

alter table yardtix_orders
  add column if not exists currency text not null default 'usd';

create index if not exists yardtix_orders_session_idx
  on yardtix_orders(checkout_session_id);

-- ---------------------------------------------------------------------------
-- 2. bookings.payment_status — ensure the CHECK allows the Phase 4 values.
--    (none | authorized | captured | failed | refunded). Guarded: only drops a
--    constraint that exists, then re-adds the full set. Safe to re-run.
-- ---------------------------------------------------------------------------
do $$
declare
  conname text;
begin
  select c.conname
    into conname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'bookings'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%payment_status%'
  limit 1;

  if conname is not null then
    execute format('alter table bookings drop constraint %I', conname);
  end if;
end $$;

alter table bookings
  add constraint bookings_payment_status_check check (
    payment_status in ('none', 'authorized', 'captured', 'failed', 'refunded')
  );

-- ---------------------------------------------------------------------------
-- 3. Webhook idempotency ledger — one row per processed Stripe event id.
--    The webhook inserts the event id before handling; a duplicate delivery
--    hits the primary-key conflict and is skipped.
-- ---------------------------------------------------------------------------
create table if not exists stripe_webhook_events (
  id          text primary key,          -- Stripe event id (evt_...)
  type        text,
  created_at  timestamptz not null default now()
);

-- Service role bypasses RLS, but enable it so nothing else can read the ledger.
alter table stripe_webhook_events enable row level security;
