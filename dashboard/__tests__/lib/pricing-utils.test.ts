import { getLocationOverrides, parsePriceString } from "@/lib/pricing-utils";
import type { FieldPricing, PricingRule } from "@/lib/types";
import { describe, expect, it } from "vitest";

describe("parsePriceString", () => {
  it("returns undefined for empty or whitespace input", () => {
    expect(parsePriceString(undefined)).toBeUndefined();
    expect(parsePriceString("")).toBeUndefined();
    expect(parsePriceString("   ")).toBeUndefined();
  });

  it("returns undefined for invalid or negative numbers", () => {
    expect(parsePriceString("abc")).toBeUndefined();
    expect(parsePriceString("-1")).toBeUndefined();
  });

  it("parses valid non-negative numbers including zero", () => {
    expect(parsePriceString("0")).toBe(0);
    expect(parsePriceString("12.5")).toBe(12.5);
    expect(parsePriceString("  8  ")).toBe(8);
  });
});

describe("getLocationOverrides", () => {
  const createMockPricing = (
    id: string,
    fieldConfigId: string,
    locationId: string | null,
    locationHierarchyId: string | null,
    pricingContext: "customer" | "worker",
    customerPrice: number,
    workerPaymentValue: number | null = null
  ): FieldPricing => {
    const now = new Date().toISOString();
    return {
      id,
      organization_id: "org-1",
      field_config_id: fieldConfigId,
      location_id: locationId,
      location_hierarchy_id: locationHierarchyId,
      pricing_type: "unit",
      customer_price: customerPrice,
      currency: "USD",
      applies_to_field_type: null,
      worker_payment_type: pricingContext === "customer" ? "fixed_rate" : null,
      worker_payment_value: workerPaymentValue,
      source_rule: {
        id,
        organization_id: "org-1",
        scope: "field",
        pricing_type: "unit",
        pricing_context: pricingContext,
        field_config_id: fieldConfigId,
        option_value: null,
        applies_to_field_type: null,
        location_id: locationId,
        location_hierarchy_id: locationHierarchyId,
        currency: "USD",
        base_price: customerPrice,
        percentage_rate: null,
        minimum_quantity: null,
        maximum_quantity: null,
        tier_definition: null,
        metadata: {},
        worker_payment_type: pricingContext === "customer" ? "fixed_rate" : null,
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
        location: locationId
          ? {
              id: locationId,
              name: `Location ${locationId}`,
            }
          : null,
        location_node: locationHierarchyId
          ? {
              id: locationHierarchyId,
              name: `Node ${locationHierarchyId}`,
              type: "region" as const,
              parent_id: null,
            }
          : null,
        conditions: [],
      } as PricingRule,
      field_config: null,
      location: locationId
        ? {
            id: locationId,
            name: `Location ${locationId}`,
          }
        : null,
      location_node: locationHierarchyId
        ? {
            id: locationHierarchyId,
            name: `Node ${locationHierarchyId}`,
            type: "region" as const,
            parent_id: null,
          }
        : null,
    };
  };

  it("should return empty array when no pricing matches field config", () => {
    const pricing: FieldPricing[] = [
      createMockPricing("1", "field-2", "loc-1", null, "customer", 100),
    ];

    const result = getLocationOverrides(pricing, "field-1");

    expect(result).toEqual([]);
  });

  it("should filter out pricing without location or hierarchy", () => {
    const pricing: FieldPricing[] = [
      createMockPricing("1", "field-1", null, null, "customer", 100),
      createMockPricing("2", "field-1", "loc-1", null, "customer", 200),
    ];

    const result = getLocationOverrides(pricing, "field-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should filter by pricing context", () => {
    const pricing: FieldPricing[] = [
      createMockPricing("1", "field-1", "loc-1", null, "customer", 100),
      createMockPricing("2", "field-1", "loc-2", null, "worker", 200),
    ];

    const customerResult = getLocationOverrides(pricing, "field-1", null, null, "customer");
    const workerResult = getLocationOverrides(pricing, "field-1", null, null, "worker");

    expect(customerResult).toHaveLength(1);
    expect(customerResult[0].id).toBe("1");
    expect(workerResult).toHaveLength(1);
    expect(workerResult[0].id).toBe("2");
  });

  it("should exclude current location from overrides", () => {
    const pricing: FieldPricing[] = [
      createMockPricing("1", "field-1", "loc-1", null, "customer", 100),
      createMockPricing("2", "field-1", "loc-2", null, "customer", 200),
    ];

    const result = getLocationOverrides(pricing, "field-1", "loc-1", null, "customer");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should exclude current location hierarchy from overrides", () => {
    const pricing: FieldPricing[] = [
      createMockPricing("1", "field-1", null, "hier-1", "customer", 100),
      createMockPricing("2", "field-1", null, "hier-2", "customer", 200),
    ];

    const result = getLocationOverrides(pricing, "field-1", null, "hier-1", "customer");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should exclude default scope when no location is selected", () => {
    const pricing: FieldPricing[] = [
      createMockPricing("1", "field-1", null, null, "customer", 100),
      createMockPricing("2", "field-1", "loc-1", null, "customer", 200),
    ];

    const result = getLocationOverrides(pricing, "field-1", null, null, "customer");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should include worker payment for customer context rules", () => {
    const pricing: FieldPricing[] = [
      createMockPricing("1", "field-1", "loc-1", null, "customer", 100, 50),
    ];

    const result = getLocationOverrides(pricing, "field-1", null, null, "customer");

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(100);
    expect(result[0].workerPayment).toBe(50);
  });

  it("should not include worker payment for worker context rules", () => {
    const pricing: FieldPricing[] = [
      createMockPricing("1", "field-1", "loc-1", null, "worker", 200),
    ];

    const result = getLocationOverrides(pricing, "field-1", null, null, "worker");

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(200);
    expect(result[0].workerPayment).toBeNull();
  });

  it("should set scopeLabel from location name when available", () => {
    const pricing: FieldPricing[] = [
      createMockPricing("1", "field-1", "loc-1", null, "customer", 100),
    ];

    const result = getLocationOverrides(pricing, "field-1", null, null, "customer");

    expect(result[0].scopeLabel).toBe("Location loc-1");
    expect(result[0].scopeType).toBe("location");
  });

  it("should set scopeLabel from location hierarchy name when available", () => {
    const pricing: FieldPricing[] = [
      createMockPricing("1", "field-1", null, "hier-1", "customer", 100),
    ];

    const result = getLocationOverrides(pricing, "field-1", null, null, "customer");

    expect(result[0].scopeLabel).toBe("Node hier-1");
    expect(result[0].scopeType).toBe("hierarchy");
  });

  it("should set isActive and isFuture based on effective dates", () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 86400000).toISOString(); // 1 day ago
    const futureDate = new Date(now.getTime() + 86400000).toISOString(); // 1 day from now

    const activePricing = createMockPricing("1", "field-1", "loc-1", null, "customer", 100);
    activePricing.source_rule.effective_at = pastDate;

    const futurePricing = createMockPricing("2", "field-1", "loc-2", null, "customer", 200);
    futurePricing.source_rule.effective_at = futureDate;

    const result = getLocationOverrides(
      [activePricing, futurePricing],
      "field-1",
      null,
      null,
      "customer"
    );

    expect(result).toHaveLength(2);
    expect(result[0].isActive).toBe(true);
    expect(result[0].isFuture).toBe(false);
    // Future dates are not active (isActive = false) and are marked as future
    expect(result[1].isActive).toBe(false);
    expect(result[1].isFuture).toBe(true);
  });
});
