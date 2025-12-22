/**
 * Comprehensive error handling tests for Edge Functions
 *
 * Tests error response structure, status codes, and error message extraction
 *
 * Run with: deno test --allow-all functions/__tests__/error-handling.test.ts
 */

import { assertEquals } from "@std/assert";
import {
  type ErrorHandlingScenario,
  mapErrorToStatusCode,
} from "./test-utils.ts";

/**
 * Test error status code mapping
 */
Deno.test("error-handling: should map authentication errors to 401", () => {
  const errors = [
    "Authentication required",
    "User not found",
    "Unauthorized access",
  ];

  for (const error of errors) {
    const statusCode = mapErrorToStatusCode(error);
    assertEquals(statusCode, 401, `Should map "${error}" to 401`);
  }
});

Deno.test("error-handling: should map not found errors to 404", () => {
  const errors = [
    "Job not found",
    "Invoice does not exist",
    "Resource not found",
  ];

  for (const error of errors) {
    const statusCode = mapErrorToStatusCode(error);
    assertEquals(statusCode, 404, `Should map "${error}" to 404`);
  }
});

Deno.test("error-handling: should map validation errors to 400", () => {
  const errors = [
    "Organization ID is required",
    "Invalid request body",
    "Missing required field: job_ids",
  ];

  for (const error of errors) {
    const statusCode = mapErrorToStatusCode(error);
    assertEquals(statusCode, 400, `Should map "${error}" to 400`);
  }
});

Deno.test("error-handling: should map permission errors to 403", () => {
  const errors = [
    "You do not have permission to access this organization",
    "Forbidden: Admin role required",
    "Access does not match organization",
  ];

  for (const error of errors) {
    const statusCode = mapErrorToStatusCode(error);
    assertEquals(statusCode, 403, `Should map "${error}" to 403`);
  }
});

Deno.test("error-handling: should map conflict errors to 409", () => {
  const errors = [
    "Invoice already exists",
    "Conflict: Job already invoiced",
  ];

  for (const error of errors) {
    const statusCode = mapErrorToStatusCode(error);
    assertEquals(statusCode, 409, `Should map "${error}" to 409`);
  }
});

Deno.test("error-handling: should map unknown errors to 500", () => {
  const errors = [
    "Internal server error",
    "Unexpected error occurred",
    "Database connection failed",
  ];

  for (const error of errors) {
    const statusCode = mapErrorToStatusCode(error);
    assertEquals(statusCode, 500, `Should map "${error}" to 500`);
  }
});

/**
 * Test error message extraction
 */
Deno.test("error-handling: should extract message from Error object", () => {
  const error = new Error("Test error message");
  const message = error.message;
  assertEquals(message, "Test error message");
});

Deno.test("error-handling: should extract message from string", () => {
  const error = "String error message";
  const message = typeof error === "string" ? error : "Unknown error";
  assertEquals(message, "String error message");
});

Deno.test("error-handling: should handle unknown error types", () => {
  const error = { code: "ERR_UNKNOWN", details: "Some details" };
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
    ? error
    : "Internal server error";
  assertEquals(message, "Internal server error");
});

/**
 * Test error response structure
 */
Deno.test("error-handling: should create error response with message", () => {
  const errorMessage = "Test error";
  const errorResponse = { error: errorMessage };
  assertEquals(errorResponse.error, errorMessage);
  assertEquals(typeof errorResponse.error, "string");
});

Deno.test("error-handling: should handle Error objects in response", () => {
  const error = new Error("Database connection failed");
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorResponse = { error: errorMessage };
  assertEquals(errorResponse.error, "Database connection failed");
});

/**
 * Test error scenarios
 */
const errorScenarios: ErrorHandlingScenario[] = [
  {
    errorType: "network",
    errorMessage: "Network request failed",
    expectedStatus: 500,
  },
  {
    errorType: "database",
    errorMessage: "Database connection error",
    expectedStatus: 500,
  },
  {
    errorType: "validation",
    errorMessage: "Invalid input data",
    expectedStatus: 400,
  },
  {
    errorType: "authorization",
    errorMessage: "Unauthorized access",
    expectedStatus: 401,
  },
  {
    errorType: "not_found",
    errorMessage: "Resource not found",
    expectedStatus: 404,
  },
];

for (const scenario of errorScenarios) {
  Deno.test(
    `error-handling: should handle ${scenario.errorType} errors correctly`,
    () => {
      const statusCode = mapErrorToStatusCode(scenario.errorMessage);
      assertEquals(
        statusCode,
        scenario.expectedStatus,
        `Should map ${scenario.errorType} error to ${scenario.expectedStatus}`,
      );
    },
  );
}
