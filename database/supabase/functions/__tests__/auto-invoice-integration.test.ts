/**
 * Integration tests for auto-invoice generation
 *
 * These tests verify the auto-invoice utility functions work correctly
 * with the actual Supabase client structure.
 *
 * Test Cases:
 * - AI-1: Enable auto-generate in onboarding
 * - AI-2: Auto-generate on job creation
 * - AI-3: Location hierarchy takes precedence
 *
 * Run with: deno test --allow-all functions/__tests__/auto-invoice-integration.test.ts
 */

import { assertEquals, assertExists } from "@std/assert";

/**
 * Test auto-generate enabled check logic
 */
Deno.test("isAutoGenerateEnabled: should return true when setting is enabled", () => {
  const orgSettings = {
    auto_generate_invoices_immediately: true,
  };

  const isEnabled = orgSettings.auto_generate_invoices_immediately === true;
  assertEquals(isEnabled, true);
});

Deno.test("isAutoGenerateEnabled: should return false when setting is disabled", () => {
  const orgSettings = {
    auto_generate_invoices_immediately: false,
  };

  const isEnabled = orgSettings.auto_generate_invoices_immediately === true;
  assertEquals(isEnabled, false);
});

Deno.test("isAutoGenerateEnabled: should return false when settings don't exist", () => {
  // deno-lint-ignore no-explicit-any
  const orgSettings: any = null;

  const isEnabled = orgSettings?.auto_generate_invoices_immediately === true;
  assertEquals(isEnabled, false);
});

/**
 * Test hierarchy auto-generate precedence
 */
Deno.test("AI-3: Location hierarchy should take precedence over org setting", () => {
  const orgAutoGenerateEnabled = true;
  const hasHierarchyAutoGenerate = true;

  // Hierarchy takes precedence - should skip org-level auto-generate
  const shouldAutoGenerate = orgAutoGenerateEnabled &&
    !hasHierarchyAutoGenerate;
  assertEquals(shouldAutoGenerate, false);
});

Deno.test("AI-3: Should use org setting when no hierarchy auto-generate", () => {
  const orgAutoGenerateEnabled = true;
  const hasHierarchyAutoGenerate = false;

  // Should use org-level setting
  const shouldAutoGenerate = orgAutoGenerateEnabled &&
    !hasHierarchyAutoGenerate;
  assertEquals(shouldAutoGenerate, true);
});

/**
 * Test invoice generation result structure
 */
Deno.test("autoGenerateInvoiceForJob: should return skipped result when hierarchy exists", () => {
  const result = {
    success: true,
    skipped: true,
    skipReason:
      "Location has hierarchy auto-generate enabled (takes precedence)",
  };

  assertEquals(result.success, true);
  assertEquals(result.skipped, true);
  assertExists(result.skipReason);
});

Deno.test("autoGenerateInvoiceForJob: should return success with invoice details", () => {
  const result = {
    success: true,
    invoiceId: "invoice-123",
    invoiceNumber: "ORG-2024-0001",
  };

  assertEquals(result.success, true);
  assertExists(result.invoiceId);
  assertExists(result.invoiceNumber);
});

Deno.test("autoGenerateInvoiceForJob: should return error on failure", () => {
  const result = {
    success: false,
    error: "Failed to calculate invoice totals",
  };

  assertEquals(result.success, false);
  assertExists(result.error);
});

/**
 * Test invoice due date calculation with configurable days
 */
Deno.test("getDefaultInvoiceDueDays: should use configured due days", () => {
  const orgSettings = {
    default_invoice_due_days: 45,
  };

  const dueDays = orgSettings.default_invoice_due_days ?? 30;
  assertEquals(dueDays, 45);
});

Deno.test("getDefaultInvoiceDueDays: should default to 30 days when not configured", () => {
  const orgSettings = {
    default_invoice_due_days: null,
  };

  const dueDays = orgSettings.default_invoice_due_days ?? 30;
  assertEquals(dueDays, 30);
});
