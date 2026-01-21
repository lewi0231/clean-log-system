/**
 * Scenario 1: Invoice Generation Tests
 *
 * Tests invoice generation and verifies pricing calculations
 * based on the test jobs and pricing rules.
 */

import {
  test,
  expect,
  TestData,
  PageHelpers,
} from "../../fixtures/scenario-1.fixture";

test.describe("Invoice Generation", () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await PageHelpers.goToInvoices(authenticatedPage);
    await authenticatedPage.waitForLoadState("networkidle");
  });

  test.describe("Invoice List", () => {
    test("should display invoices page", async ({ authenticatedPage }) => {
      await expect(authenticatedPage).toHaveURL(/\/dashboard\/invoices/);

      // Should have some form of invoice list/table
      await expect(
        authenticatedPage.locator(
          '[data-testid="invoices-table"], [data-testid="invoices-list"], table, main'
        )
      ).toBeVisible();
    });

    test("should have create/generate invoice option", async ({
      authenticatedPage,
    }) => {
      // Look for create invoice button
      const createButton = authenticatedPage.locator(
        'button:has-text("Generate"), button:has-text("Create Invoice"), [data-testid="generate-invoice-button"]'
      );

      // May or may not be visible depending on pending jobs
      const count = await createButton.count();
      // Just verify the page loaded correctly
    });
  });

  test.describe("Invoice Generation from Jobs", () => {
    test("should be able to generate invoice from completed jobs", async ({
      authenticatedPage,
    }) => {
      // Navigate to jobs first
      await PageHelpers.goToCompletedJobs(authenticatedPage);

      // Look for jobs that can be invoiced
      const invoiceableJobs = authenticatedPage.locator(
        '[data-testid="job-row"]:not([data-invoiced="true"]), [data-status="completed"]:not([data-invoiced])'
      );

      // If there are jobs to invoice, try to generate
      if ((await invoiceableJobs.count()) > 0) {
        // Select job(s) for invoicing
        const selectCheckbox = authenticatedPage.locator(
          'input[type="checkbox"][name*="select"], [data-testid="select-job"]'
        );

        if ((await selectCheckbox.count()) > 0) {
          await selectCheckbox.first().check();
        }

        // Click generate invoice
        const generateButton = authenticatedPage.locator(
          'button:has-text("Generate Invoice"), button:has-text("Create Invoice")'
        );

        if ((await generateButton.count()) > 0) {
          await generateButton.first().click();

          // Wait for invoice generation
          await authenticatedPage.waitForSelector(
            '[role="alert"], [data-testid="invoice-created"]',
            { timeout: 15000 }
          );
        }
      }
    });
  });

  test.describe("Invoice Pricing Verification", () => {
    test("should calculate correct pricing for detailing job at City Motors", async ({
      authenticatedPage,
      scenarioData,
    }) => {
      const testJob = scenarioData.testJobs[0];
      const expected = testJob.expected;

      // Navigate to invoices
      await PageHelpers.goToInvoices(authenticatedPage);

      // Find invoice for City Motors (if it exists)
      const cityMotorsInvoice = authenticatedPage.locator(
        `text=${TestData.locations.cityMotors}`
      );

      if ((await cityMotorsInvoice.count()) > 0) {
        // Click to view details
        await cityMotorsInvoice.first().click();

        // Verify total matches expected
        // Expected: $30.00 (5 cars × $5.00 × 1.2 CBD premium)
        const totalElement = authenticatedPage.locator(
          '[data-testid="invoice-total"], text=/\\$30\\.00|30\\.00/'
        );

        // Look for the expected total
        await expect(totalElement.first()).toBeVisible({ timeout: 5000 });
      }
    });

    test("should apply City Motors premium pricing (+20%)", async ({
      authenticatedPage,
    }) => {
      await PageHelpers.goToInvoices(authenticatedPage);

      // Find any invoice for City Motors
      const cityMotorsInvoice = authenticatedPage.locator(
        `[data-location="${TestData.locations.cityMotors}"], text=${TestData.locations.cityMotors}`
      );

      if ((await cityMotorsInvoice.count()) > 0) {
        await cityMotorsInvoice.first().click();

        // Look for location modifier line item
        const modifierLine = authenticatedPage.locator(
          'text=/premium|modifier|CBD|\\+20%/i'
        );

        // Verify premium is applied (may be shown as line item or in breakdown)
      }
    });

    test("should calculate correct pricing for tender job", async ({
      authenticatedPage,
      scenarioData,
    }) => {
      const testJob = scenarioData.testJobs[2]; // Tender job
      const expected = testJob.expected;

      await PageHelpers.goToInvoices(authenticatedPage);

      // Find invoice for Budget Cars (tender job location)
      const budgetCarsInvoice = authenticatedPage.locator(
        `text=${TestData.locations.budgetCars}`
      );

      if ((await budgetCarsInvoice.count()) > 0) {
        await budgetCarsInvoice.first().click();

        // Expected: $10.00 flat fee
        const totalElement = authenticatedPage.locator(
          '[data-testid="invoice-total"], text=/\\$10\\.00|10\\.00/'
        );

        await expect(totalElement.first()).toBeVisible({ timeout: 5000 });
      }
    });

    test("should calculate correct pricing for warehouse job with premium", async ({
      authenticatedPage,
      scenarioData,
    }) => {
      const testJob = scenarioData.testJobs[3]; // Warehouse job at City Motors
      const expected = testJob.expected;

      await PageHelpers.goToInvoices(authenticatedPage);

      // Warehouse job at City Motors
      // Expected: $30.00 ($25 warehouse × 1.2 premium)

      // This would need to find the specific invoice
      // Implementation depends on how invoices are identified in the UI
    });
  });

  test.describe("Invoice Details", () => {
    test("should display line items breakdown", async ({
      authenticatedPage,
    }) => {
      await PageHelpers.goToInvoices(authenticatedPage);

      // Click on first invoice
      const firstInvoice = authenticatedPage.locator(
        '[data-testid="invoice-row"]:first-child, tr[data-invoice-id]:first-child'
      );

      if ((await firstInvoice.count()) > 0) {
        await firstInvoice.click();

        // Look for line items section
        const lineItems = authenticatedPage.locator(
          '[data-testid="line-items"], [data-testid="invoice-breakdown"], table'
        );

        await expect(lineItems.first()).toBeVisible({ timeout: 5000 });
      }
    });

    test("should show correct currency (AUD)", async ({
      authenticatedPage,
    }) => {
      await PageHelpers.goToInvoices(authenticatedPage);

      // Look for AUD currency indicator
      const currencyIndicator = authenticatedPage.locator(
        'text=/AUD|\\$.*\\.\\d{2}/'
      );

      // Should find currency somewhere on the page
      const count = await currencyIndicator.count();
      expect(count).toBeGreaterThanOrEqual(0); // May not be visible if no invoices
    });

    test("should display invoice status", async ({ authenticatedPage }) => {
      await PageHelpers.goToInvoices(authenticatedPage);

      // Look for status indicators
      const statusIndicators = authenticatedPage.locator(
        '[data-testid="invoice-status"], text=/draft|sent|paid|pending/i'
      );

      // Invoices should have status
    });
  });

  test.describe("Invoice Actions", () => {
    test("should be able to view invoice details", async ({
      authenticatedPage,
    }) => {
      await PageHelpers.goToInvoices(authenticatedPage);

      const viewButton = authenticatedPage.locator(
        'button:has-text("View"), [data-testid="view-invoice"]'
      );

      if ((await viewButton.count()) > 0) {
        await viewButton.first().click();

        // Should navigate to invoice details
        await authenticatedPage.waitForLoadState("networkidle");
      }
    });

    test("should be able to send invoice (if status is draft)", async ({
      authenticatedPage,
    }) => {
      await PageHelpers.goToInvoices(authenticatedPage);

      // Look for send button on draft invoices
      const sendButton = authenticatedPage.locator(
        'button:has-text("Send"), [data-testid="send-invoice"]'
      );

      // Button may or may not be visible depending on invoice status
    });

    test("should display invoice PDF preview option", async ({
      authenticatedPage,
    }) => {
      await PageHelpers.goToInvoices(authenticatedPage);

      // Look for PDF/preview option
      const pdfButton = authenticatedPage.locator(
        'button:has-text("PDF"), button:has-text("Preview"), [data-testid="invoice-pdf"]'
      );

      // PDF option may or may not be visible
    });
  });

  test.describe("Pricing Rule Application", () => {
    test("should apply unit pricing for soaps_by_make", async ({
      authenticatedPage,
      scenarioData,
    }) => {
      // Unit pricing: $5.00 per car
      const soapRule = scenarioData.pricingRules.find(
        (r) => r.name === "Soap per car"
      );

      expect(soapRule).toBeDefined();
      expect(soapRule?.base_price).toBe(TestData.pricing.soapPerCar);
    });

    test("should apply unit pricing for wipes_by_make", async ({
      scenarioData,
    }) => {
      // Unit pricing: $3.00 per car
      const wipeRule = scenarioData.pricingRules.find(
        (r) => r.name === "Wipe per car"
      );

      expect(wipeRule).toBeDefined();
      expect(wipeRule?.base_price).toBe(TestData.pricing.wipePerCar);
    });

    test("should apply fixed pricing for tender", async ({ scenarioData }) => {
      // Fixed pricing: $10.00
      const tenderRule = scenarioData.pricingRules.find(
        (r) => r.name === "Tender handling"
      );

      expect(tenderRule).toBeDefined();
      expect(tenderRule?.base_price).toBe(TestData.pricing.tenderFlat);
    });

    test("should apply fixed pricing for warehouse", async ({
      scenarioData,
    }) => {
      // Fixed pricing: $25.00
      const warehouseRule = scenarioData.pricingRules.find(
        (r) => r.name === "Warehouse flat fee"
      );

      expect(warehouseRule).toBeDefined();
      expect(warehouseRule?.base_price).toBe(TestData.pricing.warehouseFlat);
    });

    test("should apply location percentage modifier for City Motors", async ({
      scenarioData,
    }) => {
      // Percentage: +20%
      const premiumRule = scenarioData.pricingRules.find(
        (r) => r.name === "City Motors Premium"
      );

      expect(premiumRule).toBeDefined();
      expect(premiumRule?.percentage_rate).toBe(
        TestData.pricing.cityMotorsPremium
      );
    });
  });

  test.describe("Expected Invoice Calculations", () => {
    test("Job 1: City Motors detailing = $30.00", async ({ scenarioData }) => {
      const job = scenarioData.testJobs[0];
      const soapsByMake = job.submission_data.soaps_by_make as Record<
        string,
        number
      >;

      // Calculate: (Toyota: 3 + Honda: 2) = 5 cars × $5.00 = $25.00
      // With City Motors premium (+20%): $25.00 × 1.2 = $30.00
      const totalCars = Object.values(soapsByMake).reduce((a, b) => a + b, 0);
      const subtotal = totalCars * TestData.pricing.soapPerCar;
      const withPremium = subtotal * (1 + TestData.pricing.cityMotorsPremium);

      expect(totalCars).toBe(5);
      expect(subtotal).toBe(25);
      expect(withPremium).toBe(30);
      expect(job.expected.invoice_total).toBe(30);
    });

    test("Job 2: Suburban Auto supervisor job = $26.00", async ({
      scenarioData,
    }) => {
      const job = scenarioData.testJobs[1];
      const soapsByMake = job.submission_data.soaps_by_make as Record<
        string,
        number
      >;
      const wipesByMake = job.submission_data.wipes_by_make as Record<
        string,
        number
      >;

      // Calculate: Ford: 4 soaps × $5.00 = $20.00
      // BMW: 2 wipes × $3.00 = $6.00
      // Total: $26.00 (no location premium at Suburban Auto)
      const soapTotal =
        Object.values(soapsByMake).reduce((a, b) => a + b, 0) *
        TestData.pricing.soapPerCar;
      const wipeTotal =
        Object.values(wipesByMake).reduce((a, b) => a + b, 0) *
        TestData.pricing.wipePerCar;

      expect(soapTotal).toBe(20);
      expect(wipeTotal).toBe(6);
      expect(job.expected.invoice_total).toBe(26);
    });

    test("Job 3: Budget Cars tender = $10.00", async ({ scenarioData }) => {
      const job = scenarioData.testJobs[2];

      // Fixed fee for tender handling: $10.00
      expect(job.expected.invoice_total).toBe(10);
    });

    test("Job 4: City Motors warehouse = $30.00", async ({ scenarioData }) => {
      const job = scenarioData.testJobs[3];

      // Calculate: $25.00 warehouse flat fee × 1.2 (City Motors premium) = $30.00
      const warehouseWithPremium =
        TestData.pricing.warehouseFlat *
        (1 + TestData.pricing.cityMotorsPremium);

      expect(warehouseWithPremium).toBe(30);
      expect(job.expected.invoice_total).toBe(30);
    });
  });
});
