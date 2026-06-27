YardLine Playwright Commerce QA Report
======================================

Run date: 2026-06-27
Branch: playwright-commerce-qa

Scope
-----

This sprint added a Playwright-powered live commerce QA suite for the deployed YardLine frontend and backend:

- Frontend: https://yardlinerepo.vercel.app
- Backend: https://yardlinerepo-production.up.railway.app
- Health: https://yardlinerepo-production.up.railway.app/health

The suite intentionally uses Stripe test card data only. QA-created records are prefixed with `PLAYWRIGHT COMMERCE QA [timestamp]`.

How To Run
----------

From `webapp/`:

```bash
npm run test:commerce:live
```

Headed mode is opt-in:

```bash
PLAYWRIGHT_HEADED=1 npm run test:commerce:live
```

OTP handling:

- The test prints `Please provide the OTP for [email].`
- It accepts stdin when available.
- It also watches `/tmp/yardline-otp-[email].txt`; write the 6-digit code there if stdin is not consumed by the Playwright worker.
- `CREATOR_OTP` and `BUYER_OTP` environment variables are also supported for one-off local runs.

Tests Added / Updated
---------------------

Updated `webapp/e2e/live-commerce.spec.ts` and `webapp/e2e/helpers/liveCommerce.ts` to cover:

- Creator OTP login.
- Buyer/Admin OTP login.
- Session persistence.
- Logout.
- Paid ticket event creation and Stripe Checkout purchase.
- Checkout cancellation safe return with no confirmed ticket.
- Free RSVP, attendee visibility, and duplicate RSVP blocking.
- Paid service booking authorization and creator acceptance.
- Booking decline and buyer-visible declined status.
- Backend negative checks for unauthorized checkout, invalid quantity, invalid ticket tier, invalid booking request.
- Accept-booking idempotency check.

Browser QA Diagnostics
----------------------

The suite now collects and attaches:

- Console errors.
- Network failures.
- HTTP responses with status >= 400.
- Screenshots on failure.
- Playwright traces on failure.
- Videos on failure.

Artifacts from the latest blocked run:

- `webapp/test-results/live-commerce-YardLine-liv-de740-sion-persistence-and-logout/test-failed-1.png`
- `webapp/test-results/live-commerce-YardLine-liv-de740-sion-persistence-and-logout/video.webm`
- `webapp/test-results/live-commerce-YardLine-liv-de740-sion-persistence-and-logout/trace.zip`
- `webapp/playwright-live-commerce-report/`

Run Results
-----------

Passed:

- `npx playwright test --config=playwright.live-commerce.config.ts --list`
- `npm run lint` in `webapp/` with existing Fast Refresh warnings only.
- `npm run build` in `webapp/` with existing large chunk warning.
- `npm run typecheck` in `backend/`.
- Backend health: `{"status":"ok"}`.

Live Playwright execution:

- Initial headed Chromium launch failed inside the container sandbox.
- Headless Chromium also failed inside the sandbox.
- Re-running outside the sandbox allowed Chromium to launch.
- Creator OTP verification succeeded after the OTP helper was repaired for the deployed `input-otp` auto-submit behavior.
- A later repeated run was blocked before `/verify`; the login page remained on `/login` after clicking "Send my code". This is consistent with a live OTP send/rate-limit or provider refusal condition after multiple rapid QA attempts. No commerce tests after auth were executed in the final run.

Bugs Fixed In This Branch
-------------------------

- Playwright SPA navigation helpers now route through the mounted Vercel app so direct client paths do not depend on platform rewrites during tests.
- OTP entry now supports the deployed auto-submit OTP component.
- OTP prompts now support stdin, environment variables, and `/tmp` files for reliable interactive Playwright runs.
- Auth assertions were tightened to avoid strict locator collisions.
- Live Playwright config now defaults to headless mode with `PLAYWRIGHT_HEADED=1` opt-in.
- Test diagnostics now capture browser console, network, HTTP status, screenshots, traces, and videos.

Stripe Payment Result
---------------------

No new Stripe test payment was completed in this run because the live suite was blocked in auth before commerce flows executed.

Webhook Result
--------------

No new webhook finalization was observed in this run because no new Stripe payment was completed.

Supabase Validation Result
--------------------------

No new Supabase ticket/order/booking validation was completed in this run because the suite did not get past auth in the final live run. The tests are prepared to validate visible YardTix, attendee, booking, declined, and idempotency outcomes once auth succeeds.

Bugs Remaining / Launch Blockers
--------------------------------

- Full paid ticket purchase through Stripe Checkout has not completed in this QA run.
- Stripe Checkout Session, PaymentIntent, Charge, metadata, and duplicate-object validation were not completed.
- Webhook finalization for `yardtix_orders`, `yardtix_tickets`, QR/check-in token, attendee, and notifications was not completed.
- Service booking accept/decline live payment authorization and capture/release validation was not completed.
- The live OTP send flow became blocked after repeated attempts and needs a clean OTP window or pre-seeded storage state to continue.

Final Conclusion
----------------

NOT READY FOR COMMERCE BETA

Reason: the automated live commerce QA suite is now in place and parse/build verified, but the required end-to-end Stripe payment, webhook, Supabase, booking capture, booking decline, cancellation, and idempotency validations did not complete in this live run.
