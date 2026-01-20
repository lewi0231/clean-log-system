import { test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Test fixtures for E2E tests
 * Provides authenticated sessions and common test utilities
 */

export interface TestUser {
  email: string;
  password: string;
  organizationId?: string;
}

export interface TestFixtures {
  authenticatedPage: Page;
  testUser: TestUser;
}

/**
 * Create test user from environment variables
 */
function getTestUser(): TestUser {
  return {
    email: process.env.TEST_USER_EMAIL || "test@example.com",
    password: process.env.TEST_USER_PASSWORD || "testpassword123",
    organizationId: process.env.TEST_ORG_ID,
  };
}

/**
 * Extended test with fixtures
 */
export const test = base.extend<TestFixtures>({
  testUser: async ({}, use) => {
    await use(getTestUser());
  },

  authenticatedPage: async ({ page }, use) => {
    const user = getTestUser();

    // Navigate to login page
    await page.goto("/sign-in");

    // Fill in login form
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL("/dashboard", { timeout: 10000 });

    // Verify we're logged in by checking for common dashboard elements
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 5000 });

    // Use the authenticated page in tests
    await use(page);

    // Cleanup: sign out after test
    // await page.click('[data-testid="user-menu"]');
    // await page.click('[data-testid="sign-out"]');
  },
});

export { expect } from "@playwright/test";
