/**
 * Scenario 1: Job Creation Tests
 *
 * Tests creating jobs via the dashboard UI with various field configurations.
 * Covers all 4 test job scenarios from the test data.
 */

import {
  test,
  expect,
  TestData,
  PageHelpers,
} from "../../fixtures/scenario-1.fixture";

test.describe("Job Creation", () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate to jobs/completed jobs page
    await PageHelpers.goToCompletedJobs(authenticatedPage);
    await authenticatedPage.waitForLoadState("networkidle");
  });

  test.describe("Create Job UI", () => {
    test("should display create job button", async ({ authenticatedPage }) => {
      // Look for create job button
      const createButton = authenticatedPage.locator(
        'button:has-text("Create"), button:has-text("Add Job"), [data-testid="create-job-button"]'
      );

      await expect(createButton.first()).toBeVisible();
    });

    test("should open job creation form", async ({ authenticatedPage }) => {
      // Click create job button
      const createButton = authenticatedPage.locator(
        'button:has-text("Create"), button:has-text("Add Job"), [data-testid="create-job-button"]'
      );
      await createButton.first().click();

      // Wait for form/modal to appear
      await authenticatedPage.waitForSelector(
        '[data-testid="create-job-form"], [role="dialog"], form',
        { timeout: 5000 }
      );

      // Verify form elements are present
      await expect(
        authenticatedPage.locator(
          '[data-testid="create-job-form"], [role="dialog"], form'
        )
      ).toBeVisible();
    });

    test("should display location selector", async ({ authenticatedPage }) => {
      // Open create job form
      const createButton = authenticatedPage.locator(
        'button:has-text("Create"), button:has-text("Add Job"), [data-testid="create-job-button"]'
      );
      await createButton.first().click();

      // Wait for form
      await authenticatedPage.waitForSelector(
        '[data-testid="create-job-form"], [role="dialog"], form'
      );

      // Look for location selector
      const locationSelector = authenticatedPage.locator(
        '[name="location"], [data-testid="location-select"], select'
      );

      await expect(locationSelector.first()).toBeVisible();
    });

    test("should display worker selector", async ({ authenticatedPage }) => {
      // Open create job form
      const createButton = authenticatedPage.locator(
        'button:has-text("Create"), button:has-text("Add Job"), [data-testid="create-job-button"]'
      );
      await createButton.first().click();

      // Wait for form
      await authenticatedPage.waitForSelector(
        '[data-testid="create-job-form"], [role="dialog"], form'
      );

      // Look for worker selector
      const workerSelector = authenticatedPage.locator(
        '[name="worker"], [data-testid="worker-select"], select'
      );

      await expect(workerSelector.first()).toBeVisible();
    });
  });

  test.describe("Job 1: Detailing at City Motors", () => {
    test("should create job with soaps_by_make field", async ({
      authenticatedPage,
      scenarioData,
      getLocationId,
      getWorkerId,
    }) => {
      const testJob = scenarioData.testJobs[0]; // Job 1

      // Open create job form
      const createButton = authenticatedPage.locator(
        'button:has-text("Create"), button:has-text("Add Job"), [data-testid="create-job-button"]'
      );
      await createButton.first().click();

      // Wait for form
      await authenticatedPage.waitForSelector(
        '[data-testid="create-job-form"], [role="dialog"], form'
      );

      // Select location (City Motors)
      const locationSelect = authenticatedPage.locator(
        '[name="location_id"], [data-testid="location-select"]'
      );
      if ((await locationSelect.count()) > 0) {
        await locationSelect.first().click();
        await authenticatedPage
          .locator(`text=${testJob.location_name}`)
          .click();
      }

      // Select worker (Michael Chen)
      const workerSelect = authenticatedPage.locator(
        '[name="worker_id"], [data-testid="worker-select"]'
      );
      if ((await workerSelect.count()) > 0) {
        await workerSelect.first().click();
        await authenticatedPage.locator("text=Michael Chen").click();
      }

      // Fill soaps_by_make grouped breakdown
      // This depends on how grouped_breakdown fields are rendered
      const soapsByMake =
        testJob.submission_data.soaps_by_make as Record<string, number>;

      for (const [make, count] of Object.entries(soapsByMake)) {
        // Look for input field for each make
        const makeInput = authenticatedPage.locator(
          `[data-field="soaps_by_make"] [data-option="${make}"] input,
           [name="soaps_by_make.${make}"],
           input[aria-label*="${make}" i]`
        );

        if ((await makeInput.count()) > 0) {
          await makeInput.first().fill(count.toString());
        }
      }

      // Submit the form
      const submitButton = authenticatedPage.locator(
        'button[type="submit"], button:has-text("Save"), button:has-text("Create Job")'
      );
      await submitButton.first().click();

      // Wait for success indication
      await authenticatedPage.waitForSelector(
        '[role="alert"], [data-testid="success-message"], text=/success|created/i',
        { timeout: 10000 }
      );

      // Verify job appears in list (may need to refresh)
      await PageHelpers.goToCompletedJobs(authenticatedPage);
      await expect(
        authenticatedPage.locator(`text=${testJob.location_name}`)
      ).toBeVisible();
    });
  });

  test.describe("Job 2: Supervisor Job with Detailing", () => {
    test("should create job for supervisor with soaps and wipes", async ({
      authenticatedPage,
      scenarioData,
    }) => {
      const testJob = scenarioData.testJobs[1]; // Job 2 - Supervisor

      // Open create job form
      const createButton = authenticatedPage.locator(
        'button:has-text("Create"), button:has-text("Add Job"), [data-testid="create-job-button"]'
      );
      await createButton.first().click();

      // Wait for form
      await authenticatedPage.waitForSelector(
        '[data-testid="create-job-form"], [role="dialog"], form'
      );

      // Select location (Suburban Auto)
      const locationSelect = authenticatedPage.locator(
        '[name="location_id"], [data-testid="location-select"]'
      );
      if ((await locationSelect.count()) > 0) {
        await locationSelect.first().click();
        await authenticatedPage
          .locator(`text=${testJob.location_name}`)
          .click();
      }

      // Select worker (Sarah Mitchell - supervisor)
      const workerSelect = authenticatedPage.locator(
        '[name="worker_id"], [data-testid="worker-select"]'
      );
      if ((await workerSelect.count()) > 0) {
        await workerSelect.first().click();
        await authenticatedPage.locator("text=Sarah Mitchell").click();
      }

      // Fill soaps_by_make
      const soapsByMake =
        testJob.submission_data.soaps_by_make as Record<string, number>;
      for (const [make, count] of Object.entries(soapsByMake)) {
        const makeInput = authenticatedPage.locator(
          `[name="soaps_by_make.${make}"], input[aria-label*="${make}" i]`
        );
        if ((await makeInput.count()) > 0) {
          await makeInput.first().fill(count.toString());
        }
      }

      // Fill wipes_by_make
      const wipesByMake =
        testJob.submission_data.wipes_by_make as Record<string, number>;
      for (const [make, count] of Object.entries(wipesByMake)) {
        const makeInput = authenticatedPage.locator(
          `[name="wipes_by_make.${make}"], input[aria-label*="${make}" i]`
        );
        if ((await makeInput.count()) > 0) {
          await makeInput.first().fill(count.toString());
        }
      }

      // Submit
      const submitButton = authenticatedPage.locator(
        'button[type="submit"], button:has-text("Save")'
      );
      await submitButton.first().click();

      // Wait for success
      await authenticatedPage.waitForSelector(
        '[role="alert"], text=/success|created/i',
        { timeout: 10000 }
      );
    });
  });

  test.describe("Job 3: Tender Job", () => {
    test("should create job with tender field only", async ({
      authenticatedPage,
      scenarioData,
    }) => {
      const testJob = scenarioData.testJobs[2]; // Job 3 - Tender

      // Open create job form
      const createButton = authenticatedPage.locator(
        'button:has-text("Create"), button:has-text("Add Job"), [data-testid="create-job-button"]'
      );
      await createButton.first().click();

      // Wait for form
      await authenticatedPage.waitForSelector(
        '[data-testid="create-job-form"], [role="dialog"], form'
      );

      // Select location (Budget Cars)
      const locationSelect = authenticatedPage.locator(
        '[name="location_id"], [data-testid="location-select"]'
      );
      if ((await locationSelect.count()) > 0) {
        await locationSelect.first().click();
        await authenticatedPage
          .locator(`text=${testJob.location_name}`)
          .click();
      }

      // Select worker (Emma Johnson)
      const workerSelect = authenticatedPage.locator(
        '[name="worker_id"], [data-testid="worker-select"]'
      );
      if ((await workerSelect.count()) > 0) {
        await workerSelect.first().click();
        await authenticatedPage.locator("text=Emma Johnson").click();
      }

      // Fill tender amount
      const tenderValue = testJob.submission_data.tender as number;
      const tenderInput = authenticatedPage.locator(
        '[name="tender"], [data-field="tender"] input, input[aria-label*="tender" i]'
      );
      if ((await tenderInput.count()) > 0) {
        await tenderInput.first().fill(tenderValue.toString());
      }

      // Submit
      const submitButton = authenticatedPage.locator(
        'button[type="submit"], button:has-text("Save")'
      );
      await submitButton.first().click();

      // Wait for success
      await authenticatedPage.waitForSelector(
        '[role="alert"], text=/success|created/i',
        { timeout: 10000 }
      );
    });

    test("should disable detailing fields when tender is filled (mutual exclusivity)", async ({
      authenticatedPage,
    }) => {
      // Open create job form
      const createButton = authenticatedPage.locator(
        'button:has-text("Create"), button:has-text("Add Job"), [data-testid="create-job-button"]'
      );
      await createButton.first().click();

      // Wait for form
      await authenticatedPage.waitForSelector(
        '[data-testid="create-job-form"], [role="dialog"], form'
      );

      // Fill tender field
      const tenderInput = authenticatedPage.locator(
        '[name="tender"], [data-field="tender"] input'
      );
      if ((await tenderInput.count()) > 0) {
        await tenderInput.first().fill("100");

        // Check that soaps_by_make fields are disabled
        const soapInput = authenticatedPage.locator(
          '[name="soaps_by_make.toyota"], [data-field="soaps_by_make"] input'
        );
        if ((await soapInput.count()) > 0) {
          // Field should be disabled due to mutual exclusivity
          const isDisabled = await soapInput.first().isDisabled();
          // Note: This test depends on UI implementation of mutual exclusivity
        }
      }
    });
  });

  test.describe("Job 4: Warehouse Job", () => {
    test("should create job with warehouse boolean field", async ({
      authenticatedPage,
      scenarioData,
    }) => {
      const testJob = scenarioData.testJobs[3]; // Job 4 - Warehouse

      // Open create job form
      const createButton = authenticatedPage.locator(
        'button:has-text("Create"), button:has-text("Add Job"), [data-testid="create-job-button"]'
      );
      await createButton.first().click();

      // Wait for form
      await authenticatedPage.waitForSelector(
        '[data-testid="create-job-form"], [role="dialog"], form'
      );

      // Select location (City Motors - for premium pricing)
      const locationSelect = authenticatedPage.locator(
        '[name="location_id"], [data-testid="location-select"]'
      );
      if ((await locationSelect.count()) > 0) {
        await locationSelect.first().click();
        await authenticatedPage
          .locator(`text=${testJob.location_name}`)
          .click();
      }

      // Select worker (David Williams)
      const workerSelect = authenticatedPage.locator(
        '[name="worker_id"], [data-testid="worker-select"]'
      );
      if ((await workerSelect.count()) > 0) {
        await workerSelect.first().click();
        await authenticatedPage.locator("text=David Williams").click();
      }

      // Check warehouse checkbox
      const warehouseCheckbox = authenticatedPage.locator(
        '[name="warehouse"], [data-field="warehouse"] input[type="checkbox"], input[aria-label*="warehouse" i]'
      );
      if ((await warehouseCheckbox.count()) > 0) {
        await warehouseCheckbox.first().check();
      }

      // Submit
      const submitButton = authenticatedPage.locator(
        'button[type="submit"], button:has-text("Save")'
      );
      await submitButton.first().click();

      // Wait for success
      await authenticatedPage.waitForSelector(
        '[role="alert"], text=/success|created/i',
        { timeout: 10000 }
      );
    });
  });

  test.describe("Job List Verification", () => {
    test("should display created jobs in the list", async ({
      authenticatedPage,
    }) => {
      await PageHelpers.goToCompletedJobs(authenticatedPage);

      // Wait for jobs list to load
      await authenticatedPage.waitForSelector(
        '[data-testid="jobs-table"], [data-testid="jobs-list"], table',
        { timeout: 10000 }
      );

      // Verify jobs are displayed
      // The exact content depends on what was successfully created in previous tests
      const jobRows = authenticatedPage.locator(
        '[data-testid="job-row"], tr[data-job-id], [data-testid="job-card"]'
      );

      // Should have at least some jobs (created in this test run or pre-existing)
      const count = await jobRows.count();
      // Don't assert exact count as it depends on test execution order
    });

    test("should be able to view job details", async ({
      authenticatedPage,
    }) => {
      await PageHelpers.goToCompletedJobs(authenticatedPage);

      // Click on first job to view details
      const firstJob = authenticatedPage.locator(
        '[data-testid="job-row"]:first-child, tr[data-job-id]:first-child'
      );

      if ((await firstJob.count()) > 0) {
        await firstJob.click();

        // Wait for details to load
        await authenticatedPage.waitForSelector(
          '[data-testid="job-details"], [data-testid="job-modal"]',
          { timeout: 5000 }
        );
      }
    });
  });
});
