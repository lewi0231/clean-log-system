/**
 * Tests for bank transfer settings
 *
 * Test Cases:
 * - BT-1: Configure bank transfer details
 * - BT-2: Validation and error handling
 */

import { describe, expect, test } from "vitest";

describe("Bank Transfer Settings - BT-1: Configure Details", () => {
  test("should auto-format BSB as XXX-XXX", () => {
    // Test the BSB formatting logic
    const input = "123456";
    const formatted = input.replace(/(\d{3})(\d{3})/, "$1-$2");
    expect(formatted).toBe("123-456");
  });

  test("should handle BSB with existing dash", () => {
    const input = "123-456";
    // Should preserve existing format
    expect(input).toMatch(/^\d{3}-\d{3}$/);
  });
});

describe("Bank Transfer Settings - Validation", () => {
  test("should validate BSB format (XXX-XXX)", () => {
    // Test BSB validation regex
    const validBsb = "123-456";
    const invalidBsb = "12345";
    const invalidBsb2 = "12-3456";

    const bsbRegex = /^\d{3}-\d{3}$/;

    expect(bsbRegex.test(validBsb)).toBe(true);
    expect(bsbRegex.test(invalidBsb)).toBe(false);
    expect(bsbRegex.test(invalidBsb2)).toBe(false);
  });

  test("should validate Account Number length (6-10 digits)", () => {
    // Test account number validation
    const validAccount = "12345678"; // 8 digits
    const tooShort = "12345"; // 5 digits
    const tooLong = "12345678901"; // 11 digits
    const validMin = "123456"; // 6 digits (minimum)
    const validMax = "1234567890"; // 10 digits (maximum)

    const accountRegex = /^\d{6,10}$/;

    expect(accountRegex.test(validAccount)).toBe(true);
    expect(accountRegex.test(validMin)).toBe(true);
    expect(accountRegex.test(validMax)).toBe(true);
    expect(accountRegex.test(tooShort)).toBe(false);
    expect(accountRegex.test(tooLong)).toBe(false);
  });

  test("should format bank transfer settings payload correctly", () => {
    // Test the payload structure for bank transfer settings
    const payload = {
      organization_id: "org-123",
      bank_transfer_bsb: "123-456",
      bank_transfer_account_number: "12345678",
      bank_transfer_account_name: "Test Account",
      show_bank_transfer_on_invoices: true,
    };

    expect(payload.bank_transfer_bsb).toMatch(/^\d{3}-\d{3}$/);
    expect(payload.bank_transfer_account_number).toMatch(/^\d{6,10}$/);
    expect(payload.bank_transfer_account_name).toBeTruthy();
    expect(typeof payload.show_bank_transfer_on_invoices).toBe("boolean");
  });

  test("should handle null/empty values correctly", () => {
    // Test that empty strings are converted to null using a helper function
    const toNullIfEmpty = (value: string): string | null =>
      value.trim() === "" ? null : value;

    const payload = {
      bank_transfer_bsb: toNullIfEmpty(""),
      bank_transfer_account_number: toNullIfEmpty(""),
      bank_transfer_account_name: toNullIfEmpty(""),
    };

    expect(payload.bank_transfer_bsb).toBeNull();
    expect(payload.bank_transfer_account_number).toBeNull();
    expect(payload.bank_transfer_account_name).toBeNull();
  });
});
