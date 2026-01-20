import { test, expect } from "./fixtures";

/**
 * Critical User Journey 4: Invoice Generation
 * Tests the invoice creation and viewing flow
 */
test.describe("Invoice Management", () => {
  test("should display invoices list", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/invoices");

    // Verify page loads
    await expect(authenticatedPage).toHaveURL(/\/dashboard\/invoices/);
    await expect(authenticatedPage.locator("h1")).toContainText(/invoices/i);

    // Verify table exists
    await expect(
      authenticatedPage.locator('[data-testid="invoices-table"], [data-testid="invoices-list"]')
    ).toBeVisible();
  });

  test("should view invoice details", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/invoices");

    // Wait for invoices to load
    await authenticatedPage.waitForSelector('[data-testid="invoices-table"], [data-testid="invoices-list"]');

    // Check if invoices exist
    const invoiceCount = await authenticatedPage.locator('[data-testid="invoice-row"]').count();
    if (invoiceCount > 0) {
      // Click on first invoice
      await authenticatedPage.locator('[data-testid="invoice-row"]').first().click();

      // Verify details page loads
      await expect(authenticatedPage.locator('[data-testid="invoice-details"]')).toBeVisible();

      // Verify invoice number is displayed
      await expect(authenticatedPage.locator('[data-testid="invoice-number"]')).toBeVisible();

      // Verify total amount is displayed
      await expect(authenticatedPage.locator('[data-testid="invoice-total"]')).toBeVisible();
    }
  });

  test("should create invoice from completed jobs", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/jobs");

    // Wait for jobs to load
    await authenticatedPage.waitForSelector('[data-testid="jobs-table"], [data-testid="jobs-list"]');

    // Select completed jobs (if any exist)
    const completedJobs = authenticatedPage.locator('[data-testid="job-row"][data-status="completed"]');
    const completedCount = await completedJobs.count();

    if (completedCount > 0) {
      // Select first completed job
      await completedJobs.first().locator('input[type="checkbox"]').check();

      // Click create invoice button
      await authenticatedPage.click('[data-testid="create-invoice-button"]');

      // Verify invoice creation dialog or page
      await expect(
        authenticatedPage.locator('[data-testid="invoice-form"], [data-testid="invoice-preview"]')
      ).toBeVisible();

      // Verify job is included in invoice
      await expect(authenticatedPage.locator('[data-testid="invoice-line-items"]')).toBeVisible();
    }
  });
});
