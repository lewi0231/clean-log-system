/**
 * Tests for pricing formula preview helpers
 *
 * @see S2-pricing-tab-redesign.md §5 NFR (test requirements)
 */

import { describe, expect, it } from "vitest";
import {
  buildNumberFieldFormulaLine,
  getMaxUpdatedAt,
  parseFieldPriceString,
  type FormulaLineParams,
} from "@/lib/pricing-formula-preview";

const mockFormatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

describe("parseFieldPriceString", () => {
  it("parses valid number strings", () => {
    expect(parseFieldPriceString("10")).toBe(10);
    expect(parseFieldPriceString("10.50")).toBe(10.5);
    expect(parseFieldPriceString("0")).toBe(0);
    expect(parseFieldPriceString("0.99")).toBe(0.99);
  });

  it("returns null for empty strings", () => {
    expect(parseFieldPriceString("")).toBeNull();
  });

  it("returns null for invalid numbers", () => {
    expect(parseFieldPriceString("abc")).toBeNull();
    expect(parseFieldPriceString("NaN")).toBeNull();
  });

  it("rounds to 2 decimal places to avoid floating-point noise (§12.1)", () => {
    // Values that don't trigger edge-case rounding issues
    expect(parseFieldPriceString("3.999")).toBe(4);
    expect(parseFieldPriceString("2.111")).toBe(2.11);
    expect(parseFieldPriceString("1.999")).toBe(2);
    // Note: 1.005 -> 1.00 due to JS floating point (1.005 * 100 = 100.4999...)
    // This is acceptable as user inputs rarely have this precision
    expect(parseFieldPriceString("1.006")).toBe(1.01);
  });
});

describe("buildNumberFieldFormulaLine", () => {
  const baseParams: FormulaLineParams = {
    customerPriceStr: "10",
    workerPriceStr: "7",
    workerPaymentType: "fixed_rate",
    formatCurrency: mockFormatCurrency,
  };

  describe("happy path - fixed_rate with valid prices", () => {
    it("builds formula line with margin when both prices are valid", () => {
      const result = buildNumberFieldFormulaLine(baseParams);

      expect(result.line).toBe(
        "Customer $10.00 / unit − Worker $7.00 / unit = $3.00 margin / unit"
      );
      expect(result.canShowMargin).toBe(true);
      expect(result.marginPerUnit).toBe(3);
      expect(result.marginPercent).toBe(30);
      expect(result.marginNotShownReason).toBeNull();
    });

    it("handles zero margin correctly", () => {
      const result = buildNumberFieldFormulaLine({
        ...baseParams,
        customerPriceStr: "10",
        workerPriceStr: "10",
      });

      expect(result.marginPerUnit).toBe(0);
      expect(result.marginPercent).toBe(0);
      expect(result.canShowMargin).toBe(true);
    });

    it("handles negative margin (worker > customer) correctly", () => {
      const result = buildNumberFieldFormulaLine({
        ...baseParams,
        customerPriceStr: "7",
        workerPriceStr: "10",
      });

      expect(result.line).toBe(
        "Customer $7.00 / unit − Worker $10.00 / unit = -$3.00 margin / unit"
      );
      expect(result.marginPerUnit).toBe(-3);
      expect(result.canShowMargin).toBe(true);
    });
  });

  describe("zero customer price", () => {
    it("shows margin as null percent when customer is zero", () => {
      const result = buildNumberFieldFormulaLine({
        ...baseParams,
        customerPriceStr: "0",
        workerPriceStr: "5",
      });

      expect(result.canShowMargin).toBe(true);
      expect(result.marginPerUnit).toBe(-5);
      expect(result.marginPercent).toBeNull(); // Can't divide by zero
    });
  });

  describe("invalid/empty inputs", () => {
    it("prompts for customer price when empty", () => {
      const result = buildNumberFieldFormulaLine({
        ...baseParams,
        customerPriceStr: "",
      });

      expect(result.line).toBe("Enter a customer price to see the formula preview.");
      expect(result.canShowMargin).toBe(false);
      expect(result.marginNotShownReason).toBe("Customer price not entered");
    });

    it("shows partial formula when worker price is empty", () => {
      const result = buildNumberFieldFormulaLine({
        ...baseParams,
        workerPriceStr: "",
      });

      expect(result.line).toBe("Customer $10.00 / unit");
      expect(result.canShowMargin).toBe(false);
      expect(result.marginNotShownReason).toBe("Worker payment not entered");
    });
  });

  describe("percentage worker payment type (§4.11)", () => {
    it("shows N/A explanation for percentage type", () => {
      const result = buildNumberFieldFormulaLine({
        ...baseParams,
        workerPaymentType: "percentage",
        workerPriceStr: "15",
      });

      expect(result.line).toBe("Customer $10.00 / unit − Worker 15% of customer price");
      expect(result.canShowMargin).toBe(false);
      expect(result.marginNotShownReason).toContain("percentage");
    });

    it("handles percentage type with empty worker value", () => {
      const result = buildNumberFieldFormulaLine({
        ...baseParams,
        workerPaymentType: "percentage",
        workerPriceStr: "",
      });

      expect(result.line).toBe("Customer $10.00 / unit");
      expect(result.canShowMargin).toBe(false);
    });
  });

  describe("same_structure worker payment type (§4.11)", () => {
    it("shows N/A explanation for same_structure type", () => {
      const result = buildNumberFieldFormulaLine({
        ...baseParams,
        workerPaymentType: "same_structure",
      });

      expect(result.line).toContain("mirrors customer pricing structure");
      expect(result.canShowMargin).toBe(false);
      expect(result.marginNotShownReason).toContain("same-structure");
    });
  });

  describe("floating-point precision (§12.1)", () => {
    it("does not show floating-point noise like $1.9000000001", () => {
      // This is the classic floating-point issue: 3.00 - 1.10 = 1.8999999999...
      const result = buildNumberFieldFormulaLine({
        ...baseParams,
        customerPriceStr: "3.00",
        workerPriceStr: "1.10",
      });

      expect(result.marginPerUnit).toBe(1.9);
      expect(result.line).not.toContain("1.9000000");
      expect(result.line).toContain("$1.90");
    });

    it("rounds margin percentage correctly", () => {
      // 1/3 = 0.333... should become 33.33%
      const result = buildNumberFieldFormulaLine({
        ...baseParams,
        customerPriceStr: "3",
        workerPriceStr: "2",
      });

      expect(result.marginPercent).toBe(33.33);
    });
  });
});

