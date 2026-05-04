import { verifyOrganizationMembershipFromRequest } from "../../_utils/auth.ts";
import { errorResponse, jsonResponse } from "../../_utils/http.ts";
import { createLogger } from "../../_utils/logger.ts";
import { createServiceRoleClient } from "../../_utils/supabase.ts";
import { calculateWorkerPayment, calculateWorkerSplits } from "./calculation-engine.ts";
import type {
  FieldConfig,
  JobRecord,
  JobWorker,
  LocationHierarchyNode,
  PricingConditionRow,
  PricingRuleRow,
  ServicePricingModeRow,
  WorkerPaymentCalculation,
} from "./types.ts";
import { buildWorkerRateCardMultiMap } from "./worker-rate-card-map.ts";

type Logger = ReturnType<typeof createLogger>;

export async function runCalculateWorkerPaymentPersistence(
  req: Request,
  logger: Logger,
  organization_id: string,
  job_ids: string[]
): Promise<Response> {
  const supabase = createServiceRoleClient();

  const membershipCheck = await verifyOrganizationMembershipFromRequest(
    req,
    organization_id,
    supabase
  );
  if (!membershipCheck) {
    logger.warn("Unauthorized attempt to calculate worker payment", {
      organization_id,
    });
    return errorResponse("You do not have permission to access this organization", 403);
  }

  const { data: jobsRaw, error: jobsError } = await supabase
    .from("job")
    .select(
      `
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
      `
    )
    .eq("organization_id", organization_id)
    .in("id", job_ids);

  if (jobsError) throw jobsError;
  if (!jobsRaw || jobsRaw.length === 0) {
    return errorResponse("No jobs found", 404);
  }

  const jobs = jobsRaw.map((job: (typeof jobsRaw)[number]) => {
    const locationData = job.location as unknown as {
      id: string;
      hierarchy_parent_id: string | null;
      pricing_mode: string | null;
      fixed_worker_payment: number | null;
      fixed_price_currency: string | null;
    } | null;
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

  const { data: servicePricingModes, error: servicePricingError } = await supabase
    .from("service_pricing_mode")
    .select("*")
    .eq("organization_id", organization_id);

  if (servicePricingError) throw servicePricingError;

  const nowIso = new Date().toISOString();
  const { data: pricingRules, error: pricingRulesError } = await supabase
    .from("pricing_rule")
    .select("*")
    .eq("organization_id", organization_id)
    .eq("active", true)
    .eq("pricing_context", "worker")
    .lte("effective_at", nowIso)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  if (pricingRulesError) throw pricingRulesError;

  const pricingConditionsMap = new Map<string, PricingConditionRow[]>();
  if (pricingRules && pricingRules.length > 0) {
    const pricingRuleIds = pricingRules.map((rule: { id: string }) => rule.id);
    const { data: pricingConditions, error: conditionsError } = await supabase
      .from("pricing_condition")
      .select(
        "id, pricing_rule_id, condition_field_config_id, operator, condition_value, action_type, action_value, metadata, priority"
      )
      .in("pricing_rule_id", pricingRuleIds)
      .order("priority", { ascending: true });

    if (conditionsError) throw conditionsError;

    if (pricingConditions) {
      pricingConditions.forEach((condition: (typeof pricingConditions)[number]) => {
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

  const pricingRulesWithConditions = (pricingRules || []).map(
    (rule: NonNullable<typeof pricingRules>[number]) => ({
      ...rule,
      conditions: pricingConditionsMap.get(rule.id) || [],
    })
  );

  const fieldConfigMap = new Map<string, FieldConfig>(
    (fieldConfigs || []).map((config: NonNullable<typeof fieldConfigs>[number]) => [
      config.id,
      config as FieldConfig,
    ])
  );

  const todayDate = new Date().toISOString().split("T")[0];
  const { data: rateCards, error: rateCardsError } = await supabase
    .from("worker_rate_card")
    .select(
      `
        *,
        worker_rate_card_field (
          field_config_id
        )
      `
    )
    .eq("organization_id", organization_id)
    .eq("is_active", true)
    .lte("effective_from", todayDate)
    .or(`effective_to.is.null,effective_to.gte.${todayDate}`);

  if (rateCardsError) {
    logger.warn("Failed to fetch rate cards, proceeding without modifiers", {
      error: rateCardsError.message,
    });
  }

  const rateCardMap = buildWorkerRateCardMultiMap(rateCards, logger);

  const { data: jobWorkers, error: jobWorkersError } = await supabase
    .from("job_worker")
    .select("job_id, worker_id, start_time, end_time, worker:worker_id(id, first_name, last_name)")
    .in("job_id", job_ids);

  if (jobWorkersError) {
    logger.warn("Failed to fetch job workers", {
      error: jobWorkersError.message,
    });
  }

  const workersByJob = new Map<string, JobWorker[]>();
  (jobWorkers || []).forEach((jw: NonNullable<typeof jobWorkers>[number]) => {
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
      servicePricingModes: (servicePricingModes || []) as ServicePricingModeRow[],
    });

    const workers = workersByJob.get(job.id) || [];

    if (workers.length > 0) {
      const { splits, warnings } = calculateWorkerSplits({
        baseWorkerPayment: calculation.total_worker_payment,
        workers,
        rateCardMap,
        submissionData: (job.submission_data as Record<string, unknown>) || {},
        fieldConfigMap,
      });
      calculation.worker_splits = splits;
      if (warnings.length > 0) {
        calculation.calculation_warnings = warnings;
      }

      const totalBonuses = calculation.worker_splits.reduce(
        (sum, split) =>
          sum +
          split.per_unit_bonus +
          split.flat_bonus +
          split.multiplier_adjustment +
          split.team_percentage_bonus,
        0
      );
      calculation.total_worker_payment += totalBonuses;
    }

    calculations.push(calculation);
  }

  const aggregated = {
    total_worker_payment: calculations.reduce((sum, calc) => sum + calc.total_worker_payment, 0),
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
}
