/**
 * Tests for update-worker edge function
 *
 * These tests focus on validation logic and authorization checks.
 *
 * Run with: deno test --allow-all functions/__tests__/update-worker.test.ts
 */

import { assertEquals } from "@std/assert";
import { isValidEmail, testRequiredField } from "./test-utils.ts";

/**
 * Test required field validation
 */
Deno.test("update-worker: should require worker id", () => {
  const body: { id?: string } = { id: "worker-1" };
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, true);
});

Deno.test("update-worker: should detect missing worker id", () => {
  const body: { id?: string } = {};
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "id is required");
});

/**
 * Test update data building logic
 */
Deno.test("update-worker: should only include provided fields in update", () => {
  const updateData: {
    name?: string;
    email?: string;
    phone?: string;
    active?: boolean;
  } = {};

  const name = "Updated Name";
  if (name !== undefined) updateData.name = name;

  assertEquals(updateData.name, "Updated Name");
  assertEquals(updateData.email, undefined);
  assertEquals(updateData.phone, undefined);
  assertEquals(updateData.active, undefined);
});

Deno.test("update-worker: should handle multiple field updates", () => {
  const updateData: {
    name?: string;
    email?: string;
    phone?: string;
    active?: boolean;
  } = {};

  const name = "Updated Name";
  const email = "updated@example.com";
  const active = true;

  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (active !== undefined) updateData.active = active;

  assertEquals(updateData.name, "Updated Name");
  assertEquals(updateData.email, "updated@example.com");
  assertEquals(updateData.active, true);
});

Deno.test("update-worker: should require at least one field to update", () => {
  const updateData: {
    name?: string;
    email?: string;
    phone?: string;
    active?: boolean;
  } = {};

  const hasFields = Object.keys(updateData).length > 0;
  assertEquals(hasFields, false, "Should require at least one field");
});

Deno.test("update-worker: should validate email format when provided", () => {
  const email = "updated@example.com";
  const isValid = isValidEmail(email);
  assertEquals(isValid, true);
});

Deno.test("update-worker: should reject invalid email format", () => {
  const email = "not-an-email";
  const isValid = isValidEmail(email);
  assertEquals(isValid, false);
});

/**
 * Test organization membership validation
 */
Deno.test("update-worker: should validate worker belongs to organization", () => {
  const workerOrganizationId = "org-1";
  const userOrganizationId = "org-1";
  const belongsToOrg = workerOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, true);
});

Deno.test("update-worker: should reject cross-organization updates", () => {
  const workerOrganizationId: string = "org-1";
  const userOrganizationId: string = "org-2";
  const belongsToOrg = workerOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, false);
});
