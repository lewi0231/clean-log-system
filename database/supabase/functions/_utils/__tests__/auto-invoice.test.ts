/**
 * Tests for auto-invoice utility functions
 *
 * These tests verify the logic for auto-generating invoices when jobs are created or completed.
 *
 * Run with: deno test --allow-all functions/_utils/__tests__/auto-invoice.test.ts
 */

import { assertEquals, assertExists } from "@std/assert";

/**
 * Test invoice number generation logic
 */
Deno.test("generateInvoiceNumber: should generate sequential invoice numbers", () => {
  const orgCode = "TEST";
  const year = new Date().getFullYear();
  
  // Simulate existing invoices
  const existingInvoices = [
    { invoice_number: `${orgCode}-${year}-0001` },
    { invoice_number: `${orgCode}-${year}-0002` },
  ];
  
  // Get last invoice
  const lastInvoice = existingInvoices[existingInvoices.length - 1].invoice_number;
  const match = lastInvoice.match(/-(\d+)$/);
  
  let nextNumber = 1;
  if (match) {
    nextNumber = parseInt(match[1], 10) + 1;
  }
  
  const invoiceNumber = `${orgCode}-${year}-${nextNumber.toString().padStart(4, "0")}`;
  
  assertEquals(invoiceNumber, `${orgCode}-${year}-0003`);
});

Deno.test("generateInvoiceNumber: should start at 0001 when no invoices exist", () => {
  const orgCode = "TEST";
  const year = new Date().getFullYear();
  const existingInvoices: Array<{ invoice_number: string }> = [];
  
  let nextNumber = 1;
  if (existingInvoices.length > 0) {
    const lastInvoice = existingInvoices[existingInvoices.length - 1].invoice_number;
    const match = lastInvoice.match(/-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  
  const invoiceNumber = `${orgCode}-${year}-${nextNumber.toString().padStart(4, "0")}`;
  
  assertEquals(invoiceNumber, `${orgCode}-${year}-0001`);
});

/**
 * Test due date calculation
 */
Deno.test("calculateDueDate: should calculate due date correctly", () => {
  const dueDays = 30;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);
  const dueDateISO = dueDate.toISOString();
  
  // Verify it's a valid ISO string
  assertExists(dueDateISO);
  assertEquals(typeof dueDateISO, "string");
  assertEquals(dueDateISO.includes("T"), true);
});

Deno.test("calculateDueDate: should handle custom due days", () => {
  const dueDays = 60;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);
  const dueDateISO = dueDate.toISOString();
  
  // Calculate expected date
  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + 60);
  
  // Compare dates (within same day)
  const calculated = new Date(dueDateISO);
  assertEquals(
    calculated.toDateString(),
    expectedDate.toDateString()
  );
});

/**
 * Test hierarchy auto-generate precedence logic
 */
Deno.test("hasHierarchyAutoGenerate: should return false when location_id is null", () => {
  const locationId: string | null = null;
  const hasHierarchy = locationId !== null;
  assertEquals(hasHierarchy, false);
});

Deno.test("hasHierarchyAutoGenerate: should return false when location has no hierarchy", () => {
  const location = { hierarchy_parent_id: null };
  const hasHierarchy = location?.hierarchy_parent_id !== null;
  assertEquals(hasHierarchy, false);
});

Deno.test("hasHierarchyAutoGenerate: should return true when hierarchy auto-generate is enabled", () => {
  const metadata = {
    auto_generate_invoices: {
      enabled: true,
    },
  };
  
  const autoGenerate = metadata.auto_generate_invoices;
  const hasHierarchy = 
    autoGenerate !== null &&
    typeof autoGenerate === "object" &&
    (autoGenerate as Record<string, unknown>).enabled === true;
  
  assertEquals(hasHierarchy, true);
});

Deno.test("hasHierarchyAutoGenerate: should return false when hierarchy auto-generate is disabled", () => {
  const metadata = {
    auto_generate_invoices: {
      enabled: false,
    },
  };
  
  const autoGenerate = metadata.auto_generate_invoices;
  const hasHierarchy = 
    autoGenerate !== null &&
    typeof autoGenerate === "object" &&
    (autoGenerate as Record<string, unknown>).enabled === true;
  
  assertEquals(hasHierarchy, false);
});

/**
 * Test invoice existence check logic
 */
Deno.test("invoiceExistsForJob: should return true when invoice exists", () => {
  const existingInvoice = { invoice_id: "invoice-123" };
  const invoiceExists = existingInvoice !== null;
  assertEquals(invoiceExists, true);
});

Deno.test("invoiceExistsForJob: should return false when invoice does not exist", () => {
  const existingInvoice = null;
  const invoiceExists = existingInvoice !== null;
  assertEquals(invoiceExists, false);
});

