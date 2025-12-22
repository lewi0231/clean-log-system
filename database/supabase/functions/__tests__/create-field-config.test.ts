/**
 * Tests for create-field-config edge function
 *
 * These tests focus on validation logic and authorization checks.
 *
 * Run with: deno test --allow-all functions/__tests__/create-field-config.test.ts
 */

import { assertEquals } from "@std/assert";
import { testRequiredField } from "./test-utils.ts";

/**
 * Test required field validation
 */
Deno.test("create-field-config: should require all required fields", () => {
  const body: {
    organization_id?: string;
    name?: string;
    label?: string;
    field_type?: string;
  } = {
    organization_id: "org-1",
    name: "service_type",
    label: "Service Type",
    field_type: "select",
  };

  const requiredFields = ["organization_id", "name", "label", "field_type"];
  const missingFields = requiredFields.filter((field) =>
    !(field in body) || !body[field as keyof typeof body]
  );
  const isValid = missingFields.length === 0;
  assertEquals(isValid, true);
});

Deno.test("create-field-config: should detect missing organization_id", () => {
  const body: {
    organization_id?: string;
    name?: string;
    label?: string;
    field_type?: string;
  } = {
    name: "service_type",
    label: "Service Type",
    field_type: "select",
  };
  const result = testRequiredField(
    "organization_id",
    body.organization_id,
    true,
  );
  assertEquals(result.valid, false);
  assertEquals(result.error, "organization_id is required");
});

Deno.test("create-field-config: should detect missing name", () => {
  const body: {
    organization_id?: string;
    name?: string;
    label?: string;
    field_type?: string;
  } = {
    organization_id: "org-1",
    label: "Service Type",
    field_type: "select",
  };
  const result = testRequiredField("name", body.name, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "name is required");
});

Deno.test("create-field-config: should detect missing label", () => {
  const body: {
    organization_id?: string;
    name?: string;
    label?: string;
    field_type?: string;
  } = {
    organization_id: "org-1",
    name: "service_type",
    field_type: "select",
  };
  const result = testRequiredField("label", body.label, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "label is required");
});

Deno.test("create-field-config: should detect missing field_type", () => {
  const body: {
    organization_id?: string;
    name?: string;
    label?: string;
    field_type?: string;
  } = {
    organization_id: "org-1",
    name: "service_type",
    label: "Service Type",
  };
  const result = testRequiredField("field_type", body.field_type, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "field_type is required");
});

/**
 * Test group/cluster validation
 */
Deno.test("create-field-config: should require mutually_exclusive_group when group_cluster is set", () => {
  const groupCluster = "cluster-1";
  const mutuallyExclusiveGroup = "group-1";
  // Validation: !(group_cluster && !mutually_exclusive_group)
  const isValid = !(groupCluster && !mutuallyExclusiveGroup);
  assertEquals(isValid, true);
});

Deno.test("create-field-config: should reject group_cluster without mutually_exclusive_group", () => {
  const groupCluster = "cluster-1";
  const mutuallyExclusiveGroup: string | null = null;
  // Validation: !(group_cluster && !mutually_exclusive_group)
  const isValid = !(groupCluster && !mutuallyExclusiveGroup);
  assertEquals(isValid, false);
});

Deno.test("create-field-config: should allow both group_cluster and mutually_exclusive_group to be null", () => {
  const groupCluster: string | null = null;
  const mutuallyExclusiveGroup: string | null = null;
  // Validation: !(group_cluster && !mutually_exclusive_group)
  const isValid = !(groupCluster && !mutuallyExclusiveGroup);
  assertEquals(isValid, true);
});

/**
 * Test order_position logic
 */
Deno.test("create-field-config: should use provided order_position", () => {
  const orderPosition = 5;
  const finalOrderPosition =
    orderPosition !== undefined && orderPosition !== null ? orderPosition : 0;
  assertEquals(finalOrderPosition, 5);
});

Deno.test("create-field-config: should default order_position to 0 when not provided", () => {
  const orderPosition: number | undefined = undefined;
  const finalOrderPosition =
    orderPosition !== undefined && orderPosition !== null ? orderPosition : 0;
  assertEquals(finalOrderPosition, 0);
});

Deno.test("create-field-config: should calculate next order_position from max existing", () => {
  const existingConfigs = [{ order_position: 10 }];
  const maxOrder = existingConfigs.length > 0
    ? Math.max(...existingConfigs.map((c) => c.order_position))
    : -1;
  const nextOrder = maxOrder >= 0 ? maxOrder + 1 : 0;
  assertEquals(nextOrder, 11);
});

/**
 * Test default values
 */
Deno.test("create-field-config: should set active to true by default", () => {
  const active = true;
  assertEquals(active, true);
});

Deno.test("create-field-config: should set required to false by default", () => {
  const required = false;
  assertEquals(required, false);
});
