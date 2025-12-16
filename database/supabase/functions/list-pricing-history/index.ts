import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

interface ListPricingHistoryRequest {
  organization_id: string;
  date_from?: string;
  date_to?: string;
  [key: string]: unknown;
}

interface PricingRuleRow {
  id: string;
}

interface AuditEntry {
  id: number;
  pricing_rule_id: string | null;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_at: string;
}

interface PricingRuleData {
  id: string;
  organization_id: string;
  scope: string;
  pricing_context?: string | null;
  field_config_id: string | null;
  option_value: string | null;
  location_id: string | null;
  location_hierarchy_id: string | null;
  base_price: number | null;
  percentage_rate: number | null;
  effective_at: string;
  expires_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  field_config?: {
    id: string;
    name: string;
    label: string;
  } | null;
  location?: {
    id: string;
    name: string;
  } | null;
  location_node?: {
    id: string;
    name: string;
  } | null;
}

interface FieldConfig {
  id: string;
  name: string;
  label: string;
}

interface Location {
  id: string;
  name: string;
}

interface LocationNode {
  id: string;
  name: string;
}

interface PricingData {
  scope?: string; // e.g., "base", "field", "option", "global"
  pricing_type?: string;
  pricing_context?: string;
  percentage_rate?: number | null;
  base_price?: number | null;
  field_config_id?: string;
  field_config?: {
    label?: string;
    name?: string;
  };
  location_id?: string;
  location_hierarchy_id?: string;
  location?: {
    name?: string;
  };
  location_node?: {
    name?: string;
  };
  option_value?: string;
  effective_at?: string;
  expires_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json()) as ListPricingHistoryRequest;
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id, date_from, date_to } = body;

    const supabase = createServiceRoleClient();

    // First, get all pricing rule IDs for this organization
    const { data: pricingRules, error: rulesError } = await supabase
      .from("pricing_rule")
      .select("id")
      .eq("organization_id", organization_id);

    if (rulesError) throw rulesError;

    if (!pricingRules || pricingRules.length === 0) {
      return jsonResponse({
        success: true,
        pricing_history: [],
      });
    }

    const pricingRuleIds = pricingRules.map((rule: PricingRuleRow) => rule.id);

    if (pricingRuleIds.length === 0) {
      return jsonResponse({
        success: true,
        pricing_history: [],
      });
    }

    // Query the audit table
    let query = supabase
      .from("pricing_rule_audit")
      .select("id, pricing_rule_id, action, old_data, new_data, changed_at")
      .in("pricing_rule_id", pricingRuleIds)
      .order("changed_at", { ascending: false });

    // Filter by date range if provided
    if (date_from) {
      query = query.gte("changed_at", date_from);
    }
    if (date_to) {
      // Add one day to include the entire end date
      const endDate = new Date(date_to);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt("changed_at", endDate.toISOString());
    }

    const { data: auditEntries, error: auditError } = await query;

    if (auditError) {
      console.error("Error querying pricing_rule_audit:", {
        error: auditError,
        message: auditError.message,
        code: auditError.code,
        hint: auditError.hint,
        details: auditError.details,
      });
      throw auditError;
    }

    if (!auditEntries || auditEntries.length === 0) {
      return jsonResponse({
        success: true,
        pricing_history: [],
      });
    }

    // Get unique pricing rule IDs and field config IDs from audit entries
    const uniqueRuleIds = [
      ...new Set(
        auditEntries
          .map((entry: AuditEntry) => entry.pricing_rule_id)
          .filter((id: string | null): id is string => id !== null),
      ),
    ];

    // Extract field config IDs from audit data (for deleted rules)
    const fieldConfigIdsFromAudit = new Set<string>();
    auditEntries.forEach((entry: AuditEntry) => {
      const oldData = entry.old_data as PricingData | null;
      const newData = entry.new_data as PricingData | null;
      if (oldData?.field_config_id) {
        fieldConfigIdsFromAudit.add(oldData.field_config_id);
      }
      if (newData?.field_config_id) {
        fieldConfigIdsFromAudit.add(newData.field_config_id);
      }
    });

    // Fetch pricing rules with related data (if they still exist)
    const rulesMap = new Map<string, PricingRuleData>();
    if (uniqueRuleIds.length > 0) {
      const { data: rulesWithRelations, error: rulesError } = await supabase
        .from("pricing_rule")
        .select(
          `
          id,
          organization_id,
          scope,
          pricing_context,
          field_config_id,
          option_value,
          location_id,
          location_hierarchy_id,
          base_price,
          percentage_rate,
          effective_at,
          expires_at,
          created_by,
          updated_by,
          field_config:field_config_id (
            id,
            name,
            label
          ),
          location:location_id (
            id,
            name
          ),
          location_node:location_hierarchy_id (
            id,
            name
          )
        `,
        )
        .in("id", uniqueRuleIds);

      if (rulesError) throw rulesError;

      // Type the result as unknown first to avoid type inference issues with Supabase nested selects
      const rules = (rulesWithRelations || []) as unknown[];

      rules.forEach((rule: unknown) => {
        const typedRule = rule as {
          id: string;
          organization_id: string;
          scope: string;
          field_config_id: string | null;
          option_value: string | null;
          location_id: string | null;
          location_hierarchy_id: string | null;
          base_price: number | null;
          percentage_rate: number | null;
          effective_at: string;
          expires_at: string | null;
          created_by: string | null;
          updated_by: string | null;
          field_config?:
            | {
              id: string;
              name: string;
              label: string;
            }
            | Array<{
              id: string;
              name: string;
              label: string;
            }>
            | null;
          location?:
            | {
              id: string;
              name: string;
            }
            | Array<{
              id: string;
              name: string;
            }>
            | null;
          location_node?:
            | {
              id: string;
              name: string;
            }
            | Array<{
              id: string;
              name: string;
            }>
            | null;
        };

        // Normalize nested relations (Supabase may return arrays for nested selects)
        const normalizedRule: PricingRuleData = {
          id: typedRule.id,
          organization_id: typedRule.organization_id,
          scope: typedRule.scope,
          pricing_context: (typedRule as { pricing_context?: string | null })
            .pricing_context || null,
          field_config_id: typedRule.field_config_id,
          option_value: typedRule.option_value,
          location_id: typedRule.location_id,
          location_hierarchy_id: typedRule.location_hierarchy_id,
          base_price: typedRule.base_price,
          percentage_rate: typedRule.percentage_rate,
          effective_at: typedRule.effective_at,
          expires_at: typedRule.expires_at,
          created_by: typedRule.created_by,
          updated_by: typedRule.updated_by,
          field_config: Array.isArray(typedRule.field_config)
            ? typedRule.field_config[0] || null
            : typedRule.field_config || null,
          location: Array.isArray(typedRule.location)
            ? typedRule.location[0] || null
            : typedRule.location || null,
          location_node: Array.isArray(typedRule.location_node)
            ? typedRule.location_node[0] || null
            : typedRule.location_node || null,
        };

        rulesMap.set(normalizedRule.id, normalizedRule);
      });
    }

    // Fetch field configs for deleted rules or when rule doesn't have the relation
    const fieldConfigMap = new Map<string, FieldConfig>();
    if (fieldConfigIdsFromAudit.size > 0) {
      const { data: fieldConfigs, error: fieldConfigsError } = await supabase
        .from("organization_field_configs")
        .select("id, name, label")
        .in("id", Array.from(fieldConfigIdsFromAudit))
        .eq("organization_id", organization_id);

      if (fieldConfigsError) throw fieldConfigsError;

      (fieldConfigs || []).forEach((fc: FieldConfig) => {
        fieldConfigMap.set(fc.id, fc);
      });
    }

    // Fetch locations for deleted rules
    const locationIdsFromAudit = new Set<string>();
    auditEntries.forEach((entry: AuditEntry) => {
      const oldData = entry.old_data as PricingData | null;
      const newData = entry.new_data as PricingData | null;
      if (oldData?.location_id) {
        locationIdsFromAudit.add(oldData.location_id);
      }
      if (newData?.location_id) {
        locationIdsFromAudit.add(newData.location_id);
      }
      if (oldData?.location_hierarchy_id) {
        locationIdsFromAudit.add(oldData.location_hierarchy_id);
      }
      if (newData?.location_hierarchy_id) {
        locationIdsFromAudit.add(newData.location_hierarchy_id);
      }
    });

    const locationMap = new Map<string, Location | LocationNode>();
    if (locationIdsFromAudit.size > 0) {
      const { data: locations, error: locationsError } = await supabase
        .from("location")
        .select("id, name")
        .in("id", Array.from(locationIdsFromAudit));

      if (locationsError) throw locationsError;

      (locations || []).forEach((loc: Location) => {
        locationMap.set(loc.id, loc);
      });

      const { data: locationNodes, error: nodesError } = await supabase
        .from("location_hierarchy")
        .select("id, name")
        .in("id", Array.from(locationIdsFromAudit));

      if (nodesError) throw nodesError;

      (locationNodes || []).forEach((node: LocationNode) => {
        locationMap.set(node.id, node);
      });
    }

    // Collect unique user IDs from audit entries to look up emails
    const userIdsFromAudit = new Set<string>();
    auditEntries.forEach((entry: AuditEntry) => {
      const oldData = entry.old_data as PricingData | null;
      const newData = entry.new_data as PricingData | null;
      if (oldData?.updated_by && typeof oldData.updated_by === "string") {
        userIdsFromAudit.add(oldData.updated_by);
      }
      if (oldData?.created_by && typeof oldData.created_by === "string") {
        userIdsFromAudit.add(oldData.created_by);
      }
      if (newData?.updated_by && typeof newData.updated_by === "string") {
        userIdsFromAudit.add(newData.updated_by);
      }
      if (newData?.created_by && typeof newData.created_by === "string") {
        userIdsFromAudit.add(newData.created_by);
      }
    });

    // Look up user emails from auth.users
    const userEmailMap = new Map<string, string>();
    if (userIdsFromAudit.size > 0) {
      // Use auth.admin.getUserById for each user ID
      // Note: We need to use the service role client to access auth.users
      for (const userId of userIdsFromAudit) {
        try {
          const { data: user, error: userError } = await supabase.auth.admin
            .getUserById(userId);
          if (!userError && user?.user?.email) {
            userEmailMap.set(userId, user.user.email);
          }
        } catch (error) {
          console.warn(`Failed to look up user email for ${userId}:`, error);
          // Continue with other users
        }
      }
    }

    // Helper function to safely extract pricing data from JSONB
    const extractPricingData = (
      data: Record<string, unknown> | null,
    ): PricingData | null => {
      if (!data) return null;
      return data as PricingData;
    };

    // Transform the audit data into the format expected by the frontend
    const pricingHistory = auditEntries.map((entry: AuditEntry) => {
      const rule = entry.pricing_rule_id
        ? rulesMap.get(entry.pricing_rule_id)
        : null;
      const oldData = extractPricingData(entry.old_data);
      const newData = extractPricingData(entry.new_data);

      // Determine the price values
      const getPrice = (data: PricingData | null): number | null => {
        fetch(
          "http://127.0.0.1:7242/ingest/0d1ba94f-1dd7-415c-b280-fce28d1bc840",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "list-pricing-history/index.ts:436",
              message: "getPrice called",
              data: {
                hasData: !!data,
                basePrice: data?.base_price,
                basePriceType: typeof data?.base_price,
                pricingType: data?.pricing_type,
                percentageRate: data?.percentage_rate,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "A",
            }),
          },
        ).catch(() => {});
        // #endregion
        if (!data) return null;
        // For percentage pricing, use percentage_rate
        // Check explicitly for null/undefined, not truthy (0 is valid)
        if (
          data.pricing_type === "percentage" &&
          data.percentage_rate !== null &&
          data.percentage_rate !== undefined
        ) {
          return Number(data.percentage_rate) * 100; // Convert to percentage
        }
        // Otherwise use base_price
        // Check explicitly for null/undefined, not truthy (0 is valid)
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/0d1ba94f-1dd7-415c-b280-fce28d1bc840",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "list-pricing-history/index.ts:443",
              message: "base_price check (post-fix)",
              data: {
                basePrice: data.base_price,
                basePriceNull: data.base_price === null,
                basePriceUndefined: data.base_price === undefined,
                willReturn:
                  data.base_price !== null && data.base_price !== undefined
                    ? Number(data.base_price)
                    : null,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "post-fix",
              hypothesisId: "A",
            }),
          },
        ).catch(() => {});
        // #endregion
        return data.base_price !== null && data.base_price !== undefined
          ? Number(data.base_price)
          : null;
      };

      const oldPrice = getPrice(oldData);
      const newPrice = getPrice(newData);
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/0d1ba94f-1dd7-415c-b280-fce28d1bc840",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "list-pricing-history/index.ts:447",
            message: "Price extraction results",
            data: {
              oldPrice,
              newPrice,
              oldPriceType: typeof oldPrice,
              newPriceType: typeof newPrice,
              oldDataBasePrice: oldData?.base_price,
              newDataBasePrice: newData?.base_price,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "A",
          }),
        },
      ).catch(() => {});
      // #endregion

      // Determine change type
      let changeType: "created" | "updated" | "expired" = "updated";
      if (entry.action === "INSERT") {
        changeType = "created";
      } else if (entry.action === "UPDATE") {
        changeType = "updated";
      } else if (entry.action === "DELETE") {
        changeType = "expired";
      }

      // Get field name - prefer from rule, fallback to field config map, then data
      const fieldConfig = rule?.field_config;
      const fieldConfigId = rule?.field_config_id ||
        newData?.field_config_id ||
        oldData?.field_config_id;
      const fieldConfigFromMap = fieldConfigId
        ? fieldConfigMap.get(fieldConfigId)
        : null;

      // Determine the scope for better fallback naming
      const ruleScope = rule?.scope || newData?.scope || oldData?.scope;

      // Determine field name with better fallbacks for different scopes
      let fieldName: string;
      if (fieldConfig?.label || fieldConfig?.name) {
        fieldName = fieldConfig.label || fieldConfig.name || "Unknown Field";
      } else if (fieldConfigFromMap?.label || fieldConfigFromMap?.name) {
        fieldName = fieldConfigFromMap.label || fieldConfigFromMap.name ||
          "Unknown Field";
      } else if (newData?.field_config?.label || newData?.field_config?.name) {
        fieldName = newData.field_config.label || newData.field_config.name ||
          "Unknown Field";
      } else if (oldData?.field_config?.label || oldData?.field_config?.name) {
        fieldName = oldData.field_config.label || oldData.field_config.name ||
          "Unknown Field";
      } else if (ruleScope === "base") {
        // Base pricing without a field_config - standalone base price
        fieldName = "Base Price";
      } else if (ruleScope === "global") {
        fieldName = "Global Price";
      } else {
        fieldName = "Unknown Field";
      }

      // Get location name - prefer from rule, fallback to location map, then data
      const location = rule?.location;
      const locationNode = rule?.location_node;
      const locationId = rule?.location_id ||
        newData?.location_id ||
        oldData?.location_id;
      const locationHierarchyId = rule?.location_hierarchy_id ||
        newData?.location_hierarchy_id ||
        oldData?.location_hierarchy_id;

      let locationName: string | undefined;
      if (location?.name) {
        locationName = location.name;
      } else if (locationNode?.name) {
        locationName = locationNode.name;
      } else if (locationId && locationMap.has(locationId)) {
        locationName = locationMap.get(locationId)?.name;
      } else if (locationHierarchyId && locationMap.has(locationHierarchyId)) {
        locationName = locationMap.get(locationHierarchyId)?.name;
      } else if (newData?.location?.name) {
        locationName = newData.location.name;
      } else if (newData?.location_node?.name) {
        locationName = newData.location_node.name;
      } else if (oldData?.location?.name) {
        locationName = oldData.location.name;
      } else if (oldData?.location_node?.name) {
        locationName = oldData.location_node.name;
      }

      // Get changed_by (from created_by or updated_by in new_data or old_data)
      // These are UUIDs, we'll look up the email below
      const changedByUserId = newData?.updated_by ||
        newData?.created_by ||
        oldData?.updated_by ||
        oldData?.created_by;

      // Get option_value
      const optionValue = rule?.option_value ||
        newData?.option_value ||
        oldData?.option_value ||
        undefined;

      // Get effective_at and expires_at
      const effectiveAt = newData?.effective_at ||
        oldData?.effective_at ||
        entry.changed_at;
      const expiresAt = newData?.expires_at || oldData?.expires_at || undefined;

      // Get pricing_context - prefer from rule, then new_data, then old_data
      const pricingContext = rule?.pricing_context ||
        newData?.pricing_context ||
        oldData?.pricing_context ||
        "customer"; // Default to customer for backward compatibility

      // Look up user email from UUID
      const changedByEmail = changedByUserId
        ? userEmailMap.get(changedByUserId as string) || undefined
        : undefined;

      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/0d1ba94f-1dd7-415c-b280-fce28d1bc840",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "list-pricing-history/index.ts:545",
            message: "Building history entry (post-fix)",
            data: {
              oldPrice,
              newPrice,
              // Fixed: Only use oldPrice as fallback for DELETE actions, not when newPrice is 0
              fallbackNewPrice: newPrice !== null
                ? newPrice
                : changeType === "expired"
                ? oldPrice ?? 0
                : 0,
              willUseOldPrice: newPrice === null &&
                oldPrice !== null &&
                changeType === "expired",
              oldDataBasePrice: oldData?.base_price,
              newDataBasePrice: newData?.base_price,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "post-fix",
            hypothesisId: "B",
          }),
        },
      ).catch(() => {});
      // #endregion
      return {
        id: entry.id.toString(),
        field_name: fieldName,
        option_value: optionValue,
        location_name: locationName,
        old_price: oldPrice ?? undefined,
        // Fixed: Only use oldPrice as fallback for DELETE actions, not when newPrice is 0
        // When newPrice is 0, it's a valid value and should be displayed
        new_price: newPrice !== null
          ? newPrice
          : changeType === "expired"
          ? oldPrice ?? 0
          : 0,
        effective_at: effectiveAt,
        changed_at: entry.changed_at, // When the change was actually made (vs when it takes effect)
        expires_at: expiresAt,
        changed_by: changedByEmail,
        change_type: changeType,
        pricing_context: pricingContext,
      };
    });

    return jsonResponse({
      success: true,
      pricing_history: pricingHistory,
    });
  } catch (error) {
    console.error("List pricing history error:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : typeof error === "string"
      ? error
      : "Failed to list pricing history";
    console.error("Error details:", {
      message: errorMessage,
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errorResponse(errorMessage, 500);
  }
});
