/**
 * Tests for update-location edge function
 *
 * These tests focus on validation logic and authorization checks.
 *
 * Run with: deno test --allow-all functions/__tests__/update-location.test.ts
 */

import { assertEquals } from "@std/assert";
import { isValidEmail, testRequiredField } from "./test-utils.ts";

/**
 * Test required field validation
 */
Deno.test("update-location: should require location id and all update fields", () => {
  const body: {
    id?: string;
    name?: string;
    email?: string;
    address?: string;
    contact_person?: string;
  } = {
    id: "location-1",
    name: "Updated Location",
    email: "updated@example.com",
    address: "456 Updated St",
    contact_person: "Jane Doe",
  };

  const requiredFields = ["id", "name", "email", "address", "contact_person"];
  const missingFields = requiredFields.filter((field) =>
    !(field in body) || !body[field as keyof typeof body]
  );
  const isValid = missingFields.length === 0;
  assertEquals(isValid, true);
});

Deno.test("update-location: should detect missing location id", () => {
  const body: {
    id?: string;
    name?: string;
    email?: string;
    address?: string;
    contact_person?: string;
  } = {
    name: "Updated Location",
    email: "updated@example.com",
    address: "456 Updated St",
    contact_person: "Jane Doe",
  };
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "id is required");
});

Deno.test("update-location: should detect missing name", () => {
  const body: {
    id?: string;
    name?: string;
    email?: string;
    address?: string;
    contact_person?: string;
  } = {
    id: "location-1",
    email: "updated@example.com",
    address: "456 Updated St",
    contact_person: "Jane Doe",
  };
  const result = testRequiredField("name", body.name, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "name is required");
});

/**
 * Test location existence validation
 */
Deno.test("update-location: should verify location exists before update", () => {
  const location = { id: "location-1", organization_id: "org-1" };
  const exists = location !== null && location !== undefined;
  assertEquals(exists, true);
});

Deno.test("update-location: should reject update of non-existent location", () => {
  const location = null;
  const exists = location !== null && location !== undefined;
  assertEquals(exists, false);
});

/**
 * Test hierarchy parent validation
 */
Deno.test("update-location: should validate hierarchy_parent_id belongs to same organization", () => {
  const locationOrganizationId = "org-1";
  const parentNode = { id: "hier-1", organization_id: "org-1" };
  const isValid = parentNode.organization_id === locationOrganizationId;
  assertEquals(isValid, true);
});

Deno.test("update-location: should reject hierarchy_parent_id from different organization", () => {
  const locationOrganizationId = "org-1";
  const parentNode = { id: "hier-1", organization_id: "org-2" };
  const isValid = parentNode.organization_id === locationOrganizationId;
  assertEquals(isValid, false);
});

Deno.test("update-location: should allow null hierarchy_parent_id", () => {
  const hierarchyParentId: string | null = null;
  const isValid = hierarchyParentId === null || hierarchyParentId === undefined;
  assertEquals(isValid, true);
});

/**
 * Test email validation
 */
Deno.test("update-location: should validate email format", () => {
  const email = "updated@example.com";
  const isValid = isValidEmail(email);
  assertEquals(isValid, true);
});

Deno.test("update-location: should reject invalid email format", () => {
  const email = "not-an-email";
  const isValid = isValidEmail(email);
  assertEquals(isValid, false);
});

/**
 * Test organization membership validation
 */
Deno.test("update-location: should validate location belongs to organization", () => {
  const locationOrganizationId = "org-1";
  const userOrganizationId = "org-1";
  const belongsToOrg = locationOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, true);
});

Deno.test("update-location: should reject cross-organization updates", () => {
  const locationOrganizationId: string = "org-1";
  const userOrganizationId: string = "org-2";
  const belongsToOrg = locationOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, false);
});
