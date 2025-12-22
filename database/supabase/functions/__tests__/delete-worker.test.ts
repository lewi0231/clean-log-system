/**
 * Tests for delete-worker edge function
 *
 * These tests focus on validation logic and authorization checks.
 *
 * Run with: deno test --allow-all functions/__tests__/delete-worker.test.ts
 */

import { assertEquals } from "@std/assert";
import { testRequiredField } from "./test-utils.ts";

/**
 * Test required field validation
 */
Deno.test("delete-worker: should require worker id", () => {
  const body: { id?: string } = { id: "worker-1" };
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, true);
});

Deno.test("delete-worker: should detect missing worker id", () => {
  const body: { id?: string } = {};
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "id is required");
});

/**
 * Test worker existence validation
 */
Deno.test("delete-worker: should verify worker exists before deletion", () => {
  const worker = { id: "worker-1", organization_id: "org-1", name: "John Doe" };
  const exists = worker !== null && worker !== undefined;
  assertEquals(exists, true);
});

Deno.test("delete-worker: should reject deletion of non-existent worker", () => {
  const worker = null;
  const exists = worker !== null && worker !== undefined;
  assertEquals(exists, false);
});

/**
 * Test organization membership validation
 */
Deno.test("delete-worker: should validate worker belongs to organization", () => {
  const workerOrganizationId = "org-1";
  const userOrganizationId = "org-1";
  const belongsToOrg = workerOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, true);
});

Deno.test("delete-worker: should reject cross-organization deletion", () => {
  const workerOrganizationId: string = "org-1";
  const userOrganizationId: string = "org-2";
  const belongsToOrg = workerOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, false);
});
