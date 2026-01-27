import { useOptionPricing } from "@/hooks/use-option-pricing";
import { PricingService } from "@/lib/services/pricing.service";
import type { PricingRule } from "@/lib/types";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/services/pricing.service");

// Helper to get today's date at midnight UTC for consistent effective_at matching
const getTodayMidnightUTC = () => {
  const today = new Date();
  return `${today.toISOString().split("T")[0]}T00:00:00.000Z`;
};

const createMockPricingRule = (
  overrides?: Partial<PricingRule>
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
  effective_at: getTodayMidnightUTC(), // Use today's date so rules match current date comparison
  expires_at: null,
  created_by: null,
  updated_by: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

describe("useOptionPricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetching pricing", () => {
    it("should fetch customer pricing rules", async () => {
      const mockRules: PricingRule[] = [
        createMockPricingRule({
          pricing_context: "customer",
          base_price: 100,
        }),
      ];

      vi.mocked(PricingService.listRules).mockResolvedValue(mockRules);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.optionPricing).toHaveLength(1);
      expect(result.current.optionPricing[0].customer_price).toBe(100);
      expect(result.current.optionPricing[0].option_value).toBe("option-1");
      expect(PricingService.listRules).toHaveBeenCalledWith({
        organization_id: "org-1",
        scopes: ["option"],
        field_config_id: "field-1",
        location_hierarchy_id: null,
        location_id: null,
        effective_at: undefined,
        pricing_context: "customer",
      });
    });

    it("should fetch worker pricing rules", async () => {
      const mockRules: PricingRule[] = [
        createMockPricingRule({
          pricing_context: "worker",
          base_price: 50,
        }),
      ];

      vi.mocked(PricingService.listRules).mockResolvedValue(mockRules);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "worker",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.optionPricing).toHaveLength(1);
      expect(result.current.optionPricing[0].customer_price).toBe(50);
      expect(result.current.optionPricing[0].worker_payment_rate).toBe(50);
    });

    it("should handle errors when fetching", async () => {
      vi.mocked(PricingService.listRules).mockRejectedValue(
        new Error("Failed to fetch")
      );

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to fetch");
      expect(result.current.optionPricing).toEqual([]);
    });
  });

  describe("upsertPricing - customer context", () => {
    it("should create new customer pricing rule", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "customer",
        base_price: 100,
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const pricing = await result.current.upsertPricing(
        "field-1",
        "option-1",
        100,
        {
          pricingContext: "customer",
        }
      );

      expect(pricing.customer_price).toBe(100);
      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: "org-1",
          scope: "option",
          pricing_type: "fixed",
          pricing_context: "customer",
          field_config_id: "field-1",
          option_value: "option-1",
          base_price: 100,
        })
      );
    });

    it("should update existing customer pricing rule", async () => {
      const existingRule = createMockPricingRule({
        id: "rule-1",
        pricing_context: "customer",
        base_price: 100,
      });
      const updatedRule = createMockPricingRule({
        id: "rule-1",
        pricing_context: "customer",
        base_price: 150,
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([existingRule]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(updatedRule);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing("field-1", "option-1", 150, {
        pricingContext: "customer",
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "rule-1",
          base_price: 150,
        })
      );
    });

    it("should include worker_payment fields for customer pricing", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "customer",
        base_price: 100,
        worker_payment_type: "fixed_rate",
        worker_payment_value: 50,
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing("field-1", "option-1", 100, {
        pricingContext: "customer",
        workerPaymentRate: 50,
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          pricing_context: "customer",
          worker_payment_type: "fixed_rate",
          worker_payment_value: 50,
        })
      );
    });

    it("should find existing rule by pricing_context", async () => {
      const customerRule = createMockPricingRule({
        id: "rule-customer",
        pricing_context: "customer",
        base_price: 100,
      });
      const workerRule = createMockPricingRule({
        id: "rule-worker",
        pricing_context: "worker",
        base_price: 50,
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([
        customerRule,
        workerRule,
      ]);

      const updatedCustomerRule = createMockPricingRule({
        id: "rule-customer",
        pricing_context: "customer",
        base_price: 150,
      });
      vi.mocked(PricingService.upsertRule).mockResolvedValue(
        updatedCustomerRule
      );

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing("field-1", "option-1", 150, {
        pricingContext: "customer",
      });

      // Should update the customer rule, not the worker rule
      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "rule-customer",
          pricing_context: "customer",
        })
      );
    });
  });

  describe("upsertPricing - worker context", () => {
    it("should create new worker pricing rule", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "worker",
        base_price: 50,
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "worker",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing("field-1", "option-1", 50, {
        pricingContext: "worker",
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          pricing_context: "worker",
          base_price: 50,
          // Should NOT include worker_payment fields
        })
      );

      const callArgs = vi.mocked(PricingService.upsertRule).mock.calls[0][0];
      expect(callArgs.worker_payment_type).toBeUndefined();
      expect(callArgs.worker_payment_value).toBeUndefined();
    });

    it("should NOT include worker_payment fields for worker pricing", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "worker",
        base_price: 50,
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "worker",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing("field-1", "option-1", 50, {
        pricingContext: "worker",
      });

      const callArgs = vi.mocked(PricingService.upsertRule).mock.calls[0][0];
      expect(callArgs.worker_payment_type).toBeUndefined();
      expect(callArgs.worker_payment_value).toBeUndefined();
    });

    it("should transform worker pricing correctly", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "worker",
        base_price: 50,
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "worker",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const pricing = await result.current.upsertPricing(
        "field-1",
        "option-1",
        50,
        {
          pricingContext: "worker",
        }
      );

      // For worker context, worker_payment_rate should come from base_price
      expect(pricing.customer_price).toBe(50);
      expect(pricing.worker_payment_rate).toBe(50);
    });
  });

  describe("skipRefetch for bulk operations", () => {
    it("should skip refetch when skipRefetch is true", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "customer",
        base_price: 100,
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear the mock call count
      vi.mocked(PricingService.listRules).mockClear();

      await result.current.upsertPricing("field-1", "option-1", 100, {
        pricingContext: "customer",
        skipRefetch: true,
      });

      // Should not call listRules again (refetch skipped)
      expect(PricingService.listRules).not.toHaveBeenCalled();
    });

    it("should refetch when skipRefetch is false or undefined", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "customer",
        base_price: 100,
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear the mock call count
      vi.mocked(PricingService.listRules).mockClear();

      await result.current.upsertPricing("field-1", "option-1", 100, {
        pricingContext: "customer",
        skipRefetch: false,
      });

      // Should call listRules again (refetch)
      expect(PricingService.listRules).toHaveBeenCalled();
    });
  });

  describe("location scoping", () => {
    it("should create pricing with location override", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "customer",
        location_id: "location-1",
        base_price: 100,
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "customer",
          locationId: "location-1",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing("field-1", "option-1", 100, {
        pricingContext: "customer",
        locationId: "location-1",
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          location_id: "location-1",
        })
      );
    });

    it("should create pricing with location hierarchy override", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "customer",
        location_hierarchy_id: "hierarchy-1",
        base_price: 100,
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "customer",
          locationHierarchyId: "hierarchy-1",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing("field-1", "option-1", 100, {
        pricingContext: "customer",
        locationHierarchyId: "hierarchy-1",
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          location_hierarchy_id: "hierarchy-1",
        })
      );
    });
  });

  describe("refetch", () => {
    it("should refetch pricing when refetch is called", async () => {
      const mockRules: PricingRule[] = [
        createMockPricingRule({
          pricing_context: "customer",
          base_price: 100,
        }),
      ];

      vi.mocked(PricingService.listRules).mockResolvedValue(mockRules);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear and add new rules
      const newMockRules: PricingRule[] = [
        createMockPricingRule({
          pricing_context: "customer",
          base_price: 150,
        }),
      ];
      vi.mocked(PricingService.listRules).mockResolvedValue(newMockRules);

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.optionPricing[0].customer_price).toBe(150);
      });
    });
  });

  describe("deletePricing", () => {
    it("should delete pricing rule and refetch", async () => {
      const mockRule = createMockPricingRule({
        id: "rule-1",
        pricing_context: "customer",
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([mockRule]);
      vi.mocked(PricingService.deleteRule).mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useOptionPricing("org-1", "field-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // After delete, return empty array
      vi.mocked(PricingService.listRules).mockResolvedValue([]);

      await result.current.deletePricing("rule-1");

      expect(PricingService.deleteRule).toHaveBeenCalledWith("rule-1");
      expect(PricingService.listRules).toHaveBeenCalled(); // Should refetch
    });
  });
});
