import { describe, expect, it } from "vitest";
import {
  buildOrgDefaultPricingMap,
  hasEffectiveOptionPrice,
  resolveDisplayScope,
} from "../pricing-scope-display";

describe("pricing-scope-display", () => {
  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

  it("resolveDisplayScope returns all-yards-default when no preview", () => {
    const result = resolveDisplayScope(
      {
        record: { customer_price: 8, location_id: null, location_hierarchy_id: null },
        source: "organization",
      },
      undefined,
      undefined,
      undefined,
      0,
      false,
      formatCurrency
    );
    expect(result.chip).toBe("all-yards-default");
    expect(result.effectiveCustomerPrice).toBe(8);
  });

  it("resolveDisplayScope returns inherited when preview yard uses org default", () => {
    const result = resolveDisplayScope(
      {
        record: { customer_price: 8, location_id: null, location_hierarchy_id: null },
        source: "organization",
      },
      undefined,
      {
        record: { customer_price: 8, location_id: null, location_hierarchy_id: null },
        source: "organization",
      },
      undefined,
      0,
      true,
      formatCurrency
    );
    expect(result.chip).toBe("inherited");
    expect(result.inheritedLabel).toContain("$8.00");
  });

  it("resolveDisplayScope returns yard-override when preview has location rule", () => {
    const result = resolveDisplayScope(
      {
        record: { customer_price: 8, location_id: null, location_hierarchy_id: null },
        source: "organization",
      },
      undefined,
      {
        record: { customer_price: 9, location_id: "loc-1", location_hierarchy_id: null },
        source: "location",
      },
      undefined,
      1,
      true,
      formatCurrency
    );
    expect(result.chip).toBe("yard-override");
    expect(result.effectiveCustomerPrice).toBe(9);
  });

  it("hasEffectiveOptionPrice counts inherited org default as priced", () => {
    expect(
      hasEffectiveOptionPrice(
        {
          record: { customer_price: 8 },
          source: "organization",
        },
        undefined,
        true
      )
    ).toBe(true);
  });

  it("buildOrgDefaultPricingMap only includes org-default rules", () => {
    const map = buildOrgDefaultPricingMap(
      [
        {
          option_value: "Nissan",
          customer_price: 8,
          location_id: null,
          location_hierarchy_id: null,
        },
        {
          option_value: "Nissan",
          customer_price: 9,
          location_id: "loc-1",
          location_hierarchy_id: null,
        },
      ],
      (r) => r.option_value ?? null
    );
    expect(map.Nissan?.record.customer_price).toBe(8);
    expect(map.Nissan?.source).toBe("organization");
  });
});
