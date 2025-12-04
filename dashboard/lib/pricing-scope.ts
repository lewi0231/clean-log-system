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

    records.forEach((record) => {
        const key = getKey(record);
        if (!key) return;

        if (params.locationId && record.location_id === params.locationId) {
            locationMatches.set(key, record);
            return;
        }

        if (
            params.locationHierarchyId &&
            record.location_hierarchy_id === params.locationHierarchyId &&
            !record.location_id
        ) {
            hierarchyMatches.set(key, record);
            return;
        }

        if (!record.location_id && !record.location_hierarchy_id) {
            defaultMatches.set(key, record);
        }
    });

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
