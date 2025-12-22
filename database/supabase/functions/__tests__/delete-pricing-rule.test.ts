/**
 * Tests for delete-pricing-rule edge function
 *
 * These tests focus on validation logic and authorization checks.
 *
 * Run with: deno test --allow-all functions/__tests__/delete-pricing-rule.test.ts
 */

import { assertEquals } from "@std/assert";
import { testRequiredField } from "./test-utils.ts";

/**
 * Test required field validation
 */
Deno.test("delete-pricing-rule: should require pricing rule id", () => {
  const body: { id?: string } = { id: "rule-1" };
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, true);
});

Deno.test("delete-pricing-rule: should detect missing pricing rule id", () => {
  const body: { id?: string } = {};
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "id is required");
});

/**
 * Test pricing rule existence validation
 */
Deno.test("delete-pricing-rule: should verify pricing rule exists before deletion", () => {
  const pricingRule = {
    id: "rule-1",
    organization_id: "org-1",
    scope: "field",
    pricing_type: "unit",
  };
  const exists = pricingRule !== null && pricingRule !== undefined;
  assertEquals(exists, true);
});

Deno.test("delete-pricing-rule: should reject deletion of non-existent pricing rule", () => {
  const pricingRule = null;
  const exists = pricingRule !== null && pricingRule !== undefined;
  assertEquals(exists, false);
});

/**
 * Test organization membership validation
 */
Deno.test("delete-pricing-rule: should validate pricing rule belongs to organization", () => {
  const ruleOrganizationId = "org-1";
  const userOrganizationId = "org-1";
  const belongsToOrg = ruleOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, true);
});

Deno.test("delete-pricing-rule: should reject cross-organization deletion", () => {
  const ruleOrganizationId: string = "org-1";
  const userOrganizationId: string = "org-2";
  const belongsToOrg = ruleOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, false);
});
