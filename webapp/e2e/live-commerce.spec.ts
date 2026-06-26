import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  BUYER_EMAIL,
  CREATOR_EMAIL,
  acceptLegalGateIfPresent,
  authorizeEmbeddedStripePayment,
  completeStripeCheckout,
  createEvent,
  createService,
  dismissToasts,
  futureDate,
  loginWithOtp,
  makeLiveCommerceState,
  openEventFromDirectory,
  openProviderForBooking,
} from "./helpers/liveCommerce";

test.describe.configure({ mode: "serial" });

test.describe("YardLine live commerce lifecycle", () => {
  const state = makeLiveCommerceState();

  test.beforeAll(async () => {
    await mkdir("playwright/.auth", { recursive: true });
  });

  test("creator creates a paid event and buyer purchases a ticket through Stripe Checkout", async ({ browser }) => {
    const creatorContext = await browser.newContext();
    const creatorPage = await creatorContext.newPage();
    await loginWithOtp(creatorPage, CREATOR_EMAIL);

    await creatorPage.goto("/profile");
    await expect(creatorPage.getByText(CREATOR_EMAIL).or(creatorPage.getByText(/profile/i))).toBeVisible();

    await creatorPage.goto("/creator-dashboard");
    await expect(creatorPage.getByRole("heading", { name: /creator dashboard/i })).toBeVisible();

    await createEvent(creatorPage, {
      title: state.paidEventTitle,
      description: "Live commerce QA paid event for Stripe Checkout.",
      isPaid: true,
      price: state.paidEventPrice,
      dateOffsetDays: 21,
    });
    await expect(creatorPage.getByText(/\$12\.34/)).toBeVisible();
    await creatorContext.storageState({ path: "playwright/.auth/creator.json" });
    await creatorContext.close();

    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();
    await loginWithOtp(buyerPage, BUYER_EMAIL);
    await openEventFromDirectory(buyerPage, state.paidEventTitle);
    await expect(buyerPage.getByText("General Admission")).toBeVisible();
    await expect(buyerPage.getByText(/\$12\.34/)).toBeVisible();

    await buyerPage
      .locator("div")
      .filter({ hasText: "General Admission" })
      .filter({ hasText: "$12.34" })
      .first()
      .getByRole("button")
      .last()
      .click();
    await expect(buyerPage.getByRole("button", { name: /buy tickets/i })).toBeEnabled();
    await buyerPage.getByRole("button", { name: /buy tickets/i }).click();
    await acceptLegalGateIfPresent(buyerPage);
    await completeStripeCheckout(buyerPage, BUYER_EMAIL);
    await expect(buyerPage).toHaveURL(/yardlinerepo\.vercel\.app\/receipt/, { timeout: 120_000 });
    await expect(buyerPage.getByText(state.paidEventTitle)).toBeVisible({ timeout: 60_000 });

    await buyerPage.goto("/my-yardtix");
    await expect(buyerPage.getByText(state.paidEventTitle)).toBeVisible();
    await buyerContext.storageState({ path: "playwright/.auth/buyer.json" });
    await buyerContext.close();

    const creatorVerifyContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorVerifyPage = await creatorVerifyContext.newPage();
    await openEventFromDirectory(creatorVerifyPage, state.paidEventTitle);
    await creatorVerifyPage.getByRole("button", { name: /attendees/i }).click();
    await expect(creatorVerifyPage.getByText(BUYER_EMAIL).or(creatorVerifyPage.getByText(/ticket/i))).toBeVisible();
    await creatorVerifyContext.close();
  });

  test("free event RSVP appears in buyer YardTix", async ({ browser }) => {
    const creatorContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorPage = await creatorContext.newPage();
    await createEvent(creatorPage, {
      title: state.freeEventTitle,
      description: "Live commerce QA free RSVP event.",
      isPaid: false,
      dateOffsetDays: 28,
    });
    await creatorContext.close();

    const buyerContext = await browser.newContext({ storageState: "playwright/.auth/buyer.json" });
    const buyerPage = await buyerContext.newPage();
    await openEventFromDirectory(buyerPage, state.freeEventTitle);
    await buyerPage.getByRole("button", { name: /rsvp now/i }).click();
    await expect(buyerPage.getByRole("button", { name: /you.re going/i })).toBeVisible();
    await buyerPage.goto("/my-yardtix");
    await expect(buyerPage.getByText(state.freeEventTitle)).toBeVisible();
    await buyerContext.close();
  });

  test("buyer authorizes paid booking and creator accepts it", async ({ browser }) => {
    const creatorContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorPage = await creatorContext.newPage();
    await createService(creatorPage, state);
    await creatorContext.close();

    const buyerContext = await browser.newContext({ storageState: "playwright/.auth/buyer.json" });
    const buyerPage = await buyerContext.newPage();
    await openProviderForBooking(buyerPage, "Ausar", state.serviceName);
    await buyerPage
      .locator(".rounded-2xl")
      .filter({ hasText: state.serviceName })
      .getByRole("button", { name: /^book$/i })
      .first()
      .click();
    await acceptLegalGateIfPresent(buyerPage);
    await buyerPage.getByLabel(/^date$/i).fill(futureDate(35));
    await buyerPage.getByLabel(/start time/i).fill("14:30");
    await buyerPage.getByRole("button", { name: /continue to payment/i }).click();
    await expect(buyerPage.getByRole("button", { name: /authorize card/i })).toBeVisible({ timeout: 60_000 });
    await authorizeEmbeddedStripePayment(buyerPage);
    await expect(buyerPage.getByText(/card authorized/i)).toBeVisible({ timeout: 90_000 });
    await buyerPage.getByRole("button", { name: /view my bookings/i }).click();
    await expect(buyerPage.getByText(state.serviceName)).toBeVisible();
    await expect(buyerPage.getByText(/pending|requested|authorized/i)).toBeVisible();
    await buyerContext.close();

    const creatorAcceptContext = await browser.newContext({ storageState: "playwright/.auth/creator.json" });
    const creatorAcceptPage = await creatorAcceptContext.newPage();
    await creatorAcceptPage.goto("/creator-dashboard?tab=services");
    await expect(creatorAcceptPage.getByText(state.serviceName)).toBeVisible({ timeout: 60_000 });
    await creatorAcceptPage.locator("div").filter({ hasText: state.serviceName }).getByRole("button", { name: /accept/i }).first().click();
    await expect(creatorAcceptPage.getByText(/confirmed|captured/i)).toBeVisible({ timeout: 90_000 });
    await creatorAcceptContext.close();
  });

  test.afterEach(async ({ page }, testInfo) => {
    await dismissToasts(page).catch(() => undefined);
    if (testInfo.status !== testInfo.expectedStatus) {
      await page.screenshot({ path: `test-results/live-commerce-${testInfo.title.replace(/\W+/g, "-")}.png`, fullPage: true });
    }
  });
});
