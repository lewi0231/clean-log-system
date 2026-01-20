import { test, expect } from "./fixtures";

/**
 * Critical User Journey 2: Worker Management
 * Tests creating, viewing, and managing workers
 */
test.describe("Worker Management", () => {
  test("should display workers list", async ({ authenticatedPage }) => {
    // Navigate to workers page
    await authenticatedPage.goto("/dashboard/workers");

    // Verify page loads
    await expect(authenticatedPage).toHaveURL(/\/dashboard\/workers/);
    await expect(authenticatedPage.locator("h1")).toContainText(/workers/i);

    // Verify table or list exists
    await expect(
      authenticatedPage.locator('[data-testid="workers-table"], [data-testid="workers-list"]')
    ).toBeVisible();
  });

  test("should create a new worker", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/workers");

    // Click create worker button
    await authenticatedPage.click('[data-testid="create-worker-button"]');

    // Fill in worker details
    const timestamp = Date.now();
    await authenticatedPage.fill('input[name="first_name"]', "Test");
    await authenticatedPage.fill('input[name="last_name"]', `Worker${timestamp}`);
    await authenticatedPage.fill('input[name="email"]', `testworker${timestamp}@example.com`);
    await authenticatedPage.fill('input[name="phone"]', "1234567890");

    // Submit form
    await authenticatedPage.click('button[type="submit"]');

    // Verify success message or redirect
    await expect(
      authenticatedPage.locator('[role="alert"], [data-testid="success-message"]')
    ).toBeVisible({ timeout: 5000 });

    // Verify worker appears in list
    await expect(authenticatedPage.locator("text=/Test Worker/i")).toBeVisible();
  });

  test("should view worker details", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/workers");

    // Wait for workers to load
    await authenticatedPage.waitForSelector('[data-testid="workers-table"], [data-testid="workers-list"]');

    // Click on first worker
    await authenticatedPage.click('[data-testid="worker-row"]:first-child');

    // Verify details page loads
    await expect(authenticatedPage.locator('[data-testid="worker-details"]')).toBeVisible();
  });
});
