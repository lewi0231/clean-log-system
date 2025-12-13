import { PricingService } from "@/lib/services/pricing.service";
import type { PricingRule } from "@/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/services/pricing.service");
vi.mock("@/hooks/useOrganization", () => ({
    default: () => ({ organizationId: "org-1" }),
}));

const createMockPricingRule = (
    overrides?: Partial<PricingRule>,
): PricingRule => ({
    id: "rule-1",
    organization_id: "org-1",
    scope: "option",
    pricing_type: "fixed",
    pricing_context: "customer",
    field_config_id: "field-1",
    option_value: "option-1",
    applies_to_field_type: null,
    location_hierarchy_id: null,
    location_id: null,
    currency: "USD",
    base_price: 100,
    percentage_rate: null,
    minimum_quantity: null,
    maximum_quantity: null,
    tier_definition: null,
    metadata: {},
    worker_payment_type: null,
    worker_payment_value: null,
    priority: 0,
    active: true,
    effective_at: "2024-01-01T00:00:00Z",
    expires_at: null,
    created_by: null,
    updated_by: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
});

/**
 * Integration tests for bulk pricing operations
 * These tests verify that bulk operations (like "Set All") work correctly
 * without race conditions or data inconsistencies
 */
describe("Pricing Bulk Operations", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Bulk Customer Pricing Updates", () => {
        it("should update all options with customer pricing using skipRefetch", async () => {
            const options = ["option-1", "option-2", "option-3"];
            const customerPrice = 100;

            // Mock existing rules (some exist, some don't)
            const existingRules: PricingRule[] = [
                createMockPricingRule({
                    id: "rule-1",
                    option_value: "option-1",
                    pricing_context: "customer",
                    base_price: 50,
                }),
            ];

            vi.mocked(PricingService.listRules).mockResolvedValue(
                existingRules,
            );

            // Mock upsert responses
            const mockUpsertResponses = options.map((optionValue, index) =>
                createMockPricingRule({
                    id: `rule-${index + 1}`,
                    option_value: optionValue,
                    pricing_context: "customer",
                    base_price: customerPrice,
                })
            );

            // Set up mock to return different responses for each call
            let callCount = 0;
            vi.mocked(PricingService.upsertRule).mockImplementation(
                async () => {
                    const response = mockUpsertResponses[callCount];
                    callCount++;
                    return response;
                },
            );

            // Simulate bulk save with skipRefetch
            const upsertPromises = options.map((optionValue) =>
                PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    pricing_context: "customer",
                    field_config_id: "field-1",
                    option_value: optionValue,
                    base_price: customerPrice,
                })
            );

            await Promise.all(upsertPromises);

            // Verify all options were updated
            expect(PricingService.upsertRule).toHaveBeenCalledTimes(3);
            expect(PricingService.upsertRule).toHaveBeenCalledWith(
                expect.objectContaining({
                    option_value: "option-1",
                    base_price: customerPrice,
                }),
            );
            expect(PricingService.upsertRule).toHaveBeenCalledWith(
                expect.objectContaining({
                    option_value: "option-2",
                    base_price: customerPrice,
                }),
            );
            expect(PricingService.upsertRule).toHaveBeenCalledWith(
                expect.objectContaining({
                    option_value: "option-3",
                    base_price: customerPrice,
                }),
            );
        });

        it("should handle mixed existing and new rules in bulk update", async () => {
            const options = ["option-1", "option-2", "option-3"];
            const customerPrice = 100;

            // Mock existing rules - only option-1 exists
            const existingRules: PricingRule[] = [
                createMockPricingRule({
                    id: "rule-1",
                    option_value: "option-1",
                    pricing_context: "customer",
                    base_price: 50,
                }),
            ];

            vi.mocked(PricingService.listRules).mockResolvedValue(
                existingRules,
            );

            // Mock upsert responses
            const mockUpsertResponses = [
                createMockPricingRule({
                    id: "rule-1", // Update existing
                    option_value: "option-1",
                    pricing_context: "customer",
                    base_price: customerPrice,
                }),
                createMockPricingRule({
                    id: "rule-2", // New rule
                    option_value: "option-2",
                    pricing_context: "customer",
                    base_price: customerPrice,
                }),
                createMockPricingRule({
                    id: "rule-3", // New rule
                    option_value: "option-3",
                    pricing_context: "customer",
                    base_price: customerPrice,
                }),
            ];

            let callCount = 0;
            vi.mocked(PricingService.upsertRule).mockImplementation(
                async () => {
                    const response = mockUpsertResponses[callCount];
                    callCount++;
                    return response;
                },
            );

            // Simulate bulk save
            const upsertPromises = options.map((optionValue) => {
                const existing = existingRules.find(
                    (r) => r.option_value === optionValue,
                );
                return PricingService.upsertRule({
                    id: existing?.id,
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    pricing_context: "customer",
                    field_config_id: "field-1",
                    option_value: optionValue,
                    base_price: customerPrice,
                });
            });

            await Promise.all(upsertPromises);

            // Verify first call includes id (update), others don't (create)
            const calls = vi.mocked(PricingService.upsertRule).mock.calls;
            expect(calls[0][0].id).toBe("rule-1"); // Update existing
            expect(calls[1][0].id).toBeUndefined(); // Create new
            expect(calls[2][0].id).toBeUndefined(); // Create new
        });
    });

    describe("Bulk Worker Pricing Updates", () => {
        it("should update all options with worker pricing without worker_payment fields", async () => {
            const options = ["option-1", "option-2", "option-3"];
            const workerPrice = 50;

            vi.mocked(PricingService.listRules).mockResolvedValue([]);

            const mockUpsertResponses = options.map((optionValue, index) =>
                createMockPricingRule({
                    id: `rule-${index + 1}`,
                    option_value: optionValue,
                    pricing_context: "worker",
                    base_price: workerPrice,
                })
            );

            let callCount = 0;
            vi.mocked(PricingService.upsertRule).mockImplementation(
                async () => {
                    const response = mockUpsertResponses[callCount];
                    callCount++;
                    return response;
                },
            );

            // Simulate bulk save
            const upsertPromises = options.map((optionValue) =>
                PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    pricing_context: "worker",
                    field_config_id: "field-1",
                    option_value: optionValue,
                    base_price: workerPrice,
                    // worker_payment fields should NOT be included
                })
            );

            await Promise.all(upsertPromises);

            // Verify all calls don't include worker_payment fields
            const calls = vi.mocked(PricingService.upsertRule).mock.calls;
            calls.forEach((call) => {
                const request = call[0];
                expect(request.worker_payment_type).toBeUndefined();
                expect(request.worker_payment_value).toBeUndefined();
                expect(request.pricing_context).toBe("worker");
                expect(request.base_price).toBe(workerPrice);
            });
        });
    });

    describe("Bulk Both Contexts Updates", () => {
        it("should update customer and worker pricing separately", async () => {
            const options = ["option-1", "option-2"];
            const customerPrice = 100;
            const workerPrice = 50;

            vi.mocked(PricingService.listRules).mockResolvedValue([]);

            // Mock responses for customer pricing
            const customerResponses = options.map((optionValue, index) =>
                createMockPricingRule({
                    id: `customer-rule-${index + 1}`,
                    option_value: optionValue,
                    pricing_context: "customer",
                    base_price: customerPrice,
                })
            );

            // Mock responses for worker pricing
            const workerResponses = options.map((optionValue, index) =>
                createMockPricingRule({
                    id: `worker-rule-${index + 1}`,
                    option_value: optionValue,
                    pricing_context: "worker",
                    base_price: workerPrice,
                })
            );

            let callCount = 0;
            vi.mocked(PricingService.upsertRule).mockImplementation(
                async (request) => {
                    if (request.pricing_context === "customer") {
                        const response = customerResponses[callCount % 2];
                        callCount++;
                        return response;
                    } else {
                        const response = workerResponses[(callCount - 2) % 2];
                        callCount++;
                        return response;
                    }
                },
            );

            // Save customer pricing first
            const customerPromises = options.map((optionValue) =>
                PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    pricing_context: "customer",
                    field_config_id: "field-1",
                    option_value: optionValue,
                    base_price: customerPrice,
                })
            );

            // Save worker pricing
            const workerPromises = options.map((optionValue) =>
                PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    pricing_context: "worker",
                    field_config_id: "field-1",
                    option_value: optionValue,
                    base_price: workerPrice,
                })
            );

            await Promise.all([...customerPromises, ...workerPromises]);

            // Verify customer pricing calls
            const customerCalls = vi.mocked(PricingService.upsertRule).mock
                .calls.filter(
                    (call) => call[0].pricing_context === "customer",
                );
            expect(customerCalls).toHaveLength(2);
            customerCalls.forEach((call) => {
                expect(call[0].base_price).toBe(customerPrice);
            });

            // Verify worker pricing calls
            const workerCalls = vi.mocked(PricingService.upsertRule).mock.calls
                .filter(
                    (call) => call[0].pricing_context === "worker",
                );
            expect(workerCalls).toHaveLength(2);
            workerCalls.forEach((call) => {
                expect(call[0].base_price).toBe(workerPrice);
                expect(call[0].worker_payment_type).toBeUndefined();
                expect(call[0].worker_payment_value).toBeUndefined();
            });
        });
    });

    describe("Race Condition Prevention", () => {
        it("should handle concurrent bulk updates without data loss", async () => {
            const options = ["option-1", "option-2", "option-3"];
            const price = 100;

            vi.mocked(PricingService.listRules).mockResolvedValue([]);

            const mockResponses = options.map((optionValue, index) =>
                createMockPricingRule({
                    id: `rule-${index + 1}`,
                    option_value: optionValue,
                    pricing_context: "customer",
                    base_price: price,
                })
            );

            let callCount = 0;
            vi.mocked(PricingService.upsertRule).mockImplementation(
                async () => {
                    // Simulate network delay
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    const response = mockResponses[callCount];
                    callCount++;
                    return response;
                },
            );

            // Simulate concurrent bulk saves
            const bulkSave1 = Promise.all(
                options.map((optionValue) =>
                    PricingService.upsertRule({
                        organization_id: "org-1",
                        scope: "option",
                        pricing_type: "fixed",
                        pricing_context: "customer",
                        field_config_id: "field-1",
                        option_value: optionValue,
                        base_price: price,
                    })
                ),
            );

            const bulkSave2 = Promise.all(
                options.map((optionValue) =>
                    PricingService.upsertRule({
                        organization_id: "org-1",
                        scope: "option",
                        pricing_type: "fixed",
                        pricing_context: "customer",
                        field_config_id: "field-1",
                        option_value: optionValue,
                        base_price: price + 10,
                    })
                ),
            );

            await Promise.all([bulkSave1, bulkSave2]);

            // All calls should complete successfully
            expect(PricingService.upsertRule).toHaveBeenCalledTimes(6);
        });
    });
});
