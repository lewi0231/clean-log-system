import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

interface LineItem {
  field_config_id: string;
  field_name: string;
  field_label: string;
  option_value?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface AppliedRule {
  pricing_rule_id: string;
  scope: string;
  pricing_type: string;
  field_config_id: string | null;
  option_value: string | null;
  location_hierarchy_id: string | null;
  location_id: string | null;
  amount: number;
  worker_payment: number;
  metadata: Record<string, unknown>;
  line_item_key?: string;
  snapshot_data: Record<string, unknown>;
}

interface InvoiceCalculation {
  job_id: string;
  base_price: number;
  line_items: LineItem[];
  applied_rules: AppliedRule[];
  subtotal: number;
  total_adjustments: number;
  total: number;
  worker_payment_total: number;
  margin: number;
}

type FieldConfig = {
  id: string;
  name: string;
  label: string;
  field_type: string;
  options?: string[] | null;
};

type JobRecord = {
  id: string;
  organization_id: string;
  location_id: string | null;
  submission_data: Record<string, unknown> | null;
  hierarchy_parent_id?: string | null; // Denormalized from location for pricing lookup
  location?: LocationRecord | null;
};

type PricingConditionRow = {
  id: string;
  condition_field_config_id: string;
  operator: string;
  condition_value: string;
  action_type: string;
  action_value: number;
  metadata: Record<string, unknown> | null;
  priority: number | null;
};

type PricingRuleRow = {
  id: string;
  organization_id: string;
  scope: string;
  pricing_type: string;
  pricing_context: string | null; // 'customer' or 'worker'
  field_config_id: string | null;
  option_value: string | null;
  applies_to_field_type: string | null;
  location_hierarchy_id: string | null;
  location_id: string | null;
  currency: string;
  base_price: number | null;
  percentage_rate: number | null;
  minimum_quantity: number | null;
  maximum_quantity: number | null;
  tier_definition: unknown;
  metadata: Record<string, unknown> | null;
  worker_payment_type: string | null;
  worker_payment_value: number | null;
  priority: number | null;
  conditions?: PricingConditionRow[];
};

type LocationRecord = {
  id: string;
  pricing_mode: string | null;
  fixed_customer_price: number | null;
  fixed_worker_payment: number | null;
  fixed_price_currency: string | null;
  hierarchy_parent_id: string | null;
};

type ServicePricingModeRow = {
  id: string;
  organization_id: string;
  location_id: string | null;
  service_type_field_config_id: string;
  service_type_value: string;
  pricing_mode: "field_based" | "fixed_price";
  fixed_customer_price: number | null;
  fixed_worker_payment: number | null;
  fixed_price_currency: string | null;
};

type LocationHierarchyNode = {
  id: string;
  parent_id: string | null;
};

type LocationContext = {
  locationId: string | null;
  ancestors: Set<string>;
  depthMap: Map<string, number>;
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "calculate-invoice" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "job_ids",
    ]);

    if (!validation.valid) {
      return errorResponse("Organization ID and job IDs are required", 400);
    }

    const { organization_id, job_ids } = body;

    if (!Array.isArray(job_ids) || job_ids.length === 0) {
      return errorResponse("job_ids must be a non-empty array", 400);
    }

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Query jobs first without location join to avoid PostgREST reverse relationship issues
    const { data: jobsRaw, error: jobsError } = await supabase
      .from("job")
      .select("id, organization_id, location_id, submission_data")
      .eq("organization_id", organization_id)
      .in("id", job_ids);

    if (jobsError) throw jobsError;
    if (!jobsRaw || jobsRaw.length === 0) {
      return errorResponse("No jobs found", 404);
    }

    // Get unique location IDs
    const locationIds = [
      ...new Set(
        jobsRaw
          .map((job) => job.location_id)
          .filter((id): id is string => id !== null),
      ),
    ];

    // Query locations separately to avoid reverse relationship issues with pricing_rule
    let locationMap = new Map<string, LocationRecord>();
    if (locationIds.length > 0) {
      const { data: locations, error: locationsError } = await supabase
        .from("location")
        .select(
          "id, hierarchy_parent_id, pricing_mode, fixed_customer_price, fixed_worker_payment, fixed_price_currency",
        )
        .in("id", locationIds);

      if (locationsError) throw locationsError;
      if (locations) {
        locationMap = new Map(
          locations.map((loc) => [
            loc.id,
            {
              id: loc.id,
              hierarchy_parent_id: loc.hierarchy_parent_id,
              pricing_mode: loc.pricing_mode,
              fixed_customer_price: loc.fixed_customer_price,
              fixed_worker_payment: loc.fixed_worker_payment,
              fixed_price_currency: loc.fixed_price_currency,
            },
          ]),
        );
      }
    }

    // Combine jobs with location data
    const jobs = jobsRaw.map((job) => {
      const locationData = job.location_id
        ? locationMap.get(job.location_id) || null
        : null;
      return {
        id: job.id,
        organization_id: job.organization_id,
        location_id: job.location_id,
        submission_data: job.submission_data,
        hierarchy_parent_id: locationData?.hierarchy_parent_id || null,
        location: locationData,
      };
    });

    const { data: fieldConfigs, error: configsError } = await supabase
      .from("organization_field_configs")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("active", true)
      .order("order_position", { ascending: true });

    if (configsError) throw configsError;

    const { data: hierarchyNodes, error: hierarchyError } = await supabase
      .from("location_hierarchy")
      .select("id, parent_id")
      .eq("organization_id", organization_id);

    if (hierarchyError) throw hierarchyError;

    // Service-specific pricing mode overrides (per service type option per location)
    const { data: servicePricingModes, error: servicePricingError } =
      await supabase
        .from("service_pricing_mode")
        .select("*")
        .eq("organization_id", organization_id);

    if (servicePricingError) throw servicePricingError;

    const nowIso = new Date().toISOString();
    // Filter pricing rules to only customer pricing (for invoicing)
    // Worker pricing rules will be used separately for worker payment calculations
    // Query pricing_rule without embedded conditions to avoid reverse relationship issues
    const { data: pricingRules, error: pricingRulesError } = await supabase
      .from("pricing_rule")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("active", true)
      .eq("pricing_context", "customer") // Only customer pricing for invoicing
      .lte("effective_at", nowIso)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

    if (pricingRulesError) throw pricingRulesError;

    // Query pricing_condition separately to avoid reverse relationship issues
    const pricingConditionsMap = new Map<string, PricingConditionRow[]>();
    if (pricingRules && pricingRules.length > 0) {
      const pricingRuleIds = pricingRules.map((rule) => rule.id);
      const { data: pricingConditions, error: conditionsError } = await supabase
        .from("pricing_condition")
        .select(
          "id, pricing_rule_id, condition_field_config_id, operator, condition_value, action_type, action_value, metadata, priority",
        )
        .in("pricing_rule_id", pricingRuleIds)
        .order("priority", { ascending: true });

      if (conditionsError) throw conditionsError;

      // Group conditions by pricing_rule_id
      if (pricingConditions) {
        pricingConditions.forEach((condition) => {
          if (!pricingConditionsMap.has(condition.pricing_rule_id)) {
            pricingConditionsMap.set(condition.pricing_rule_id, []);
          }
          pricingConditionsMap.get(condition.pricing_rule_id)!.push({
            id: condition.id,
            condition_field_config_id: condition.condition_field_config_id,
            operator: condition.operator,
            condition_value: condition.condition_value,
            action_type: condition.action_type,
            action_value: condition.action_value,
            metadata: condition.metadata,
            priority: condition.priority,
          });
        });
      }
    }

    // Attach conditions to pricing rules
    const pricingRulesWithConditions = (pricingRules || []).map((rule) => ({
      ...rule,
      conditions: pricingConditionsMap.get(rule.id) || [],
    }));

    const fieldConfigMap = new Map<string, FieldConfig>(
      (fieldConfigs || []).map((config) => [config.id, config as FieldConfig]),
    );

    const calculations: InvoiceCalculation[] = [];

    for (const job of jobs as JobRecord[]) {
      const calculation = calculateJobPricing({
        job,
        fieldConfigMap,
        pricingRules: pricingRulesWithConditions as PricingRuleRow[],
        hierarchyNodes: (hierarchyNodes || []) as LocationHierarchyNode[],
        servicePricingModes:
          (servicePricingModes || []) as ServicePricingModeRow[],
      });
      calculations.push(calculation);
    }

    const aggregated = {
      total_subtotal: calculations.reduce(
        (sum, calc) => sum + calc.subtotal,
        0,
      ),
      total_adjustments: calculations.reduce(
        (sum, calc) => sum + calc.total_adjustments,
        0,
      ),
      total: calculations.reduce((sum, calc) => sum + calc.total, 0),
      total_worker_payment: calculations.reduce(
        (sum, calc) => sum + calc.worker_payment_total,
        0,
      ),
      total_margin: calculations.reduce((sum, calc) => sum + calc.margin, 0),
      job_calculations: calculations,
    };

    return jsonResponse({
      success: true,
      calculation: aggregated,
    });
  } catch (error) {
    logger.error("Calculate invoice error", error);
    const errorMessage = extractErrorMessage(
      error,
      "Failed to calculate invoice",
    );
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
});

