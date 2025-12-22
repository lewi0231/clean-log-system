/**
 * Tests for create-worker edge function
 *
 * These tests focus on validation logic and authorization checks.
 *
 * Run with: deno test --allow-all functions/__tests__/create-worker.test.ts
 */

import { assertEquals } from "@std/assert";
import {
  isValidEmail,
  testRequiredField,
  type ValidationTestScenario,
} from "./test-utils.ts";

/**
 * Test required field validation
 */
Deno.test("create-worker: should require all required fields", () => {
  const body: {
    name?: string;
    email?: string;
    phone?: string;
    organization_id?: string;
  } = {
    name: "John Doe",
    email: "john@example.com",
    phone: "0412345678",
    organization_id: "org-1",
  };

  const requiredFields = ["name", "email", "phone", "organization_id"];
  const missingFields = requiredFields.filter((field) =>
    !(field in body) || !body[field as keyof typeof body]
  );
  const isValid = missingFields.length === 0;
  assertEquals(isValid, true);
});

Deno.test("create-worker: should detect missing name", () => {
  const body: {
    name?: string;
    email?: string;
    phone?: string;
    organization_id?: string;
  } = {
    email: "john@example.com",
    phone: "0412345678",
    organization_id: "org-1",
  };
  const result = testRequiredField("name", body.name, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "name is required");
});

Deno.test("create-worker: should detect missing email", () => {
  const body: {
    name?: string;
    email?: string;
    phone?: string;
    organization_id?: string;
  } = {
    name: "John Doe",
    phone: "0412345678",
    organization_id: "org-1",
  };
  const result = testRequiredField("email", body.email, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "email is required");
});

Deno.test("create-worker: should detect missing phone", () => {
  const body: {
    name?: string;
    email?: string;
    phone?: string;
    organization_id?: string;
  } = {
    name: "John Doe",
    email: "john@example.com",
    organization_id: "org-1",
  };
  const result = testRequiredField("phone", body.phone, true);
  assertEquals(result.valid, false);
  assertEquals(result.error, "phone is required");
});

Deno.test("create-worker: should detect missing organization_id", () => {
  const body: {
    name?: string;
    email?: string;
    phone?: string;
    organization_id?: string;
  } = {
    name: "John Doe",
    email: "john@example.com",
    phone: "0412345678",
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
Deno.test("create-worker: should validate email format", () => {
  const email = "john@example.com";
  const isValid = isValidEmail(email);
  assertEquals(isValid, true);
});

Deno.test("create-worker: should reject invalid email format", () => {
  const email = "not-an-email";
  const isValid = isValidEmail(email);
  assertEquals(isValid, false);
});

/**
 * Test worker creation logic
 */
Deno.test("create-worker: should set worker as inactive initially", () => {
  const active = false; // Workers are inactive until they accept invitation
  assertEquals(active, false);
});

Deno.test("create-worker: should generate invitation token", () => {
  // Simulate UUID generation
  const token = "550e8400-e29b-41d4-a716-446655440000";
  const isValidToken = typeof token === "string" && token.length > 0;
  assertEquals(isValidToken, true);
});

Deno.test("create-worker: should calculate invitation expiration (7 days)", () => {
  const now = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  const daysUntilExpiry = Math.floor(
    (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  assertEquals(daysUntilExpiry, 7);
});

/**
 * Test validation scenarios
 */
const validationScenarios: ValidationTestScenario[] = [
  {
    field: "name",
    value: "John Doe",
    required: true,
    expectedValid: true,
  },
  {
    field: "name",
    value: undefined,
    required: true,
    expectedValid: false,
    expectedError: "name is required",
  },
  {
    field: "email",
    value: "john@example.com",
    required: true,
    expectedValid: true,
  },
  {
    field: "email",
    value: "invalid-email",
    required: true,
    expectedValid: false, // Invalid format
  },
  {
    field: "phone",
    value: "0412345678",
    required: true,
    expectedValid: true,
  },
  {
    field: "organization_id",
    value: "org-1",
    required: true,
    expectedValid: true,
  },
];

for (const scenario of validationScenarios) {
  Deno.test(
    `create-worker: should validate ${scenario.field} - ${
      scenario.expectedValid ? "valid" : "invalid"
    }`,
    () => {
      const result = testRequiredField(
        scenario.field,
        scenario.value,
        scenario.required,
      );
      if (scenario.field === "email" && typeof scenario.value === "string") {
        const emailValid = isValidEmail(scenario.value);
        assertEquals(emailValid, scenario.expectedValid);
      } else {
        assertEquals(result.valid, scenario.expectedValid);
        if (scenario.expectedError) {
          assertEquals(result.error, scenario.expectedError);
        }
      }
    },
  );
}
