import { expect, type Frame, type Page } from "@playwright/test";
import { createInterface } from "node:readline/promises";
import process from "node:process";

export const CREATOR_EMAIL = process.env.CREATOR_EMAIL ?? "ausarkhan@gmail.com";
export const BUYER_EMAIL = process.env.BUYER_EMAIL ?? "markmurphy235@gmail.com";
export const STRIPE_TEST_CARD = process.env.STRIPE_TEST_CARD ?? "4242424242424242";

export interface LiveCommerceState {
  runId: string;
  paidEventTitle: string;
  freeEventTitle: string;
  serviceName: string;
  paidEventPrice: string;
  servicePrice: string;
}

export function makeLiveCommerceState(): LiveCommerceState {
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return {
    runId,
    paidEventTitle: `Live Commerce Paid ${runId}`,
    freeEventTitle: `Live Commerce Free ${runId}`,
    serviceName: `Live Commerce Service ${runId}`,
    paidEventPrice: "12.34",
    servicePrice: "18.75",
  };
}

export function futureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

export async function promptOtp(email: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`Please provide the OTP for ${email}: `)).trim();
  } finally {
    rl.close();
  }
}

export async function loginWithOtp(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole("button", { name: /send my code/i }).click();
  await expect(page).toHaveURL(/\/verify/);

  const otp = await promptOtp(email);
  const otpInput = page.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').first();
  if ((await otpInput.count()) > 0) {
    await otpInput.fill(otp);
  } else {
    await page.keyboard.type(otp);
  }

  const verifyButton = page.getByRole("button", { name: /verify/i });
  if (await verifyButton.isVisible().catch(() => false)) {
    await verifyButton.click();
  }
  await expect(page).not.toHaveURL(/\/verify/);
}

export async function acceptLegalGateIfPresent(page: Page): Promise<void> {
  const accept = page.getByRole("button", { name: /accept & continue/i });
  if (await accept.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await accept.click();
  }
}

export async function dismissToasts(page: Page): Promise<void> {
  await page.keyboard.press("Escape").catch(() => undefined);
}

export async function createEvent(
  page: Page,
  options: {
    title: string;
    description: string;
    isPaid: boolean;
    price?: string;
    dateOffsetDays: number;
  },
): Promise<void> {
  await page.goto("/create-event");
  await page.getByLabel(/event title/i).fill(options.title);
  await page.getByLabel(/^description$/i).fill(options.description);
  await page.getByLabel(/^date$/i).fill(futureDate(options.dateOffsetDays));
  await page.getByLabel(/location/i).fill("YardLine Live QA Field");
  await page.getByLabel(/start time/i).fill("18:00");
  await page.getByLabel(/end time/i).fill("20:00");

  if (options.isPaid) {
    await page.getByRole("switch").first().click();
    await expect(page.getByText(/sell tickets across tiers/i)).toBeVisible();
    await page.getByPlaceholder(/general admission/i).fill("General Admission");
    await page.getByPlaceholder(/what.s included/i).fill("Live QA ticket tier");
    await page.getByPlaceholder("0.00").fill(options.price ?? "12.34");
    await page.getByPlaceholder("Unlimited").first().fill("20");
    await page.getByPlaceholder("4").fill("2");
  } else {
    await page.getByLabel(/rsvp capacity/i).fill("20");
  }

  await page.getByRole("button", { name: /publish event/i }).click();
  await acceptLegalGateIfPresent(page);
  await expect(page.getByRole("heading", { name: options.title })).toBeVisible();
}

export async function openEventFromDirectory(page: Page, title: string): Promise<void> {
  await page.goto(`/events?q=${encodeURIComponent(title)}`);
  await page.getByPlaceholder(/search events/i).fill(title);
  await page.getByRole("link", { name: new RegExp(escapeRegex(title), "i") }).first().click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

export async function ensureProviderProfile(page: Page): Promise<void> {
  await page.goto("/creator-dashboard?tab=services");
  if (await page.getByRole("button", { name: /become a provider/i }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /become a provider/i }).click();
    await page.getByLabel(/^description$/i).fill("Live commerce QA provider profile for Stripe test bookings.");
    await page.getByRole("button", { name: /go live/i }).click();
    await acceptLegalGateIfPresent(page);
    await expect(page.getByText(/your services/i)).toBeVisible();
  }
}

export async function createService(page: Page, state: LiveCommerceState): Promise<void> {
  await page.goto("/creator-dashboard?tab=services");
  await ensureProviderProfile(page);
  await page.getByRole("button", { name: /^add service$/i }).click();
  await page.getByLabel(/service name/i).fill(state.serviceName);
  await page.getByLabel(/description/i).fill("Live QA paid booking service.");
  await page.getByLabel(/price/i).fill(state.servicePrice);
  await page.getByLabel(/duration/i).fill("45");
  await page.getByRole("button", { name: /^add service$/i }).click();
  await expect(page.getByText(state.serviceName)).toBeVisible();
}

export async function openProviderForBooking(page: Page, providerSearch: string, serviceName: string): Promise<void> {
  await page.goto("/services");
  await page.getByPlaceholder(/search providers/i).fill(providerSearch);
  await page.getByRole("link").filter({ hasText: new RegExp(escapeRegex(providerSearch), "i") }).first().click();
  await expect(page.getByText(serviceName)).toBeVisible();
}

export async function fillStripePaymentFields(page: Page): Promise<void> {
  await fillAnyStripeField(page, ["input[name='cardNumber']", "input[name='number']"], STRIPE_TEST_CARD);
  await fillAnyStripeField(page, ["input[name='cardExpiry']", "input[name='expiry']"], "1234");
  await fillAnyStripeField(page, ["input[name='cardCvc']", "input[name='cvc']"], "123");
  await fillAnyStripeField(page, ["input[name='billingName']", "input[name='name']"], "YardLine QA");
  await fillAnyStripeField(page, ["input[name='billingPostalCode']", "input[name='postalCode']"], "10001");
}

export async function completeStripeCheckout(page: Page, email: string): Promise<void> {
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
  await page.getByLabel(/^email$/i).fill(email).catch(() => undefined);
  const cardChoice = page.getByLabel(/pay with card/i).or(page.getByText(/^card$/i)).first();
  if (await cardChoice.isVisible().catch(() => false)) {
    await cardChoice.click({ force: true });
  }
  await fillStripePaymentFields(page);
  await page.getByTestId("hosted-payment-submit-button")
    .or(page.getByRole("button", { name: /pay/i }))
    .first()
    .click();

  const aiDisclosure = page.getByText(/i am an ai agent/i);
  if (await aiDisclosure.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await aiDisclosure.click({ force: true });
    await page.getByTestId("hosted-payment-submit-button")
      .or(page.getByRole("button", { name: /pay/i }))
      .first()
      .click();
  }
}

export async function authorizeEmbeddedStripePayment(page: Page): Promise<void> {
  await fillStripePaymentFields(page);
  await page.getByRole("button", { name: /authorize card/i }).click();
}

async function fillAnyStripeField(page: Page, selectors: string[], value: string): Promise<void> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await locator.fill(value);
      return;
    }
  }

  for (const frame of page.frames()) {
    if (await fillFrameField(frame, selectors, value)) return;
  }

  throw new Error(`Could not find Stripe field: ${selectors.join(", ")}`);
}

async function fillFrameField(frame: Frame, selectors: string[], value: string): Promise<boolean> {
  for (const selector of selectors) {
    const locator = frame.locator(selector).first();
    if (await locator.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await locator.fill(value);
      return true;
    }
  }
  return false;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