function calculateJobPricing({
  job,
  fieldConfigMap,
  pricingRules,
  hierarchyNodes,
  servicePricingModes,
}: {
  job: JobRecord;
  fieldConfigMap: Map<string, FieldConfig>;
  pricingRules: PricingRuleRow[];
  hierarchyNodes: LocationHierarchyNode[];
  servicePricingModes: ServicePricingModeRow[];
}): InvoiceCalculation {
  // Early return for fixed price locations (highest precedence)
  // Field config data is still collected (in submission_data) but pricing is fixed
  if (job.location?.pricing_mode === "fixed_price") {
    const fixedCustomerPrice = job.location.fixed_customer_price || 0;
    const fixedWorkerPayment = job.location.fixed_worker_payment || 0;

    return {
      job_id: job.id,
      base_price: fixedCustomerPrice,
      line_items: [], // No field-based line items for fixed pricing
      applied_rules: [
        {
          pricing_rule_id: `fixed_location_${job.location.id}`,
          scope: "global",
          pricing_type: "fixed",
          field_config_id: null,
          option_value: null,
          location_hierarchy_id: job.hierarchy_parent_id || null,
          location_id: job.location_id,
          amount: fixedCustomerPrice,
          worker_payment: fixedWorkerPayment,
          metadata: {
            pricing_mode: "fixed_price",
            location_id: job.location.id,
            currency: job.location.fixed_price_currency || "USD",
          },
          snapshot_data: {
            pricing_mode: "fixed_price",
            fixed_customer_price: fixedCustomerPrice,
            fixed_worker_payment: fixedWorkerPayment,
            currency: job.location.fixed_price_currency || "USD",
          },
        },
      ],
      subtotal: fixedCustomerPrice,
      total_adjustments: 0,
      total: fixedCustomerPrice,
      worker_payment_total: fixedWorkerPayment,
      margin: fixedCustomerPrice - fixedWorkerPayment,
    };
  }

  // Service-specific pricing mode override (takes precedence over field-based)
  const serviceOverride = findServicePricingOverride({
    job,
    fieldConfigMap,
    servicePricingModes,
  });

  if (serviceOverride?.pricing_mode === "fixed_price") {
    const fixedCustomerPrice = serviceOverride.fixed_customer_price || 0;
    const fixedWorkerPayment = serviceOverride.fixed_worker_payment || 0;

    return {
      job_id: job.id,
      base_price: fixedCustomerPrice,
      line_items: [],
      applied_rules: [
        {
          pricing_rule_id: `fixed_service_${serviceOverride.id}`,
          scope: "global",
          pricing_type: "fixed",
          field_config_id: null,
          option_value: null,
          location_hierarchy_id: job.hierarchy_parent_id || null,
          location_id: job.location_id,
          amount: fixedCustomerPrice,
          worker_payment: fixedWorkerPayment,
          metadata: {
            pricing_mode: "fixed_price",
            service_type_value: serviceOverride.service_type_value,
            location_id: job.location_id,
            currency: serviceOverride.fixed_price_currency || "USD",
          },
          snapshot_data: {
            pricing_mode: "fixed_price",
            fixed_customer_price: fixedCustomerPrice,
            fixed_worker_payment: fixedWorkerPayment,
            service_type_value: serviceOverride.service_type_value,
            currency: serviceOverride.fixed_price_currency || "USD",
          },
        },
      ],
      subtotal: fixedCustomerPrice,
      total_adjustments: 0,
      total: fixedCustomerPrice,
      worker_payment_total: fixedWorkerPayment,
      margin: fixedCustomerPrice - fixedWorkerPayment,
    };
  }

  // Standard field-based pricing calculation
  const submissionData = (job.submission_data as Record<string, unknown>) || {};
  const nodeParentMap = new Map(hierarchyNodes.map((node) => [node.id, node]));

  const locationContext = buildLocationContext(
    job.location_id,
    job.hierarchy_parent_id || null,
    nodeParentMap,
  );

  const applicableRules = pricingRules.filter((rule) =>
    ruleMatchesLocation(rule, locationContext)
  );

  const lineItems: LineItem[] = [];
  const appliedRules: AppliedRule[] = [];
  let subtotal = 0;

  const fieldRuleGroups = groupRules(
    applicableRules.filter((rule) => rule.scope === "field"),
    (rule) => rule.field_config_id || "default",
  );

  for (const [fieldId, rules] of fieldRuleGroups.entries()) {
    if (!fieldId || fieldId === "default") continue;
    const bestRule = selectBestRule(rules, locationContext);
    if (!bestRule) continue;

    const fieldConfig = fieldConfigMap.get(fieldId);
    if (!fieldConfig) continue;

    const result = evaluateFieldRule(
      bestRule,
      fieldConfig,
      submissionData[fieldConfig.name],
    );

    if (result) {
      subtotal += result.lineItem.total;
      lineItems.push(result.lineItem);
      appliedRules.push(result.appliedRule);
    }
  }

  const optionRuleGroups = groupRules(
    applicableRules.filter((rule) => rule.scope === "option"),
    (rule) => `${rule.field_config_id || "default"}:${rule.option_value || ""}`,
  );

  for (const [key, rules] of optionRuleGroups.entries()) {
    const [fieldId] = key.split(":");
    if (!fieldId || fieldId === "default") continue;
    const bestRule = selectBestRule(rules, locationContext);
    if (!bestRule) continue;
    const fieldConfig = fieldConfigMap.get(fieldId);
    if (!fieldConfig) continue;

    const result = evaluateOptionRule(
      bestRule,
      fieldConfig,
      submissionData[fieldConfig.name],
    );

    if (result) {
      subtotal += result.lineItem.total;
      lineItems.push(result.lineItem);
      appliedRules.push(result.appliedRule);
    }
  }

  const baseRules = applicableRules.filter((rule) => rule.scope === "base");
  const baseEvaluation = applyBaseRules({
    rules: baseRules,
    locationContext,
    submissionData,
    fieldConfigMap,
    subtotal,
  });

  let total = baseEvaluation.total;
  let totalAdjustments = baseEvaluation.adjustmentAmount;
  const basePrice = baseEvaluation.baseAmount;
  appliedRules.push(...baseEvaluation.appliedRules);

  const conditionalRules = applicableRules.filter(
    (rule) => rule.pricing_type === "conditional" || rule.scope === "global",
  );
  const conditionalEvaluation = applyConditionalRules({
    rules: conditionalRules,
    submissionData,
    fieldConfigMap,
    currentTotal: total,
  });

  total = conditionalEvaluation.total;
  totalAdjustments += conditionalEvaluation.adjustmentAmount;
  appliedRules.push(...conditionalEvaluation.appliedRules);

  const workerPaymentTotal = appliedRules.reduce(
    (sum, rule) => sum + (rule.worker_payment || 0),
    0,
  );

  return {
    job_id: job.id,
    base_price: basePrice,
    line_items: lineItems,
    applied_rules: appliedRules,
    subtotal,
    total_adjustments: totalAdjustments,
    total,
    worker_payment_total: workerPaymentTotal,
    margin: total - workerPaymentTotal,
  };
}

