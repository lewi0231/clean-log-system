import type { PricingHistoryEntry } from "@/lib/services/pricing.service";
import type { Location } from "@/lib/types";
import type { LocationHierarchyNode } from "@/lib/types";

/** `all` | `default` (org-wide) | `location:<id>` | `node:<id>` */
export type PricingHistoryScopeFilter = string;

/**
 * True when a history row is organization-wide (applies to all sites unless overridden).
 * Rows without a location label are always treated as default.
 */
export function isHistoryEntryOrgWide(entry: PricingHistoryEntry): boolean {
  if (entry.location_name && entry.location_name.trim() !== "") {
    return false;
  }
  if (entry.location_id || entry.location_hierarchy_id) {
    return false;
  }
  return true;
}

/**
 * Returns whether a history entry matches the selected scope filter.
 * Supports legacy rows that only have `location_name` (no ids from older API).
 */
export function entryMatchesScopeFilter(
  entry: PricingHistoryEntry,
  filter: PricingHistoryScopeFilter,
  locations: Location[],
  nodes: LocationHierarchyNode[]
): boolean {
  if (filter === "all") return true;
  if (filter === "default") {
    return isHistoryEntryOrgWide(entry);
  }
  if (filter.startsWith("location:")) {
    const id = filter.slice("location:".length);
    if (entry.location_id) return entry.location_id === id;
    const loc = locations.find((l) => l.id === id);
    return !!loc && entry.location_name === loc.name;
  }
  if (filter.startsWith("node:")) {
    const id = filter.slice("node:".length);
    if (entry.location_hierarchy_id) {
      return entry.location_hierarchy_id === id;
    }
    const node = nodes.find((n) => n.id === id);
    return !!node && entry.location_name === node.name;
  }
  return true;
}
