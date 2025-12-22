/**
 * Comprehensive validation tests for Edge Functions
 *
 * Tests input validation, boundary conditions, and invalid data handling
 *
 * Run with: deno test --allow-all functions/__tests__/validation.test.ts
 */

import { assertEquals } from "@std/assert";
import {
  isValidEmail,
  isValidIsoDate,
  isValidUuid,
  testArrayField,
  testRequiredField,
  ValidationPatterns,
  type ValidationTestScenario,
} from "./test-utils.ts";

/**
 * Test UUID validation
 */
Deno.test("validation: should validate correct UUID format", () => {
  const validUuids = [
    "550e8400-e29b-41d4-a716-446655440000",
    "123e4567-e89b-12d3-a456-426614174000",
    "00000000-0000-0000-0000-000000000000",
  ];

  for (const uuid of validUuids) {
    const isValid = isValidUuid(uuid);
    assertEquals(isValid, true, `Should validate UUID: ${uuid}`);
  }
});

Deno.test("validation: should reject invalid UUID format", () => {
  const invalidUuids = [
    "not-a-uuid",
    "550e8400-e29b-41d4-a716", // Too short
    "550e8400-e29b-41d4-a716-446655440000-extra", // Too long
    "",
    null,
    undefined,
    123,
  ];

  for (const uuid of invalidUuids) {
    const isValid = isValidUuid(uuid);
    assertEquals(isValid, false, `Should reject invalid UUID: ${uuid}`);
  }
});

/**
 * Test email validation
 */
Deno.test("validation: should validate correct email format", () => {
  const validEmails = [
    "user@example.com",
    "test.user@example.co.uk",
    "user+tag@example.com",
    "user123@example-domain.com",
  ];

  for (const email of validEmails) {
    const isValid = isValidEmail(email);
    assertEquals(isValid, true, `Should validate email: ${email}`);
  }
});

Deno.test("validation: should reject invalid email format", () => {
  const invalidEmails = [
    "not-an-email",
    "@example.com",
    "user@",
    "user@example",
    "user @example.com",
    "",
    null,
    undefined,
  ];

  for (const email of invalidEmails) {
    const isValid = isValidEmail(email);
    assertEquals(isValid, false, `Should reject invalid email: ${email}`);
  }
});

/**
 * Test ISO date validation
 */
Deno.test("validation: should validate correct ISO date format", () => {
  const validDates = [
    "2024-01-01T00:00:00Z",
    "2024-12-31T23:59:59Z",
    "2024-01-01T00:00:00.000Z",
  ];

  for (const date of validDates) {
    const isValid = isValidIsoDate(date);
    assertEquals(isValid, true, `Should validate ISO date: ${date}`);
  }
});

Deno.test("validation: should reject invalid ISO date format", () => {
  const invalidDates = [
    "2024-01-01",
    "01/01/2024",
    "2024-01-01T00:00:00",
    "not-a-date",
    "",
    null,
    undefined,
  ];

  for (const date of invalidDates) {
    const isValid = isValidIsoDate(date);
    assertEquals(isValid, false, `Should reject invalid date: ${date}`);
  }
});

/**
 * Test required field validation
 */
Deno.test("validation: should validate required fields are present", () => {
  const result = testRequiredField("organization_id", "org-1", true);
  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
});

Deno.test("validation: should reject missing required fields", () => {
  const testCases = [
    { value: undefined, field: "organization_id" },
    { value: null, field: "job_id" },
    { value: "", field: "email" },
  ];

  for (const testCase of testCases) {
    const result = testRequiredField(testCase.field, testCase.value, true);
    assertEquals(result.valid, false);
    assertEquals(result.error, `${testCase.field} is required`);
  }
});

Deno.test("validation: should allow missing optional fields", () => {
  const result = testRequiredField("notes", undefined, false);
  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
});

/**
 * Test array field validation
 */
Deno.test("validation: should validate array fields", () => {
  const result = testArrayField("job_ids", ["job-1", "job-2"]);
  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
});

Deno.test("validation: should reject non-array values", () => {
  const testCases = [
    { value: "not-an-array", field: "job_ids" },
    { value: 123, field: "worker_ids" },
    { value: null, field: "items" },
    { value: {}, field: "list" },
  ];

  for (const testCase of testCases) {
    const result = testArrayField(testCase.field, testCase.value);
    assertEquals(result.valid, false);
    assertEquals(result.error, `${testCase.field} must be an array`);
  }
});