function findServicePricingOverride({
  job,
  fieldConfigMap,
  servicePricingModes,
}: {
  job: JobRecord;
  fieldConfigMap: Map<string, FieldConfig>;
  servicePricingModes: ServicePricingModeRow[];
}): ServicePricingModeRow | null {
  if (!job.location_id) return null;
  const submissionData = (job.submission_data as Record<string, unknown>) || {};

  for (const override of servicePricingModes) {
    // If override is scoped to a specific location, enforce it
    if (override.location_id && override.location_id !== job.location_id) {
      continue;
    }

    const serviceField = fieldConfigMap.get(
      override.service_type_field_config_id,
    );
    if (!serviceField) continue;
    const value = submissionData[serviceField.name];
    if (value === undefined || value === null) continue;
    if (String(value) !== override.service_type_value) continue;

    return override;
  }

  return null;
}

function groupRules(
  rules: PricingRuleRow[],
  keyFn: (rule: PricingRuleRow) => string,
): Map<string, PricingRuleRow[]> {
  const map = new Map<string, PricingRuleRow[]>();
  for (const rule of rules) {
    const key = keyFn(rule);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(rule);
  }
  return map;
}

function buildLocationContext(
  locationId: string | null,
  hierarchyParentId: string | null,
  nodeMap: Map<string, LocationHierarchyNode>,
): LocationContext {
  const ancestors = new Set<string>();
  const depthMap = new Map<string, number>();

  // Start from the location's hierarchy parent (if any)
  let currentNodeId: string | null = hierarchyParentId;

  while (currentNodeId) {
    ancestors.add(currentNodeId);
    const depth = getNodeDepth(currentNodeId, nodeMap, new Map());
    depthMap.set(currentNodeId, depth);
    const parentNode = nodeMap.get(currentNodeId);
    currentNodeId = parentNode?.parent_id || null;
  }

  return {
    locationId,
    ancestors,
    depthMap,
  };
}

