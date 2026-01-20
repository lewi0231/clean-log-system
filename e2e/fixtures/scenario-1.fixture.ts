/**
 * Scenario 1 Playwright Fixtures
 *
 * Provides typed test data and authenticated page fixtures for
 * Car Yard Detailer E2E tests.
 */

import { test as base, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

import type { Scenario1Data, SeededDataIds } from "../helpers/types";

// Path to stored seeded data IDs
const SEEDED_DATA_PATH = path.resolve(__dirname, "../.seeded-data.json");
const SCENARIO_DATA_PATH = path.resolve(__dirname, "../data/scenario-1.json");

/**
 * Extended fixtures for Scenario 1 tests
 */
export interface Scenario1Fixtures {
  /** Authenticated page with admin session */
  authenticatedPage: Page;
  /** Seeded database IDs for reference */
  seededIds: SeededDataIds;
  /** Scenario test data from JSON */
  scenarioData: Scenario1Data;
  /** Helper to get location ID by name */
  getLocationId: (name: string) => string;
  /** Helper to get worker ID by name */
  getWorkerId: (firstName: string, lastName: string) => string;
  /** Helper to get field config ID by name */
  getFieldConfigId: (name: string) => string;
}

/**
 * Load seeded data IDs
 */
function loadSeededIds(): SeededDataIds {
  if (!fs.existsSync(SEEDED_DATA_PATH)) {
    throw new Error(
      "Seeded data not found. Make sure global setup ran successfully.\n" +
        `Expected file at: ${SEEDED_DATA_PATH}`
    );
  }

  const data = fs.readFileSync(SEEDED_DATA_PATH, "utf-8");
  return JSON.parse(data) as SeededDataIds;
}

/**
 * Load scenario data
 */
function loadScenarioData(): Scenario1Data {
  if (!fs.existsSync(SCENARIO_DATA_PATH)) {
    throw new Error(`Scenario data not found at: ${SCENARIO_DATA_PATH}`);
  }

  const data = fs.readFileSync(SCENARIO_DATA_PATH, "utf-8");
  return JSON.parse(data) as Scenario1Data;
}

/**
 * Extended test with Scenario 1 fixtures
 */
export const test = base.extend<Scenario1Fixtures>({
  // Authenticated page (uses saved auth state from global setup)
  authenticatedPage: async ({ page }, use) => {
    // Auth state is loaded automatically via storageState in playwright.config.ts
    // Navigate to dashboard to verify we're logged in
    await page.goto("/dashboard");

    // Wait for dashboard to load
    await page.waitForLoadState("networkidle");

    // Verify we're on the dashboard
    const url = page.url();
    if (!url.includes("/dashboard")) {
      throw new Error(`Expected to be on dashboard, but got: ${url}`);
    }

    await use(page);
  },

  // Seeded database IDs
  seededIds: async ({}, use) => {
    const ids = loadSeededIds();
    await use(ids);
  },

  // Scenario test data
  scenarioData: async ({}, use) => {
    const data = loadScenarioData();
    await use(data);
  },

  // Helper to get location ID by name
  getLocationId: async ({ seededIds, scenarioData }, use) => {
    const helper = (name: string): string => {
      const location = scenarioData.locations.find((l) => l.name === name);
      if (!location) {
        throw new Error(`Location not found: ${name}`);
      }
      const locationId = seededIds.locationIds[location.id];
      if (!locationId) {
        throw new Error(`Location ID not seeded for: ${name}`);
      }
      return locationId;
    };
    await use(helper);
  },

  // Helper to get worker ID by name
  getWorkerId: async ({ seededIds, scenarioData }, use) => {
    const helper = (firstName: string, lastName: string): string => {
      const worker = scenarioData.workers.find(
        (w) => w.first_name === firstName && w.last_name === lastName
      );
      if (!worker) {
        throw new Error(`Worker not found: ${firstName} ${lastName}`);
      }
      const workerId = seededIds.workerIds[worker.id];
      if (!workerId) {
        throw new Error(`Worker ID not seeded for: ${firstName} ${lastName}`);
      }
      return workerId;
    };
    await use(helper);
  },

  // Helper to get field config ID by name
  getFieldConfigId: async ({ seededIds, scenarioData }, use) => {
    const helper = (name: string): string => {
      const field = scenarioData.fieldConfigs.find((f) => f.name === name);
      if (!field) {
        throw new Error(`Field config not found: ${name}`);
      }
      const fieldConfigId = seededIds.fieldConfigIds[field.id];
      if (!fieldConfigId) {
        throw new Error(`Field config ID not seeded for: ${name}`);
      }
      return fieldConfigId;
    };
    await use(helper);
  },
});

// Re-export expect for convenience
export { expect };

/**
 * Test data constants for Scenario 1
 */
export const TestData = {
  /** Organization name (with test ID suffix) */
  organizationNamePrefix: "Pro Detail Services",

  /** Admin credentials */
  admin: {
    emailPrefix: "admin@prodetail.test",
    password: "TestPassword123!",
  },

  /** Location names */
  locations: {
    cityMotors: "City Motors",
    suburbanAuto: "Suburban Auto",
    budgetCars: "Budget Cars",
  },

  /** Worker names */
  workers: {
    supervisor: { firstName: "Sarah", lastName: "Mitchell" },
    regular: [
      { firstName: "Michael", lastName: "Chen" },
      { firstName: "Emma", lastName: "Johnson" },
      { firstName: "David", lastName: "Williams" },
      { firstName: "Lisa", lastName: "Brown" },
      { firstName: "James", lastName: "Taylor" },
    ],
  },

  /** Field config names */
  fields: {
    soapsByMake: "soaps_by_make",
    wipesByMake: "wipes_by_make",
    tender: "tender",
    warehouse: "warehouse",
  },

  /** Expected pricing values */
  pricing: {
    soapPerCar: 5.0,
    wipePerCar: 3.0,
    tenderFlat: 10.0,
    warehouseFlat: 25.0,
    cityMotorsPremium: 0.2, // 20%
  },

  /** Supervisor rate card values */
  supervisorRateCard: {
    soapBonus: 0.5, // $0.50 per car
    shiftPercentage: 0.02, // 2%
  },
};

/**
 * Page helpers for common interactions
 */
export const PageHelpers = {
  /** Navigate to workers page */
  async goToWorkers(page: Page): Promise<void> {
    await page.goto("/dashboard/workers");
    await page.waitForLoadState("networkidle");
  },

  /** Navigate to locations page */
  async goToLocations(page: Page): Promise<void> {
    await page.goto("/dashboard/locations");
    await page.waitForLoadState("networkidle");
  },

  /** Navigate to completed jobs page */
  async goToCompletedJobs(page: Page): Promise<void> {
    await page.goto("/dashboard/jobs");
    await page.waitForLoadState("networkidle");
  },

  /** Navigate to invoices page */
  async goToInvoices(page: Page): Promise<void> {
    await page.goto("/dashboard/invoices");
    await page.waitForLoadState("networkidle");
  },

  /** Navigate to settings page */
  async goToSettings(page: Page): Promise<void> {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");
  },

  /** Wait for toast notification */
  async waitForToast(page: Page, textPattern: RegExp | string): Promise<void> {
    const selector =
      typeof textPattern === "string"
        ? `text=${textPattern}`
        : `[role="alert"]`;

    await page.waitForSelector(selector, { timeout: 10000 });

    if (typeof textPattern !== "string") {
      const toast = page.locator('[role="alert"]');
      await expect(toast).toContainText(textPattern);
    }
  },

  /** Click button by text */
  async clickButton(page: Page, text: string): Promise<void> {
    await page.click(`button:has-text("${text}")`);
  },

  /** Fill form field by label */
  async fillField(page: Page, label: string, value: string): Promise<void> {
    await page.fill(`input[aria-label="${label}"], [name="${label}"]`, value);
  },
};
