/**
 * Re-export shared hierarchy billing helpers for Deno edge functions.
 * Canonical implementation: shared/utils/hierarchy-billing.ts
 *
 * Also provides async resolveHierarchyBilling(supabase, …) for Edge callers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export {
  companyForcesChildrenBilling,
  extractBillingAddressFromMetadata,
  formatBillingAddressLines,
  formatServiceAddressLines,
  isBillingEmailFormat,
  isDisplayUsableBilling,
  isEmailUsableBilling,
  normalizeBillingAddress,
  resolveHierarchyBillingFromNodes,
  selectPrimaryInvoiceJob,
  unwrapRelation,
  type HierarchyBillingAddress,
  type HierarchyBillingNode,
  type HierarchyBillingUsability,
  type HierarchyNodeType,
  type InvoiceJobLike,
  type PrimaryInvoiceJobSelection,
  type PrimaryInvoiceLocation,
  type ResolvedHierarchyBilling,
} from "../../../../shared/utils/hierarchy-billing.ts";

import {
  resolveHierarchyBillingFromNodes,
  type HierarchyBillingNode,
  type HierarchyBillingUsability,
  type ResolvedHierarchyBilling,
} from "../../../../shared/utils/hierarchy-billing.ts";

const NODE_SELECT = "id, type, name, parent_id, metadata, active";

async function loadNode(
  supabase: SupabaseClient,
  id: string
): Promise<HierarchyBillingNode | null> {
  const { data, error } = await supabase
    .from("location_hierarchy")
    .select(NODE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    // Fail closed to "no billing" but surface the failure for operators/logs.
    console.error("hierarchy-billing: failed to load node", { id, error });
    return null;
  }
  if (!data) return null;
  return data as HierarchyBillingNode;
}

/**
 * Resolve hierarchy billing for a location's hierarchy_parent_id.
 */
export async function resolveHierarchyBilling(
  supabase: SupabaseClient,
  hierarchyParentId: string | null | undefined,
  predicate: HierarchyBillingUsability
): Promise<ResolvedHierarchyBilling | null> {
  if (!hierarchyParentId) return null;

  const parent = await loadNode(supabase, hierarchyParentId);
  if (!parent) return null;

  let company: HierarchyBillingNode | null = null;
  if (parent.type === "region" && parent.parent_id) {
    company = await loadNode(supabase, parent.parent_id);
  }

  return resolveHierarchyBillingFromNodes(parent, company, predicate);
}

/**
 * Load hierarchy nodes for invoice jobs: immediate parents + company grandparents.
 */
export async function loadHierarchyMetadataForParentIds(
  supabase: SupabaseClient,
  hierarchyParentIds: string[]
): Promise<
  Record<
    string,
    {
      id: string;
      type: string;
      name: string;
      parent_id?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  >
> {
  const hierarchyMetadata: Record<
    string,
    {
      id: string;
      type: string;
      name: string;
      parent_id?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  > = {};

  const unique = [...new Set(hierarchyParentIds.filter(Boolean))];
  if (unique.length === 0) return hierarchyMetadata;

  const { data: nodes, error } = await supabase
    .from("location_hierarchy")
    .select(NODE_SELECT)
    .in("id", unique);

  if (error || !nodes) return hierarchyMetadata;

  const companyIds = new Set<string>();
  for (const node of nodes) {
    hierarchyMetadata[node.id] = {
      id: node.id,
      type: node.type,
      name: node.name,
      parent_id: node.parent_id,
      metadata: node.metadata,
    };
    if (node.type === "region" && node.parent_id) {
      companyIds.add(node.parent_id);
    }
  }

  const missingCompanyIds = [...companyIds].filter((id) => !hierarchyMetadata[id]);
  if (missingCompanyIds.length > 0) {
    const { data: companies } = await supabase
      .from("location_hierarchy")
      .select(NODE_SELECT)
      .in("id", missingCompanyIds);
    if (companies) {
      for (const node of companies) {
        hierarchyMetadata[node.id] = {
          id: node.id,
          type: node.type,
          name: node.name,
          parent_id: node.parent_id,
          metadata: node.metadata,
        };
      }
    }
  }

  return hierarchyMetadata;
}