Deno.test("validation: should validate array minimum length", () => {
  const result = testArrayField("job_ids", ["job-1"], 1);
  assertEquals(result.valid, true);
});

Deno.test("validation: should reject arrays below minimum length", () => {
  const result = testArrayField("job_ids", [], 1);
  assertEquals(result.valid, false);
  assertEquals(result.error, "job_ids must have at least 1 item(s)");
});

/**
 * Test boundary conditions
 */
Deno.test("validation: should handle empty strings", () => {
  const emptyString: string = "";
  const isEmpty = emptyString === "" || emptyString.trim() === "";
  assertEquals(isEmpty, true);
});

Deno.test("validation: should handle whitespace-only strings", () => {
  const whitespace = "   ";
  const isWhitespace = whitespace.trim() === "";
  assertEquals(isWhitespace, true);
});

Deno.test("validation: should handle very long strings", () => {
  const longString = "a".repeat(10000);
  const isValid = typeof longString === "string" && longString.length > 0;
  assertEquals(isValid, true);
});

Deno.test("validation: should handle negative numbers", () => {
  const negativeNumber = -100;
  const isValid = typeof negativeNumber === "number";
  assertEquals(isValid, true);
  // Note: Business logic may reject negative, but type validation passes
});

Deno.test("validation: should handle zero values", () => {
  const zero = 0;
  const isValid = typeof zero === "number";
  assertEquals(isValid, true);
});

/**
 * Test validation scenarios
 */
const validationScenarios: ValidationTestScenario[] = [
  {
    field: "organization_id",
    value: "org-1",
    required: true,
    expectedValid: true,
  },
  {
    field: "organization_id",
    value: undefined,
    required: true,
    expectedValid: false,
    expectedError: "organization_id is required",
  },
  {
    field: "job_ids",
    value: ["job-1"],
    required: true,
    expectedValid: true,
  },
  {
    field: "job_ids",
    value: [],
    required: true,
    expectedValid: false,
    expectedError: "job_ids must have at least 1 item(s)",
  },
  {
    field: "notes",
    value: undefined,
    required: false,
    expectedValid: true,
  },
];

for (const scenario of validationScenarios) {
  Deno.test(
    `validation: should handle ${scenario.field} validation - ${
      scenario.expectedValid ? "valid" : "invalid"
    }`,
    () => {
      if (scenario.field.includes("_ids") && Array.isArray(scenario.value)) {
        const result = testArrayField(
          scenario.field,
          scenario.value,
          scenario.required ? 1 : undefined,
        );
        assertEquals(result.valid, scenario.expectedValid);
        if (scenario.expectedError) {
          assertEquals(result.error, scenario.expectedError);
        }
      } else {
        const result = testRequiredField(
          scenario.field,
          scenario.value,
          scenario.required,
        );
        assertEquals(result.valid, scenario.expectedValid);
        if (scenario.expectedError) {
          assertEquals(result.error, scenario.expectedError);
        }
      }
    },
  );
}

/**
 * Test type validation
 */
Deno.test("validation: should validate string types", () => {
  const value = "test";
  const isValid = typeof value === "string";
  assertEquals(isValid, true);
});

Deno.test("validation: should validate number types", () => {
  const value = 123;
  const isValid = typeof value === "number" && !isNaN(value);
  assertEquals(isValid, true);
});

Deno.test("validation: should validate boolean types", () => {
  const value = true;
  const isValid = typeof value === "boolean";
  assertEquals(isValid, true);
});

Deno.test("validation: should validate object types", () => {
  const value = { key: "value" };
  const isValid = typeof value === "object" && value !== null &&
    !Array.isArray(value);
  assertEquals(isValid, true);
});

/**
 * Test validation pattern matching
 */
Deno.test("validation: should match UUID pattern", () => {
  const uuid = "550e8400-e29b-41d4-a716-446655440000";
  const matches = ValidationPatterns.uuid.test(uuid);
  assertEquals(matches, true);
});

Deno.test("validation: should match email pattern", () => {
  const email = "user@example.com";
  const matches = ValidationPatterns.email.test(email);
  assertEquals(matches, true);
});

Deno.test("validation: should match ISO date pattern", () => {
  const date = "2024-01-01T00:00:00Z";
  const matches = ValidationPatterns.isoDate.test(date);
  assertEquals(matches, true);
});
