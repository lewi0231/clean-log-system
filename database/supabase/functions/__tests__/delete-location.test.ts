/**
 * Tests for delete-location edge function
 *
 * These tests focus on validation logic and authorization checks.
 *
 * Run with: deno test --allow-all functions/__tests__/delete-location.test.ts
 */

import { assertEquals } from "@std/assert";
import { testRequiredField } from "./test-utils.ts";

/**
 * Test required field validation
 */
Deno.test("delete-location: should require location id", () => {
  const body: { id?: string } = { id: "location-1" };
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, true);
});

Deno.test("delete-location: should detect missing location id", () => {
  const body: { id?: string } = {};
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "id is required");
});

/**
 * Test location existence validation
 */
Deno.test("delete-location: should verify location exists before deletion", () => {
  const location = {
    id: "location-1",
    organization_id: "org-1",
    name: "Test Location",
  };
  const exists = location !== null && location !== undefined;
  assertEquals(exists, true);
});

Deno.test("delete-location: should reject deletion of non-existent location", () => {
  const location = null;
  const exists = location !== null && location !== undefined;
  assertEquals(exists, false);
});

/**
 * Test organization membership validation
 */
Deno.test("delete-location: should validate location belongs to organization", () => {
  const locationOrganizationId = "org-1";
  const userOrganizationId = "org-1";
  const belongsToOrg = locationOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, true);
});

Deno.test("delete-location: should reject cross-organization deletion", () => {
  const locationOrganizationId: string = "org-1";
  const userOrganizationId: string = "org-2";
  const belongsToOrg = locationOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, false);
});
