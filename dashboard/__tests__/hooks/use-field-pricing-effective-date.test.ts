import { useFieldPricing } from "@/hooks/use-field-pricing";
import useOrganization from "@/hooks/useOrganization";
import { PricingService } from "@/lib/services/pricing.service";
import type { PricingRule } from "@/lib/types";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/hooks/useOrganization");
vi.mock("@/lib/services/pricing.service", () => ({
    PricingService: {
        listRules: vi.fn(),
        upsertRule: vi.fn(),
    },
}));

const createMockPricingRule = (
    overrides?: Partial<PricingRule>,
): PricingRule => ({
    id: "rule-1",
    organization_id: "org-1",
    scope: "field",
    pricing_type: "unit",
    pricing_context: "customer",
    field_config_id: "field-1",
    option_value: null,
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
    field_config: null,
    location: null,
    location_node: null,
    conditions: [],
    ...overrides,
});

describe("useFieldPricing - Effective Date Updates", () => {
    const mockOrganizationId = "org-1";

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useOrganization).mockReturnValue({
            organizationId: mockOrganizationId,
            loading: false,
            error: null,
        });
    });

    it("should update effective_at to current date when updating organizational default rule", async () => {
        const existingRule = createMockPricingRule({
            effective_at: "2024-01-01T00:00:00Z", // 11 days ago
            base_price: 100,
        });

        const updatedRule = createMockPricingRule({
            base_price: 200,
            effective_at: new Date().toISOString(),
        });

        vi.mocked(PricingService.listRules).mockResolvedValue([existingRule]);
        vi.mocked(PricingService.upsertRule).mockResolvedValue(updatedRule);

        const { result } = renderHook(() => useFieldPricing());

        await waitFor(() => {
            expect(result.current.fieldPricing).toHaveLength(1);
        });

        const beforeUpdate = new Date().toISOString();

        // Update the pricing rule (organizational default - no location)
        await act(async () => {
            await result.current.upsertPricing("field-1", 200, {
                locationId: null,
                locationHierarchyId: null,
                // No explicit effectiveAt provided
            });
        });

        const afterUpdate = new Date().toISOString();

        // Verify that upsertRule was called with effective_at set to current date
        expect(PricingService.upsertRule).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "rule-1",
                base_price: 200,
                location_id: null,
                location_hierarchy_id: null,
                effective_at: expect.stringMatching(
                    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
                ),
            }),
        );

        // Verify the effective_at is between before and after update
        const callArgs = vi.mocked(PricingService.upsertRule).mock.calls[0][0];
        const effectiveAt = callArgs.effective_at as string;
        expect(effectiveAt).toBeDefined();
        expect(new Date(effectiveAt).getTime()).toBeGreaterThanOrEqual(
            new Date(beforeUpdate).getTime() - 1000, // Allow 1 second tolerance
        );
        expect(new Date(effectiveAt).getTime()).toBeLessThanOrEqual(
            new Date(afterUpdate).getTime() + 1000, // Allow 1 second tolerance
        );
    });

    it("should NOT update effective_at when updating a location override", async () => {
        const existingRule = createMockPricingRule({
            location_id: "loc-1",
            effective_at: "2024-01-01T00:00:00Z",
            base_price: 100,
        });

        const updatedRule = createMockPricingRule({
            location_id: "loc-1",
            base_price: 200,
        });

        vi.mocked(PricingService.listRules).mockResolvedValue([existingRule]);
        vi.mocked(PricingService.upsertRule).mockResolvedValue(updatedRule);

        const { result } = renderHook(() => useFieldPricing());

        await waitFor(() => {
            expect(result.current.fieldPricing).toHaveLength(1);
        });

        // Update the pricing rule with a location (location override)
        await act(async () => {
            await result.current.upsertPricing("field-1", 200, {
                locationId: "loc-1",
                locationHierarchyId: null,
            });
        });

        // Verify that upsertRule was called WITHOUT effective_at
        // (should not update effective_at for location overrides)
        expect(PricingService.upsertRule).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "rule-1",
                base_price: 200,
                location_id: "loc-1",
                location_hierarchy_id: null,
            }),
        );

        const callArgs = vi.mocked(PricingService.upsertRule).mock.calls[0][0];
        // effective_at should be undefined (not provided) for location overrides
        expect(callArgs.effective_at).toBeUndefined();
    });

    it("should use explicit effectiveAt when provided", async () => {
        const existingRule = createMockPricingRule({
            effective_at: "2024-01-01T00:00:00Z",
            base_price: 100,
        });

        const explicitEffectiveAt = "2024-12-25T00:00:00Z";
        const updatedRule = createMockPricingRule({
            base_price: 200,
            effective_at: explicitEffectiveAt,
        });

        vi.mocked(PricingService.listRules).mockResolvedValue([existingRule]);
        vi.mocked(PricingService.upsertRule).mockResolvedValue(updatedRule);

        const { result } = renderHook(() => useFieldPricing());

        await waitFor(() => {
            expect(result.current.fieldPricing).toHaveLength(1);
        });

        // Update the pricing rule with explicit effectiveAt
        await act(async () => {
            await result.current.upsertPricing("field-1", 200, {
                locationId: null,
                locationHierarchyId: null,
                effectiveAt: explicitEffectiveAt, // This is the correct property name from UpsertPricingOptions
            });
        });

        // Verify that upsertRule was called with the explicit effective_at
        expect(PricingService.upsertRule).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "rule-1",
                base_price: 200,
                location_id: null,
                location_hierarchy_id: null,
                effective_at: explicitEffectiveAt,
            }),
        );
    });

    it("should NOT update effective_at when creating a new rule", async () => {
        // No existing rule
        const newRule = createMockPricingRule({
            effective_at: new Date().toISOString(),
            base_price: 200,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });

        vi.mocked(PricingService.listRules).mockResolvedValue([]);
        vi.mocked(PricingService.upsertRule).mockResolvedValue(newRule);

        const { result } = renderHook(() => useFieldPricing());

        await waitFor(() => {
            expect(result.current.fieldPricing).toHaveLength(0);
        });

        // Create a new pricing rule (no existing rule ID)
        await act(async () => {
            await result.current.upsertPricing("field-1", 200, {
                locationId: null,
                locationHierarchyId: null,
            });
        });

        // Verify that upsertRule was called WITHOUT effective_at
        // (create-pricing-rule will set it to current date by default)
        expect(PricingService.upsertRule).toHaveBeenCalledWith(
            expect.objectContaining({
                id: undefined, // New rule, no ID
                base_price: 200,
                location_id: null,
                location_hierarchy_id: null,
            }),
        );

        const callArgs = vi.mocked(PricingService.upsertRule).mock.calls[0][0];
        // effective_at should be undefined for new rules (let create-pricing-rule handle it)
        expect(callArgs.effective_at).toBeUndefined();
    });
});
