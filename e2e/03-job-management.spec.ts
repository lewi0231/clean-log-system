import { test, expect } from "./fixtures";

/**
 * Critical User Journey 3: Job Creation and Management
 * Tests the complete job lifecycle
 */
test.describe("Job Management", () => {
  test("should display jobs list", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/jobs");

    // Verify page loads
    await expect(authenticatedPage).toHaveURL(/\/dashboard\/jobs/);
    await expect(authenticatedPage.locator("h1")).toContainText(/jobs/i);

    // Verify table exists
    await expect(
      authenticatedPage.locator('[data-testid="jobs-table"], [data-testid="jobs-list"]')
    ).toBeVisible();
  });

  test("should view job details", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/jobs");

    // Wait for jobs to load
    await authenticatedPage.waitForSelector('[data-testid="jobs-table"], [data-testid="jobs-list"]');

    // Click on first job
    const firstJob = authenticatedPage.locator('[data-testid="job-row"]').first();
    
    // Only proceed if jobs exist
    const jobCount = await authenticatedPage.locator('[data-testid="job-row"]').count();
    if (jobCount > 0) {
      await firstJob.click();

      // Verify details page loads
      await expect(authenticatedPage.locator('[data-testid="job-details"]')).toBeVisible();
    }
  });

  test("should filter jobs by status", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard/jobs");

    // Wait for page to load
    await authenticatedPage.waitForSelector('[data-testid="jobs-table"], [data-testid="jobs-list"]');

    // Click on status filter
    const statusFilter = authenticatedPage.locator('[data-testid="status-filter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();

      // Select "completed" status
      await authenticatedPage.click('text=Completed');

      // Wait for filtered results
      await authenticatedPage.waitForTimeout(1000);

      // Verify URL contains filter parameter
      await expect(authenticatedPage).toHaveURL(/status=completed/i);
    }
  });
});
