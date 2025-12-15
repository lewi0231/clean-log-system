export type PricingScopeSource = "location" | "hierarchy" | "organization";

interface PricingScopeParams {
    locationId?: string | null;
    locationHierarchyId?: string | null;
}

interface LocatablePricingRecord {
    location_id?: string | null;
    location_hierarchy_id?: string | null;
}

export interface ScopedPricingEntry<T> {
    record: T;
    source: PricingScopeSource;
}

export function getPricingScopeSource({
    locationId,
    locationHierarchyId,
}: PricingScopeParams): PricingScopeSource {
    if (locationId) {
        return "location";
    }
    if (locationHierarchyId) {
        return "hierarchy";
    }
    return "organization";
}

export function isEntryForScope(
    entry: ScopedPricingEntry<unknown> | undefined,
    scope: PricingScopeSource,
): boolean {
    return entry?.source === scope;
}

/**
 * Build a scoped pricing map that respects location hierarchy.
 *
 * Given a list of pricing records and scope parameters, this function:
 * 1. Groups records by their key (e.g., field_config_id)
 * 2. Selects the most specific location match (location > hierarchy > organization)
 * 3. Returns a map of key -> { record, source }
 *
 * The pricing model assumes ONE rule per (key, location, context) combination.
 * Historical changes are tracked in the audit table, not via multiple rules.
 */
export function buildScopedPricingMap<
    T extends LocatablePricingRecord,
    K extends string,
>(
    records: T[],
    params: PricingScopeParams,
    getKey: (record: T) => K | null | undefined,
): Partial<Record<K, ScopedPricingEntry<T>>> {
    const locationMatches = new Map<K, T>();
    const hierarchyMatches = new Map<K, T>();
    const defaultMatches = new Map<K, T>();

    // Categorize records by their location scope
    // First match wins (records are already sorted by priority from the API)
    records.forEach((record) => {
        const key = getKey(record);
        if (!key) return;

        // Exact location match (most specific)
        if (params.locationId && record.location_id === params.locationId) {
            if (!locationMatches.has(key)) {
                locationMatches.set(key, record);
            }
            return;
        }

        // Hierarchy match (less specific)
        if (
            params.locationHierarchyId &&
            record.location_hierarchy_id === params.locationHierarchyId &&
            !record.location_id
        ) {
            if (!hierarchyMatches.has(key)) {
                hierarchyMatches.set(key, record);
            }
            return;
        }

        // Organization default (least specific)
        if (!record.location_id && !record.location_hierarchy_id) {
            if (!defaultMatches.has(key)) {
                defaultMatches.set(key, record);
            }
        }
    });

    // Build the scoped map with hierarchy precedence
    const scopedMap: Partial<Record<K, ScopedPricingEntry<T>>> = {};

    const assignEntries = (
        source: PricingScopeSource,
        sourceMap: Map<K, T>,
    ) => {
        sourceMap.forEach((record, key) => {
            if (!scopedMap[key]) {
                scopedMap[key] = { record, source };
            }
        });
    };

    // Apply in order of specificity: location > hierarchy > organization
    if (params.locationId) {
        assignEntries("location", locationMatches);
        if (params.locationHierarchyId) {
            assignEntries("hierarchy", hierarchyMatches);
        }
        assignEntries("organization", defaultMatches);
    } else if (params.locationHierarchyId) {
        assignEntries("hierarchy", hierarchyMatches);
        assignEntries("organization", defaultMatches);
    } else {
        assignEntries("organization", defaultMatches);
    }

    return scopedMap;
}
