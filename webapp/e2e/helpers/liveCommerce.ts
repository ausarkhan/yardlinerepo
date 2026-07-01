import { expect, type Frame, type Locator, type Page, type TestInfo } from "@playwright/test";
import { createInterface } from "node:readline/promises";
import { readFile, rm } from "node:fs/promises";
import process from "node:process";

export const CREATOR_EMAIL = process.env.CREATOR_EMAIL ?? "ausarkhan@gmail.com";
export const BUYER_EMAIL = process.env.BUYER_EMAIL ?? "markmurphy235@gmail.com";
export const STRIPE_TEST_CARD = process.env.STRIPE_TEST_CARD ?? "4242424242424242";
export const AUTH_DIR = "playwright/.auth";
export const CREATOR_STORAGE_STATE = `${AUTH_DIR}/creator.json`;
export const BUYER_STORAGE_STATE = `${AUTH_DIR}/buyer.json`;

export interface LiveCommerceState {
  runId: string;
  paidEventTitle: string;
  cancelEventTitle: string;
  freeEventTitle: string;
  serviceName: string;
  paidEventPrice: string;
  servicePrice: string;
  paidEventId?: string;
  paidTierId?: string;
  cancelEventId?: string;
  cancelTierId?: string;
  serviceId?: string;
  providerUserId?: string;
  paidOrderId?: string;
  paidCheckoutSessionId?: string;
  acceptedBookingId?: string;
  declinedBookingId?: string;
}

export function makeLiveCommerceState(): LiveCommerceState {
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const prefix = `PLAYWRIGHT COMMERCE QA ${runId}`;
  return {
    runId,
    paidEventTitle: `${prefix} Paid Ticket`,
    cancelEventTitle: `${prefix} Cancel Ticket`,
    freeEventTitle: `${prefix} Free RSVP`,
    serviceName: `${prefix} Paid Service`,
    paidEventPrice: "12.34",
    servicePrice: "18.75",
  };
}

export interface QaDiagnostics {
  consoleErrors: string[];
  networkFailures: string[];
  badResponses: string[];
}

export function makeDiagnostics(): QaDiagnostics {
  return { consoleErrors: [], networkFailures: [], badResponses: [] };
}

