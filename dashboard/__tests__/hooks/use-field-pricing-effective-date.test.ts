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

// Helper to get today's date at midnight UTC for consistent effective_at matching
const getTodayMidnightUTC = () => {
    const today = new Date();
    return `${today.toISOString().split("T")[0]}T00:00:00.000Z`;
};

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
    effective_at: getTodayMidnightUTC(), // Use today's date so rules match
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

    it("should find existing rule and update when effective_at date matches", async () => {
        const existingRule = createMockPricingRule({
            effective_at: getTodayMidnightUTC(),
            base_price: 100,
        });

        const updatedRule = createMockPricingRule({
            base_price: 200,
            effective_at: getTodayMidnightUTC(),
        });

        vi.mocked(PricingService.listRules).mockResolvedValue([existingRule]);
        vi.mocked(PricingService.upsertRule).mockResolvedValue(updatedRule);

        const { result } = renderHook(() => useFieldPricing());

        await waitFor(() => {
            expect(result.current.fieldPricing).toHaveLength(1);
        });

        // Update the pricing rule (organizational default - no location)
        await act(async () => {
            await result.current.upsertPricing("field-1", 200, {
                locationId: null,
                locationHierarchyId: null,
            });
        });

        // Verify that upsertRule was called with the existing rule's ID (UPDATE)
        expect(PricingService.upsertRule).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "rule-1", // Should find existing rule
                base_price: 200,
                location_id: null,
                location_hierarchy_id: null,
            }),
        );
    });

    it("should create new rule when effective_at date does not match", async () => {
        // Existing rule has a DIFFERENT effective date (not today)
        const existingRule = createMockPricingRule({
            effective_at: "2024-01-01T00:00:00.000Z", // Old date
            base_price: 100,
        });

        const newRule = createMockPricingRule({
            id: "rule-2",
            base_price: 200,
            effective_at: getTodayMidnightUTC(),
        });

        vi.mocked(PricingService.listRules).mockResolvedValue([existingRule]);
        vi.mocked(PricingService.upsertRule).mockResolvedValue(newRule);

        const { result } = renderHook(() => useFieldPricing());

        await waitFor(() => {
            expect(result.current.fieldPricing).toHaveLength(1);
        });

        // Update the pricing rule
        await act(async () => {
            await result.current.upsertPricing("field-1", 200, {
                locationId: null,
                locationHierarchyId: null,
            });
        });

        // Should NOT find existing rule (different effective date) - creates new
        expect(PricingService.upsertRule).toHaveBeenCalledWith(
            expect.objectContaining({
                id: undefined, // No match - new rule
                base_price: 200,
            }),
        );
    });

    it("should use explicit effectiveAt when provided", async () => {
        const explicitEffectiveAt = "2024-12-25";
        const existingRule = createMockPricingRule({
            effective_at: `${explicitEffectiveAt}T00:00:00.000Z`,
            base_price: 100,
        });

        const updatedRule = createMockPricingRule({
            base_price: 200,
            effective_at: `${explicitEffectiveAt}T00:00:00.000Z`,
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
                effectiveAt: explicitEffectiveAt,
            });
        });

        // Verify that upsertRule was called with the explicit effective_at
        expect(PricingService.upsertRule).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "rule-1", // Found existing rule with matching effective date
                base_price: 200,
                effective_at: `${explicitEffectiveAt}T00:00:00.000Z`,
            }),
        );
    });

    it("should create new rule when no existing rules exist", async () => {
        const newRule = createMockPricingRule({
            effective_at: getTodayMidnightUTC(),
            base_price: 200,
        });

        vi.mocked(PricingService.listRules).mockResolvedValue([]);
        vi.mocked(PricingService.upsertRule).mockResolvedValue(newRule);

        const { result } = renderHook(() => useFieldPricing());

        await waitFor(() => {
            expect(result.current.fieldPricing).toHaveLength(0);
        });

        // Create a new pricing rule (no existing rule)
        await act(async () => {
            await result.current.upsertPricing("field-1", 200, {
                locationId: null,
                locationHierarchyId: null,
            });
        });

        // Verify that upsertRule was called with undefined id (CREATE)
        expect(PricingService.upsertRule).toHaveBeenCalledWith(
            expect.objectContaining({
                id: undefined, // New rule, no ID
                base_price: 200,
                location_id: null,
                location_hierarchy_id: null,
            }),
        );

        // effective_at should be set to today's date
        const callArgs = vi.mocked(PricingService.upsertRule).mock.calls[0][0];
        expect(callArgs.effective_at).toBeDefined();
        expect(callArgs.effective_at?.split("T")[0]).toBe(
            new Date().toISOString().split("T")[0],
        );
    });

    it("should match location override by effective date", async () => {
        const existingRule = createMockPricingRule({
            location_id: "loc-1",
            effective_at: getTodayMidnightUTC(),
            base_price: 100,
        });

        const updatedRule = createMockPricingRule({
            location_id: "loc-1",
            base_price: 200,
            effective_at: getTodayMidnightUTC(),
        });

        vi.mocked(PricingService.listRules).mockResolvedValue([existingRule]);
        vi.mocked(PricingService.upsertRule).mockResolvedValue(updatedRule);

        const { result } = renderHook(() => useFieldPricing());

        await waitFor(() => {
            expect(result.current.fieldPricing).toHaveLength(1);
        });

        // Update the location override
        await act(async () => {
            await result.current.upsertPricing("field-1", 200, {
                locationId: "loc-1",
                locationHierarchyId: null,
            });
        });

        // Should find existing location override rule
        expect(PricingService.upsertRule).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "rule-1", // Found existing rule
                base_price: 200,
                location_id: "loc-1",
            }),
        );
    });
});
