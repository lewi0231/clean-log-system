import { useFieldPricing } from "@/hooks/use-field-pricing";
import { PricingService } from "@/lib/services/pricing.service";
import type { PricingRule } from "@/lib/types";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/services/pricing.service");

const createMockPricingRule = (
  overrides?: Partial<PricingRule>
): PricingRule => ({
  id: "rule-1",
  organization_id: "org-1",
  scope: "field",
  pricing_type: "unit",
  pricing_context: "customer",
  field_config_id: "field-1",
  option_value: null,
  applies_to_field_type: "number",
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

describe("useFieldPricing", () => {
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
        useFieldPricing("org-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.fieldPricing).toHaveLength(1);
      expect(result.current.fieldPricing[0].customer_price).toBe(100);
      expect(PricingService.listRules).toHaveBeenCalledWith({
        organization_id: "org-1",
        scopes: ["field"],
        location_hierarchy_id: null,
        location_id: null,
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
        useFieldPricing("org-1", {
          pricingContext: "worker",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.fieldPricing).toHaveLength(1);
      expect(result.current.fieldPricing[0].customer_price).toBe(50);
      expect(result.current.fieldPricing[0].worker_payment_value).toBe(50);
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
        useFieldPricing("org-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const pricing = await result.current.upsertPricing("field-1", 100, {
        pricingContext: "customer",
        appliesToFieldType: "number",
        pricingType: "unit",
      });

      expect(pricing.customer_price).toBe(100);
      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: "org-1",
          scope: "field",
          pricing_type: "unit",
          pricing_context: "customer",
          field_config_id: "field-1",
          base_price: 100,
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
        useFieldPricing("org-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing("field-1", 100, {
        pricingContext: "customer",
        workerPaymentType: "fixed_rate",
        workerPaymentValue: 50,
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          pricing_context: "customer",
          worker_payment_type: "fixed_rate",
          worker_payment_value: 50,
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
        useFieldPricing("org-1", {
          pricingContext: "worker",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing("field-1", 50, {
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
        useFieldPricing("org-1", {
          pricingContext: "worker",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const pricing = await result.current.upsertPricing("field-1", 50, {
        pricingContext: "worker",
      });

      // For worker context, worker_payment_value should come from base_price
      expect(pricing.customer_price).toBe(50);
      expect(pricing.worker_payment_value).toBe(50);
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
        useFieldPricing("org-1", {
          pricingContext: "customer",
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.upsertPricing("field-1", 100, {
        pricingContext: "customer",
        locationId: "location-1",
      });

      expect(PricingService.upsertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          location_id: "location-1",
        })
      );
    });
  });
});
