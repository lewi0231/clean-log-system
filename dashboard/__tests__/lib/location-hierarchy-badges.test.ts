import { resolveHierarchyBadges } from "@/lib/location-hierarchy-badges";
import { describe, expect, it } from "vitest";
import { createMockLocationHierarchyNode } from "../lib/fixtures";

describe("resolveHierarchyBadges", () => {
  const company = createMockLocationHierarchyNode({
    id: "company-1",
    name: "Acme",
    type: "company",
    parent_id: null,
  });
  const region = createMockLocationHierarchyNode({
    id: "region-1",
    name: "North",
    type: "region",
    parent_id: company.id,
  });

  it("returns empty when unassigned", () => {
    expect(resolveHierarchyBadges(null, null, [company, region])).toEqual([]);
  });

  it("returns company badge only when assigned to company", () => {
    expect(
      resolveHierarchyBadges({ id: company.id, name: company.name, type: "company" }, company.id, [
        company,
        region,
      ])
    ).toEqual([{ kind: "company", id: "company-1", name: "Acme" }]);
  });

  it("returns company + region when assigned to region with API parent", () => {
    expect(
      resolveHierarchyBadges(
        {
          id: region.id,
          name: region.name,
          type: "region",
          parent_id: company.id,
          parent: { id: company.id, name: company.name, type: "company" },
        },
        region.id,
        []
      )
    ).toEqual([
      { kind: "company", id: "company-1", name: "Acme" },
      { kind: "region", id: "region-1", name: "North" },
    ]);
  });

  it("resolves company from hierarchy nodes when API parent missing", () => {
    expect(
      resolveHierarchyBadges(
        { id: region.id, name: region.name, type: "region", parent_id: company.id },
        region.id,
        [company, region]
      )
    ).toEqual([
      { kind: "company", id: "company-1", name: "Acme" },
      { kind: "region", id: "region-1", name: "North" },
    ]);
  });

  it("returns region only when company parent cannot be resolved", () => {
    expect(
      resolveHierarchyBadges(
        { id: region.id, name: region.name, type: "region", parent_id: "missing" },
        region.id,
        [region]
      )
    ).toEqual([{ kind: "region", id: "region-1", name: "North" }]);
  });
});
