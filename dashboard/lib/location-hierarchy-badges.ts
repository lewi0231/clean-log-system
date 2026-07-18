import type { Location, LocationHierarchyNode } from "@/lib/types";

export type HierarchyBadge = {
  kind: "company" | "region";
  id: string;
  name: string;
};

/**
 * Resolve company/region badges for a location assigned to a hierarchy node.
 * Prefer nested API parent; fall back to hierarchy nodes by parent_id.
 */
export function resolveHierarchyBadges(
  hierarchyParent: Location["hierarchy_parent"],
  hierarchyParentId: string | null | undefined,
  nodes: LocationHierarchyNode[]
): HierarchyBadge[] {
  if (!hierarchyParent && !hierarchyParentId) {
    return [];
  }

  const assigned =
    (hierarchyParentId ? nodes.find((n) => n.id === hierarchyParentId) : undefined) ??
    hierarchyParent ??
    null;

  if (!assigned) {
    return [];
  }

  const badges: HierarchyBadge[] = [];

  if (assigned.type === "company") {
    badges.push({ kind: "company", id: assigned.id, name: assigned.name });
    return badges;
  }

  // Region: resolve parent company
  const parentId =
    ("parent_id" in assigned ? assigned.parent_id : null) ?? hierarchyParent?.parent_id ?? null;

  const company =
    (hierarchyParent?.parent?.type === "company" ? hierarchyParent.parent : null) ??
    (parentId ? nodes.find((n) => n.id === parentId && n.type === "company") : null) ??
    null;

  if (company) {
    badges.push({ kind: "company", id: company.id, name: company.name });
  }

  badges.push({ kind: "region", id: assigned.id, name: assigned.name });
  return badges;
}
