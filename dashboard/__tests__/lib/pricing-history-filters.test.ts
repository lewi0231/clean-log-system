import { entryMatchesScopeFilter, isHistoryEntryOrgWide } from "@/lib/pricing-history-filters";
import type { PricingHistoryEntry } from "@/lib/services/pricing.service";
import { describe, expect, it } from "vitest";

const base: PricingHistoryEntry = {
  id: "1",
  field_name: "Test",
  new_price: 10,
  effective_at: "2024-01-01",
  change_type: "created",
  pricing_context: "customer",
};

describe("isHistoryEntryOrgWide", () => {
  it("is true when no location or hierarchy is set and no name", () => {
    expect(
      isHistoryEntryOrgWide({
        ...base,
        location_name: undefined,
        location_id: null,
        location_hierarchy_id: null,
      })
    ).toBe(true);
  });

  it("is false when a location name is present", () => {
    expect(
      isHistoryEntryOrgWide({
        ...base,
        location_name: "Main Office",
        location_id: null,
        location_hierarchy_id: null,
      })
    ).toBe(false);
  });

  it("is false when location_id is set", () => {
    expect(
      isHistoryEntryOrgWide({
        ...base,
        location_id: "loc-1",
        location_hierarchy_id: null,
      })
    ).toBe(false);
  });
});

describe("entryMatchesScopeFilter", () => {
  const locs = [{ id: "loc-1", name: "Site A" } as const];
  const nodes = [{ id: "node-1", name: "North" } as const];

  it("all passes every row", () => {
    const entry: PricingHistoryEntry = {
      ...base,
      location_name: "Site A",
      location_id: "loc-1",
    };
    expect(entryMatchesScopeFilter(entry, "all", locs as never, nodes as never)).toBe(true);
  });

  it("default matches only org-wide rows", () => {
    const wide: PricingHistoryEntry = { ...base };
    const scoped: PricingHistoryEntry = {
      ...base,
      location_name: "Site A",
      location_id: "loc-1",
    };
    expect(entryMatchesScopeFilter(wide, "default", locs as never, nodes as never)).toBe(true);
    expect(entryMatchesScopeFilter(scoped, "default", locs as never, nodes as never)).toBe(false);
  });

  it("location:id matches by id or legacy name", () => {
    const withId: PricingHistoryEntry = {
      ...base,
      location_id: "loc-1",
      location_name: "Site A",
    };
    const legacy: PricingHistoryEntry = {
      ...base,
      location_name: "Site A",
    };
    expect(entryMatchesScopeFilter(withId, "location:loc-1", locs as never, nodes as never)).toBe(
      true
    );
    expect(entryMatchesScopeFilter(legacy, "location:loc-1", locs as never, nodes as never)).toBe(
      true
    );
  });

  it("node:id matches by hierarchy id or legacy name", () => {
    const withId: PricingHistoryEntry = {
      ...base,
      location_hierarchy_id: "node-1",
      location_name: "North",
    };
    const legacy: PricingHistoryEntry = {
      ...base,
      location_name: "North",
    };
    expect(entryMatchesScopeFilter(withId, "node:node-1", locs as never, nodes as never)).toBe(
      true
    );
    expect(entryMatchesScopeFilter(legacy, "node:node-1", locs as never, nodes as never)).toBe(
      true
    );
  });
});