export function attachDiagnostics(page: Page, diagnostics: QaDiagnostics, label = "page"): void {
  page.on("console", (msg) => {
    if (msg.type() === "error") diagnostics.consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on("requestfailed", (request) => {
    diagnostics.networkFailures.push(
      `[${label}] ${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      diagnostics.badResponses.push(`[${label}] ${response.status()} ${response.url()}`);
    }
  });
}

export async function attachDiagnosticsReport(testInfo: TestInfo, diagnostics: QaDiagnostics): Promise<void> {
  await testInfo.attach("live-commerce-diagnostics.json", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
  });
}

export function futureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

export async function promptOtp(email: string): Promise<string> {
  const envName = email.toLowerCase().startsWith("ausar") ? "CREATOR_OTP" : "BUYER_OTP";
  if (process.env[envName]) return process.env[envName]!.trim();

  const otpFile = `/tmp/yardline-otp-${email.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
  console.log(`Please provide the OTP for ${email}. Waiting for ${otpFile} or stdin.`);

  const fileOtp = waitForOtpFile(otpFile);
  const stdinOtp = readOtpFromStdin(email);
  return Promise.race([fileOtp, stdinOtp]);
}

async function readOtpFromStdin(email: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`Please provide the OTP for ${email}: `)).trim();
  } finally {
    rl.close();
  }
}

async function waitForOtpFile(path: string): Promise<string> {
  for (;;) {
    const value = await readFile(path, "utf8").catch(() => "");
    const otp = value.trim();
    if (/^\d{6}$/.test(otp)) {
      await rm(path, { force: true }).catch(() => undefined);
      return otp;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export async function loginWithOtp(page: Page, email: string): Promise<void> {
  await appGoto(page, "/login");
  await page.getByLabel(/email address/i).fill(email);
  const sendButton = page.getByRole("button", { name: /send my code/i });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
  await page.waitForURL(/\/verify/, { timeout: 30_000 }).catch(async () => {
    const bodyText = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
    throw new Error(`OTP send did not reach /verify for ${email}. Visible page text: ${bodyText.slice(0, 1000)}`);
  });

  const otp = await promptOtp(email);
  const otpInput = page
    .getByRole("textbox")
    .or(page.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"], input'))
    .first();
  await expect(otpInput).toBeVisible();
  await otpInput.fill(otp);
  await expect(otpInput).toHaveValue(otp);

  const verifyButton = page.getByRole("button", { name: /verify/i });
  if (await verifyButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await expect(verifyButton).toBeEnabled();
    await verifyButton.click();
  }
  await expect(page).not.toHaveURL(/\/verify/, { timeout: 30_000 });
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
  await appGoto(page, "/create-event");
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

export function currentEventId(page: Page): string {
  const match = page.url().match(/\/event\/([0-9a-f-]{36})/i);
  if (!match) throw new Error(`Could not read event id from URL: ${page.url()}`);
  return match[1];
}

export async function firstTicketTierId(page: Page): Promise<string> {
  const tierId = await page.evaluate(() => {
    const text = document.body.innerHTML;
    return text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
  });
  if (!tierId) throw new Error("Could not infer a ticket tier id from the event page.");
  return tierId;
}

export async function openEventFromDirectory(page: Page, title: string): Promise<void> {
  await appGoto(page, `/events?q=${encodeURIComponent(title)}`);
  await page.getByPlaceholder(/search events/i).fill(title);
  await page.getByRole("link", { name: new RegExp(escapeRegex(title), "i") }).first().click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

export async function ensureProviderProfile(page: Page): Promise<void> {
  await appGoto(page, "/creator-dashboard?tab=services");
  if (await page.getByRole("button", { name: /become a provider/i }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /become a provider/i }).click();
    await page.getByLabel(/^description$/i).fill("Live commerce QA provider profile for Stripe test bookings.");
    await page.getByRole("button", { name: /go live/i }).click();
    await acceptLegalGateIfPresent(page);
    await expect(page.getByText(/your services/i)).toBeVisible();
  }
}

export async function createService(page: Page, state: LiveCommerceState): Promise<void> {
  await appGoto(page, "/creator-dashboard?tab=services");
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
  await appGoto(page, "/services");
  await page.getByPlaceholder(/search providers/i).fill(providerSearch);
  await page.getByRole("link").filter({ hasText: new RegExp(escapeRegex(providerSearch), "i") }).first().click();
  await expect(page.getByText(serviceName)).toBeVisible();
}

export async function captureProviderAndServiceIds(page: Page, serviceName: string): Promise<{
  providerUserId: string | null;
  serviceId: string | null;
}> {
  return page.evaluate((target) => {
    const html = document.body.innerHTML;
    const serviceIndex = html.indexOf(target);
    const windowText = serviceIndex >= 0 ? html.slice(Math.max(0, serviceIndex - 2500), serviceIndex + 2500) : html;
    const ids = Array.from(windowText.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)).map(
      (m) => m[0],
    );
    return {
      providerUserId: ids[0] ?? null,
      serviceId: ids[1] ?? null,
    };
  }, serviceName);
}

export async function submitBookingRequest(
  page: Page,
  serviceName: string,
  date: string,
  time: string,
): Promise<void> {
  await page
    .locator(".rounded-2xl")
    .filter({ hasText: serviceName })
    .getByRole("button", { name: /^book$/i })
    .first()
    .click();
  await acceptLegalGateIfPresent(page);
  await page.getByLabel(/^date$/i).fill(date);
  await page.getByLabel(/start time/i).fill(time);
  const continueButton = page.getByRole("button", { name: /continue to payment/i });
  await expect(continueButton).toBeVisible();
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(page.getByRole("button", { name: /authorize card/i })).toBeVisible({ timeout: 60_000 });
  await authorizeEmbeddedStripePayment(page);
  await expect(page.getByText(/card authorized/i)).toBeVisible({ timeout: 90_000 });
}

export async function fillStripePaymentFields(page: Page): Promise<void> {
  await fillAnyStripeField(page, ["input[name='cardNumber']", "input[name='number']"], STRIPE_TEST_CARD);
  await fillAnyStripeField(page, ["input[name='cardExpiry']", "input[name='expiry']"], "1234");
  await fillAnyStripeField(page, ["input[name='cardCvc']", "input[name='cvc']"], "123");
  await fillOptionalStripeField(page, ["input[name='billingName']", "input[name='name']"], "YardLine QA");
  await fillOptionalStripeField(page, ["input[name='billingPostalCode']", "input[name='postalCode']"], "10001");
}

export async function completeStripeCheckout(page: Page, email: string): Promise<void> {
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
  await page.getByLabel(/^email$/i).fill(email).catch(() => undefined);
  await expandStripeCheckoutCardSection(page);
  await fillStripePaymentFields(page);
  await acceptStripeAiDisclosure(page);
  await declineStripeLinkSaveInfo(page);
  await page.getByTestId("hosted-payment-submit-button")
    .or(page.getByRole("button", { name: /^pay$/i }))
    .last()
    .click();
}

export async function readAccessToken(storageStatePath: string): Promise<string> {
  const raw = JSON.parse(await readFile(storageStatePath, "utf8")) as {
    origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
  };
  for (const origin of raw.origins ?? []) {
    const entry = origin.localStorage?.find((item) => item.name === "yardline-auth");
    if (!entry) continue;
    const parsed = JSON.parse(entry.value) as { access_token?: string; currentSession?: { access_token?: string } };
    const token = parsed.access_token ?? parsed.currentSession?.access_token;
    if (token) return token;
  }
  throw new Error(`Could not find Supabase access token in ${storageStatePath}`);
}

export async function backendPost<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<{ status: number; json: T }> {
  const base = process.env.YARDLINE_BACKEND_URL ?? "https://yardlinerepo-production.up.railway.app";
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json().catch(() => ({}))) as T };
}

export async function authorizeEmbeddedStripePayment(page: Page): Promise<void> {
  await fillStripePaymentFields(page);
  await acceptStripeAiDisclosure(page);
  await page.getByRole("button", { name: /authorize card/i }).click();
}

async function acceptStripeAiDisclosure(page: Page): Promise<void> {
  const aiDisclosure = page.getByRole("checkbox", { name: /i am an ai agent/i });
  if (await aiDisclosure.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await aiDisclosure.evaluate((element) => {
      const checkbox = element as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("input", { bubbles: true }));
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
}

async function declineStripeLinkSaveInfo(page: Page): Promise<void> {
  const saveInfo = page.getByRole("checkbox", { name: /save my information for faster checkout/i }).first();
  if (!(await saveInfo.isVisible({ timeout: 2_000 }).catch(() => false))) return;
  if (await saveInfo.isChecked().catch(() => false)) {
    await saveInfo.uncheck({ force: true });
  }
}

async function expandStripeCheckoutCardSection(page: Page): Promise<void> {
  const cardNumberSelectors = ["input[name='cardNumber']", "input[name='number']"];
  await screenshotStripeCheckout(page, "before-card-expand");

  await clickFirstVisibleLocator(stripeCardSectionControls(page));
  if (!(await hasVisibleStripeCardNumberUi(page, cardNumberSelectors, 3_000))) {
    await clickFirstVisibleLocator(stripeCardFallbackControls(page));
  }
  await screenshotStripeCheckout(page, "after-card-expand");

  await waitForStripeCardNumberUi(page, cardNumberSelectors, 15_000);
}

function stripeCardSectionControls(page: Page): Locator {
  const cardControlName = /pay with card|card/i;
  return page
    .locator('button[data-testid*="card" i], button[aria-label*="card" i], [role="tab"][aria-label*="card" i]')
    .or(page.locator('[role="tab"]').filter({ hasText: cardControlName }))
    .or(page.getByRole("button", { name: cardControlName }))
    .or(page.getByRole("tab", { name: cardControlName }))
    .or(page.locator("button").filter({ hasText: cardControlName }));
}

function stripeCardFallbackControls(page: Page): Locator {
  return page
    .getByRole("radio", { name: /^card$/i })
    .or(page.getByText(/^card$/i));
}

async function clickFirstVisibleLocator(locator: Locator): Promise<boolean> {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await candidate.click({ force: true });
      return true;
    }
  }
  return false;
}

async function screenshotStripeCheckout(page: Page, label: string): Promise<void> {
  await page.screenshot({
    path: `test-results/stripe-checkout-${label}.png`,
    fullPage: true,
  }).catch(() => undefined);
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

async function waitForStripeCardNumberUi(page: Page, selectors: string[], timeout: number): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await hasVisibleStripeCardNumberUi(page, selectors, 500)) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`Timed out waiting for Stripe card number UI: ${selectors.join(", ")}, iframe card fields, or Card number label`);
}

async function hasVisibleStripeField(page: Page, selectors: string[], timeout: number): Promise<boolean> {
  for (const selector of selectors) {
    if (await page.locator(selector).first().isVisible({ timeout }).catch(() => false)) return true;
  }

  for (const frame of page.frames()) {
    for (const selector of selectors) {
      if (await frame.locator(selector).first().isVisible({ timeout }).catch(() => false)) return true;
    }
  }

  return false;
}

async function hasVisibleStripeCardNumberUi(page: Page, selectors: string[], timeout: number): Promise<boolean> {
  if (await hasVisibleStripeField(page, selectors, timeout)) return true;
  if (await page.getByText(/card number/i).first().isVisible({ timeout }).catch(() => false)) return true;

  for (const frame of page.frames()) {
    if (await frame.getByText(/card number/i).first().isVisible({ timeout }).catch(() => false)) return true;
  }

  return false;
}

async function fillOptionalStripeField(page: Page, selectors: string[], value: string): Promise<void> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await locator.fill(value);
      return;
    }
  }

  for (const frame of page.frames()) {
    if (await fillFrameField(frame, selectors, value)) return;
  }
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

export async function appGoto(page: Page, path: string): Promise<void> {
  await page.goto("/");
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
