import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

interface ListPricingRulesRequest {
  organization_id: string;
  scopes?: string[];
  include_inactive?: boolean;
  effective_at?: string;
  location_hierarchy_id?: string | null;
  location_id?: string | null;
  field_config_id?: string;
  option_value?: string;
  pricing_context?: "customer" | "worker"; // Filter by pricing context
  [key: string]: unknown;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json()) as ListPricingRulesRequest;
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const {
      organization_id,
      scopes,
      include_inactive,
      effective_at,
      location_hierarchy_id,
      location_id,
      field_config_id,
      option_value,
      pricing_context,
    } = body;

    const supabase = createServiceRoleClient();

    const { data: hierarchyNodes, error: hierarchyError } =
      location_hierarchy_id
        ? await supabase
          .from("location_hierarchy")
          .select("id,parent_id")
          .eq("organization_id", organization_id)
        : { data: null, error: null };

    if (hierarchyError) throw hierarchyError;

    let query = supabase
      .from("pricing_rule")
      .select(
        `
        *,
        field_config:field_config_id (
          id,
          name,
          label,
          field_type
        ),
        location:location_id (
          id,
          name
        ),
        location_node:location_hierarchy_id (
          id,
          name,
          type,
          parent_id
        ),
        conditions:pricing_condition (
          id,
          pricing_rule_id,
          condition_field_config_id,
          operator,
          condition_value,
          action_type,
          action_value,
          metadata,
          priority
        )
      `,
      )
      .eq("organization_id", organization_id)
      .order("priority", { ascending: true })
      .order("effective_at", { ascending: false });

    if (scopes && scopes.length > 0) {
      query = query.in("scope", scopes);
    }

    if (!include_inactive) {
      query = query.eq("active", true);
    }

    if (field_config_id) {
      query = query.eq("field_config_id", field_config_id);
    }

    if (option_value) {
      query = query.eq("option_value", option_value);
    }

    if (pricing_context) {
      query = query.eq("pricing_context", pricing_context);
    }

    if (effective_at) {
      // Convert to full timestamp for filtering
      // Date-only strings (YYYY-MM-DD) → end of that day in UTC
      // Full timestamps → use as-is
      let effectiveDate: string;

      if (effective_at.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Date-only format: parse as UTC and set to end of day
        // Important: new Date("YYYY-MM-DD") parses as LOCAL time, which causes timezone issues
        // We want end of the specified UTC day to include all rules from that day
        effectiveDate = `${effective_at}T23:59:59.999Z`;
      } else {
        // Full timestamp: normalize to ISO string
        effectiveDate = new Date(effective_at).toISOString();
      }

      // Filter for rules that are effective at or before the specified date/time
      // and either haven't expired or expire after the effective date
      query = query
        .lte("effective_at", effectiveDate)
        .or(`expires_at.is.null,expires_at.gt.${effectiveDate}`);
    }

    const { data: pricingRules, error: rulesError } = await query;
    if (rulesError) throw rulesError;

    let filteredRules = pricingRules || [];

    if (location_id || location_hierarchy_id) {
      const allowedHierarchyIds = new Set<string>();
      if (location_hierarchy_id) {
        allowedHierarchyIds.add(location_hierarchy_id);
        const nodes = hierarchyNodes || [];
        let currentId: string | null = location_hierarchy_id;
        const nodeMap = new Map(nodes.map((node) => [node.id, node]));
        while (currentId) {
          const node = nodeMap.get(currentId);
          if (node?.parent_id) {
            allowedHierarchyIds.add(node.parent_id);
            currentId = node.parent_id;
          } else {
            currentId = null;
          }
        }
      }

      filteredRules = filteredRules.filter((rule) => {
        const matchesLocation = !location_id || !rule.location_id ||
          rule.location_id === location_id;

        const matchesHierarchy = !location_hierarchy_id ||
          !rule.location_hierarchy_id ||
          allowedHierarchyIds.has(rule.location_hierarchy_id);

        return matchesLocation && matchesHierarchy;
      });
    }

    return jsonResponse({
      success: true,
      pricing_rules: filteredRules,
    });
  } catch (error) {
    console.error("List pricing rules error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to list pricing rules",
    );
  }
});
