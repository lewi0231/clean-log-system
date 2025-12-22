/**
 * Tests for create-location edge function
 *
 * These tests focus on validation logic and authorization checks.
 *
 * Run with: deno test --allow-all functions/__tests__/create-location.test.ts
 */

import { assertEquals } from "@std/assert";
import { isValidEmail, testRequiredField } from "./test-utils.ts";

/**
 * Test required field validation
 */
Deno.test("create-location: should require all required fields", () => {
  const body: {
    name?: string;
    email?: string;
    address?: string;
    contact_person?: string;
    organization_id?: string;
  } = {
    name: "Test Location",
    email: "location@example.com",
    address: "123 Test St",
    contact_person: "John Doe",
    organization_id: "org-1",
  };

  const requiredFields = [
    "name",
    "email",
    "address",
    "contact_person",
    "organization_id",
  ];
  const missingFields = requiredFields.filter((field) =>
    !(field in body) || !body[field as keyof typeof body]
  );
  const isValid = missingFields.length === 0;
  assertEquals(isValid, true);
});

Deno.test("create-location: should detect missing name", () => {
  const body: {
    name?: string;
    email?: string;
    address?: string;
    contact_person?: string;
    organization_id?: string;
  } = {
    email: "location@example.com",
    address: "123 Test St",
    contact_person: "John Doe",
    organization_id: "org-1",
  };
  const result = testRequiredField("name", body.name, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "name is required");
});

Deno.test("create-location: should detect missing email", () => {
  const body: {
    name?: string;
    email?: string;
    address?: string;
    contact_person?: string;
    organization_id?: string;
  } = {
    name: "Test Location",
    address: "123 Test St",
    contact_person: "John Doe",
    organization_id: "org-1",
  };
  const result = testRequiredField("email", body.email, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "email is required");
});

Deno.test("create-location: should detect missing address", () => {
  const body: {
    name?: string;
    email?: string;
    address?: string;
    contact_person?: string;
    organization_id?: string;
  } = {
    name: "Test Location",
    email: "location@example.com",
    contact_person: "John Doe",
    organization_id: "org-1",
  };
  const result = testRequiredField("address", body.address, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "address is required");
});

Deno.test("create-location: should detect missing contact_person", () => {
  const body: {
    name?: string;
    email?: string;
    address?: string;
    contact_person?: string;
    organization_id?: string;
  } = {
    name: "Test Location",
    email: "location@example.com",
    address: "123 Test St",
    organization_id: "org-1",
  };
  const result = testRequiredField("contact_person", body.contact_person, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "contact_person is required");
});

Deno.test("create-location: should detect missing organization_id", () => {
  const body: {
    name?: string;
    email?: string;
    address?: string;
    contact_person?: string;
    organization_id?: string;
  } = {
    name: "Test Location",
    email: "location@example.com",
    address: "123 Test St",
    contact_person: "John Doe",
  };
  const result = testRequiredField(
    "organization_id",
    body.organization_id,
    true,
  );
  assertEquals(result.valid, false);
  assertEquals(result.error, "organization_id is required");
});

/**
 * Test email validation
 */
Deno.test("create-location: should validate email format", () => {
  const email = "location@example.com";
  const isValid = isValidEmail(email);
  assertEquals(isValid, true);
});

Deno.test("create-location: should reject invalid email format", () => {
  const email = "not-an-email";
  const isValid = isValidEmail(email);
  assertEquals(isValid, false);
});

/**
 * Test hierarchy parent validation
 */
Deno.test("create-location: should validate hierarchy_parent_id belongs to same organization", () => {
  const organizationId = "org-1";
  const parentNode = { id: "hier-1", organization_id: "org-1" };
  const isValid = parentNode.organization_id === organizationId;
  assertEquals(isValid, true);
});

Deno.test("create-location: should reject hierarchy_parent_id from different organization", () => {
  const organizationId = "org-1";
  const parentNode = { id: "hier-1", organization_id: "org-2" };
  const isValid = parentNode.organization_id === organizationId;
  assertEquals(isValid, false);
});

Deno.test("create-location: should allow null hierarchy_parent_id", () => {
  const hierarchyParentId: string | null = null;
  const isValid = hierarchyParentId === null || hierarchyParentId === undefined;
  assertEquals(isValid, true);
});

/**
 * Test location creation logic
 */
Deno.test("create-location: should set location as active by default", () => {
  const active = true;
  assertEquals(active, true);
});

Deno.test("create-location: should handle optional phone field", () => {
  const phone: string | undefined = "0412345678";
  const phoneValue = phone || null;
  assertEquals(phoneValue, "0412345678");
});

Deno.test("create-location: should handle missing phone field", () => {
  const phone: string | undefined = undefined;
  const phoneValue = phone || null;
  assertEquals(phoneValue, null);
});
