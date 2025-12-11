import {
    formatCurrency,
    formatPaymentDate,
} from "@/components/invoicing/payment-utils";
import { describe, expect, it } from "vitest";

describe("payment-utils", () => {
    describe("formatCurrency", () => {
        it("should format AUD currency correctly", () => {
            expect(formatCurrency(1000.0, "AUD")).toBe("A$1,000.00");
            expect(formatCurrency(1234.56, "AUD")).toBe("A$1,234.56");
            expect(formatCurrency(0, "AUD")).toBe("A$0.00");
        });

        it("should format USD currency correctly", () => {
            expect(formatCurrency(1000.0, "USD")).toBe("$1,000.00");
            expect(formatCurrency(99.99, "USD")).toBe("$99.99");
        });

        it("should format GBP currency correctly", () => {
            expect(formatCurrency(1000.0, "GBP")).toBe("£1,000.00");
        });

        it("should format EUR currency correctly", () => {
            expect(formatCurrency(1000.0, "EUR")).toBe("1.000,00 €");
        });

        it("should handle NaN values", () => {
            expect(formatCurrency(NaN, "AUD")).toBe("A$0.00");
        });

        it("should handle negative amounts", () => {
            expect(formatCurrency(-100.0, "AUD")).toBe("-A$100.00");
        });

        it("should default to AUD locale for unknown currencies", () => {
            expect(formatCurrency(1000.0, "XYZ")).toBe("A$1,000.00");
        });

        it("should handle large amounts", () => {
            expect(formatCurrency(1000000.0, "AUD")).toBe("A$1,000,000.00");
        });

        it("should handle small amounts", () => {
            expect(formatCurrency(0.01, "AUD")).toBe("A$0.01");
        });
    });

    describe("formatPaymentDate", () => {
        it("should format valid ISO date string", () => {
            const date = "2025-01-15T10:30:00Z";
            const formatted = formatPaymentDate(date);
            expect(formatted).toContain("2025");
            expect(formatted).toContain("Jan");
            expect(formatted).toContain("15");
        });

        it("should return '-' for null input", () => {
            expect(formatPaymentDate(null)).toBe("-");
        });

        it("should return '-' for empty string", () => {
            expect(formatPaymentDate("")).toBe("-");
        });

        it("should handle invalid date strings gracefully", () => {
            const invalid = "not-a-date";
            // Should return the original string if parsing fails
            expect(formatPaymentDate(invalid)).toBe(invalid);
        });

        it("should format dates with time component", () => {
            const date = "2025-01-15T14:30:00Z";
            const formatted = formatPaymentDate(date);
            expect(formatted).toMatch(/\d{1,2}:\d{2}/); // Contains time
        });
    });
});
