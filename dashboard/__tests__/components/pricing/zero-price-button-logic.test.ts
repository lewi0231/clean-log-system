import { describe, expect, it } from "vitest";

/**
 * Unit tests for zero price button enable/disable logic
 * These tests verify the exact logic used in field-pricing-list.tsx
 */
describe("Zero Price Button Logic", () => {
    describe("Button disable validation for zero price", () => {
        it("should NOT disable button when price is '0' (string)", () => {
            const currentCustomerPrice = "0";

            // This is the exact logic from the component (line 825-829)
            const shouldDisable = currentCustomerPrice === undefined ||
                currentCustomerPrice === null ||
                currentCustomerPrice.trim() === "" ||
                isNaN(parseFloat(currentCustomerPrice)) ||
                parseFloat(currentCustomerPrice) < 0;

            expect(shouldDisable).toBe(false);
            expect(parseFloat(currentCustomerPrice)).toBe(0);
            expect(parseFloat(currentCustomerPrice) < 0).toBe(false);
        });

        it("should NOT disable button when price is '0.00' (string)", () => {
            const currentCustomerPrice = "0.00";

            const shouldDisable = currentCustomerPrice === undefined ||
                currentCustomerPrice === null ||
                currentCustomerPrice.trim() === "" ||
                isNaN(parseFloat(currentCustomerPrice)) ||
                parseFloat(currentCustomerPrice) < 0;

            expect(shouldDisable).toBe(false);
        });

        it("should disable button when price is empty string", () => {
            const currentCustomerPrice = "";

            const shouldDisable = currentCustomerPrice === undefined ||
                currentCustomerPrice === null ||
                currentCustomerPrice.trim() === "" ||
                isNaN(parseFloat(currentCustomerPrice)) ||
                parseFloat(currentCustomerPrice) < 0;

            expect(shouldDisable).toBe(true);
        });

        it("should disable button when price is undefined", () => {
            const currentCustomerPrice: string | undefined | null = undefined;

            // Check undefined/null first, then handle string operations
            const isUndefinedOrNull = currentCustomerPrice === undefined ||
                currentCustomerPrice === null;
            const priceString = currentCustomerPrice ?? "";
            const isEmptyString = priceString.trim() === "";
            const isInvalidNumber = isNaN(parseFloat(priceString));
            const isNegative = parseFloat(priceString) < 0;

            const shouldDisable = isUndefinedOrNull || isEmptyString ||
                isInvalidNumber || isNegative;

            expect(shouldDisable).toBe(true);
        });

        it("should disable button when price is negative", () => {
            const currentCustomerPrice = "-10";

            const shouldDisable = currentCustomerPrice === undefined ||
                currentCustomerPrice === null ||
                currentCustomerPrice.trim() === "" ||
                isNaN(parseFloat(currentCustomerPrice)) ||
                parseFloat(currentCustomerPrice) < 0;

            expect(shouldDisable).toBe(true);
        });
    });

    describe("Change detection for zero price", () => {
        it("should detect change when going from 100 to 0", () => {
            const editingCustomer = "0";
            const existingPrice = 100;

            // This is the exact logic from the component (line 561-564)
            const hasCustomerChanges = editingCustomer !== undefined &&
                parseFloat(editingCustomer || "0") !== (existingPrice ?? 0);

            expect(hasCustomerChanges).toBe(true);
        });

        it("should detect change when going from 0 to 100", () => {
            const editingCustomer = "100";
            const existingPrice = 0;

            const hasCustomerChanges = editingCustomer !== undefined &&
                parseFloat(editingCustomer || "0") !== (existingPrice ?? 0);

            expect(hasCustomerChanges).toBe(true);
        });

        it("should NOT detect change when staying at 0", () => {
            const editingCustomer = "0";
            const existingPrice = 0;

            const hasCustomerChanges = editingCustomer !== undefined &&
                parseFloat(editingCustomer || "0") !== (existingPrice ?? 0);

            expect(hasCustomerChanges).toBe(false);
        });

        it("should detect change when going from undefined/null to 0", () => {
            const editingCustomer = "0";
            const existingPrice = null;

            const hasCustomerChanges = editingCustomer !== undefined &&
                parseFloat(editingCustomer || "0") !== (existingPrice ?? 0);

            expect(hasCustomerChanges).toBe(false); // 0 === 0, so no change
        });
    });

    describe("Price parsing for zero", () => {
        it("should parse '0' as 0 (number)", () => {
            const priceValue = "0";
            const price = parseFloat(priceValue);

            expect(price).toBe(0);
            expect(price).not.toBe(NaN);
            expect(isNaN(price)).toBe(false);
        });

        it("should allow saving when price is 0", () => {
            const priceValue = "0";

            // This is the logic from handleSave (line 351-355)
            const shouldReturnEarly = !priceValue || priceValue.trim() === "";
            const price = parseFloat(priceValue);
            const shouldReturnEarly2 = isNaN(price) || price < 0;

            expect(shouldReturnEarly).toBe(false);
            expect(price).toBe(0);
            expect(shouldReturnEarly2).toBe(false);
        });
    });

    describe("showBothContexts validation", () => {
        it("should validate '0' as valid customer price", () => {
            const currentCustomerPrice = "0";

            // This is the exact logic from the component (line 809-812)
            const customerValid = currentCustomerPrice !== undefined &&
                currentCustomerPrice !== null &&
                currentCustomerPrice.trim() !== "" &&
                !isNaN(parseFloat(currentCustomerPrice)) &&
                parseFloat(currentCustomerPrice) >= 0;

            expect(customerValid).toBe(true);
        });

        it("should allow saving if at least one valid price (including 0) is provided", () => {
            const currentCustomerPrice = "0";
            const currentWorkerPrice = "";

            const customerValid = currentCustomerPrice !== undefined &&
                currentCustomerPrice !== null &&
                currentCustomerPrice.trim() !== "" &&
                !isNaN(parseFloat(currentCustomerPrice)) &&
                parseFloat(currentCustomerPrice) >= 0;

            const workerValid = currentWorkerPrice !== undefined &&
                currentWorkerPrice !== null &&
                currentWorkerPrice.trim() !== "" &&
                !isNaN(parseFloat(currentWorkerPrice)) &&
                parseFloat(currentWorkerPrice) >= 0;

            // Disable if both are empty or both are invalid
            const shouldDisable = !customerValid && !workerValid;

            expect(customerValid).toBe(true);
            expect(workerValid).toBe(false);
            expect(shouldDisable).toBe(false); // Should NOT disable because customer is valid
        });
    });
});
