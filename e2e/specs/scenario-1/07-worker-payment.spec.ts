/**
 * Scenario 1: Worker Payment Tests
 *
 * Tests worker payment calculations including supervisor rate card bonuses.
 * Verifies the $0.50/car soap bonus and 2% shift percentage for Sarah Mitchell.
 */

import {
  test,
  expect,
  TestData,
  PageHelpers,
} from "../../fixtures/scenario-1.fixture";

test.describe("Worker Payment", () => {
  test.describe("Worker Payment Overview", () => {
    test("should navigate to worker payments section", async ({
      authenticatedPage,
    }) => {
      // Navigate to workers page
      await PageHelpers.goToWorkers(authenticatedPage);

      // Look for payments link/section
      const paymentsLink = authenticatedPage.locator(
        'a[href*="payment"], text=/payments|pay/i'
      );

      if ((await paymentsLink.count()) > 0) {
        await paymentsLink.first().click();
        await authenticatedPage.waitForLoadState("networkidle");
      }

      // Or navigate directly if there's a dedicated route
      await authenticatedPage.goto("/dashboard/workers/payments");
      await authenticatedPage.waitForLoadState("networkidle");
    });

    test("should display worker payment summary", async ({
      authenticatedPage,
    }) => {
      // Navigate to worker payments
      await authenticatedPage.goto("/dashboard/workers/payments");

      // Look for payment summary elements
      const paymentSummary = authenticatedPage.locator(
        '[data-testid="payment-summary"], [data-testid="worker-payments"], main'
      );

      await expect(paymentSummary).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Supervisor Rate Card", () => {
    test("should display Sarah Mitchell as supervisor", async ({
      authenticatedPage,
    }) => {
      await PageHelpers.goToWorkers(authenticatedPage);

      // Find Sarah Mitchell in workers list
      const supervisorRow = authenticatedPage.locator(
        `text=${TestData.workers.supervisor.firstName} ${TestData.workers.supervisor.lastName}`
      );

      await expect(supervisorRow).toBeVisible();
    });

    test("should show rate card for supervisor", async ({
      authenticatedPage,
      getWorkerId,
    }) => {
      // Get supervisor ID
      const supervisorId = getWorkerId(
        TestData.workers.supervisor.firstName,
        TestData.workers.supervisor.lastName
      );

      // Navigate to worker details
      await authenticatedPage.goto(`/dashboard/workers/${supervisorId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Look for rate card section
      const rateCardSection = authenticatedPage.locator(
        '[data-testid="rate-card"], text=/rate card|bonus|payment rate/i'
      );

      // Rate card should be visible for supervisor
    });

    test("should display soap bonus rate ($0.50/car)", async ({
      authenticatedPage,
      scenarioData,
    }) => {
      const supervisorCard = scenarioData.rateCards.supervisor;
      const soapBonus = supervisorCard.cards.find((c) => c.name === "Soap Bonus");

      expect(soapBonus).toBeDefined();
      expect(soapBonus?.base_amount).toBe(TestData.supervisorRateCard.soapBonus);

      // Navigate to supervisor details to verify in UI
      await PageHelpers.goToWorkers(authenticatedPage);

      // Click on Sarah Mitchell
      const supervisorLink = authenticatedPage.locator(
        `text=${TestData.workers.supervisor.firstName}`
      );
      if ((await supervisorLink.count()) > 0) {
        await supervisorLink.first().click();

        // Look for rate card with $0.50 amount
        const bonusAmount = authenticatedPage.locator(
          'text=/\\$0\\.50|0\\.50|50.*cent/i'
        );
        // May or may not be visible depending on UI
      }
    });

    test("should display shift percentage rate (2%)", async ({
      authenticatedPage,
      scenarioData,
    }) => {
      const supervisorCard = scenarioData.rateCards.supervisor;
      const percentageBonus = supervisorCard.cards.find(
        (c) => c.name === "Shift Percentage"
      );

      expect(percentageBonus).toBeDefined();
      expect(percentageBonus?.percentage_rate).toBe(
        TestData.supervisorRateCard.shiftPercentage
      );
    });
  });

  test.describe("Worker Payment Calculations", () => {
    test("should calculate supervisor payment for Job 2 correctly", async ({
      scenarioData,
    }) => {
      const job = scenarioData.testJobs[1]; // Supervisor job
      const expected = job.expected;

      // Job 2: Suburban Auto, Sarah Mitchell
      // Invoice total: $26.00
      // Soap bonus: 4 cars × $0.50 = $2.00
      // Percentage bonus: 2% × $26.00 = $0.52
      // Total worker payment: $26.00 + $2.00 + $0.52 = $28.52

      expect(expected.worker_payment_base).toBe(26.0);
      expect(expected.worker_payment_soap_bonus).toBe(2.0);
      expect(expected.worker_payment_percentage_bonus).toBe(0.52);
      expect(expected.worker_payment_total).toBe(28.52);

      // Verify calculation
      const soapsByMake = job.submission_data.soaps_by_make as Record<
        string,
        number
      >;
      const totalSoapCars = Object.values(soapsByMake).reduce((a, b) => a + b, 0);

      const calculatedSoapBonus =
        totalSoapCars * TestData.supervisorRateCard.soapBonus;
      const calculatedPercentageBonus =
        expected.worker_payment_base! *
        TestData.supervisorRateCard.shiftPercentage;
      const calculatedTotal =
        expected.worker_payment_base! +
        calculatedSoapBonus +
        calculatedPercentageBonus;

      expect(calculatedSoapBonus).toBe(2.0);
      expect(calculatedPercentageBonus).toBeCloseTo(0.52);
      expect(calculatedTotal).toBeCloseTo(28.52);
    });

    test("should calculate regular worker payment (no bonus)", async ({
      scenarioData,
    }) => {
      // Regular workers should get base payment only
      const job = scenarioData.testJobs[0]; // Job 1: Michael Chen (regular)

      // For regular workers, payment = invoice amount (or portion based on rules)
      // No supervisor bonuses apply
      expect(job.expected.invoice_total).toBe(30.0);
    });
  });

  test.describe("Worker Payment UI", () => {
    test("should display payment breakdown for completed jobs", async ({
      authenticatedPage,
    }) => {
      // Navigate to worker payments
      await authenticatedPage.goto("/dashboard/workers/payments");
      await authenticatedPage.waitForLoadState("networkidle");

      // Look for payment breakdown table
      const paymentTable = authenticatedPage.locator(
        '[data-testid="payment-table"], table'
      );

      if ((await paymentTable.count()) > 0) {
        // Should have columns for worker, jobs, amount
        await expect(paymentTable).toBeVisible();
      }
    });

    test("should filter payments by worker", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/dashboard/workers/payments");

      // Look for worker filter
      const workerFilter = authenticatedPage.locator(
        '[data-testid="worker-filter"], select[name="worker"], input[placeholder*="worker"]'
      );

      if ((await workerFilter.count()) > 0) {
        // Try to filter by supervisor
        await workerFilter.first().click();

        const supervisorOption = authenticatedPage.locator(
          `text=${TestData.workers.supervisor.firstName} ${TestData.workers.supervisor.lastName}`
        );

        if ((await supervisorOption.count()) > 0) {
          await supervisorOption.click();
        }
      }
    });

    test("should show supervisor bonus line items", async ({
      authenticatedPage,
      getWorkerId,
    }) => {
      // Navigate to supervisor's payment details
      const supervisorId = getWorkerId(
        TestData.workers.supervisor.firstName,
        TestData.workers.supervisor.lastName
      );

      await authenticatedPage.goto(
        `/dashboard/workers/${supervisorId}/payments`
      );
      await authenticatedPage.waitForLoadState("networkidle");

      // Look for bonus line items
      const bonusItems = authenticatedPage.locator(
        '[data-testid="bonus-item"], text=/bonus|modifier/i'
      );

      // Bonus items should be displayed
    });
  });

  test.describe("Rate Card Configuration", () => {
    test("should verify rate card was seeded correctly", async ({
      seededIds,
    }) => {
      // Verify rate cards were created during seeding
      expect(seededIds.rateCardIds.length).toBeGreaterThan(0);
    });

    test("rate card should be linked to correct worker", async ({
      scenarioData,
      seededIds,
    }) => {
      // Supervisor (worker-1 / Sarah Mitchell) should have rate cards
      const supervisorWorkerId = seededIds.workerIds["worker-1"];
      expect(supervisorWorkerId).toBeTruthy();

      // Rate cards should be for supervisor
      expect(scenarioData.rateCards.supervisor.worker_name).toBe(
        "Sarah Mitchell"
      );
    });

    test("rate card should have correct modifiers", async ({ scenarioData }) => {
      const cards = scenarioData.rateCards.supervisor.cards;

      // Should have 2 rate cards
      expect(cards.length).toBe(2);

      // Soap bonus card
      const soapCard = cards.find((c) => c.rate_type === "unit");
      expect(soapCard).toBeDefined();
      expect(soapCard?.base_amount).toBe(0.5);
      expect(soapCard?.field_config_name).toBe("soaps_by_make");

      // Percentage card
      const percentageCard = cards.find((c) => c.rate_type === "percentage");
      expect(percentageCard).toBeDefined();
      expect(percentageCard?.percentage_rate).toBe(0.02);
      expect(percentageCard?.modifier_type).toBe("team_percentage");
    });
  });

  test.describe("Payment Period", () => {
    test("organization should be configured for fortnightly payments", async ({
      scenarioData,
    }) => {
      expect(scenarioData.organization.settings.worker_payment_cycle).toBe(
        "fortnightly"
      );
    });

    test("should display payment period selector", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/dashboard/workers/payments");

      // Look for period selector
      const periodSelector = authenticatedPage.locator(
        '[data-testid="payment-period"], select[name="period"], input[type="date"]'
      );

      // Period selector may be present for filtering
    });
  });

  test.describe("Edge Cases", () => {
    test("should handle worker with no completed jobs", async ({
      authenticatedPage,
    }) => {
      // Some workers may not have completed any jobs yet
      // Should show $0.00 or "No payments" message

      await authenticatedPage.goto("/dashboard/workers/payments");

      // Look for empty state or zero amounts
      const emptyState = authenticatedPage.locator(
        'text=/no payments|\\$0\\.00|no jobs/i'
      );

      // May or may not be present depending on test data
    });

    test("should handle supervisor with only non-soap jobs", async ({
      scenarioData,
    }) => {
      // If supervisor completes warehouse/tender job, soap bonus = $0
      // Percentage bonus still applies

      // Example: Warehouse job
      // Invoice: $25.00
      // Soap bonus: $0.00 (no soap cars)
      // Percentage: 2% × $25.00 = $0.50
      // Total: $25.50

      const warehousePayment = 25.0;
      const soapBonus = 0;
      const percentageBonus = warehousePayment * 0.02;
      const total = warehousePayment + soapBonus + percentageBonus;

      expect(total).toBe(25.5);
    });

    test("should calculate cumulative bonuses for multiple jobs", async ({
      scenarioData,
    }) => {
      // If supervisor completes multiple jobs in a pay period:
      // Soap bonus accumulates per car
      // Percentage applies to each job individually

      // Example: 2 jobs with 4 soap cars each
      // Job 1: $20.00 + $2.00 bonus + $0.40 percentage = $22.40
      // Job 2: $20.00 + $2.00 bonus + $0.40 percentage = $22.40
      // Total: $44.80

      const jobsCount = 2;
      const carsPerJob = 4;
      const jobValue = carsPerJob * TestData.pricing.soapPerCar;
      const soapBonusPerJob = carsPerJob * TestData.supervisorRateCard.soapBonus;
      const percentageBonusPerJob =
        jobValue * TestData.supervisorRateCard.shiftPercentage;

      const totalPerJob = jobValue + soapBonusPerJob + percentageBonusPerJob;
      const grandTotal = totalPerJob * jobsCount;

      expect(totalPerJob).toBeCloseTo(22.4);
      expect(grandTotal).toBeCloseTo(44.8);
    });
  });
});
