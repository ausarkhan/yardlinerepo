# YardLine Live E2E QA Report

Date: 2026-06-26  
Branch: `live-production-e2e`  
Frontend: https://yardlinerepo.vercel.app  
Backend: https://yardlinerepo-production.up.railway.app  
Supabase project observed in deployed bundle: `djkjxpcadpbahkqyghyc`  

## Summary

Live QA used the two requested real OTP accounts:

- Creator: `ausarkhan@gmail.com`
- Buyer/Admin: `markmurphy235@gmail.com`

The deployed app is not fully launch-ready until the backend CORS fix and Supabase migration in this branch are deployed/applied. Core authenticated Supabase flows work, Stripe is in test mode and can create test Checkout/PaymentIntent objects, but production browser calls from Vercel to Railway are currently blocked by CORS and profile image uploads/budget/review writes need database policy/default fixes.

No real payments were completed. Stripe checks stopped after test-mode Checkout Session / PaymentIntent creation.

## Test Data Created

All production test records were timestamped with `LIVE QA 2026-06-26T08-17-26-361Z` or `LIVE QA Paid Checkout 2026-06-26T08:24:17.703Z`.

Key test records:

- Organization: `610ba32a-1a69-4168-9ed8-2a3ad4339a3b`
- Free event: `36d60594-c4eb-45b1-8cef-87eea5def5a0`
- Paid checkout event: `f9fe39b9-b416-41b2-a17d-5ea0a1b6e59a`
- Service: `0ef26f1b-a143-4923-a9e7-767d79e9400b`
- Booking PaymentIntent test booking: `30250f41-96e0-4234-93ee-8febfe3b94af`

No production data was deleted.

## What Passed

- Backend health: `GET /health` returned `200 {"status":"ok"}`.
- Frontend availability: Vercel returned `200` for the deployed app shell and assets.
- OTP authentication: both requested accounts successfully authenticated through Supabase OTP.
- Session-backed Supabase reads: both accounts could read their own auth user and profile.
- Profile editing: creator bio/social link update succeeded.
- Organizations: create organization, browse active organization, join request, approve request, membership insert, and announcement insert succeeded.
- Events: create draft org-hosted event, publish event, and buyer browse of published event succeeded.
- YardTix/free RSVP: buyer RSVP inserted into `event_attendees` with HTTP `201`.
- Services/bookings: service creation, buyer booking request, provider accept, and buyer unauthorized booking-status edit denial passed.
- Messaging: conversation creation, buyer send, creator read passed.
- Reports/admin: buyer/admin report queue read passed; buyer report submission passed.
- Notifications: self notification insert/read passed.
- Stripe Connect: live status returned active test-mode account with charges and payouts enabled.
- Stripe ticket checkout: corrected paid-event request returned a Stripe `cs_test_...` Checkout Session URL.
- Stripe booking checkout: booking intent route returned a test-mode PaymentIntent client secret.

## What Failed

### 1. Backend CORS Blocks Browser API Calls

Severity: Critical launch blocker

Steps:

1. Send a browser-equivalent preflight:
   `OPTIONS https://yardlinerepo-production.up.railway.app/api/checkout/event-session`
2. Include `Origin: https://yardlinerepo.vercel.app`.
3. Include requested method/header preflight headers.

Observed:

- HTTP status: `204`
- `Access-Control-Allow-Origin`: `null` / omitted

Root cause:

- `backend/src/index.ts` CORS allowlist did not include `https://yardlinerepo.vercel.app`.

Fix applied:

- Added the production Vercel origin to the backend CORS allowlist.

Verification:

- Backend typecheck passed locally. Production remains blocked until this branch is deployed to Railway.

### 2. Profile Avatar/Banner Uploads Blocked by Storage RLS

Severity: High launch blocker for profile upload

Steps:

1. Authenticate as creator.
2. Upload an image to `avatars/{user_id}/qa-avatar-*.png`, matching the app path pattern.

Observed:

- HTTP `400`
- Storage body: `403 Unauthorized`, `new row violates row-level security policy`

Root cause:

- The `avatars` bucket exists, but storage object insert/update policies for owner-scoped profile uploads were missing.

Fix applied:

- Added migration `0008_live_e2e_fixes.sql` with owner-scoped `avatars` upload/update/delete policies and public read policy.

Verification:

- Migration is additive and local validation passed. Production upload remains blocked until migration is applied.

### 3. Budget Request Creation Denied for Organization President

Severity: High launch blocker for budget workflow

Steps:

1. Creator creates organization.
2. Confirm creator is active `president` member.
3. Creator inserts draft budget request for that organization.

