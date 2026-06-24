# Phase 4 — Stripe Payments (status & setup)

Status as of 2026-06-21. Phase 4 wires real money movement (paid event tickets and
authorize-then-capture service bookings) through Stripe Checkout, PaymentIntents, and a
signature-verified webhook. The code and database are in place; the live integration is
blocked on backend environment variables (see [Current blocker](#current-blocker)).

## What is done

### Database (live Supabase project)

| Migration | Purpose | State |
| --- | --- | --- |
| `supabase/migrations/0001_yardtix_orders_tickets.sql` | `yardtix_orders` / `yardtix_tickets` ledger + RLS | **Applied** |
| `supabase/migrations/0003_phase4_payments.sql` | `checkout_session_id` + `currency`, `bookings.payment_status` CHECK, `stripe_webhook_events` idempotency ledger | **Applied** |
| `supabase/migrations/0002_booking_lifecycle.sql` | Expanded `bookings.status` lifecycle values | **Not applied as a migration** — see note below |

**Booking constraints confirmed correct on the live DB** (verified directly, so `0002`'s
status values are already present):

- `bookings_status_check`: `requested`, `pending`, `pending_provider_review`, `confirmed`,
  `declined`, `cancelled`, `checkout_created`, `completed`, `refund_pending`, `refunded`.
- `bookings_payment_status_check`: `none`, `authorized`, `captured`, `failed`, `refunded`.

> **Note on 0002.** Applying `0002` after `0003` fails with
> `ERROR: 42710: constraint "bookings_status_check" already exists`. `0002` drops the status
> constraint by matching `pg_get_constraintdef(...) ILIKE '%status%' LIMIT 1`, but once `0003`
> has added `bookings_payment_status_check` (which also contains "status"), the `LIMIT 1`
> matcher can pick the wrong constraint. The live `bookings_status_check` already contains the
> full status set, so no further action is needed. If a future DB does need it, drop the
> constraint **by exact name** instead:
> ```sql
> alter table bookings drop constraint if exists bookings_status_check;
> alter table bookings add constraint bookings_status_check check (
>   status in ('requested','pending','pending_provider_review','confirmed','declined',
>              'cancelled','checkout_created','completed','refund_pending','refunded')
> );
> ```

### Backend API (mounted in `backend/src/index.ts`)

All app routes are deployed and enforce Supabase-token auth (verified: each returns `401`
without a valid token).

| Route | Purpose |
| --- | --- |
| `POST /api/checkout/event-session` | Stripe Checkout session for instant paid ticket purchase |
| `POST /api/checkout/booking-intent` | Manual-capture PaymentIntent (authorize now, capture on accept) |
| `GET /api/checkout/session/:id/status` | Poll order/ticket state for the receipt page |
| `POST /api/bookings/:id/accept` | Provider accepts → capture the authorized payment |
| `POST /api/bookings/:id/decline` | Provider declines → release the authorization |
| `POST /api/payments/connect/onboard` | Stripe Connect onboarding (Express accounts) |
| `POST /api/webhooks/stripe` | Signature-verified, idempotent Stripe webhook |

## Current blocker

`POST /api/webhooks/stripe` returns **`503 "Webhooks not configured"`**. That response only
fires when `stripeConfigured()` is false **or** `STRIPE_WEBHOOK_SECRET` is unset
(`backend/src/routes/webhooks.ts`). So the running backend is missing or not loading
**`STRIPE_SECRET_KEY` and/or `STRIPE_WEBHOOK_SECRET`**.

Until that is fixed, the full payment happy-path cannot run end-to-end:
checkout → `checkout.session.completed` → mint tickets, and authorize →
`payment_intent.*` → capture/decline.

## Required backend environment variables

Defined as optional in `backend/src/env.ts` so the server still boots without them (paid flows
hard-disable with a clear message). All must be present in the **running** process for payments
to work:

| Variable | Format | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…` (test mode) | Stripe API calls (Checkout, PaymentIntents, Connect) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Verify Stripe webhook signatures |
| `SUPABASE_URL` | `https://<ref>.supabase.co` | Service-role REST + token auth |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role JWT | Trusted server-side writes (webhook finalize) |
| `APP_URL` | `https://…` (optional) | Build Checkout success/cancel URLs; falls back to request origin |

> These are **not** in any committed `.env` file (only `OPENAI_API_KEY`, `PORT`, `BACKEND_URL`
> are). They are injected into the backend process by the platform. Setting a secret does **not**
> take effect until the backend is **restarted**.

## How to unblock and finish the live E2E

1. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the backend's platform environment,
   then **restart the backend**.
2. Verify Stripe is live — a bad-signature webhook should now return `400 "Invalid signature"`
   (not `503`):
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BACKEND_URL/api/webhooks/stripe" \
     -H 'stripe-signature: t=1,v1=deadbeef' \
     -H 'Content-Type: application/json' \
     -d '{"id":"evt_test","type":"checkout.session.completed"}'
   # expect: 400
   ```
3. Drive the authenticated happy-path with either:
   - a **Supabase test-user access token** (plus a seeded paid event whose host has an active
     Connect account) to call `event-session` / `booking-intent` via cURL, and the **Stripe CLI**
     (`stripe listen` + `stripe trigger`) to deliver signed webhooks; or
   - the app UI once, then verify the resulting `yardtix_orders`, `yardtix_tickets`, and
     `bookings` rows reached the expected states.
