# Live Playwright Commerce QA

This suite runs against the deployed YardLine frontend at `https://yardlinerepo.vercel.app` and uses Stripe test mode card data only.

## What It Covers

- Creator OTP login.
- Paid event creation.
- Buyer OTP login.
- Buyer ticket purchase through Stripe Checkout with `4242 4242 4242 4242`.
- Stripe redirect back to YardLine.
- Buyer ticket visibility in My YardTix.
- Creator attendee/order visibility.
- Free event creation and RSVP.
- Paid service creation.
- Buyer paid booking request with embedded Stripe authorization.
- Creator booking acceptance and status update.

## Run

```bash
cd webapp
npm install
npx playwright install chromium
npm run test:commerce:live
```

The test prompts in the terminal when OTP is needed:

```text
Please provide the OTP for ausarkhan@gmail.com:
Please provide the OTP for markmurphy235@gmail.com:
```

Run headed for Stripe Checkout. The configured npm script already passes `--headed`.

## Optional Environment

```bash
YARDLINE_LIVE_URL=https://yardlinerepo.vercel.app \
CREATOR_EMAIL=ausarkhan@gmail.com \
BUYER_EMAIL=markmurphy235@gmail.com \
STRIPE_TEST_CARD=4242424242424242 \
npm run test:commerce:live
```

## Notes

- These tests create real live production test data.
- Do not use live Stripe mode.
- Use one worker because OTP prompts and shared test data are serial.
- Failure artifacts are written under `webapp/test-results` and the HTML report under `webapp/playwright-live-commerce-report`.
