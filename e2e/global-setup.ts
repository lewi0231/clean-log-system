/**
 * Global Setup for E2E Tests
 *
 * This file runs before all tests and:
 * 1. Seeds the database with Scenario 1 test data
 * 2. Authenticates the admin user and saves the session state
 * 3. Stores seeded IDs for test reference
 */

import { chromium, FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

import { loadScenarioData, seedScenario1 } from "./helpers/db-seeder";
import type { SeededDataIds } from "./helpers/types";

// Path to store seeded data IDs
const SEEDED_DATA_PATH = path.resolve(__dirname, ".seeded-data.json");
const AUTH_STATE_PATH = path.resolve(__dirname, ".auth/user.json");

async function globalSetup(config: FullConfig): Promise<void> {
  console.log("\n🚀 Starting Global Setup...\n");

  // Ensure auth directory exists
  const authDir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // 1. Seed the database
  console.log("📦 Seeding database with Scenario 1 data...");
  let seededIds: SeededDataIds;

  try {
    seededIds = await seedScenario1();
    console.log("✅ Database seeded successfully\n");

    // Save seeded IDs for tests and cleanup
    fs.writeFileSync(SEEDED_DATA_PATH, JSON.stringify(seededIds, null, 2));
    console.log(`📝 Saved seeded data IDs to ${SEEDED_DATA_PATH}`);
  } catch (error) {
    console.error("❌ Failed to seed database:", error);
    throw error;
  }

  // 2. Authenticate admin user and save state
  console.log("\n🔐 Authenticating admin user...");

  const scenarioData = loadScenarioData();
  const adminEmail = seededIds.adminEmail || scenarioData.admin.email;
  const adminPassword = scenarioData.admin.password;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const baseURL = config.projects[0]?.use?.baseURL || "http://localhost:3000";

    // Navigate to sign-in page
    await page.goto(`${baseURL}/sign-in`);
    await page.waitForLoadState("networkidle");

    // Fill in login form
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL("**/dashboard**", { timeout: 30000 });
    console.log("✅ Admin user authenticated successfully");

    // Save authentication state
    await context.storageState({ path: AUTH_STATE_PATH });
    console.log(`📝 Saved auth state to ${AUTH_STATE_PATH}`);
  } catch (error) {
    console.error("❌ Failed to authenticate admin user:", error);
    // Take a screenshot for debugging
    const screenshotPath = path.resolve(__dirname, "global-setup-failure.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved to ${screenshotPath}`);
    throw error;
  } finally {
    await browser.close();
  }

  console.log("\n✅ Global Setup completed successfully!\n");
}

export default globalSetup;
