import { PricingService } from "@/lib/services/pricing.service";
import { supabase } from "@/lib/supabase";
import type { PricingRule } from "@/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
    supabase: {
        functions: {
            invoke: vi.fn(),
        },
    },
}));

vi.mock("@/lib/logger", () => ({
    log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe("PricingService", () => {
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

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("listRules", () => {
        it("should list pricing rules successfully", async () => {
            const mockRules: PricingRule[] = [
                {
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
                },
            ];

            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, pricing_rules: mockRules },
                error: null,
            });

            const result = await PricingService.listRules({
                organization_id: "org-1",
            });

            expect(result).toEqual(mockRules);
            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "list-pricing-rules",
                {
                    body: { organization_id: "org-1" },
                },
            );
        });

        it("should handle errors when listing rules", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: null,
                error: { message: "Failed to list rules" },
            });

            await expect(
                PricingService.listRules({ organization_id: "org-1" }),
            ).rejects.toThrow();
        });

        it("should filter by pricing_context", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true, pricing_rules: [] },
                error: null,
            });

            await PricingService.listRules({
                organization_id: "org-1",
                pricing_context: "worker",
            });

            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "list-pricing-rules",
                {
                    body: {
                        organization_id: "org-1",
                        pricing_context: "worker",
                    },
                },
            );
        });
    });

    describe("upsertRule", () => {
        describe("create pricing rule", () => {
            it("should create customer pricing rule successfully", async () => {
                const mockRule = createMockPricingRule({
                    pricing_context: "customer",
                    base_price: 100,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    pricing_context: "customer",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 100,
                });

                expect(result).toEqual(mockRule);
                expect(supabase.functions.invoke).toHaveBeenCalledWith(
                    "create-pricing-rule",
                    {
                        body: {
                            organization_id: "org-1",
                            scope: "option",
                            pricing_type: "fixed",
                            pricing_context: "customer",
                            field_config_id: "field-1",
                            option_value: "option-1",
                            base_price: 100,
                        },
                    },
                );
            });

            it("should create worker pricing rule successfully", async () => {
                const mockRule = createMockPricingRule({
                    pricing_context: "worker",
                    base_price: 50,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    pricing_context: "worker",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 50,
                });

                expect(result).toEqual(mockRule);
                expect(supabase.functions.invoke).toHaveBeenCalledWith(
                    "create-pricing-rule",
                    {
                        body: {
                            organization_id: "org-1",
                            scope: "option",
                            pricing_type: "fixed",
                            pricing_context: "worker",
                            field_config_id: "field-1",
                            option_value: "option-1",
                            base_price: 50,
                        },
                    },
                );
            });

            it("should create customer pricing rule with worker payment fields", async () => {
                const mockRule = createMockPricingRule({
                    pricing_context: "customer",
                    base_price: 100,
                    worker_payment_type: "fixed_rate",
                    worker_payment_value: 50,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    pricing_context: "customer",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 100,
                    worker_payment_type: "fixed_rate",
                    worker_payment_value: 50,
                });

                expect(result).toEqual(mockRule);
                expect(result.worker_payment_type).toBe("fixed_rate");
                expect(result.worker_payment_value).toBe(50);
            });

            it("should NOT include worker_payment fields for worker pricing rules", async () => {
                const mockRule = createMockPricingRule({
                    pricing_context: "worker",
                    base_price: 50,
                    worker_payment_type: null,
                    worker_payment_value: null,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    pricing_context: "worker",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 50,
                    // These should not be sent for worker pricing
                    worker_payment_type: undefined,
                    worker_payment_value: undefined,
                });

                expect(result).toEqual(mockRule);
                // Verify the request didn't include worker_payment fields
                const callArgs =
                    vi.mocked(supabase.functions.invoke).mock.calls[0];
                const requestBody = callArgs[1]?.body as Record<
                    string,
                    unknown
                >;
                expect(requestBody.worker_payment_type).toBeUndefined();
                expect(requestBody.worker_payment_value).toBeUndefined();
            });
        });

        describe("update pricing rule", () => {
            it("should update customer pricing rule successfully", async () => {
                const mockRule = createMockPricingRule({
                    id: "rule-1",
                    pricing_context: "customer",
                    base_price: 150,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    id: "rule-1",
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    pricing_context: "customer",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 150,
                });

                expect(result).toEqual(mockRule);
                expect(supabase.functions.invoke).toHaveBeenCalledWith(
                    "update-pricing-rule",
                    {
                        body: {
                            id: "rule-1",
                            organization_id: "org-1",
                            scope: "option",
                            pricing_type: "fixed",
                            pricing_context: "customer",
                            field_config_id: "field-1",
                            option_value: "option-1",
                            base_price: 150,
                        },
                    },
                );
            });

            it("should update worker pricing rule successfully", async () => {
                const mockRule = createMockPricingRule({
                    id: "rule-1",
                    pricing_context: "worker",
                    base_price: 75,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    id: "rule-1",
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    pricing_context: "worker",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 75,
                });

                expect(result).toEqual(mockRule);
                expect(result.base_price).toBe(75);
            });
        });

        describe("error handling", () => {
            it("should extract error message from data.error", async () => {
                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { error: "Invalid pricing rule" },
                    error: null,
                });

                await expect(
                    PricingService.upsertRule({
                        organization_id: "org-1",
                        scope: "option",
                        pricing_type: "fixed",
                        base_price: 100,
                    }),
                ).rejects.toThrow("Invalid pricing rule");
            });

            it("should extract error message from error.context.body", async () => {
                const mockError = {
                    message: "Edge Function returned a non-2xx status code",
                    context: {
                        body: JSON.stringify({ error: "Validation failed" }),
                    },
                };

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: null,
                    error: mockError,
                });

                await expect(
                    PricingService.upsertRule({
                        organization_id: "org-1",
                        scope: "option",
                        pricing_type: "fixed",
                        base_price: 100,
                    }),
                ).rejects.toThrow("Validation failed");
            });

            it("should extract error message from error.context.data", async () => {
                const mockError = {
                    message: "Edge Function returned a non-2xx status code",
                    context: {
                        data: { error: "Database error" },
                    },
                };

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: null,
                    error: mockError,
                });

                await expect(
                    PricingService.upsertRule({
                        organization_id: "org-1",
                        scope: "option",
                        pricing_type: "fixed",
                        base_price: 100,
                    }),
                ).rejects.toThrow("Database error");
            });

            it("should handle missing pricing_rule in response", async () => {
                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { success: true },
                    error: null,
                });

                await expect(
                    PricingService.upsertRule({
                        organization_id: "org-1",
                        scope: "option",
                        pricing_type: "fixed",
                        base_price: 100,
                    }),
                ).rejects.toThrow();
            });
        });

        describe("location scoping", () => {
            it("should create pricing rule with location override", async () => {
                const mockRule = createMockPricingRule({
                    location_id: "location-1",
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 100,
                    location_id: "location-1",
                });

                expect(result.location_id).toBe("location-1");
            });

            it("should create pricing rule with location hierarchy override", async () => {
                const mockRule = createMockPricingRule({
                    location_hierarchy_id: "hierarchy-1",
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 100,
                    location_hierarchy_id: "hierarchy-1",
                });

                expect(result.location_hierarchy_id).toBe("hierarchy-1");
            });
        });
    });

    describe("deleteRule", () => {
        it("should delete pricing rule successfully", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            await PricingService.deleteRule("rule-1");

            expect(supabase.functions.invoke).toHaveBeenCalledWith(
                "delete-pricing-rule",
                {
                    body: { id: "rule-1" },
                },
            );
        });

        it("should handle errors when deleting rule", async () => {
            vi.mocked(supabase.functions.invoke).mockResolvedValue({
                data: { success: false },
                error: null,
            });

            await expect(PricingService.deleteRule("rule-1")).rejects.toThrow();
        });
    });

    describe("additional edge cases", () => {
        describe("percentage pricing type", () => {
            it("should create pricing rule with percentage rate", async () => {
                const mockRule = createMockPricingRule({
                    pricing_type: "percentage",
                    base_price: null,
                    percentage_rate: 1.1,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "field",
                    pricing_type: "percentage",
                    field_config_id: "field-1",
                    percentage_rate: 1.1,
                });

                expect(result.pricing_type).toBe("percentage");
                expect(result.percentage_rate).toBe(1.1);
                expect(result.base_price).toBeNull();
            });
        });

        describe("expiration dates", () => {
            it("should create pricing rule with expiration date", async () => {
                const expiresAt = "2025-12-31T23:59:59Z";
                const mockRule = createMockPricingRule({
                    expires_at: expiresAt,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 100,
                    expires_at: expiresAt,
                });

                expect(result.expires_at).toBe(expiresAt);
            });

            it("should create pricing rule without expiration date", async () => {
                const mockRule = createMockPricingRule({
                    expires_at: null,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 100,
                    expires_at: null,
                });

                expect(result.expires_at).toBeNull();
            });
        });

        describe("effective dates", () => {
            it("should list rules with effective_at filter", async () => {
                const effectiveAt = "2024-06-01T00:00:00Z";
                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { success: true, pricing_rules: [] },
                    error: null,
                });

                await PricingService.listRules({
                    organization_id: "org-1",
                    effective_at: effectiveAt,
                });

                expect(supabase.functions.invoke).toHaveBeenCalledWith(
                    "list-pricing-rules",
                    {
                        body: {
                            organization_id: "org-1",
                            effective_at: effectiveAt,
                        },
                    },
                );
            });
        });

        describe("different scopes", () => {
            it("should list field scope rules", async () => {
                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { success: true, pricing_rules: [] },
                    error: null,
                });

                await PricingService.listRules({
                    organization_id: "org-1",
                    scopes: ["field"],
                });

                expect(supabase.functions.invoke).toHaveBeenCalledWith(
                    "list-pricing-rules",
                    {
                        body: {
                            organization_id: "org-1",
                            scopes: ["field"],
                        },
                    },
                );
            });

            it("should list base scope rules", async () => {
                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { success: true, pricing_rules: [] },
                    error: null,
                });

                await PricingService.listRules({
                    organization_id: "org-1",
                    scopes: ["base"],
                });

                expect(supabase.functions.invoke).toHaveBeenCalledWith(
                    "list-pricing-rules",
                    {
                        body: {
                            organization_id: "org-1",
                            scopes: ["base"],
                        },
                    },
                );
            });

            it("should list multiple scopes", async () => {
                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { success: true, pricing_rules: [] },
                    error: null,
                });

                await PricingService.listRules({
                    organization_id: "org-1",
                    scopes: ["field", "option", "base"],
                });

                expect(supabase.functions.invoke).toHaveBeenCalledWith(
                    "list-pricing-rules",
                    {
                        body: {
                            organization_id: "org-1",
                            scopes: ["field", "option", "base"],
                        },
                    },
                );
            });
        });

        describe("field config filtering", () => {
            it("should list rules filtered by field_config_id", async () => {
                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { success: true, pricing_rules: [] },
                    error: null,
                });

                await PricingService.listRules({
                    organization_id: "org-1",
                    field_config_id: "field-1",
                });

                expect(supabase.functions.invoke).toHaveBeenCalledWith(
                    "list-pricing-rules",
                    {
                        body: {
                            organization_id: "org-1",
                            field_config_id: "field-1",
                        },
                    },
                );
            });

            it("should list rules filtered by option_value", async () => {
                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { success: true, pricing_rules: [] },
                    error: null,
                });

                await PricingService.listRules({
                    organization_id: "org-1",
                    option_value: "option-1",
                });

                expect(supabase.functions.invoke).toHaveBeenCalledWith(
                    "list-pricing-rules",
                    {
                        body: {
                            organization_id: "org-1",
                            option_value: "option-1",
                        },
                    },
                );
            });
        });

        describe("tier definitions", () => {
            it("should create pricing rule with tier definition", async () => {
                const tierDefinition = [
                    { min: 0, max: 10, price: 100 },
                    { min: 11, max: 20, price: 90 },
                ];
                const mockRule = createMockPricingRule({
                    pricing_type: "tiered",
                    tier_definition: tierDefinition,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "field",
                    pricing_type: "tiered",
                    field_config_id: "field-1",
                    tier_definition: tierDefinition,
                });

                expect(result.pricing_type).toBe("tiered");
                expect(result.tier_definition).toEqual(tierDefinition);
            });
        });

        describe("conditions", () => {
            it("should create pricing rule with conditions", async () => {
                const conditions = [
                    {
                        condition_field_config_id: "field-2",
                        operator: "greater_than" as const,
                        condition_value: 10,
                        action_type: "add" as const,
                        action_value: 50,
                    },
                ];
                const mockRule = createMockPricingRule({
                    pricing_type: "conditional",
                    conditions: [
                        {
                            id: "cond-1",
                            pricing_rule_id: "rule-1",
                            condition_field_config_id: "field-2",
                            operator: "greater_than",
                            condition_value: "10",
                            action_type: "add",
                            action_value: 50,
                            metadata: null,
                            priority: 0,
                        },
                    ],
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "field",
                    pricing_type: "conditional",
                    field_config_id: "field-1",
                    base_price: 100,
                    conditions,
                });

                expect(result.pricing_type).toBe("conditional");
                expect(result.conditions).toBeDefined();
            });
        });

        describe("metadata", () => {
            it("should create pricing rule with metadata", async () => {
                const metadata = { custom_field: "value", another_field: 123 };
                const mockRule = createMockPricingRule({
                    metadata,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 100,
                    metadata,
                });

                expect(result.metadata).toEqual(metadata);
            });
        });

        describe("priority and active status", () => {
            it("should create pricing rule with priority", async () => {
                const mockRule = createMockPricingRule({
                    priority: 5,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 100,
                    priority: 5,
                });

                expect(result.priority).toBe(5);
            });

            it("should create inactive pricing rule", async () => {
                const mockRule = createMockPricingRule({
                    active: false,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 100,
                    active: false,
                });

                expect(result.active).toBe(false);
            });
        });

        describe("currency", () => {
            it("should create pricing rule with custom currency", async () => {
                const mockRule = createMockPricingRule({
                    currency: "AUD",
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "option",
                    pricing_type: "fixed",
                    field_config_id: "field-1",
                    option_value: "option-1",
                    base_price: 100,
                    currency: "AUD",
                });

                expect(result.currency).toBe("AUD");
            });
        });

        describe("quantity limits", () => {
            it("should create pricing rule with minimum and maximum quantity", async () => {
                const mockRule = createMockPricingRule({
                    minimum_quantity: 1,
                    maximum_quantity: 100,
                });

                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { pricing_rule: mockRule },
                    error: null,
                });

                const result = await PricingService.upsertRule({
                    organization_id: "org-1",
                    scope: "field",
                    pricing_type: "unit",
                    field_config_id: "field-1",
                    base_price: 10,
                    minimum_quantity: 1,
                    maximum_quantity: 100,
                });

                expect(result.minimum_quantity).toBe(1);
                expect(result.maximum_quantity).toBe(100);
            });
        });

        describe("include inactive rules", () => {
            it("should list inactive rules when include_inactive is true", async () => {
                vi.mocked(supabase.functions.invoke).mockResolvedValue({
                    data: { success: true, pricing_rules: [] },
                    error: null,
                });

                await PricingService.listRules({
                    organization_id: "org-1",
                    include_inactive: true,
                });

                expect(supabase.functions.invoke).toHaveBeenCalledWith(
                    "list-pricing-rules",
                    {
                        body: {
                            organization_id: "org-1",
                            include_inactive: true,
                        },
                    },
                );
            });
        });
    });
});
