import { useBasePricing } from "@/hooks/use-base-pricing";
import { PricingService } from "@/lib/services/pricing.service";
import type { PricingRule } from "@/lib/types";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/services/pricing.service");
vi.mock("@/hooks/useOrganization", () => ({
  default: () => ({ organizationId: "org-1" }),
}));

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
  scope: "base",
  pricing_type: "fixed",
  pricing_context: "customer",
  field_config_id: null,
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
  metadata: { adjustment_type: "add" },
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

describe("useBasePricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetching pricing", () => {
    it("should fetch customer base pricing rules", async () => {
      const mockRules: PricingRule[] = [
        createMockPricingRule({
          pricing_context: "customer",
          base_price: 100,
          metadata: { adjustment_type: "add" },
        }),
      ];

      vi.mocked(PricingService.listRules).mockResolvedValue(mockRules);

      const { result } = renderHook(() =>
        useBasePricing({
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.basePricing).toHaveLength(1);
      expect(result.current.basePricing[0].customer_base_price).toBe(100);
      expect(result.current.basePricing[0].adjustment_type).toBe("add");
      expect(PricingService.listRules).toHaveBeenCalledWith({
        organization_id: "org-1",
        scopes: ["base"],
        location_hierarchy_id: null,
        location_id: null,
        pricing_context: "customer",
      });
    });

    it("should fetch worker base pricing rules", async () => {
      const mockRules: PricingRule[] = [
        createMockPricingRule({
          pricing_context: "worker",
          base_price: 50,
          metadata: { adjustment_type: "add" },
        }),
      ];

      vi.mocked(PricingService.listRules).mockResolvedValue(mockRules);

      const { result } = renderHook(() =>
        useBasePricing({
          pricingContext: "worker",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.basePricing).toHaveLength(1);
      expect(result.current.basePricing[0].customer_base_price).toBe(50);
      expect(result.current.basePricing[0].worker_base_payment).toBe(50);
    });

    it("should handle errors when fetching", async () => {
      vi.mocked(PricingService.listRules).mockRejectedValue(
        new Error("Failed to fetch")
      );

      const { result } = renderHook(() =>
        useBasePricing({
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to fetch");
      expect(result.current.basePricing).toEqual([]);
    });
  });

  describe("upsertPricing - customer context", () => {
    it("should create new customer base pricing with add adjustment", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "customer",
        base_price: 100,
        metadata: { adjustment_type: "add" },
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useBasePricing({
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const pricing = await result.current.upsertPricing({
        customer_base_price: 100,
        adjustment_type: "add",
        pricingContext: "customer",
      });

      expect(pricing.customer_base_price).toBe(100);
      expect(pricing.adjustment_type).toBe("add");
      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: "org-1",
          scope: "base",
          pricing_type: "fixed",
          pricing_context: "customer",
          base_price: 100,
          percentage_rate: null,
        })
      );
    });

    it("should create new customer base pricing with multiply adjustment", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "customer",
        base_price: null,
        percentage_rate: 1.1,
        pricing_type: "percentage",
        metadata: { adjustment_type: "multiply" },
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useBasePricing({
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing({
        customer_base_price: 1.1,
        adjustment_type: "multiply",
        pricingContext: "customer",
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          pricing_type: "percentage",
          base_price: null,
          percentage_rate: 1.1,
        })
      );
    });

    it("should include worker_payment fields for customer pricing", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "customer",
        base_price: 100,
        worker_payment_type: "fixed_rate",
        worker_payment_value: 50,
        metadata: { adjustment_type: "add" },
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useBasePricing({
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing({
        customer_base_price: 100,
        worker_base_payment: 50,
        adjustment_type: "add",
        pricingContext: "customer",
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          pricing_context: "customer",
          worker_payment_type: "fixed_rate",
          worker_payment_value: 50,
        })
      );
    });

    it("should find existing rule by pricing_context and location", async () => {
      const existingRule = createMockPricingRule({
        id: "rule-1",
        pricing_context: "customer",
        location_id: "location-1",
        base_price: 100,
        metadata: { adjustment_type: "add" },
      });
      const updatedRule = createMockPricingRule({
        id: "rule-1",
        pricing_context: "customer",
        location_id: "location-1",
        base_price: 150,
        metadata: { adjustment_type: "add" },
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([existingRule]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(updatedRule);

      const { result } = renderHook(() =>
        useBasePricing({
          pricingContext: "customer",
          locationId: "location-1",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing({
        customer_base_price: 150,
        adjustment_type: "add",
        pricingContext: "customer",
        location_id: "location-1",
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "rule-1",
          base_price: 150,
        })
      );
    });
  });

  describe("upsertPricing - worker context", () => {
    it("should create new worker base pricing", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "worker",
        base_price: 50,
        metadata: { adjustment_type: "add" },
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useBasePricing({
          pricingContext: "worker",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing({
        customer_base_price: 50,
        adjustment_type: "add",
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
        metadata: { adjustment_type: "add" },
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useBasePricing({
          pricingContext: "worker",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const pricing = await result.current.upsertPricing({
        customer_base_price: 50,
        adjustment_type: "add",
        pricingContext: "worker",
      });

      // For worker context, worker_base_payment should come from base_price
      expect(pricing.customer_base_price).toBe(50);
      expect(pricing.worker_base_payment).toBe(50);
    });
  });

  describe("job type based pricing", () => {
    it("should create pricing with job type field config", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "customer",
        field_config_id: "job-type-field-1",
        option_value: "service-type-1",
        base_price: 100,
        metadata: { adjustment_type: "add" },
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useBasePricing({
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing({
        customer_base_price: 100,
        job_type_field_config_id: "job-type-field-1",
        job_type_value: "service-type-1",
        adjustment_type: "add",
        pricingContext: "customer",
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          field_config_id: "job-type-field-1",
          option_value: "service-type-1",
        })
      );
    });

    it("should find existing rule by job type", async () => {
      const existingRule = createMockPricingRule({
        id: "rule-1",
        pricing_context: "customer",
        field_config_id: "job-type-field-1",
        option_value: "service-type-1",
        base_price: 100,
        metadata: { adjustment_type: "add" },
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([existingRule]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(existingRule);

      const { result } = renderHook(() =>
        useBasePricing({
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing({
        customer_base_price: 150,
        job_type_field_config_id: "job-type-field-1",
        job_type_value: "service-type-1",
        adjustment_type: "add",
        pricingContext: "customer",
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "rule-1",
        })
      );
    });
  });

  describe("location scoping", () => {
    it("should create pricing with location override", async () => {
      const mockRule = createMockPricingRule({
        pricing_context: "customer",
        location_id: "location-1",
        base_price: 100,
        metadata: { adjustment_type: "add" },
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([]);
      vi.mocked(PricingService.upsertRule).mockResolvedValue(mockRule);

      const { result } = renderHook(() =>
        useBasePricing({
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing({
        customer_base_price: 100,
        adjustment_type: "add",
        pricingContext: "customer",
        location_id: "location-1",
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          location_id: "location-1",
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
          metadata: { adjustment_type: "add" },
        }),
      ];

      vi.mocked(PricingService.listRules).mockResolvedValue(mockRules);

      const { result } = renderHook(() =>
        useBasePricing({
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
          metadata: { adjustment_type: "add" },
        }),
      ];
      vi.mocked(PricingService.listRules).mockResolvedValue(newMockRules);

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.basePricing[0].customer_base_price).toBe(150);
      });
    });
  });

  describe("deletePricing", () => {
    it("should delete pricing rule and refetch", async () => {
      const mockRule = createMockPricingRule({
        id: "rule-1",
        pricing_context: "customer",
        metadata: { adjustment_type: "add" },
      });

      vi.mocked(PricingService.listRules).mockResolvedValue([mockRule]);
      vi.mocked(PricingService.deleteRule).mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useBasePricing({
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