function getNodeDepth(
  nodeId: string,
  nodeMap: Map<string, LocationHierarchyNode>,
  cache: Map<string, number>,
): number {
  if (cache.has(nodeId)) {
    return cache.get(nodeId)!;
  }
  const node = nodeMap.get(nodeId);
  if (!node || !node.parent_id) {
    cache.set(nodeId, 1);
    return 1;
  }
  const depth = 1 + getNodeDepth(node.parent_id, nodeMap, cache);
  cache.set(nodeId, depth);
  return depth;
}

function ruleMatchesLocation(
  rule: PricingRuleRow,
  context: LocationContext,
): boolean {
  if (rule.location_id && rule.location_id !== context.locationId) {
    return false;
  }
  if (
    rule.location_hierarchy_id &&
    !context.ancestors.has(rule.location_hierarchy_id)
  ) {
    return false;
  }
  return true;
}

function getRuleSpecificity(
  rule: PricingRuleRow,
  context: LocationContext,
): number {
  let score = 0;
  if (rule.location_id && rule.location_id === context.locationId) {
    score += 300;
  } else if (
    rule.location_hierarchy_id &&
    context.ancestors.has(rule.location_hierarchy_id)
  ) {
    const depth = context.depthMap.get(rule.location_hierarchy_id) || 0;
    score += 200 + depth;
  } else if (!rule.location_id && !rule.location_hierarchy_id) {
    score += 100;
  }
  const priority = rule.priority ?? 0;
  score += Math.max(0, 50 - priority);
  return score;
}

