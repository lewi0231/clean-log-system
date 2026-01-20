import { test, expect } from "./fixtures";

/**
 * Critical User Journey 5: Settings and Configuration
 * Tests organization settings, pricing rules, and field configurations
 */
test.describe("Settings and Configuration", () => {
  test("should display organization settings", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/settings");

    // Verify page loads
    await expect(authenticatedPage).toHaveURL(/\/dashboard\/settings/);
    await expect(authenticatedPage.locator("h1, h2")).toContainText(/settings/i);

    // Verify settings sections are visible
    await expect(
      authenticatedPage.locator('[data-testid="organization-settings"]')
    ).toBeVisible();
  });

  test("should update organization details", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/settings");

    // Find organization name input
    const orgNameInput = authenticatedPage.locator('input[name="organization_name"]');
    
    if (await orgNameInput.isVisible()) {
      const currentValue = await orgNameInput.inputValue();
      const newValue = `${currentValue} Updated`;

      // Update organization name
      await orgNameInput.fill(newValue);

      // Save changes
      await authenticatedPage.click('button[type="submit"]');

      // Verify success message
      await expect(
        authenticatedPage.locator('[role="alert"], [data-testid="success-message"]')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("should navigate to field configurations", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/settings/fields");

    // Verify field configuration page loads
    await expect(authenticatedPage).toHaveURL(/\/settings\/fields/);
    await expect(authenticatedPage.locator("h1, h2")).toContainText(/field/i);

    // Verify fields list is visible
    await expect(
      authenticatedPage.locator('[data-testid="fields-list"], [data-testid="fields-table"]')
    ).toBeVisible();
  });

  test("should navigate to pricing rules", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/settings/pricing");

    // Verify pricing page loads
    await expect(authenticatedPage).toHaveURL(/\/settings\/pricing/);
    await expect(authenticatedPage.locator("h1, h2")).toContainText(/pricing/i);

    // Verify pricing rules are displayed
    await expect(
      authenticatedPage.locator('[data-testid="pricing-rules"], [data-testid="pricing-table"]')
    ).toBeVisible();
  });
});