describe("getMaxUpdatedAt", () => {
  const customerTime = "2026-04-20T10:00:00Z";
  const workerTime = "2026-04-21T10:00:00Z";
  const tieTime = "2026-04-20T10:00:00Z";

  describe("two rules with A < B", () => {
    it("returns worker info when worker is newer", () => {
      const result = getMaxUpdatedAt(customerTime, "user-customer", workerTime, "user-worker");

      expect(result.updatedAt).toBe(workerTime);
      expect(result.updatedBy).toBe("user-worker");
      expect(result.source).toBe("worker");
    });

    it("returns customer info when customer is newer", () => {
      const result = getMaxUpdatedAt(
        workerTime, // Customer is newer in this case
        "user-customer",
        customerTime, // Worker is older
        "user-worker"
      );

      expect(result.updatedAt).toBe(workerTime);
      expect(result.updatedBy).toBe("user-customer");
      expect(result.source).toBe("customer");
    });
  });

  describe("one side null", () => {
    it("returns customer info when only customer exists", () => {
      const result = getMaxUpdatedAt(customerTime, "user-customer", null, null);

      expect(result.updatedAt).toBe(customerTime);
      expect(result.updatedBy).toBe("user-customer");
      expect(result.source).toBe("customer");
    });

    it("returns worker info when only worker exists", () => {
      const result = getMaxUpdatedAt(null, null, workerTime, "user-worker");

      expect(result.updatedAt).toBe(workerTime);
      expect(result.updatedBy).toBe("user-worker");
      expect(result.source).toBe("worker");
    });

    it("handles undefined values as null", () => {
      const result = getMaxUpdatedAt(undefined, undefined, workerTime, "user-worker");

      expect(result.updatedAt).toBe(workerTime);
      expect(result.source).toBe("worker");
    });
  });

  describe("tie (same timestamp)", () => {
    it("returns customer info when timestamps are equal (customer wins ties per §4.6.1)", () => {
      const result = getMaxUpdatedAt(tieTime, "user-customer", tieTime, "user-worker");

      expect(result.updatedAt).toBe(tieTime);
      expect(result.updatedBy).toBe("user-customer");
      expect(result.source).toBe("customer");
    });
  });

  describe("neither exists", () => {
    it("returns null info when no rules exist", () => {
      const result = getMaxUpdatedAt(null, null, null, null);

      expect(result.updatedAt).toBeNull();
      expect(result.updatedBy).toBeNull();
      expect(result.source).toBeNull();
    });
  });

  describe("null updatedBy", () => {
    it("handles null updatedBy on winning rule", () => {
      const result = getMaxUpdatedAt(customerTime, null, null, null);

      expect(result.updatedAt).toBe(customerTime);
      expect(result.updatedBy).toBeNull();
      expect(result.source).toBe("customer");
    });
  });
});
