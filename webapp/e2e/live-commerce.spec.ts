import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  BUYER_EMAIL,
  CREATOR_EMAIL,
  acceptLegalGateIfPresent,
  appGoto,
  attachDiagnostics,
  attachDiagnosticsReport,
  authorizeEmbeddedStripePayment,
  backendPost,
  captureProviderAndServiceIds,
  completeStripeCheckout,
  createEvent,
  createService,
  currentEventId,
  dismissToasts,
  futureDate,
  loginWithOtp,
  makeDiagnostics,
  makeLiveCommerceState,
  openEventFromDirectory,
  openProviderForBooking,
  readAccessToken,
  submitBookingRequest,
} from "./helpers/liveCommerce";

test.describe.configure({ mode: "serial" });

test.describe("YardLine live commerce lifecycle", () => {
  const state = makeLiveCommerceState();
  const diagnostics = makeDiagnostics();

  test.beforeAll(async () => {
    await mkdir("playwright/.auth", { recursive: true });
  });

  test.afterEach(async ({ page }, testInfo) => {
    await dismissToasts(page).catch(() => undefined);
    await attachDiagnosticsReport(testInfo, diagnostics);
    if (testInfo.status !== testInfo.expectedStatus) {
      await page.screenshot({ path: `test-results/live-commerce-${testInfo.title.replace(/\W+/g, "-")}.png`, fullPage: true });
    }
  });

  test("auth: creator and buyer OTP login, session persistence, and logout", async ({ browser }) => {
    const creatorContext = await browser.newContext();
    const creatorPage = await creatorContext.newPage();
    attachDiagnostics(creatorPage, diagnostics, "creator-auth");
    await loginWithOtp(creatorPage, CREATOR_EMAIL);

    await appGoto(creatorPage, "/profile");
    await expect(creatorPage.getByText(CREATOR_EMAIL)).toBeVisible();

    await appGoto(creatorPage, "/creator-dashboard");
    await expect(creatorPage.getByRole("heading", { name: /creator dashboard/i })).toBeVisible();
    await creatorContext.storageState({ path: "playwright/.auth/creator.json" });
    await creatorContext.close();

    const creatorPersistContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorPersistPage = await creatorPersistContext.newPage();
    attachDiagnostics(creatorPersistPage, diagnostics, "creator-persist");
    await appGoto(creatorPersistPage, "/creator-dashboard");
    await expect(creatorPersistPage.getByRole("heading", { name: /creator dashboard/i })).toBeVisible();
    await creatorPersistContext.close();

    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();
    attachDiagnostics(buyerPage, diagnostics, "buyer-auth");
    await loginWithOtp(buyerPage, BUYER_EMAIL);
    await appGoto(buyerPage, "/profile");
    await expect(buyerPage.getByText(BUYER_EMAIL)).toBeVisible();
    await buyerContext.storageState({ path: "playwright/.auth/buyer.json" });
    await buyerContext.close();

    const logoutContext = await browser.newContext({ storageState: "playwright/.auth/buyer.json" });
    const logoutPage = await logoutContext.newPage();
    attachDiagnostics(logoutPage, diagnostics, "buyer-logout");
    await appGoto(logoutPage, "/profile");
    const menuButton = logoutPage.getByRole("button", { name: /user|account|profile|menu/i }).first();
    if (await menuButton.isVisible().catch(() => false)) {
      await menuButton.click();
    }
    const logout = logoutPage.getByRole("menuitem", { name: /log out|sign out/i }).or(logoutPage.getByRole("button", { name: /log out|sign out/i })).first();
    await expect(logout).toBeVisible();
    await logout.click();
    await expect(logoutPage.getByRole("link", { name: /log in|sign in/i }).or(logoutPage.getByRole("button", { name: /log in|sign in/i }))).toBeVisible({ timeout: 30_000 });
    await logoutContext.close();
  });

  test("paid ticket: creator publishes event and buyer completes Stripe Checkout", async ({ browser }) => {
    const creatorContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorPage = await creatorContext.newPage();
    attachDiagnostics(creatorPage, diagnostics, "paid-creator");
    await createEvent(creatorPage, {
      title: state.paidEventTitle,
      description: "Live commerce QA paid event for Stripe Checkout.",
      isPaid: true,
      price: state.paidEventPrice,
      dateOffsetDays: 21,
    });
    state.paidEventId = currentEventId(creatorPage);
    await expect(creatorPage.getByText(/\$12\.34/)).toBeVisible();
    await creatorContext.close();

    const buyerContext = await browser.newContext({ storageState: "playwright/.auth/buyer.json" });
    const buyerPage = await buyerContext.newPage();
    attachDiagnostics(buyerPage, diagnostics, "paid-buyer");
    await openEventFromDirectory(buyerPage, state.paidEventTitle);
    await expect(buyerPage.getByText("General Admission")).toBeVisible();
    await expect(buyerPage.getByText(/\$12\.34/)).toBeVisible();

    const increment = buyerPage
      .locator("div")
      .filter({ hasText: "General Admission" })
      .filter({ hasText: "$12.34" })
      .first()
      .getByRole("button")
      .last();
    await expect(increment).toBeVisible();
    await expect(increment).toBeEnabled();
    await increment.click();
    const buyButton = buyerPage.getByRole("button", { name: /buy tickets/i });
    await expect(buyButton).toBeEnabled();
    const checkoutResponse = buyerPage.waitForResponse((res) => res.url().includes("/api/checkout/event-session") && res.request().method() === "POST");
    await buyButton.click();
    await expect(buyButton).toBeDisabled();
    await acceptLegalGateIfPresent(buyerPage);
    const checkoutJson = await (await checkoutResponse).json().catch(() => null);
    state.paidOrderId = checkoutJson?.data?.order_id ?? undefined;
    state.paidCheckoutSessionId = checkoutJson?.data?.session_id ?? undefined;
    await completeStripeCheckout(buyerPage, BUYER_EMAIL);
    await expect(buyerPage).toHaveURL(/yardlinerepo\.vercel\.app\/receipt/, { timeout: 120_000 });
    await expect(buyerPage.getByText(state.paidEventTitle)).toBeVisible({ timeout: 60_000 });

    await appGoto(buyerPage, "/my-yardtix");
    await expect(buyerPage.getByText(state.paidEventTitle)).toBeVisible();
    await expect(buyerPage.getByText(/qr|check.?in|ticket/i)).toBeVisible();
    await buyerContext.close();

    const creatorVerifyContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorVerifyPage = await creatorVerifyContext.newPage();
    attachDiagnostics(creatorVerifyPage, diagnostics, "paid-creator-verify");
    await openEventFromDirectory(creatorVerifyPage, state.paidEventTitle);
    await creatorVerifyPage.getByRole("button", { name: /attendees/i }).click();
    await expect(creatorVerifyPage.getByText(BUYER_EMAIL).or(creatorVerifyPage.getByText(/ticket/i))).toBeVisible();
    await creatorVerifyContext.close();
  });

  test("checkout cancellation returns safely without confirmed ticket", async ({ browser }) => {
    const creatorContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorPage = await creatorContext.newPage();
    attachDiagnostics(creatorPage, diagnostics, "cancel-creator");
    await createEvent(creatorPage, {
      title: state.cancelEventTitle,
      description: "Live commerce QA cancellation event.",
      isPaid: true,
      price: state.paidEventPrice,
      dateOffsetDays: 24,
    });
    state.cancelEventId = currentEventId(creatorPage);
    await creatorContext.close();

    const buyerContext = await browser.newContext({ storageState: "playwright/.auth/buyer.json" });
    const buyerPage = await buyerContext.newPage();
    attachDiagnostics(buyerPage, diagnostics, "cancel-buyer");
    await openEventFromDirectory(buyerPage, state.cancelEventTitle);
    const eventUrl = buyerPage.url();
    await buyerPage
      .locator("div")
      .filter({ hasText: "General Admission" })
      .filter({ hasText: "$12.34" })
      .first()
      .getByRole("button")
      .last()
      .click();
    await buyerPage.getByRole("button", { name: /buy tickets/i }).click();
    await acceptLegalGateIfPresent(buyerPage);
    await expect(buyerPage).toHaveURL(/checkout\.stripe\.com/, { timeout: 60_000 });
    await buyerPage.goto(eventUrl);
    await expect(buyerPage.getByRole("heading", { name: state.cancelEventTitle })).toBeVisible({ timeout: 60_000 });
    await appGoto(buyerPage, "/my-yardtix");
    await expect(buyerPage.getByText(state.cancelEventTitle)).toHaveCount(0);
    await buyerContext.close();
  });

  test("free RSVP: buyer receives RSVP, creator sees attendee, duplicate RSVP is blocked", async ({ browser }) => {
    const creatorContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorPage = await creatorContext.newPage();
    attachDiagnostics(creatorPage, diagnostics, "free-creator");
    await createEvent(creatorPage, {
      title: state.freeEventTitle,
      description: "Live commerce QA free RSVP event.",
      isPaid: false,
      dateOffsetDays: 28,
    });
    await creatorContext.close();

    const buyerContext = await browser.newContext({ storageState: "playwright/.auth/buyer.json" });
    const buyerPage = await buyerContext.newPage();
    attachDiagnostics(buyerPage, diagnostics, "free-buyer");
    await openEventFromDirectory(buyerPage, state.freeEventTitle);
    await buyerPage.getByRole("button", { name: /rsvp now/i }).click();
    await expect(buyerPage.getByRole("button", { name: /you.re going/i })).toBeVisible();
    await expect(buyerPage.getByRole("button", { name: /rsvp now/i })).toHaveCount(0);
    await appGoto(buyerPage, "/my-yardtix");
    await expect(buyerPage.getByText(state.freeEventTitle)).toBeVisible();
    await buyerContext.close();

    const creatorVerifyContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorVerifyPage = await creatorVerifyContext.newPage();
    attachDiagnostics(creatorVerifyPage, diagnostics, "free-creator-verify");
    await openEventFromDirectory(creatorVerifyPage, state.freeEventTitle);
    await creatorVerifyPage.getByRole("button", { name: /attendees/i }).click();
    await expect(creatorVerifyPage.getByText(BUYER_EMAIL).or(creatorVerifyPage.getByText(/attendee/i))).toBeVisible();
    await creatorVerifyContext.close();
  });

  test("service booking payment: buyer authorizes and creator accepts", async ({ browser }) => {
    const creatorContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorPage = await creatorContext.newPage();
    attachDiagnostics(creatorPage, diagnostics, "booking-create-service");
    await createService(creatorPage, state);
    await creatorContext.close();

    const buyerContext = await browser.newContext({ storageState: "playwright/.auth/buyer.json" });
    const buyerPage = await buyerContext.newPage();
    attachDiagnostics(buyerPage, diagnostics, "booking-buyer");
    await openProviderForBooking(buyerPage, "Ausar", state.serviceName);
    const ids = await captureProviderAndServiceIds(buyerPage, state.serviceName);
    state.providerUserId = ids.providerUserId ?? undefined;
    state.serviceId = ids.serviceId ?? undefined;
    const bookingResponse = buyerPage.waitForResponse((res) => res.url().includes("/api/checkout/booking-intent") && res.request().method() === "POST");
    await submitBookingRequest(buyerPage, state.serviceName, futureDate(35), "14:30");
    const bookingJson = await (await bookingResponse).json().catch(() => null);
    state.acceptedBookingId = bookingJson?.data?.booking_id ?? undefined;
    await buyerPage.getByRole("button", { name: /view my bookings/i }).click();
    await expect(buyerPage.getByText(state.serviceName)).toBeVisible();
    await expect(buyerPage.getByText(/pending|requested|authorized/i)).toBeVisible();
    await buyerContext.close();

    const creatorAcceptContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorAcceptPage = await creatorAcceptContext.newPage();
    attachDiagnostics(creatorAcceptPage, diagnostics, "booking-creator-accept");
    await appGoto(creatorAcceptPage, "/creator-dashboard?tab=services");
    await expect(creatorAcceptPage.getByText(state.serviceName)).toBeVisible({ timeout: 60_000 });
    const accept = creatorAcceptPage.locator("div").filter({ hasText: state.serviceName }).getByRole("button", { name: /accept/i }).first();
    await expect(accept).toBeEnabled();
    await Promise.all([
      accept.click(),
      accept.click({ force: true }).catch(() => undefined),
    ]);
    await expect(creatorAcceptPage.getByText(/confirmed|captured/i)).toBeVisible({ timeout: 90_000 });
    await creatorAcceptContext.close();
  });

  test("booking decline releases authorization and shows declined status", async ({ browser }) => {
    const buyerContext = await browser.newContext({ storageState: "playwright/.auth/buyer.json" });
    const buyerPage = await buyerContext.newPage();
    attachDiagnostics(buyerPage, diagnostics, "decline-buyer");
    await openProviderForBooking(buyerPage, "Ausar", state.serviceName);
    const bookingResponse = buyerPage.waitForResponse((res) => res.url().includes("/api/checkout/booking-intent") && res.request().method() === "POST");
    await submitBookingRequest(buyerPage, state.serviceName, futureDate(42), "15:15");
    const bookingJson = await (await bookingResponse).json().catch(() => null);
    state.declinedBookingId = bookingJson?.data?.booking_id ?? undefined;
    await buyerContext.close();

    const creatorContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorPage = await creatorContext.newPage();
    attachDiagnostics(creatorPage, diagnostics, "decline-creator");
    await appGoto(creatorPage, "/creator-dashboard?tab=services");
    await expect(creatorPage.getByText(state.serviceName)).toBeVisible({ timeout: 60_000 });
    const decline = creatorPage.locator("div").filter({ hasText: state.serviceName }).getByRole("button", { name: /decline/i }).first();
    await expect(decline).toBeEnabled();
    await decline.click();
    await expect(creatorPage.getByText(/declined/i)).toBeVisible({ timeout: 60_000 });
    await creatorContext.close();

    const buyerVerifyContext = await browser.newContext({ storageState: "playwright/.auth/buyer.json" });
    const buyerVerifyPage = await buyerVerifyContext.newPage();
    attachDiagnostics(buyerVerifyPage, diagnostics, "decline-buyer-verify");
    await appGoto(buyerVerifyPage, "/my-bookings");
    await expect(buyerVerifyPage.getByText(state.serviceName)).toBeVisible();
    await expect(buyerVerifyPage.getByText(/declined/i)).toBeVisible();
    await buyerVerifyContext.close();
  });

  test("negative and idempotency API checks are enforced", async () => {
    const buyerToken = await readAccessToken("playwright/.auth/buyer.json");
    const creatorToken = await readAccessToken("playwright/.auth/creator.json");

    const unauthorized = await backendPost("/api/checkout/event-session", {
      event_id: state.paidEventId ?? "00000000-0000-0000-0000-000000000000",
      items: [{ tier_id: "invalid", quantity: 1 }],
      origin: "https://yardlinerepo.vercel.app",
    });
    expect(unauthorized.status).toBe(401);

    const invalidQuantity = await backendPost("/api/checkout/event-session", {
      event_id: state.paidEventId,
      items: [{ tier_id: "invalid", quantity: 0 }],
      origin: "https://yardlinerepo.vercel.app",
    }, buyerToken);
    expect(invalidQuantity.status).toBe(400);

    const invalidTier = await backendPost("/api/checkout/event-session", {
      event_id: state.paidEventId,
      items: [{ tier_id: "00000000-0000-0000-0000-000000000000", quantity: 1 }],
      origin: "https://yardlinerepo.vercel.app",
    }, buyerToken);
    expect([200, 400]).toContain(invalidTier.status);
    expect(JSON.stringify(invalidTier.json)).toMatch(/Unknown ticket tier|Invalid checkout request|not activated|payments/i);

    const invalidBooking = await backendPost("/api/checkout/booking-intent", {
      service_id: state.serviceId ?? "missing",
      provider_user_id: "00000000-0000-0000-0000-000000000000",
      date: futureDate(50),
      time_start: "13:00",
    }, buyerToken);
    expect([400, 404]).toContain(invalidBooking.status);

    if (state.acceptedBookingId) {
      const firstAccept = await backendPost(`/api/bookings/${state.acceptedBookingId}/accept`, undefined, creatorToken);
      const secondAccept = await backendPost(`/api/bookings/${state.acceptedBookingId}/accept`, undefined, creatorToken);
      expect(firstAccept.status).toBe(200);
      expect(secondAccept.status).toBe(200);
      expect(JSON.stringify(secondAccept.json)).toMatch(/Already captured|captured|confirmed/i);
    }
  });
});
