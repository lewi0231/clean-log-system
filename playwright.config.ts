import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

/**
 * Load e2e environment variables from e2e/.env.local
 * Falls back to defaults if file doesn't exist
 */
require("dotenv").config({ path: path.resolve(__dirname, "e2e/.env.local") });

/**
 * E2E Testing Configuration
 * Tests critical user journeys through the dashboard application
 *
 * Projects:
 * - scenario-1: Car Yard Detailer scenario with seeded test data
 * - chromium/firefox/webkit: Browser-specific tests (legacy specs)
 */
export default defineConfig({
  testDir: "./e2e",

  // Maximum time one test can run for
  timeout: 60 * 1000,

  // Expect timeout for assertions
  expect: {
    timeout: 10 * 1000,
  },

  // Run tests in files in parallel (disabled for scenario tests to maintain order)
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ["html"],
    ["junit", { outputFile: "test-results/junit.xml" }],
    ["list"],
  ],

  // Global setup/teardown for scenario tests
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3001",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Video on failure
    video: "retain-on-failure",

    // Store state between tests in a scenario
    storageState: "./e2e/.auth/user.json",
  },

  // Configure projects for major browsers
  projects: [
    // Setup project - authenticates and saves state
    {
      name: "setup",
      testMatch: /global-setup\.ts/,
      teardown: "teardown",
    },

    // Teardown project - cleans up test data
    {
      name: "teardown",
      testMatch: /global-teardown\.ts/,
    },

    // Scenario 1: Car Yard Detailer - comprehensive E2E tests
    {
      name: "scenario-1",
      testDir: "./e2e/specs/scenario-1",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
      },
    },

    // Legacy browser tests (existing specs)
    {
      name: "chromium",
      testMatch: /^(?!.*specs\/scenario).*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      testMatch: /^(?!.*specs\/scenario).*\.spec\.ts$/,
      use: { ...devices["Desktop Firefox"] },
    },

    {
      name: "webkit",
      testMatch: /^(?!.*specs\/scenario).*\.spec\.ts$/,
      use: { ...devices["Desktop Safari"] },
    },

    // Test against mobile viewports
    {
      name: "Mobile Chrome",
      testMatch: /^(?!.*specs\/scenario).*\.spec\.ts$/,
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      testMatch: /^(?!.*specs\/scenario).*\.spec\.ts$/,
      use: { ...devices["iPhone 12"] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: "pnpm dev:dashboard",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
