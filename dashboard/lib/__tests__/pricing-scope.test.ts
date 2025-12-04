import { describe, expect, it } from "vitest";
import {
    buildScopedPricingMap,
    getPricingScopeSource,
    isEntryForScope,
    type PricingScopeSource,
} from "../pricing-scope";

type TestRecord = {
    id: string;
    key: string;
    location_id?: string | null;
    location_hierarchy_id?: string | null;
};

let recordCounter = 0;
const makeRecord = (overrides: Partial<TestRecord>): TestRecord => ({
    id: `rec-${recordCounter++}`,
    key: "default",
    ...overrides,
});

describe("getPricingScopeSource", () => {
    it("returns location when locationId is provided", () => {
        expect(
            getPricingScopeSource({
                locationId: "loc-1",
                locationHierarchyId: "node-1",
            }),
        ).toBe<PricingScopeSource>("location");
    });

    it("returns hierarchy when only locationHierarchyId exists", () => {
        expect(
            getPricingScopeSource({
                locationId: null,
                locationHierarchyId: "node-1",
            }),
        ).toBe<PricingScopeSource>("hierarchy");
    });

    it("returns organization otherwise", () => {
        expect(getPricingScopeSource({})).toBe<PricingScopeSource>(
            "organization",
        );
    });
});

describe("buildScopedPricingMap", () => {
    const defaultRecord = makeRecord({ key: "wash" });
    const hierarchyRecord = makeRecord({
        key: "wash",
        location_hierarchy_id: "node-1",
    });
    const locationRecord = makeRecord({
        key: "wash",
        location_id: "loc-1",
    });

    it("prefers location-specific records", () => {
        const map = buildScopedPricingMap(
            [defaultRecord, hierarchyRecord, locationRecord],
            { locationId: "loc-1", locationHierarchyId: "node-1" },
            (record) => record.key,
        );

        expect(map["wash"]?.record.id).toBe(locationRecord.id);
        expect(map["wash"]?.source).toBe<PricingScopeSource>("location");
    });

    it("falls back to hierarchy when location override missing", () => {
        const map = buildScopedPricingMap(
            [defaultRecord, hierarchyRecord],
            { locationId: "loc-1", locationHierarchyId: "node-1" },
            (record) => record.key,
        );

        expect(map["wash"]?.record.id).toBe(hierarchyRecord.id);
        expect(map["wash"]?.source).toBe<PricingScopeSource>("hierarchy");
    });

    it("falls back to organization default when no overrides exist", () => {
        const map = buildScopedPricingMap(
            [defaultRecord],
            { locationId: "loc-1", locationHierarchyId: "node-1" },
            (record) => record.key,
        );

        expect(map["wash"]?.record.id).toBe(defaultRecord.id);
        expect(map["wash"]?.source).toBe<PricingScopeSource>("organization");
    });

    it("ignores overrides for other locations", () => {
        const otherLocationRecord = makeRecord({
            key: "wash",
            location_id: "loc-2",
        });

        const map = buildScopedPricingMap(
            [defaultRecord, otherLocationRecord],
            { locationId: "loc-1", locationHierarchyId: null },
            (record) => record.key,
        );

        expect(map["wash"]?.record.id).toBe(defaultRecord.id);
        expect(map["wash"]?.source).toBe<PricingScopeSource>("organization");
    });

    it("returns hierarchy entries when viewing a hierarchy directly", () => {
        const map = buildScopedPricingMap(
            [defaultRecord, hierarchyRecord],
            { locationId: null, locationHierarchyId: "node-1" },
            (record) => record.key,
        );

        expect(map["wash"]?.record.id).toBe(hierarchyRecord.id);
        expect(map["wash"]?.source).toBe<PricingScopeSource>("hierarchy");
    });
});

describe("isEntryForScope", () => {
    it("returns true when entry source matches scope", () => {
        expect(
            isEntryForScope(
                { record: makeRecord({}), source: "organization" },
                "organization",
            ),
        ).toBe(true);
    });

    it("returns false when entry source differs", () => {
        expect(
            isEntryForScope(
                { record: makeRecord({}), source: "hierarchy" },
                "location",
            ),
        ).toBe(false);
    });
});