function selectBestRule(
  rules: PricingRuleRow[],
  context: LocationContext,
): PricingRuleRow | null {
  let bestRule: PricingRuleRow | null = null;
  let bestScore = -Infinity;
  for (const rule of rules) {
    const score = getRuleSpecificity(rule, context);
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }
  return bestRule;
}

function evaluateFieldRule(
  rule: PricingRuleRow,
  fieldConfig: FieldConfig,
  fieldValue: unknown,
): { lineItem: LineItem; appliedRule: AppliedRule } | null {
  const quantity = getFieldQuantity(fieldConfig.field_type, fieldValue);
  if (quantity <= 0) return null;

  const unitPrice = rule.base_price ?? 0;
  let total = 0;

  switch (rule.pricing_type) {
    case "unit":
      total = quantity * unitPrice;
      break;
    case "fixed":
      total = unitPrice;
      break;
    case "tiered":
      total = calculateTieredTotal(quantity, rule.tier_definition);
      break;
    case "percentage":
      total = quantity * (rule.percentage_rate ?? 0);
      break;
    default:
      total = quantity * unitPrice;
  }

  if (total <= 0) return null;

  const workerPayment = computeWorkerPayment(rule, total);
  const lineItemKey = `${rule.field_config_id}:${rule.option_value || "field"}`;

  return {
    lineItem: {
      field_config_id: fieldConfig.id,
      field_name: fieldConfig.name,
      field_label: fieldConfig.label,
      quantity,
      unit_price: unitPrice,
      total,
    },
    appliedRule: {
      pricing_rule_id: rule.id,
      scope: rule.scope,
      pricing_type: rule.pricing_type,
      field_config_id: rule.field_config_id,
      option_value: null,
      location_hierarchy_id: rule.location_hierarchy_id,
      location_id: rule.location_id,
      amount: total,
      worker_payment: workerPayment,
      metadata: { quantity, unit_price: unitPrice },
      line_item_key: lineItemKey,
      snapshot_data: {
        rule,
        quantity,
        unit_price: unitPrice,
        field_value: fieldValue,
      },
    },
  };
}

