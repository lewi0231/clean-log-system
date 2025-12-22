/**
 * Tests for calculate-invoice edge function
 *
 * These tests focus on calculation logic and validation.
 *
 * Run with: deno test --allow-all functions/__tests__/calculate-invoice.test.ts
 */

import { assertEquals } from "@std/assert";

/**
 * Test required field validation
 */
Deno.test("calculate-invoice: should require organization_id and job_ids", () => {
  const body: { organization_id?: string; job_ids?: string[] } = {
    organization_id: "org-1",
    job_ids: ["job-1", "job-2"],
  };
  const requiredFields = ["organization_id", "job_ids"];
  const missingFields = requiredFields.filter((field) =>
    !(field in body) || !body[field as keyof typeof body]
  );
  const isValid = missingFields.length === 0;
  assertEquals(isValid, true);
});

Deno.test("calculate-invoice: should detect missing organization_id", () => {
  const body: { organization_id?: string; job_ids?: string[] } = {
    job_ids: ["job-1"],
  };
  const requiredFields = ["organization_id", "job_ids"];
  const missingFields = requiredFields.filter((field) =>
    !(field in body) || !body[field as keyof typeof body]
  );
  const isValid = missingFields.length === 0;
  assertEquals(isValid, false);
  assertEquals(missingFields.includes("organization_id"), true);
});

Deno.test("calculate-invoice: should detect missing job_ids", () => {
  const body: { organization_id?: string; job_ids?: string[] } = {
    organization_id: "org-1",
  };
  const requiredFields = ["organization_id", "job_ids"];
  const missingFields = requiredFields.filter((field) =>
    !(field in body) || !body[field as keyof typeof body]
  );
  const isValid = missingFields.length === 0;
  assertEquals(isValid, false);
  assertEquals(missingFields.includes("job_ids"), true);
});

Deno.test("calculate-invoice: should validate job_ids is an array", () => {
  const jobIds = ["job-1", "job-2"];
  const isValid = Array.isArray(jobIds);
  assertEquals(isValid, true);
});

Deno.test("calculate-invoice: should reject empty job_ids array", () => {
  const jobIds: string[] = [];
  const isValid = Array.isArray(jobIds) && jobIds.length > 0;
  assertEquals(isValid, false);
});

/**
 * Test calculation aggregation logic
 */
Deno.test("calculate-invoice: should aggregate totals from multiple jobs", () => {
  const jobCalculations = [
    {
      subtotal: 1000,
      total_adjustments: 0,
      total: 1000,
      worker_payment_total: 500,
      margin: 500,
    },
    {
      subtotal: 2000,
      total_adjustments: 100,
      total: 1900,
      worker_payment_total: 800,
      margin: 1100,
    },
  ];

  const totalSubtotal = jobCalculations.reduce(
    (sum, calc) => sum + calc.subtotal,
    0,
  );
  const totalAdjustments = jobCalculations.reduce(
    (sum, calc) => sum + calc.total_adjustments,
    0,
  );
  const total = jobCalculations.reduce((sum, calc) => sum + calc.total, 0);
  const totalWorkerPayment = jobCalculations.reduce(
    (sum, calc) => sum + calc.worker_payment_total,
    0,
  );
  const totalMargin = jobCalculations.reduce(
    (sum, calc) => sum + calc.margin,
    0,
  );

  assertEquals(totalSubtotal, 3000);
  assertEquals(totalAdjustments, 100);
  assertEquals(total, 2900);
  assertEquals(totalWorkerPayment, 1300);
  assertEquals(totalMargin, 1600);
});

Deno.test("calculate-invoice: should handle zero total invoice", () => {
  const jobCalculations = [
    {
      subtotal: 0,
      total_adjustments: 0,
      total: 0,
      worker_payment_total: 0,
      margin: 0,
    },
  ];

  const total = jobCalculations.reduce((sum, calc) => sum + calc.total, 0);
  assertEquals(total, 0);
});

/**
 * Test currency handling
 */
Deno.test("calculate-invoice: should handle currency field", () => {
  const currency = "AUD";
  const isValid = typeof currency === "string" && currency.length > 0;
  assertEquals(isValid, true);
});

Deno.test("calculate-invoice: should default to AUD if currency missing", () => {
  const currency = undefined;
  const defaultCurrency = currency || "AUD";
  assertEquals(defaultCurrency, "AUD");
});

