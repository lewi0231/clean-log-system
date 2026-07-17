/**
 * Shared worker payment calculation for job IDs (no persistence).
 * Used by calculate-worker-payment and worker tax invoice draft/submit (B0 / D2).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLoggerWithoutRequest } from "../../_utils/logger.ts";
import { roundTaxInvoiceAmount } from "../../_utils/worker-tax-invoice.ts";
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

export async function calculateAmountsForJobs(
  supabase: SupabaseClient,
  organization_id: string,
  job_ids: string[]
): Promise<WorkerPaymentCalculation[]> {
  const logger = createLoggerWithoutRequest({
    functionName: "calculateAmountsForJobs",
  });

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
    return [];
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

  return calculations;
}

/** Amount owed to one worker across job calculations (from splits). */
export function amountForWorkerFromCalculations(
  calculations: WorkerPaymentCalculation[],
  workerId: string
): { job_id: string; amount: number; description: string }[] {
  const lines: { job_id: string; amount: number; description: string }[] = [];
  for (const calc of calculations) {
    const split = calc.worker_splits?.find((s) => s.worker_id === workerId);
    if (!split) continue;
    const amount = roundTaxInvoiceAmount(split.final_payment);
    lines.push({
      job_id: calc.job_id,
      amount,
      description: `Job ${calc.job_id.slice(0, 8)}`,
    });
  }
  return lines;
}
