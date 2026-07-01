import { defineConfig } from "@playwright/test";
import process from "node:process";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 20_000,
  },
  reporter: [["list"], ["html", { outputFolder: "playwright-live-commerce-report", open: "never" }]],
  use: {
    baseURL: process.env.YARDLINE_LIVE_URL ?? "https://yardlinerepo.vercel.app",
    browserName: "chromium",
    headless: process.env.PLAYWRIGHT_HEADED === "1" ? false : true,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "auth",
      testMatch: /live-commerce\.auth\.setup\.ts/,
    },
    {
      name: "commerce",
      testMatch: /live-commerce\.spec\.ts/,
      dependencies: ["auth"],
    },
  ],
});
