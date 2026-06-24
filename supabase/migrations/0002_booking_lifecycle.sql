-- YardLine Phase 3 — booking lifecycle expansion
--
-- Extends bookings.status to the full request → fulfilment → refund lifecycle.
-- ADDITIVE and non-breaking: every previously-allowed value is preserved.
--
-- The live CHECK constraint currently allows:
--   requested | pending | confirmed | declined | cancelled | checkout_created
-- This migration adds:
--   pending_provider_review | completed | refund_pending | refunded
--
-- IMPORTANT: this environment has no direct database access, so this file is
-- delivered as a migration to apply when DB access is available:
--   supabase db push        (or paste into the Supabase SQL editor)
-- Until it is applied, the web app keeps writing the previously-allowed
-- statuses; the new statuses (e.g. "completed", refunds) only take effect once
-- this runs.

-- ---------------------------------------------------------------------------
-- Drop whatever CHECK constraint currently guards bookings.status (by name,
-- since the auto-generated name can vary), then re-add the expanded set.
-- ---------------------------------------------------------------------------
do $$
declare
  target_conname text;
begin
  select c.conname
    into target_conname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'bookings'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%status%'
  limit 1;

  if target_conname is not null then
    execute format('alter table bookings drop constraint %I', target_conname);
  end if;
end $$;

alter table bookings
  add constraint bookings_status_check check (
    status in (
      'requested',
      'pending',
      'pending_provider_review',
      'confirmed',
      'declined',
      'cancelled',
      'checkout_created',
      'completed',
      'refund_pending',
      'refunded'
    )
  );