Observed:

- HTTP `403`
- `new row violates row-level security policy for table "budget_requests"`

Root cause:

- The budget create RLS policy did not allow the intended active president/officer path in production.

Fix applied:

- Added migration `0008_live_e2e_fixes.sql` to recreate the budget create policy with an explicit active-member role check for president, treasurer, officer, advisor, admin, or platform admin.

Verification:

- Migration is additive and local validation passed. Production budget creation remains blocked until migration is applied.

### 4. Review Insert Fails Because `reviews.id` Has No Default

Severity: Medium/high launch blocker for reviews

Steps:

1. Buyer/admin submits provider review through the app-compatible insert shape.

Observed:

- HTTP `400`
- Postgres `23502`: null value in `reviews.id` violates not-null constraint.

Root cause:

- Production `reviews.id` exists but does not default to `gen_random_uuid()`, while the frontend correctly does not generate ids client-side.

Fix applied:

- Added migration `0008_live_e2e_fixes.sql` to set `reviews.id default gen_random_uuid()` when the default is missing.

Verification:

- Migration is additive and local validation passed. Production review insert remains blocked until migration is applied.

## Bugs Fixed In This Branch

- `backend/src/index.ts`: added `https://yardlinerepo.vercel.app` to allowed CORS origins.
- `supabase/migrations/0008_live_e2e_fixes.sql`: added owner-scoped profile storage upload policies.
- `supabase/migrations/0008_live_e2e_fixes.sql`: fixed missing default for `reviews.id`.
- `supabase/migrations/0008_live_e2e_fixes.sql`: fixed budget request create policy for authorized org budget roles.

## Bugs Left Unresolved

- Event images and service images are URL/preset pickers in the current webapp, not actual file uploads. The requested file-upload surface for event/service images is not implemented and was not added because that would be new feature scope.
- Full Stripe webhook behavior was not completed because no test payment was completed. Checkout/session creation was verified only.
- Visual screenshot capture was not available in this container because no browser automation runtime was installed. Network/API evidence was captured instead.

## Environment Variables / Deployment Observations

- `VITE_BACKEND_URL` is present in the deployed bundle and points to `https://yardlinerepo-production.up.railway.app`.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present in the deployed bundle.
- `VITE_STRIPE_PUBLISHABLE_KEY` appears configured because Stripe client code loads and backend Stripe test flows work.
- Backend Stripe secret/config appears present: Connect status, event Checkout Session, and booking PaymentIntent returned test-mode Stripe objects.
- Backend CORS deployment is missing the production frontend origin until this branch is deployed.
- Supabase production is migrated through `0007`; `0008_live_e2e_fixes.sql` must be applied after merge/deploy.

## Negative Testing

- Unauthenticated backend Connect status returns auth error as expected.
- Buyer editing provider-owned booking status was denied or produced no writable row.
- Invalid profile upload was rejected.
- Invalid checkout request returned HTTP `400`.
- Invalid route on Vercel returned platform `404`. Note: direct deep links such as `/events` may depend on Vercel SPA rewrite configuration; the arbitrary invalid route returned Vercel `NOT_FOUND`.

## Performance / Console / Network Observations

- Vercel app shell and bundle load successfully.
- Deployed JS bundle is large: local build reports `1,509.93 kB` minified and `407.92 kB` gzip. This is non-blocking but should be code-split before scale.
- The largest functional network issue is CORS from Vercel to Railway, which blocks browser API calls despite direct curl/backend requests succeeding.

## Security Observations

- The buyer/admin account is `role=admin`; admin-level organization edits are expected for that account.
- Creator account is `role=user`; admin gating should be checked in-browser after CORS deploy/browser runtime is available.
- The new storage policy is owner-folder scoped and does not grant cross-user writes.
- The new budget policy is role-scoped and does not grant ordinary member budget creation.

## Launch Blockers

1. Deploy backend CORS fix to Railway.
2. Apply `supabase/migrations/0008_live_e2e_fixes.sql` to production Supabase.
3. Re-run browser QA after deploy/migration, especially profile uploads, budget requests, reviews, and Stripe flows from the Vercel origin.

## Non-Blocking Polish

- Add code splitting for the large frontend bundle.
- Add real browser E2E automation with screenshots for the launch checklist.
- Consider implementing true event/service image file uploads later if required; current UI is URL/preset-based.

## Verification Commands

- `npm run build` in `webapp`: passed.
- `npm run lint` in `webapp`: passed with 9 existing fast-refresh warnings.
- `npm run typecheck` in `backend`: passed.