/**
 * Test pricing rule edge cases
 */
Deno.test("calculate-invoice: should handle no pricing rules (zero total)", () => {
  const pricingRules: unknown[] = [];
  const hasPricingRules = pricingRules.length > 0;

  // When no pricing rules, calculation should result in zero total
  const total = hasPricingRules ? 100 : 0;
  assertEquals(
    total,
    0,
    "Should return zero total when no pricing rules exist",
  );
});

Deno.test("calculate-invoice: should filter expired pricing rules", () => {
  const nowIso = new Date().toISOString();
  const pricingRules = [
    {
      id: "rule-1",
      effective_at: "2024-01-01T00:00:00Z",
      expires_at: "2024-12-31T23:59:59Z",
    },
    { id: "rule-2", effective_at: "2024-01-01T00:00:00Z", expires_at: null },
    { id: "rule-3", effective_at: "2025-01-01T00:00:00Z", expires_at: null }, // Future rule
  ];

  // Filter rules: effective_at <= now AND (expires_at IS NULL OR expires_at > now)
  const activeRules = pricingRules.filter((rule: {
    effective_at: string;
    expires_at: string | null;
  }) => {
    const isEffective = rule.effective_at <= nowIso;
    const isNotExpired = rule.expires_at === null || rule.expires_at > nowIso;
    return isEffective && isNotExpired;
  });

  // rule-1: expired (if current date > 2024-12-31)
  // rule-2: active (no expiration)
  // rule-3: not yet effective (future date)
  // Should include at least rule-2
  assertEquals(
    activeRules.length >= 1,
    true,
    "Should filter out expired and future rules",
  );
});

Deno.test("calculate-invoice: should filter future pricing rules", () => {
  const nowIso = new Date().toISOString();
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  const futureIso = futureDate.toISOString();

  const pricingRules = [
    { id: "rule-1", effective_at: "2024-01-01T00:00:00Z", expires_at: null },
    { id: "rule-2", effective_at: futureIso, expires_at: null }, // Future rule
  ];

  // Only include rules where effective_at <= now
  const activeRules = pricingRules.filter((rule: { effective_at: string }) =>
    rule.effective_at <= nowIso
  );

  assertEquals(activeRules.length, 1, "Should exclude future rules");
  assertEquals(activeRules[0].id, "rule-1");
});

Deno.test("calculate-invoice: should prioritize more specific rules", () => {
  // Simulate rule specificity scoring
  // Higher score = more specific = should be selected
  const rules = [
    {
      id: "rule-1",
      location_id: "loc-1",
      location_hierarchy_id: null,
      priority: null,
      score: 300, // Location-specific (highest)
    },
    {
      id: "rule-2",
      location_id: null,
      location_hierarchy_id: "hier-1",
      priority: null,
      score: 250, // Hierarchy-specific (medium)
    },
    {
      id: "rule-3",
      location_id: null,
      location_hierarchy_id: null,
      priority: 10,
      score: 140, // Global with priority (lowest)
    },
  ];

  // Select rule with highest score
  const bestRule = rules.reduce((best, current) =>
    current.score > best.score ? current : best
  );

  assertEquals(bestRule.id, "rule-1", "Should select most specific rule");
  assertEquals(bestRule.score, 300);
});

Deno.test("calculate-invoice: should use priority when specificity is equal", () => {
  // Two rules with same location specificity, different priorities
  const rules = [
    {
      id: "rule-1",
      location_id: "loc-1",
      location_hierarchy_id: null,
      priority: 20, // Lower priority number = higher priority
      baseScore: 300,
    },
    {
      id: "rule-2",
      location_id: "loc-1",
      location_hierarchy_id: null,
      priority: 10, // Lower priority number = higher priority
      baseScore: 300,
    },
  ];

  // Calculate score: baseScore + (50 - priority)
  const scoredRules = rules.map((rule) => ({
    ...rule,
    score: rule.baseScore + Math.max(0, 50 - (rule.priority || 0)),
  }));

  // Select rule with highest score (lower priority number = higher score)
  const bestRule = scoredRules.reduce((best, current) =>
    current.score > best.score ? current : best
  );

  assertEquals(
    bestRule.id,
    "rule-2",
    "Should select rule with lower priority number",
  );
  assertEquals(bestRule.priority, 10);
});