function evaluateOptionRule(
  rule: PricingRuleRow,
  fieldConfig: FieldConfig,
  fieldValue: unknown,
): { lineItem: LineItem; appliedRule: AppliedRule } | null {
  if (!rule.option_value) return null;
  const quantity = getOptionQuantity(fieldValue, rule.option_value);
  if (quantity <= 0) return null;

  const unitPrice = rule.base_price ?? 0;
  const total = quantity * unitPrice;
  if (total <= 0) return null;

  const workerPayment = computeWorkerPayment(rule, total);
  const lineItemKey = `${rule.field_config_id}:${rule.option_value}`;

  return {
    lineItem: {
      field_config_id: fieldConfig.id,
      field_name: fieldConfig.name,
      field_label: fieldConfig.label,
      option_value: rule.option_value,
      quantity,
      unit_price: unitPrice,
      total,
    },
    appliedRule: {
      pricing_rule_id: rule.id,
      scope: rule.scope,
      pricing_type: rule.pricing_type,
      field_config_id: rule.field_config_id,
      option_value: rule.option_value,
      location_hierarchy_id: rule.location_hierarchy_id,
      location_id: rule.location_id,
      amount: total,
      worker_payment: workerPayment,
      metadata: { quantity, unit_price: unitPrice },
      line_item_key: lineItemKey,
      snapshot_data: {
        rule,
        quantity,
        unit_price: unitPrice,
        field_value: fieldValue,
      },
    },
  };
}

function getFieldQuantity(fieldType: string, value: unknown): number {
  if (fieldType === "number") {
    return typeof value === "number" ? value : Number(value) || 0;
  }
  if (fieldType === "boolean") {
    return value === true ? 1 : 0;
  }
  if (typeof value === "number") {
    return value;
  }
  return 0;
}

function getOptionQuantity(value: unknown, optionValue: string): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string" || typeof value === "number") {
    return String(value) === optionValue ? 1 : 0;
  }
  if (Array.isArray(value)) {
    let total = 0;
    for (const entry of value) {
      if (entry === optionValue) {
        total += 1;
      } else if (
        typeof entry === "object" &&
        entry !== null &&
        "quantity" in entry
      ) {
        const label = (entry.brand as string) ||
          (entry.option as string) ||
          (entry.name as string);
        if (label === optionValue) {
          total += Number((entry as Record<string, unknown>).quantity) || 0;
        }
      }
    }
    return total;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entry = record[optionValue];
    return typeof entry === "number" ? entry : Number(entry) || 0;
  }
  return 0;
}

