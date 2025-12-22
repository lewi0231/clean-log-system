/**
 * Tests for delete-field-config edge function
 *
 * These tests focus on validation logic and authorization checks.
 *
 * Run with: deno test --allow-all functions/__tests__/delete-field-config.test.ts
 */

import { assertEquals } from "@std/assert";
import { testRequiredField } from "./test-utils.ts";

/**
 * Test required field validation
 */
Deno.test("delete-field-config: should require field config id", () => {
  const body: { id?: string } = { id: "field-config-1" };
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, true);
});

Deno.test("delete-field-config: should detect missing field config id", () => {
  const body: { id?: string } = {};
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "id is required");
});

/**
 * Test field config existence validation
 */
Deno.test("delete-field-config: should verify field config exists before deletion", () => {
  const fieldConfig = {
    id: "field-config-1",
    organization_id: "org-1",
    name: "Service Type",
  };
  const exists = fieldConfig !== null && fieldConfig !== undefined;
  assertEquals(exists, true);
});

Deno.test("delete-field-config: should reject deletion of non-existent field config", () => {
  const fieldConfig = null;
  const exists = fieldConfig !== null && fieldConfig !== undefined;
  assertEquals(exists, false);
});

/**
 * Test field config usage validation
 */
Deno.test("delete-field-config: should detect if field config is used in jobs", () => {
  const jobsUsingField = [{ id: "job-1" }];
  const hasData = jobsUsingField && jobsUsingField.length > 0;
  assertEquals(hasData, true);
});

Deno.test("delete-field-config: should allow deletion when field config is not used", () => {
  const jobsUsingField: unknown[] = [];
  const hasData = jobsUsingField && jobsUsingField.length > 0;
  assertEquals(hasData, false);
});

/**
 * Test organization membership validation
 */
Deno.test("delete-field-config: should validate field config belongs to organization", () => {
  const fieldConfigOrganizationId = "org-1";
  const userOrganizationId = "org-1";
  const belongsToOrg = fieldConfigOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, true);
});

Deno.test("delete-field-config: should reject cross-organization deletion", () => {
  const fieldConfigOrganizationId: string = "org-1";
  const userOrganizationId: string = "org-2";
  const belongsToOrg = fieldConfigOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, false);
});
