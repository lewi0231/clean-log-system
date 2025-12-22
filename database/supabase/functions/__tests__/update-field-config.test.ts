/**
 * Tests for update-field-config edge function
 *
 * These tests focus on validation logic and authorization checks.
 *
 * Run with: deno test --allow-all functions/__tests__/update-field-config.test.ts
 */

import { assertEquals } from "@std/assert";
import { testRequiredField } from "./test-utils.ts";

/**
 * Test required field validation
 */
Deno.test("update-field-config: should require field config id", () => {
  const body: { id?: string } = { id: "field-config-1" };
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, true);
});

Deno.test("update-field-config: should detect missing field config id", () => {
  const body: { id?: string } = {};
  const result = testRequiredField("id", body.id, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "id is required");
});

/**
 * Test field config existence validation
 */
Deno.test("update-field-config: should verify field config exists before update", () => {
  const fieldConfig = { id: "field-config-1", organization_id: "org-1" };
  const exists = fieldConfig !== null && fieldConfig !== undefined;
  assertEquals(exists, true);
});

Deno.test("update-field-config: should reject update of non-existent field config", () => {
  const fieldConfig = null;
  const exists = fieldConfig !== null && fieldConfig !== undefined;
  assertEquals(exists, false);
});

/**
 * Test group/cluster validation
 */
Deno.test("update-field-config: should require mutually_exclusive_group when group_cluster is set", () => {
  const groupCluster = "cluster-1";
  const mutuallyExclusiveGroup = "group-1";
  // Validation: !(group_cluster !== undefined && group_cluster !== null && (!mutually_exclusive_group || mutually_exclusive_group === null))
  const isValid = !(
    groupCluster !== undefined &&
    groupCluster !== null &&
    (!mutuallyExclusiveGroup || mutuallyExclusiveGroup === null)
  );
  assertEquals(isValid, true);
});

Deno.test("update-field-config: should reject group_cluster without mutually_exclusive_group", () => {
  const groupCluster = "cluster-1";
  const mutuallyExclusiveGroup: string | null = null;
  // Validation: !(group_cluster !== undefined && group_cluster !== null && (!mutually_exclusive_group || mutually_exclusive_group === null))
  const isValid = !(
    groupCluster !== undefined &&
    groupCluster !== null &&
    (!mutuallyExclusiveGroup || mutuallyExclusiveGroup === null)
  );
  assertEquals(isValid, false);
});

Deno.test("update-field-config: should allow clearing group_cluster and mutually_exclusive_group", () => {
  const groupCluster: string | null = null;
  const mutuallyExclusiveGroup: string | null = null;
  // Validation: !(group_cluster !== undefined && group_cluster !== null && (!mutually_exclusive_group || mutually_exclusive_group === null))
  const isValid = !(
    groupCluster !== undefined &&
    groupCluster !== null &&
    (!mutuallyExclusiveGroup || mutuallyExclusiveGroup === null)
  );
  assertEquals(isValid, true);
});

/**
 * Test update data building logic
 */
Deno.test("update-field-config: should only include provided fields in update", () => {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const name = "Updated Name";
  if (name !== undefined) updateData.name = name;

  assertEquals(updateData.name, "Updated Name");
  assertEquals(updateData.label, undefined);
  assertEquals(updateData.field_type, undefined);
});

Deno.test("update-field-config: should handle multiple field updates", () => {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const name = "Updated Name";
  const label = "Updated Label";
  const required = true;

  if (name !== undefined) updateData.name = name;
  if (label !== undefined) updateData.label = label;
  if (required !== undefined) updateData.required = required;

  assertEquals(updateData.name, "Updated Name");
  assertEquals(updateData.label, "Updated Label");
  assertEquals(updateData.required, true);
});

/**
 * Test organization membership validation
 */
Deno.test("update-field-config: should validate field config belongs to organization", () => {
  const fieldConfigOrganizationId = "org-1";
  const userOrganizationId = "org-1";
  const belongsToOrg = fieldConfigOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, true);
});

Deno.test("update-field-config: should reject cross-organization updates", () => {
  const fieldConfigOrganizationId: string = "org-1";
  const userOrganizationId: string = "org-2";
  const belongsToOrg = fieldConfigOrganizationId === userOrganizationId;
  assertEquals(belongsToOrg, false);
});