function calculateTieredTotal(quantity: number, definition: unknown): number {
  if (!Array.isArray(definition) || quantity <= 0) return 0;
  const tiers = definition
    .map((tier) => ({
      min: Number((tier as Record<string, unknown>).min) || 0,
      max: (tier as Record<string, unknown>).max === null ||
          (tier as Record<string, unknown>).max === undefined
        ? Infinity
        : Number((tier as Record<string, unknown>).max),
      price: Number((tier as Record<string, unknown>).price) || 0,
    }))
    .sort((a, b) => a.min - b.min);

  let total = 0;
  let remaining = quantity;

  for (const tier of tiers) {
    if (remaining <= 0) break;
    if (quantity <= tier.min) continue;
    const upperBound = Math.min(remaining + tier.min, tier.max);
    const tierQuantity = tier.max === Infinity
      ? remaining
      : Math.max(0, upperBound - tier.min);
    total += tierQuantity * tier.price;
    remaining -= tierQuantity;
  }

  return total;
}

function computeWorkerPayment(rule: PricingRuleRow, amount: number): number {
  if (
    !rule.worker_payment_type ||
    rule.worker_payment_type === "same_structure"
  ) {
    return amount;
  }
  if (rule.worker_payment_type === "percentage") {
    const percentage = (rule.worker_payment_value ?? 0) / 100;
    return amount * percentage;
  }
  if (rule.worker_payment_type === "fixed_rate") {
    return rule.worker_payment_value ?? 0;
  }
  return 0;
}

function applyBaseRules({
  rules,
  locationContext,
  submissionData,
  fieldConfigMap,
  subtotal,
}: {
  rules: PricingRuleRow[];
  locationContext: LocationContext;
  submissionData: Record<string, unknown>;
  fieldConfigMap: Map<string, FieldConfig>;
  subtotal: number;
}): {
  total: number;
  adjustmentAmount: number;
  baseAmount: number;
  appliedRules: AppliedRule[];
} {
  let total = subtotal;
  let adjustmentAmount = 0;
  let baseAmount = 0;
  const appliedRules: AppliedRule[] = [];

  const fieldBasedRules = rules.filter((rule) => rule.field_config_id);
  const standaloneRules = rules.filter((rule) => !rule.field_config_id);

  const fieldGroups = groupRules(
    fieldBasedRules,
    (rule) => `${rule.field_config_id}:${rule.option_value || ""}`,
  );

  let selectedRule: PricingRuleRow | null = null;

  for (const [key, group] of fieldGroups.entries()) {
    const [fieldId, optionValue] = key.split(":");
    if (!fieldId) continue;
    const fieldConfig = fieldConfigMap.get(fieldId);
    if (!fieldConfig) continue;
    const fieldValue = submissionData[fieldConfig.name];
    if (fieldValue === null || fieldValue === undefined) continue;
    if (String(fieldValue) !== optionValue) continue;
    const bestRule = selectBestRule(group, locationContext);
    if (bestRule) {
      selectedRule = bestRule;
      break;
    }
  }

  if (!selectedRule) {
    selectedRule = selectBestRule(standaloneRules, locationContext);
  }

  if (selectedRule) {
    const adjustmentType =
      (selectedRule.metadata?.adjustment_type as "add" | "multiply") ||
      (selectedRule.pricing_type === "percentage" ? "multiply" : "add");

    if (adjustmentType === "add") {
      baseAmount = selectedRule.base_price ?? 0;
      total += baseAmount;
      adjustmentAmount += baseAmount;
    } else {
      const multiplier = selectedRule.percentage_rate ?? 1;
      const newTotal = total * multiplier;
      adjustmentAmount += newTotal - total;
      total = newTotal;
      baseAmount = multiplier;
    }

    const workerPayment = computeWorkerPayment(selectedRule, adjustmentAmount);
    appliedRules.push({
      pricing_rule_id: selectedRule.id,
      scope: selectedRule.scope,
      pricing_type: selectedRule.pricing_type,
      field_config_id: selectedRule.field_config_id,
      option_value: selectedRule.option_value,
      location_hierarchy_id: selectedRule.location_hierarchy_id,
      location_id: selectedRule.location_id,
      amount: adjustmentAmount,
      worker_payment: workerPayment,
      metadata: {
        adjustment_type: adjustmentType,
      },
      line_item_key: `base:${selectedRule.field_config_id || "standalone"}`,
      snapshot_data: {
        rule: selectedRule,
        subtotal,
      },
    });
  }

  return { total, adjustmentAmount, baseAmount, appliedRules };
}

