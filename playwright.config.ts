import { defineConfig, devices } from "@playwright/test";

// Browser tests (issue #12). Run: npm run e2e   (first time: npx playwright install chromium)
// The app runs with DELT_E2E=1 so /e2e shows the inbox with fake mail; no Google sign-in needed.
const PORT = 3100;
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  // service workers off: the tests answer /api themselves (the worker never touches /api anyway)
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", serviceWorkers: "block" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
    // Safari's engine on an iPhone-sized screen (issue #17). Not a real iPhone, but catches most Safari issues.
    { name: "iphone", use: { ...devices["iPhone 15"] }, testIgnore: /a11y/ },
  ],
  webServer: {
    // CI builds first (see .github/workflows/test.yml); locally the dev server is fine.
    command: process.env.CI ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/e2e`,
    env: { DELT_E2E: "1" },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
