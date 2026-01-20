import { test, expect } from "./fixtures";

/**
 * Critical User Journey 1: User Authentication
 * Tests the complete authentication flow
 */
test.describe("Authentication Flow", () => {
  test("should allow user to sign in with valid credentials", async ({ page, testUser }) => {
    // Navigate to login page
    await page.goto("/sign-in");

    // Verify login page loads
    await expect(page).toHaveTitle(/Sign In|Login/i);

    // Fill in credentials
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL("/dashboard", { timeout: 10000 });

    // Verify dashboard loads
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/sign-in");

    // Fill in invalid credentials
    await page.fill('input[name="email"]', "invalid@example.com");
    await page.fill('input[name="password"]', "wrongpassword");

    // Submit form
    await page.click('button[type="submit"]');

    // Verify error message appears
    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(page.locator('[role="alert"]')).toContainText(/invalid|incorrect|failed/i);
  });

  test("should allow user to sign out", async ({ authenticatedPage }) => {
    // Click user menu
    await authenticatedPage.click('[data-testid="user-menu"]');

    // Click sign out
    await authenticatedPage.click('[data-testid="sign-out"]');

    // Verify redirect to login page
    await authenticatedPage.waitForURL(/sign-in|login/i, { timeout: 5000 });
  });
});