function applyConditionalRules({
  rules,
  submissionData,
  fieldConfigMap,
  currentTotal,
}: {
  rules: PricingRuleRow[];
  submissionData: Record<string, unknown>;
  fieldConfigMap: Map<string, FieldConfig>;
  currentTotal: number;
}): {
  total: number;
  adjustmentAmount: number;
  appliedRules: AppliedRule[];
} {
  let total = currentTotal;
  let adjustmentAmount = 0;
  const appliedRules: AppliedRule[] = [];

  for (const rule of rules) {
    if (!rule.conditions || rule.conditions.length === 0) continue;

    for (const condition of rule.conditions) {
      const fieldConfig = fieldConfigMap.get(
        condition.condition_field_config_id,
      );
      if (!fieldConfig) continue;

      const fieldValue = submissionData[fieldConfig.name];
      if (
        !evaluateCondition(
          condition.operator,
          fieldValue,
          condition.condition_value,
        )
      ) {
        continue;
      }

      let adjustment = 0;
      let newTotal = total;

      switch (condition.action_type) {
        case "add":
          adjustment = condition.action_value;
          newTotal = total + adjustment;
          break;
        case "subtract":
          adjustment = -condition.action_value;
          newTotal = total + adjustment;
          break;
        case "multiply":
          newTotal = total * condition.action_value;
          adjustment = newTotal - total;
          break;
        case "divide":
          if (condition.action_value !== 0) {
            newTotal = total / condition.action_value;
            adjustment = newTotal - total;
          }
          break;
        case "set":
          newTotal = condition.action_value;
          adjustment = newTotal - total;
          break;
      }

      if (adjustment === 0) continue;

      total = newTotal;
      adjustmentAmount += adjustment;

      const workerPayment = computeWorkerPayment(rule, adjustment);
      appliedRules.push({
        pricing_rule_id: rule.id,
        scope: rule.scope,
        pricing_type: rule.pricing_type,
        field_config_id: rule.field_config_id,
        option_value: rule.option_value,
        location_hierarchy_id: rule.location_hierarchy_id,
        location_id: rule.location_id,
        amount: adjustment,
        worker_payment: workerPayment,
        metadata: {
          condition_id: condition.id,
          operator: condition.operator,
          action_type: condition.action_type,
        },
        line_item_key: `conditional:${rule.id}:${condition.id}`,
        snapshot_data: {
          rule,
          condition,
          field_value: fieldValue,
          total_before: total - adjustment,
          adjustment,
        },
      });
    }
  }

  return { total, adjustmentAmount, appliedRules };
}

function evaluateCondition(
  operator: string,
  value: unknown,
  target: string,
): boolean {
  switch (operator) {
    case "equals":
      return String(value) === target;
    case "not_equals":
      return String(value) !== target;
    case "greater_than":
      return Number(value) > Number(target);
    case "greater_than_or_equal":
      return Number(value) >= Number(target);
    case "less_than":
      return Number(value) < Number(target);
    case "less_than_or_equal":
      return Number(value) <= Number(target);
    case "contains":
      if (Array.isArray(value)) {
        return value.map(String).includes(target);
      }
      if (typeof value === "string") {
        return value.includes(target);
      }
      return false;
    default:
      return false;
  }
}
