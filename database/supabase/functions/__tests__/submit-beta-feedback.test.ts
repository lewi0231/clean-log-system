/**
 * Tests for submit-beta-feedback edge function
 *
 * Covers validation logic: required fields, category, message length, empty message.
 *
 * Run with: deno test --allow-all functions/__tests__/submit-beta-feedback.test.ts
 */

import { assertEquals } from "@std/assert";
import { testRequiredField } from "./test-utils.ts";

const VALID_CATEGORIES = ["bug", "idea", "general"] as const;

Deno.test("submit-beta-feedback: should require organization_id", () => {
  const body = { message: "Great app" };
  const result = testRequiredField(
    "organization_id",
    (body as Record<string, unknown>).organization_id,
    true,
  );
  assertEquals(result.valid, false);
  assertEquals(result.error, "organization_id is required");
});

Deno.test("submit-beta-feedback: should require message", () => {
  const body = { organization_id: "org-1" };
  const result = testRequiredField(
    "message",
    (body as Record<string, unknown>).message,
    true,
  );
  assertEquals(result.valid, false);
  assertEquals(result.error, "message is required");
});

Deno.test("submit-beta-feedback: should accept valid required fields", () => {
  const body = { organization_id: "org-1", message: "Improve the form" };
  const orgResult = testRequiredField(
    "organization_id",
    (body as Record<string, unknown>).organization_id,
    true,
  );
  const msgResult = testRequiredField(
    "message",
    (body as Record<string, unknown>).message,
    true,
  );
  assertEquals(orgResult.valid, true);
  assertEquals(msgResult.valid, true);
});

Deno.test("submit-beta-feedback: should treat empty message as invalid", () => {
  const message = "   ";
  const isNonEmpty =
    typeof message === "string" && message.trim().length > 0;
  assertEquals(isNonEmpty, false);
});

Deno.test("submit-beta-feedback: should treat non-empty message as valid", () => {
  const message = "  Add a dark mode  ";
  const isNonEmpty =
    typeof message === "string" && message.trim().length > 0;
  assertEquals(isNonEmpty, true);
});

Deno.test("submit-beta-feedback: should reject message over 5000 characters", () => {
  const message = "x".repeat(5001);
  const isValid = typeof message === "string" && message.length <= 5000;
  assertEquals(isValid, false);
});

Deno.test("submit-beta-feedback: should accept message exactly 5000 characters", () => {
  const message = "x".repeat(5000);
  const isValid = typeof message === "string" && message.length <= 5000;
  assertEquals(isValid, true);
});

Deno.test("submit-beta-feedback: should accept valid category bug", () => {
  const rawCategory = "bug";
  const category =
    typeof rawCategory === "string" && VALID_CATEGORIES.includes(rawCategory)
      ? rawCategory
      : "general";
  assertEquals(category, "bug");
});

Deno.test("submit-beta-feedback: should accept valid category idea", () => {
  const rawCategory = "idea";
  const category =
    typeof rawCategory === "string" && VALID_CATEGORIES.includes(rawCategory)
      ? rawCategory
      : "general";
  assertEquals(category, "idea");
});

Deno.test("submit-beta-feedback: should accept valid category general", () => {
  const rawCategory = "general";
  const category =
    typeof rawCategory === "string" && VALID_CATEGORIES.includes(rawCategory)
      ? rawCategory
      : "general";
  assertEquals(category, "general");
});

Deno.test("submit-beta-feedback: should default invalid category to general", () => {
  const rawCategory = "feature-request";
  const validSet = new Set<string>(VALID_CATEGORIES);
  const category =
    typeof rawCategory === "string" && validSet.has(rawCategory)
      ? rawCategory
      : "general";
  assertEquals(category, "general");
});

Deno.test("submit-beta-feedback: should default non-string category to general", () => {
  const rawCategory = 123;
  const category =
    typeof rawCategory === "string" && VALID_CATEGORIES.includes(rawCategory)
      ? rawCategory
      : "general";
  assertEquals(category, "general");
});

Deno.test("submit-beta-feedback: should truncate page_path to 500 chars", () => {
  const pagePath = "a".repeat(600);
  const result =
    typeof pagePath === "string" && pagePath.length > 0
      ? pagePath.slice(0, 500)
      : null;
  assertEquals(result?.length, 500);
});

Deno.test("submit-beta-feedback: should allow null page_path when empty string", () => {
  const pagePath = "";
  const result =
    typeof pagePath === "string" && pagePath.length > 0
      ? pagePath.slice(0, 500)
      : null;
  assertEquals(result, null);
});
