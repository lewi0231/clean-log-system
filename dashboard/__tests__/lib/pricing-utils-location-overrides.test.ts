import { getLocationOverrides } from "@/lib/pricing-utils";
import type { FieldPricing, PricingRule } from "@/lib/types";
import { describe, expect, it } from "vitest";

/**
 * Test to verify that worker overrides are NOT displayed under customer context
 * and vice versa. This addresses the bug where worker overrides appear under customer.
 */
describe("getLocationOverrides - Context Separation", () => {
    const createMockPricing = (
        id: string,
        fieldConfigId: string,
        locationId: string,
        pricingContext: "customer" | "worker",
        customerPrice: number,
        workerPaymentValue: number | null = null,
    ): FieldPricing => {
        const now = new Date().toISOString();
        return {
            id,
            organization_id: "org-1",
            field_config_id: fieldConfigId,
            location_id: locationId,
            location_hierarchy_id: null,
            pricing_type: "unit",
            customer_price: customerPrice,
            currency: "USD",
            applies_to_field_type: null,
            worker_payment_type: pricingContext === "customer"
                ? "fixed_rate"
                : null,
            worker_payment_value: workerPaymentValue,
            source_rule: {
                id,
                organization_id: "org-1",
                scope: "field",
                pricing_type: "unit",
                pricing_context: pricingContext, // This is the key field
                field_config_id: fieldConfigId,
                option_value: null,
                applies_to_field_type: null,
                location_id: locationId,
                location_hierarchy_id: null,
                currency: "USD",
                base_price: customerPrice,
                percentage_rate: null,
                minimum_quantity: null,
                maximum_quantity: null,
                tier_definition: null,
                metadata: {},
                worker_payment_type: pricingContext === "customer"
                    ? "fixed_rate"
                    : null,
                worker_payment_value: workerPaymentValue,
                priority: 0,
                active: true,
                effective_at: now,
                expires_at: null,
                created_by: null,
                updated_by: null,
                created_at: now,
                updated_at: now,
                field_config: null,
                location: {
                    id: locationId,
                    name: `Location ${locationId}`,
                },
                location_node: null,
                conditions: [],
            } as PricingRule,
            field_config: null,
            location: {
                id: locationId,
                name: `Location ${locationId}`,
            },
            location_node: null,
        };
    };

    it("should NOT return worker overrides when filtering for customer context", () => {
        const customerPricing = createMockPricing(
            "customer-1",
            "field-1",
            "loc-1",
            "customer",
            100,
            50,
        );
        const workerPricing = createMockPricing(
            "worker-1",
            "field-1",
            "loc-2",
            "worker",
            200,
        );

        // Mix both customer and worker pricing in the same array
        const allPricing: FieldPricing[] = [customerPricing, workerPricing];

        // When filtering for customer context, should ONLY return customer pricing
        const customerOverrides = getLocationOverrides(
            allPricing,
            "field-1",
            null,
            null,
            "customer",
        );

        expect(customerOverrides).toHaveLength(1);
        expect(customerOverrides[0].id).toBe("customer-1");
        expect(customerOverrides[0].price).toBe(100);
        expect(customerOverrides[0].workerPayment).toBe(50);
    });

    it("should NOT return customer overrides when filtering for worker context", () => {
        const customerPricing = createMockPricing(
            "customer-1",
            "field-1",
            "loc-1",
            "customer",
            100,
            50,
        );
        const workerPricing = createMockPricing(
            "worker-1",
            "field-1",
            "loc-2",
            "worker",
            200,
        );

        // Mix both customer and worker pricing in the same array
        const allPricing: FieldPricing[] = [customerPricing, workerPricing];

        // When filtering for worker context, should ONLY return worker pricing
        const workerOverrides = getLocationOverrides(
            allPricing,
            "field-1",
            null,
            null,
            "worker",
        );

        expect(workerOverrides).toHaveLength(1);
        expect(workerOverrides[0].id).toBe("worker-1");
        expect(workerOverrides[0].price).toBe(200);
        expect(workerOverrides[0].workerPayment).toBeNull();
        expect(workerOverrides[0].pricingContext).toBe("worker");
    });

    it("should correctly separate customer and worker overrides when both exist", () => {
        const customerPricing1 = createMockPricing(
            "customer-1",
            "field-1",
            "loc-1",
            "customer",
            100,
            50,
        );
        const customerPricing2 = createMockPricing(
            "customer-2",
            "field-1",
            "loc-3",
            "customer",
            150,
            75,
        );
        const workerPricing1 = createMockPricing(
            "worker-1",
            "field-1",
            "loc-2",
            "worker",
            200,
        );
        const workerPricing2 = createMockPricing(
            "worker-2",
            "field-1",
            "loc-4",
            "worker",
            250,
        );

        // Mix all pricing together
        const allPricing: FieldPricing[] = [
            customerPricing1,
            customerPricing2,
            workerPricing1,
            workerPricing2,
        ];

        const customerOverrides = getLocationOverrides(
            allPricing,
            "field-1",
            null,
            null,
            "customer",
        );

        const workerOverrides = getLocationOverrides(
            allPricing,
            "field-1",
            null,
            null,
            "worker",
        );

        // Customer overrides should only contain customer context rules
        expect(customerOverrides).toHaveLength(2);
        expect(customerOverrides.map((o) => o.id)).toEqual([
            "customer-1",
            "customer-2",
        ]);
        expect(customerOverrides.every((o) => o.workerPayment !== null)).toBe(
            true,
        );
        // Verify all customer overrides have customer context
        expect(
            customerOverrides.every((o) => o.pricingContext === "customer"),
        ).toBe(true);

        // Worker overrides should only contain worker context rules
        expect(workerOverrides).toHaveLength(2);
        expect(workerOverrides.map((o) => o.id)).toEqual([
            "worker-1",
            "worker-2",
        ]);
        expect(workerOverrides.every((o) => o.workerPayment === null)).toBe(
            true,
        );
        // Verify all worker overrides have worker context
        expect(workerOverrides.every((o) => o.pricingContext === "worker"))
            .toBe(
                true,
            );
    });

    it("should default missing pricing_context to customer for backward compatibility", () => {
        const pricingWithoutContext = createMockPricing(
            "no-context-1",
            "field-1",
            "loc-1",
            "customer",
            100,
        );
        // Remove pricing_context to simulate old data
        delete (pricingWithoutContext.source_rule as Partial<PricingRule>)
            .pricing_context;

        const allPricing: FieldPricing[] = [pricingWithoutContext];

        // Should include pricing without context when filtering for customer (defaults to customer)
        const customerOverrides = getLocationOverrides(
            allPricing,
            "field-1",
            null,
            null,
            "customer",
        );

        // Pricing without context defaults to "customer" for backward compatibility
        expect(customerOverrides).toHaveLength(1);
        expect(customerOverrides[0].id).toBe("no-context-1");

        // Should NOT include pricing without context when filtering for worker
        const workerOverrides = getLocationOverrides(
            allPricing,
            "field-1",
            null,
            null,
            "worker",
        );

        // Pricing without context should be excluded from worker overrides
        expect(workerOverrides).toHaveLength(0);
    });
});
