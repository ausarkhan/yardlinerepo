import { expect, test, type Browser, type Page } from "@playwright/test";
import { access, mkdir } from "node:fs/promises";
import {
  AUTH_DIR,
  BUYER_EMAIL,
  BUYER_STORAGE_STATE,
  CREATOR_EMAIL,
  CREATOR_STORAGE_STATE,
  appGoto,
  attachDiagnostics,
  attachDiagnosticsReport,
  loginWithOtp,
  makeDiagnostics,
} from "./helpers/liveCommerce";

const diagnostics = makeDiagnostics();

test.describe("YardLine live commerce auth setup", () => {
  test.beforeAll(async () => {
    await mkdir(AUTH_DIR, { recursive: true });
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachDiagnosticsReport(testInfo, diagnostics);
    if (testInfo.status !== testInfo.expectedStatus) {
      await page.screenshot({ path: `test-results/live-commerce-auth-${testInfo.title.replace(/\W+/g, "-")}.png`, fullPage: true });
    }
  });

  test("creator storage state is valid or refreshed", async ({ browser }) => {
    await ensureStorageState({
      browser,
      email: CREATOR_EMAIL,
      path: CREATOR_STORAGE_STATE,
      label: "creator-auth-setup",
      validatePath: "/creator-dashboard",
      validate: async (page) => {
        await expect(page.getByRole("heading", { name: /creator dashboard/i })).toBeVisible({ timeout: 20_000 });
      },
    });
  });

  test("buyer storage state is valid or refreshed", async ({ browser }) => {
    await ensureStorageState({
      browser,
      email: BUYER_EMAIL,
      path: BUYER_STORAGE_STATE,
      label: "buyer-auth-setup",
      validatePath: "/profile",
      validate: async (page) => {
        await expect(page.getByText(BUYER_EMAIL)).toBeVisible({ timeout: 20_000 });
      },
    });
  });
});

async function ensureStorageState(options: {
  browser: Browser;
  email: string;
  path: string;
  label: string;
  validatePath: string;
  validate: (page: Page) => Promise<void>;
}): Promise<void> {
  if (await storageStateExists(options.path)) {
    const valid = await validateExistingState(options).catch(() => false);
    if (valid) return;
  }

  const context = await options.browser.newContext();
  const page = await context.newPage();
  attachDiagnostics(page, diagnostics, `${options.label}-refresh`);
  await loginWithOtp(page, options.email);
  await appGoto(page, options.validatePath);
  await options.validate(page);
  await context.storageState({ path: options.path });
  await context.close();
}

async function validateExistingState(options: {
  browser: Browser;
  path: string;
  label: string;
  validatePath: string;
  validate: (page: Page) => Promise<void>;
}): Promise<boolean> {
  const context = await options.browser.newContext({ storageState: options.path });
  const page = await context.newPage();
  attachDiagnostics(page, diagnostics, `${options.label}-validate`);
  await appGoto(page, options.validatePath);
  const loginRedirected = /\/login|\/verify/.test(page.url());
  if (!loginRedirected) {
    await options.validate(page);
    await context.storageState({ path: options.path });
  }
  await context.close();
  return !loginRedirected;
}

async function storageStateExists(path: string): Promise<boolean> {
  return access(path)
    .then(() => true)
    .catch(() => false);
}
