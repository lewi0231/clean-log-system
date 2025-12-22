/**
 * Shared test utilities for Edge Function tests
 *
 * Provides common helpers for testing error handling, authorization, and validation
 */

import { assertEquals, assertExists } from "@std/assert";

/**
 * Test error response structure
 */
export interface ErrorResponse {
  error: string;
}

/**
 * Test success response structure
 */
export interface SuccessResponse<T = unknown> {
  success: boolean;
  data?: T;
}

/**
 * Assert that an error response has the correct structure and status code
 */
export function assertErrorResponse(
  response: Response | { error: string },
  expectedStatus?: number,
  expectedMessage?: string,
): void {
  if (response instanceof Response) {
    if (expectedStatus) {
      assertEquals(response.status, expectedStatus);
    }
    // Note: In unit tests, we can't easily parse Response body
    // This is mainly for structure validation
  } else {
    assertExists(response.error, "Error response should have error field");
    if (expectedMessage) {
      assertEquals(response.error, expectedMessage);
    }
  }
}

/**
 * Assert that a success response has the correct structure
 */
export function assertSuccessResponse<T>(
  response: SuccessResponse<T>,
  dataValidator?: (data: T) => void,
): void {
  assertEquals(response.success, true, "Response should indicate success");
  if (dataValidator && response.data) {
    dataValidator(response.data);
  }
}

/**
 * Test authorization scenarios
 */
export interface AuthTestScenario {
  hasToken: boolean;
  tokenValid: boolean;
  userEmail?: string;
  userRole?: "admin" | "viewer";
  organizationId?: string;
  expectedStatus: number;
  expectedMessage?: string;
}

/**
 * Test validation scenarios
 */
export interface ValidationTestScenario {
  field: string;
  value: unknown;
  required: boolean;
  expectedValid: boolean;
  expectedError?: string;
}

/**
 * Test error handling scenarios
 */
export interface ErrorHandlingScenario {
  errorType:
    | "network"
    | "database"
    | "validation"
    | "authorization"
    | "not_found";
  errorMessage: string;
  expectedStatus: number;
  expectedMessage?: string;
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  isoDate: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
} as const;

/**
 * Validate UUID format
 */
export function isValidUuid(value: unknown): boolean {
  return typeof value === "string" && ValidationPatterns.uuid.test(value);
}

/**
 * Validate email format
 */
export function isValidEmail(value: unknown): boolean {
  return typeof value === "string" && ValidationPatterns.email.test(value);
}

/**
 * Validate ISO date format
 */
export function isValidIsoDate(value: unknown): boolean {
  return typeof value === "string" && ValidationPatterns.isoDate.test(value);
}

/**
 * Test required field validation
 */
export function testRequiredField(
  fieldName: string,
  value: unknown,
  required: boolean,
): { valid: boolean; error?: string } {
  if (required) {
    if (value === undefined || value === null || value === "") {
      return {
        valid: false,
        error: `${fieldName} is required`,
      };
    }
  }
  return { valid: true };
}

/**
 * Test array validation
 */
export function testArrayField(
  fieldName: string,
  value: unknown,
  minLength?: number,
): { valid: boolean; error?: string } {
  if (!Array.isArray(value)) {
    return {
      valid: false,
      error: `${fieldName} must be an array`,
    };
  }
  if (minLength !== undefined && value.length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must have at least ${minLength} item(s)`,
    };
  }
  return { valid: true };
}

/**
 * Test organization membership validation logic
 */
export function testOrganizationMembership(
  userOrganizationId: string,
  requestedOrganizationId: string,
): { valid: boolean; error?: string } {
  if (userOrganizationId !== requestedOrganizationId) {
    return {
      valid: false,
      error: "You do not have permission to access this organization",
    };
  }
  return { valid: true };
}

/**
 * Test admin role validation
 */
export function testAdminRole(
  role: string,
): { valid: boolean; error?: string } {
  if (role !== "admin") {
    return {
      valid: false,
      error: "Admin role required",
    };
  }
  return { valid: true };
}

/**
 * Simulate error status code mapping
 * Note: Order matters - check more specific errors first
 */
export function mapErrorToStatusCode(errorMessage: string): number {
  const message = errorMessage.toLowerCase();
  if (
    message.includes("authentication") ||
    message.includes("user not found") ||
    message.includes("unauthorized")
  ) {
    return 401;
  }
  if (message.includes("not found") || message.includes("does not exist")) {
    return 404;
  }
  // Check permission/forbidden BEFORE required (since "forbidden: admin role required" contains "required")
  if (
    message.includes("permission") ||
    message.includes("forbidden") ||
    message.includes("does not match")
  ) {
    return 403;
  }
  if (
    message.includes("required") ||
    message.includes("invalid") ||
    message.includes("missing")
  ) {
    return 400;
  }
  if (message.includes("conflict") || message.includes("already exists")) {
    return 409;
  }
  return 500;
}
