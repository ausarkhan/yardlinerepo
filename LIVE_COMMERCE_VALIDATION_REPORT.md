# Live Commerce Validation Report

Date: 2026-06-26  
Branch: `live-commerce-validation`  
Frontend: https://yardlinerepo.vercel.app  
Backend: https://yardlinerepo-production.up.railway.app  
Backend health: `200 {"status":"ok"}`

## Test Accounts

- Creator: `ausarkhan@gmail.com`
- Buyer/Admin: `markmurphy235@gmail.com`

## Screenshots

- Stripe Checkout loaded: `commerce-validation-screenshots/stripe-checkout.png`
- Stripe processing after test-card submit: `commerce-validation-screenshots/stripe-processing-after-submit.png`
- Paid event direct route 404 before fix: `commerce-validation-screenshots/paid-event-route-404.png`
- Events route 404 before fix: `commerce-validation-screenshots/events-route-404.png`

## Test Data

- Paid event: `Commerce QA Paid Event 20260626180908`
- Paid event ID: `bd5d16b7-8f57-4492-b89c-3aaba6cb3fdd`
- Free event: `Commerce QA Free Event 20260626180908`
- Free event ID: `0ad75702-9888-4625-a8e3-5dbbc491bd33`
- Primary Checkout Session: `cs_test_b1h5SUZCvgIWePhKVuGxtgWa1uKi4xngOchyg14gwfMPMyiq4izIrZvM8C`
- Primary order: `25d570c8-4974-488d-ae60-4f6a77681514`
- Service created for booking probe: `1d8ce057-91f9-464f-9a25-4b6b2645eec1`

## Major Validation Results

| Area | Result | Evidence |
| --- | --- | --- |
| Creator profile loads | PASS | Creator profile returned `role=user`, name `Ausarkhan`. |
| Stripe Connect status | PASS | Connect account `acct_1SonepJS05BCRnQx`, `status=active`, charges/payouts enabled. |
| Creator dashboard data | PASS | Existing creator events, services, and bookings returned from production. |
| Paid event creation | PASS | Paid event inserted as `published`, price `$12.00`, fee `$0.99`, total `$12.99`. |
| Paid event public route | FAIL | Vercel returned platform `404: NOT_FOUND` for `/event/:id` and `/events`. |
| Checkout Session creation | PASS | Backend returned valid Stripe Checkout URL and `cs_test_...` session. |
| Stripe Checkout content | PASS | Checkout showed YardLine sandbox, correct event, `$12.00` ticket, `$0.99` platform fee, `$12.99` USD total. |
| Stripe test payment completion | BLOCKED | Stripe remained on Checkout processing / AI-agent disclosure; no redirect occurred in headless run. |
| Order before payment | PASS | Pending order created with `payment_status=pending`, no ticket minted before payment. |
| Webhook finalization | NOT COMPLETED | Payment did not complete, so `checkout.session.completed` was not observed. |
| Free event RSVP | PASS | RSVP row created in `event_attendees`. Duplicate RSVP rejected by unique constraint. |
| Paid service booking | FAIL | Backend generated invalid time `10:00:00:00`; booking PaymentIntent not created. |
| Booking decline | BLOCKED | Booking creation failed before provider decline could be validated. |
| Checkout cancellation | PARTIAL | Checkout URL can be abandoned; no ticket/order finalization occurred. SPA cancel route currently affected by Vercel 404 fix. |
| Double-click protection | FAIL | Rapid API calls created duplicate pending ticket orders and Checkout Sessions. |
| Unauthorized payment endpoints | PASS | Checkout and booking endpoints returned `401` without auth. |
| Invalid ticket quantity | PASS | Quantity `0` rejected with `400 bad_request`. |
| Invalid ticket tier | PARTIAL | Unknown tier did not create a session, but returned `200` with a soft failure message. |
| Invalid booking request | PASS | Unknown service returned `404 Service not found`. |
| Invalid webhook payload | PASS | Missing Stripe signature returned `400 bad_request`. |

## Checkout URL Validation

Checkout URL was a valid Stripe test Checkout URL:

`https://checkout.stripe.com/c/pay/cs_test_b1h5SUZCvgIWePhKVuGxtgWa1uKi4xngOchyg14gwfMPMyiq4izIrZvM8C...`

Stripe page evidence:

- Sandbox/test mode displayed.
- Product: `Commerce QA Paid Event 20260626180908 — General Admission`.
- Ticket price: `$12.00`.
- Platform fee: `$0.99`.
- Total: `$12.99`.
- Currency: USD.
- Merchant label: YardLine.

## Payment Behavior

Payment could not be fully completed in this headless environment. After entering Stripe test card `4242 4242 4242 4242`, future expiry, CVC, and ZIP, Stripe stayed on the hosted Checkout page showing `Processing` and an AI-agent disclosure control. No YardLine redirect occurred.

Database after the attempt:

- Order `25d570c8-4974-488d-ae60-4f6a77681514`: `status=pending`, `payment_status=pending`.
- `payment_intent_id`: `null`.
- Tickets for order: `0`.
- Event attendees for paid event: `0`.
- Paid event `tickets_sold`: `0`.

This means YardLine did not incorrectly mint tickets or finalize an unpaid purchase.

## Redirect Behavior

Production Vercel currently hard-404s client-side routes:

- `/event/bd5d16b7-8f57-4492-b89c-3aaba6cb3fdd`
- `/events`

Root cause: missing Vercel SPA rewrite.  
Fix added: `webapp/vercel.json` rewrites all paths to `/index.html`.

This is launch-blocking because Stripe success/cancel URLs return to client routes such as `/receipt?...` and `/event/:id`.

## Booking Behavior

Paid service booking failed before Stripe Elements could open:

Backend response:

`Supabase insert bookings 400: invalid input syntax for type time: "10:00:00:00"`

Root cause: frontend sends `HH:MM:SS`, backend appended another `:00`.  
Fix added: backend now normalizes times with `normalizeTime()` and inserts a valid `HH:MM:SS`.

Because booking intent creation failed in production, these could not be completed live:

- Card authorization.
- Provider accept/capture.
- Booking decline/release.
- Booking notifications.
- Booking dashboard updates after payment.

## Revenue / Dashboard Tracking

Pre-payment creator data loaded:

- Existing services returned.
- Existing bookings returned.
- Connect account active.

Revenue/sales updates could not be validated because Stripe Checkout did not complete and the webhook did not finalize the event purchase.

## Notifications

- Existing booking and organization notifications loaded for both users.
- Free RSVP did not produce a distinct notification in the latest notification rows.
- Paid purchase notifications could not be validated because payment did not complete.
- Booking notifications could not be validated because booking intent creation failed before the fix.

## Stripe Dashboard Validation

Direct Stripe Dashboard inspection was not available from this environment. Validation performed through Stripe Checkout UI and YardLine database/API evidence:

- Checkout Session was created in test mode.
- Checkout URL was valid.
- Checkout page displayed correct amount/currency/product.
- No YardLine ticket/order finalization occurred without completed payment.

## Webhook Behavior

- Invalid webhook without `stripe-signature` was safely rejected with `400 bad_request`.
- `checkout.session.completed` and `payment_intent.succeeded` were not observed because the Stripe payment did not complete.
- No duplicate ticket or attendee rows were created.

## Bugs Fixed

1. SPA route 404 on Vercel.
   - Added `webapp/vercel.json` rewrite to `/index.html`.

2. Booking time format bug.
   - Fixed backend booking time normalization so `HH:MM` and `HH:MM:SS` both insert valid time values.

3. Repeated checkout/booking request protection.
   - Added best-effort reuse of recent open pending event Checkout Sessions.
   - Added best-effort reuse of recent unresolved booking PaymentIntents.

## Remaining Launch Blockers

- Deploy the SPA rewrite and verify `/events`, `/event/:id`, `/receipt`, and Stripe return URLs.
- Deploy backend booking time/idempotency fixes and re-run paid service booking end-to-end.
- Complete a Stripe test payment in a non-headless browser or Stripe Dashboard-capable test environment, then verify:
  - `checkout.session.completed`
  - order `paid`
  - tickets minted exactly once
  - buyer ticket/QR visible
  - creator attendee/revenue updates
  - notifications
- Re-test rapid Buy Ticket and Book Service clicks after deployment.
- Re-test checkout cancellation after SPA routing fix deploys.

## Verification Run Locally

- `npm run build` in `webapp`: passed.
- `npm run lint` in `webapp`: passed with 9 existing fast-refresh warnings.
- `npm run typecheck` in `backend`: passed.

## Conclusion

❌ Commerce system not launch ready.
