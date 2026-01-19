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

// Reuse types from calculate-invoice but adapt for worker payments
interface WorkerPaymentLineItem {
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
  metadata: Record<string, unknown>;
  line_item_key?: string;
  snapshot_data: Record<string, unknown>;
}

interface WorkerPaymentSplit {
  worker_id: string;
  worker_name: string;
  hours_worked: number;
  time_share: number; // Their share of the base payment
  multiplier_adjustment: number; // Additional from multiplier modifier
  per_unit_bonus: number; // Additive bonus (per unit)
  flat_bonus: number; // Additive bonus (flat)
  final_payment: number; // Total for this worker
  rate_card_id?: string;
  allocation_type: string;
}

interface WorkerPaymentCalculation {
  job_id: string;
  line_items: WorkerPaymentLineItem[];
  applied_rules: AppliedRule[];
  subtotal: number;
  total_adjustments: number;
  total_worker_payment: number;
  worker_splits?: WorkerPaymentSplit[];
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
  hierarchy_parent_id?: string | null;
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
  pricing_context: string | null;
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
  priority: number | null;
  conditions?: PricingConditionRow[];
};

type LocationRecord = {
  id: string;
  pricing_mode: string | null;
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

type WorkerRateCard = {
  id: string;
  worker_id: string;
  modifier_type: "per_unit" | "flat" | "multiplier";
  modifier_value: number;
  currency: string;
  role_title: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  // Joined field mappings (for per_unit type)
  field_config_ids?: string[];
};

type WorkerPaymentAllocation = {
  id: string;
  job_id: string;
  worker_id: string;
  allocation_type: "percentage" | "amount" | "hours";
  percentage: number | null;
  fixed_amount: number | null;
  hours_worked: number | null;
};

type JobWorker = {
  job_id: string;
  worker_id: string;
  start_time: string | null;
  end_time: string | null;
  worker: {
    id: string;
    first_name: string;
    last_name: string;
  };
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "calculate-worker-payment",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "job_ids",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields for worker payment calculation", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Organization ID and job IDs are required", 400);
    }

    const { organization_id, job_ids } = body;

    if (!Array.isArray(job_ids) || job_ids.length === 0) {
      logger.warn("Invalid job_ids array for worker payment calculation", {
        organization_id,
        job_ids_type: typeof job_ids,
        is_array: Array.isArray(job_ids),
        length: Array.isArray(job_ids) ? job_ids.length : 0,
      });
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
      logger.warn("Unauthorized attempt to calculate worker payment", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    const { data: jobsRaw, error: jobsError } = await supabase
      .from("job")
      .select(`
        id,
        organization_id,
        location_id,
        submission_data,
        location:location_id (
          id,
          hierarchy_parent_id,
          pricing_mode,
          fixed_worker_payment,
          fixed_price_currency
        )
      `)
      .eq("organization_id", organization_id)
      .in("id", job_ids);

    if (jobsError) throw jobsError;
    if (!jobsRaw || jobsRaw.length === 0) {
      return errorResponse("No jobs found", 404);
    }

    const jobs = jobsRaw.map((job) => {
      const locationData = job.location as unknown as
        | {
          id: string;
          hierarchy_parent_id: string | null;
          pricing_mode: string | null;
          fixed_worker_payment: number | null;
          fixed_price_currency: string | null;
        }
        | null;
      return {
        id: job.id,
        organization_id: job.organization_id,
        location_id: job.location_id,
        submission_data: job.submission_data,
        hierarchy_parent_id: locationData?.hierarchy_parent_id || null,
        location: locationData
          ? {
            id: locationData.id,
            hierarchy_parent_id: locationData.hierarchy_parent_id,
            pricing_mode: locationData.pricing_mode,
            fixed_worker_payment: locationData.fixed_worker_payment,
            fixed_price_currency: locationData.fixed_price_currency,
          }
          : null,
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

    const { data: servicePricingModes, error: servicePricingError } =
      await supabase
        .from("service_pricing_mode")
        .select("*")
        .eq("organization_id", organization_id);

    if (servicePricingError) throw servicePricingError;

    const nowIso = new Date().toISOString();
    // Filter pricing rules to only worker pricing
    // Query pricing_rule without embedded conditions to avoid reverse relationship issues
    const { data: pricingRules, error: pricingRulesError } = await supabase
      .from("pricing_rule")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("active", true)
      .eq("pricing_context", "worker") // Only worker pricing
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

    // Fetch worker rate cards with modifier types
    const todayDate = new Date().toISOString().split("T")[0];
    const { data: rateCards, error: rateCardsError } = await supabase
      .from("worker_rate_card")
      .select(`
        *,
        worker_rate_card_field (
          field_config_id
        )
      `)
      .eq("organization_id", organization_id)
      .eq("is_active", true)
      .lte("effective_from", todayDate)
      .or(`effective_to.is.null,effective_to.gte.${todayDate}`);

    if (rateCardsError) {
      logger.warn("Failed to fetch rate cards, proceeding without modifiers", {
        error: rateCardsError.message,
      });
    }

    // Map rate cards by worker_id, extracting field_config_ids for per_unit types
    const rateCardMap = new Map<string, WorkerRateCard>();
    (rateCards || []).forEach((card) => {
      const fieldMappings = card.worker_rate_card_field as
        | { field_config_id: string }[]
        | null;
      const rateCard: WorkerRateCard = {
        id: card.id,
        worker_id: card.worker_id,
        modifier_type: card.modifier_type,
        modifier_value: card.modifier_value,
        currency: card.currency,
        role_title: card.role_title,
        effective_from: card.effective_from,
        effective_to: card.effective_to,
        is_active: card.is_active,
        field_config_ids: fieldMappings?.map((f) => f.field_config_id) || [],
      };
      rateCardMap.set(card.worker_id, rateCard);
    });

    // Fetch custom allocations for the jobs
    const { data: allocations, error: allocationsError } = await supabase
      .from("worker_payment_allocation")
      .select("*")
      .eq("organization_id", organization_id)
      .in("job_id", job_ids);

    if (allocationsError) {
      logger.warn("Failed to fetch allocations, proceeding without", {
        error: allocationsError.message,
      });
    }

    const allocationsByJob = new Map<string, WorkerPaymentAllocation[]>();
    (allocations || []).forEach((alloc) => {
      const jobAllocs = allocationsByJob.get(alloc.job_id) || [];
      jobAllocs.push(alloc as WorkerPaymentAllocation);
      allocationsByJob.set(alloc.job_id, jobAllocs);
    });

    // Fetch job workers for split calculations (including time tracking)
    const { data: jobWorkers, error: jobWorkersError } = await supabase
      .from("job_worker")
      .select(
        "job_id, worker_id, start_time, end_time, worker:worker_id(id, first_name, last_name)",
      )
      .in("job_id", job_ids);

    if (jobWorkersError) {
      logger.warn("Failed to fetch job workers", {
        error: jobWorkersError.message,
      });
    }

    const workersByJob = new Map<string, JobWorker[]>();
    (jobWorkers || []).forEach((jw) => {
      const workers = workersByJob.get(jw.job_id) || [];
      workers.push(jw as unknown as JobWorker);
      workersByJob.set(jw.job_id, workers);
    });

    const calculations: WorkerPaymentCalculation[] = [];

    for (const job of jobs as JobRecord[]) {
      const calculation = calculateWorkerPayment({
        job,
        fieldConfigMap,
        pricingRules: pricingRulesWithConditions as PricingRuleRow[],
        hierarchyNodes: (hierarchyNodes || []) as LocationHierarchyNode[],
        servicePricingModes:
          (servicePricingModes || []) as ServicePricingModeRow[],
      });

      // Calculate worker splits with additive bonuses
      const workers = workersByJob.get(job.id) || [];
      const jobAllocations = allocationsByJob.get(job.id) || [];

      if (workers.length > 0) {
        calculation.worker_splits = calculateWorkerSplits({
          baseWorkerPayment: calculation.total_worker_payment,
          workers,
          rateCardMap,
          allocations: jobAllocations,
          submissionData: (job.submission_data as Record<string, unknown>) ||
            {},
          fieldConfigMap,
        });

        // Update total_worker_payment to include additive bonuses
        const totalBonuses = calculation.worker_splits.reduce(
          (sum, split) =>
            sum +
            split.per_unit_bonus +
            split.flat_bonus +
            split.multiplier_adjustment,
          0,
        );
        calculation.total_worker_payment += totalBonuses;
      }

      calculations.push(calculation);
    }

    const aggregated = {
      total_worker_payment: calculations.reduce(
        (sum, calc) => sum + calc.total_worker_payment,
        0,
      ),
      job_calculations: calculations,
    };

    logger.info("Worker payment calculated successfully", {
      organization_id,
      job_count: job_ids.length,
      calculation_count: calculations.length,
      total_worker_payment: aggregated.total_worker_payment,
    });

    return jsonResponse({
      success: true,
      calculation: aggregated,
    });
  } catch (error) {
    logger.error("Calculate worker payment error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to calculate worker payment"),
      getErrorStatusCode(error),
    );
  }
});

function calculateWorkerPayment({
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
}): WorkerPaymentCalculation {
  const serviceOverride = findServicePricingOverride({
    job,
    fieldConfigMap,
    servicePricingModes,
  });

  if (serviceOverride?.pricing_mode === "fixed_price") {
    const fixedWorkerPayment = serviceOverride.fixed_worker_payment || 0;

    return {
      job_id: job.id,
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
          amount: fixedWorkerPayment,
          metadata: {
            pricing_mode: "fixed_price",
            service_type_value: serviceOverride.service_type_value,
            location_id: job.location_id,
            currency: serviceOverride.fixed_price_currency || "USD",
          },
          snapshot_data: {
            pricing_mode: "fixed_price",
            fixed_worker_payment: fixedWorkerPayment,
            service_type_value: serviceOverride.service_type_value,
            currency: serviceOverride.fixed_price_currency || "USD",
          },
        },
      ],
      subtotal: fixedWorkerPayment,
      total_adjustments: 0,
      total_worker_payment: fixedWorkerPayment,
    };
  }

  // Early return for fixed price locations (highest precedence)
  if (job.location?.pricing_mode === "fixed_price") {
    const fixedWorkerPayment = job.location.fixed_worker_payment || 0;

    return {
      job_id: job.id,
      line_items: [],
      applied_rules: [
        {
          pricing_rule_id: `fixed_location_${job.location.id}`,
          scope: "global",
          pricing_type: "fixed",
          field_config_id: null,
          option_value: null,
          location_hierarchy_id: job.hierarchy_parent_id || null,
          location_id: job.location_id,
          amount: fixedWorkerPayment,
          metadata: {
            pricing_mode: "fixed_price",
            location_id: job.location.id,
            currency: job.location.fixed_price_currency || "USD",
          },
          snapshot_data: {
            pricing_mode: "fixed_price",
            fixed_worker_payment: fixedWorkerPayment,
            currency: job.location.fixed_price_currency || "USD",
          },
        },
      ],
      subtotal: fixedWorkerPayment,
      total_adjustments: 0,
      total_worker_payment: fixedWorkerPayment,
    };
  }

  // Standard field-based worker payment calculation
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

  const lineItems: WorkerPaymentLineItem[] = [];
  const appliedRules: AppliedRule[] = [];
  let subtotal = 0;

  // Process field rules
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

  // Process option rules
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

  // Process base rules
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
  appliedRules.push(...baseEvaluation.appliedRules);

  // Process conditional rules
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

  return {
    job_id: job.id,
    line_items: lineItems,
    applied_rules: appliedRules,
    subtotal,
    total_adjustments: totalAdjustments,
    total_worker_payment: total,
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

// Helper functions (reused from calculate-invoice)
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
): { lineItem: WorkerPaymentLineItem; appliedRule: AppliedRule } | null {
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
): { lineItem: WorkerPaymentLineItem; appliedRule: AppliedRule } | null {
  if (!rule.option_value) return null;
  const quantity = getOptionQuantity(fieldValue, rule.option_value);
  if (quantity <= 0) return null;

  const unitPrice = rule.base_price ?? 0;
  const total = quantity * unitPrice;
  if (total <= 0) return null;

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
  appliedRules: AppliedRule[];
} {
  let total = subtotal;
  let adjustmentAmount = 0;
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
      const baseAmount = selectedRule.base_price ?? 0;
      total += baseAmount;
      adjustmentAmount += baseAmount;
    } else {
      const multiplier = selectedRule.percentage_rate ?? 1;
      const newTotal = total * multiplier;
      adjustmentAmount += newTotal - total;
      total = newTotal;
    }

    appliedRules.push({
      pricing_rule_id: selectedRule.id,
      scope: selectedRule.scope,
      pricing_type: selectedRule.pricing_type,
      field_config_id: selectedRule.field_config_id,
      option_value: selectedRule.option_value,
      location_hierarchy_id: selectedRule.location_hierarchy_id,
      location_id: selectedRule.location_id,
      amount: adjustmentAmount,
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

  return { total, adjustmentAmount, appliedRules };
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

      appliedRules.push({
        pricing_rule_id: rule.id,
        scope: rule.scope,
        pricing_type: rule.pricing_type,
        field_config_id: rule.field_config_id,
        option_value: rule.option_value,
        location_hierarchy_id: rule.location_hierarchy_id,
        location_id: rule.location_id,
        amount: adjustment,
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

/**
 * Calculate how to split the total payment among workers.
 *
 * New model with ADDITIVE bonuses:
 * 1. Time-based split: Base worker payment is split by hours worked
 * 2. Multipliers: Applied to worker's time-share (increases their portion)
 * 3. Per-unit bonuses: Added ON TOP of time share (not deducted from pool)
 * 4. Flat bonuses: Added ON TOP of time share (not deducted from pool)
 *
 * Bonuses are ADDITIVE - they increase total payout, not redistribute existing pool.
 * This honors the pricing rules (workers receive what's defined per unit).
 */
function calculateWorkerSplits({
  baseWorkerPayment,
  workers,
  rateCardMap,
  allocations,
  submissionData,
  fieldConfigMap,
}: {
  baseWorkerPayment: number;
  workers: JobWorker[];
  rateCardMap: Map<string, WorkerRateCard>;
  allocations: WorkerPaymentAllocation[];
  submissionData: Record<string, unknown>;
  fieldConfigMap: Map<string, FieldConfig>;
}): WorkerPaymentSplit[] {
  if (workers.length === 0) return [];

  // Initialize breakdown for each worker
  const breakdowns: WorkerPaymentSplit[] = workers.map((worker) => {
    const workerName = worker.worker
      ? `${worker.worker.first_name} ${worker.worker.last_name}`.trim()
      : "Unknown";

    // Calculate hours worked from time tracking
    let hoursWorked = 0;
    if (worker.start_time && worker.end_time) {
      const start = new Date(worker.start_time);
      const end = new Date(worker.end_time);
      hoursWorked = Math.max(
        0,
        (end.getTime() - start.getTime()) / (1000 * 60 * 60),
      );
    }

    return {
      worker_id: worker.worker_id,
      worker_name: workerName,
      hours_worked: Math.round(hoursWorked * 100) / 100,
      time_share: 0,
      multiplier_adjustment: 0,
      per_unit_bonus: 0,
      flat_bonus: 0,
      final_payment: 0,
      allocation_type: "time_based",
    };
  });

  // Single worker gets full base payment (no need to split)
  if (workers.length === 1) {
    breakdowns[0].time_share = baseWorkerPayment;
    breakdowns[0].allocation_type = "single_worker";
  } else {
    // Step 1: Time-based split of the FULL base worker payment
    const totalHours = breakdowns.reduce((sum, b) => sum + b.hours_worked, 0);

    if (totalHours > 0) {
      // Proportional split by hours worked
      breakdowns.forEach((breakdown) => {
        breakdown.time_share = Math.round(
          ((breakdown.hours_worked / totalHours) * baseWorkerPayment) * 100,
        ) / 100;
        breakdown.allocation_type = "time_based";
      });
    } else {
      // Fallback: equal split if no time tracking data
      const equalShare =
        Math.round((baseWorkerPayment / workers.length) * 100) / 100;
      breakdowns.forEach((breakdown) => {
        breakdown.time_share = equalShare;
        breakdown.allocation_type = "equal_split";
      });
    }
  }

  // Step 2: Apply multipliers to time-share (increases their portion)
  breakdowns.forEach((breakdown) => {
    const rateCard = rateCardMap.get(breakdown.worker_id);
    if (rateCard?.modifier_type === "multiplier") {
      const originalShare = breakdown.time_share;
      breakdown.time_share =
        Math.round(originalShare * rateCard.modifier_value * 100) / 100;
      breakdown.multiplier_adjustment =
        Math.round((breakdown.time_share - originalShare) * 100) / 100;
      breakdown.rate_card_id = rateCard.id;
    }
  });

  // Step 3: Calculate ADDITIVE per-unit bonuses (on top of share)
  breakdowns.forEach((breakdown) => {
    const rateCard = rateCardMap.get(breakdown.worker_id);
    if (rateCard?.modifier_type === "per_unit" && rateCard.field_config_ids) {
      let bonus = 0;
      rateCard.field_config_ids.forEach((fieldConfigId) => {
        const fieldConfig = fieldConfigMap.get(fieldConfigId);
        if (fieldConfig) {
          const fieldValue = submissionData[fieldConfig.name];
          // Get numeric value from field (could be number, array length, etc.)
          const count = getNumericFieldValue(fieldValue);
          bonus += count * rateCard.modifier_value;
        }
      });
      breakdown.per_unit_bonus = Math.round(bonus * 100) / 100;
      breakdown.rate_card_id = rateCard.id;
    }
  });

  // Step 4: Calculate ADDITIVE flat bonuses (on top of share)
  breakdowns.forEach((breakdown) => {
    const rateCard = rateCardMap.get(breakdown.worker_id);
    if (rateCard?.modifier_type === "flat") {
      breakdown.flat_bonus = rateCard.modifier_value;
      breakdown.rate_card_id = rateCard.id;
    }
  });

  // Step 5: Calculate final payments (share + all bonuses)
  breakdowns.forEach((breakdown) => {
    breakdown.final_payment = Math.round(
      (breakdown.time_share +
        breakdown.per_unit_bonus +
        breakdown.flat_bonus) *
        100,
    ) / 100;
  });

  return breakdowns;
}

/**
 * Extract a numeric value from a field value for per-unit bonus calculation.
 * Handles various field types: number, array (count), object with quantity, etc.
 */
function getNumericFieldValue(value: unknown): number {
  if (value === null || value === undefined) return 0;

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  if (Array.isArray(value)) {
    // For arrays, could be count of items or sum of quantities
    let total = 0;
    for (const item of value) {
      if (typeof item === "number") {
        total += item;
      } else if (typeof item === "object" && item !== null) {
        // Check for quantity field in object
        const obj = item as Record<string, unknown>;
        if (typeof obj.quantity === "number") {
          total += obj.quantity;
        } else if (typeof obj.count === "number") {
          total += obj.count;
        } else {
          // Count the item itself
          total += 1;
        }
      } else {
        // Count non-numeric items
        total += 1;
      }
    }
    return total;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Check common quantity field names
    if (typeof obj.quantity === "number") return obj.quantity;
    if (typeof obj.count === "number") return obj.count;
    if (typeof obj.total === "number") return obj.total;
  }

  return 0;
}
