"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { basePricingKey } from "@/app/query-provider";
import { PricingService } from "@/lib/services";
import type { UpsertPricingRuleRequest } from "@/lib/services/pricing.service";
import { log } from "@/lib/logger";
import type { BasePricing, PricingRule } from "@/lib/types";

interface UseBasePricingOptions {
  locationId?: string | null;
  locationHierarchyId?: string | null;
  effectiveAt?: string | null;
  pricingContext?: "customer" | "worker"; // Defaults to 'customer'
}

interface UseBasePricingResult {
  basePricing: BasePricing[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  upsertPricing: (request: {
    job_type_field_config_id?: string | null;
    job_type_value?: string | null;
    standalone_base_price?: number | null;
    customer_base_price: number;
    worker_base_payment?: number | null;
    adjustment_type?: "add" | "multiply";
    location_id?: string | null;
    currency?: string;
    conditions?: UpsertPricingRuleRequest["conditions"];
    effectiveAt?: string | null; // Explicit effective date for timeline support
    pricingContext?: "customer" | "worker";
  }) => Promise<BasePricing>;
  deletePricing: (id: string) => Promise<void>;
}

function transformBaseRule(rule: PricingRule): BasePricing {
  const isWorkerContext = rule.pricing_context === "worker";
  const adjustmentType =
    (typeof (rule.metadata as Record<string, unknown> | undefined)?.["adjustment_type"] === "string"
      ? ((rule.metadata as Record<string, unknown>)["adjustment_type"] as "add" | "multiply")
      : undefined) || (rule.pricing_type === "percentage" ? "multiply" : "add");

  const customerValue =
    adjustmentType === "multiply" ? (rule.percentage_rate ?? 0) : (rule.base_price ?? 0);

  return {
    id: rule.id,
    organization_id: rule.organization_id,
    job_type_field_config_id: rule.field_config_id || null,
    job_type_value: rule.option_value || null,
    adjustment_type: adjustmentType,
    customer_base_price: customerValue,
    // For worker context rules, worker_base_payment comes from base_price
    // For customer context rules, it comes from worker_payment_value field
    worker_base_payment: isWorkerContext ? customerValue : (rule.worker_payment_value ?? null),
    worker_payment_type: rule.worker_payment_type ?? null,
    location_id: rule.location_id,
    location_hierarchy_id: rule.location_hierarchy_id,
    currency: rule.currency,
    source_rule: rule,
    field_config: rule.field_config,
    location: rule.location,
    location_node: rule.location_node,
  };
}

export function useBasePricing(
  organizationId: string | null,
  filters?: UseBasePricingOptions
): UseBasePricingResult {
  const queryClient = useQueryClient();

  const queryKey = basePricingKey(organizationId, {
    effectiveAt: filters?.effectiveAt,
    locationHierarchyId: filters?.locationHierarchyId,
    locationId: filters?.locationId,
    pricingContext: filters?.pricingContext,
  });

  const {
    data: basePricing = [],
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return [];
      const pricing = await PricingService.listRules({
        organization_id: organizationId,
        scopes: ["base"],
        location_hierarchy_id: null,
        location_id: null,
        effective_at: filters?.effectiveAt ?? undefined,
        pricing_context: filters?.pricingContext || "customer",
      });
      return pricing.map(transformBaseRule);
    },
    enabled: !!organizationId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (params: {
      request: UpsertPricingRuleRequest;
      existingRule: BasePricing | null;
      optimisticBasePricing: BasePricing;
    }) => {
      const { request } = params;
      const pricing = await PricingService.upsertRule(request);
      return transformBaseRule(pricing);
    },
    onMutate: async (params) => {
      const { existingRule, optimisticBasePricing } = params;
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<BasePricing[]>(queryKey);

      queryClient.setQueryData<BasePricing[]>(queryKey, (old) => {
        if (!old) return old;
        if (existingRule) {
          return old.map((r) => (r.id === existingRule.id ? optimisticBasePricing : r));
        }
        return [...old, optimisticBasePricing];
      });

      return { previousData };
    },
    onError: (err, _params, context) => {
      log.error("useBasePricing: Failed to upsert base pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: ["pricing-history", organizationId],
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => PricingService.deleteRule(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<BasePricing[]>(queryKey);

      queryClient.setQueryData<BasePricing[]>(queryKey, (old) =>
        old ? old.filter((r) => r.id !== id) : old
      );

      return { previousData };
    },
    onError: (err, _id, context) => {
      log.error("useBasePricing: Failed to delete base pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: ["pricing-history", organizationId],
        });
      }
    },
  });

  const upsertPricing = async (request: {
    job_type_field_config_id?: string | null;
    job_type_value?: string | null;
    standalone_base_price?: number | null;
    customer_base_price: number;
    worker_base_payment?: number | null;
    adjustment_type?: "add" | "multiply";
    location_id?: string | null;
    currency?: string;
    conditions?: UpsertPricingRuleRequest["conditions"];
    effectiveAt?: string | null;
    pricingContext?: "customer" | "worker";
  }): Promise<BasePricing> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const targetLocationHierarchyId = filters?.locationHierarchyId ?? null;
    const targetLocationId = request.location_id ?? filters?.locationId ?? null;

    const isFieldBased = Boolean(request.job_type_field_config_id);
    const targetPricingContext = request.pricingContext || filters?.pricingContext || "customer";

    let targetEffectiveAt: string;
    let targetEffectiveDate: string;

    if (request.effectiveAt) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(request.effectiveAt)) {
        targetEffectiveDate = request.effectiveAt;
        targetEffectiveAt = `${request.effectiveAt}T00:00:00.000Z`;
      } else {
        targetEffectiveAt = new Date(request.effectiveAt).toISOString();
        targetEffectiveDate = targetEffectiveAt.split("T")[0];
      }
    } else {
      targetEffectiveAt = new Date().toISOString();
      targetEffectiveDate = targetEffectiveAt.split("T")[0];
    }

    const existing = basePricing.find((pricing) => {
      const ruleContext = pricing.source_rule?.pricing_context || "customer";
      const ruleEffectiveDate = pricing.source_rule?.effective_at
        ? new Date(pricing.source_rule.effective_at).toISOString().split("T")[0]
        : null;
      const matchesLocation =
        (pricing.location_hierarchy_id || null) === targetLocationHierarchyId &&
        (pricing.location_id || null) === targetLocationId;

      if (
        !matchesLocation ||
        ruleContext !== targetPricingContext ||
        ruleEffectiveDate !== targetEffectiveDate
      ) {
        return false;
      }

      if (isFieldBased) {
        return (
          pricing.job_type_field_config_id === request.job_type_field_config_id &&
          pricing.job_type_value === request.job_type_value
        );
      }

      return !pricing.job_type_field_config_id;
    });

    const adjustmentType = request.adjustment_type || "add";
    const pricingType = adjustmentType === "add" ? "fixed" : "percentage";

    const pricingRequest: UpsertPricingRuleRequest = {
      id: existing?.id,
      organization_id: organizationId,
      scope: "base",
      pricing_type: pricingType,
      pricing_context: targetPricingContext,
      field_config_id: request.job_type_field_config_id || null,
      option_value: request.job_type_value || null,
      base_price: adjustmentType === "add" ? request.customer_base_price : null,
      percentage_rate: adjustmentType === "multiply" ? request.customer_base_price : null,
      metadata: {
        adjustment_type: adjustmentType,
      },
      location_hierarchy_id: targetLocationHierarchyId,
      location_id: request.location_id ?? targetLocationId,
      currency: request.currency || "USD",
      conditions: request.conditions,
      effective_at: targetEffectiveAt,
    };

    if (targetPricingContext === "customer") {
      pricingRequest.worker_payment_type = request.worker_base_payment
        ? "fixed_rate"
        : existing?.worker_payment_type || null;
      pricingRequest.worker_payment_value = request.worker_base_payment ?? null;
    }

    const tempId = existing?.id ?? `temp-${Date.now()}`;
    const customerValue =
      adjustmentType === "multiply" ? request.customer_base_price : request.customer_base_price;

    const optimisticSourceRule: PricingRule = {
      id: tempId,
      organization_id: organizationId,
      scope: "base",
      pricing_type: pricingType,
      pricing_context: targetPricingContext,
      field_config_id: request.job_type_field_config_id || null,
      option_value: request.job_type_value || null,
      applies_to_field_type: null,
      location_hierarchy_id: targetLocationHierarchyId,
      location_id: targetLocationId,
      currency: request.currency || "USD",
      base_price: adjustmentType === "add" ? request.customer_base_price : null,
      percentage_rate: adjustmentType === "multiply" ? request.customer_base_price : null,
      minimum_quantity: null,
      maximum_quantity: null,
      tier_definition: null,
      metadata: { adjustment_type: adjustmentType },
      worker_payment_type:
        request.worker_base_payment && targetPricingContext === "customer" ? "fixed_rate" : null,
      worker_payment_value:
        request.worker_base_payment && targetPricingContext === "customer"
          ? request.worker_base_payment
          : null,
      priority: 0,
      effective_at: targetEffectiveAt,
      expires_at: null,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      field_config: existing?.field_config ?? undefined,
      location: existing?.location ?? undefined,
      location_node: existing?.location_node ?? undefined,
    } as unknown as PricingRule;

    const optimisticBasePricing: BasePricing = {
      id: tempId,
      organization_id: organizationId,
      job_type_field_config_id: request.job_type_field_config_id || null,
      job_type_value: request.job_type_value || null,
      adjustment_type: adjustmentType,
      customer_base_price: customerValue,
      worker_base_payment:
        targetPricingContext === "worker" ? customerValue : (request.worker_base_payment ?? null),
      worker_payment_type:
        request.worker_base_payment && targetPricingContext === "customer" ? "fixed_rate" : null,
      location_id: targetLocationId,
      location_hierarchy_id: targetLocationHierarchyId,
      currency: request.currency || "USD",
      source_rule: optimisticSourceRule,
      field_config: existing?.field_config ?? undefined,
      location: existing?.location ?? undefined,
      location_node: existing?.location_node ?? undefined,
    };

    return upsertMutation.mutateAsync({
      request: pricingRequest,
      existingRule: existing ?? null,
      optimisticBasePricing,
    });
  };

  const deletePricing = async (id: string): Promise<void> => {
    await deleteMutation.mutateAsync(id);
  };

  const refetch = async () => {
    await queryRefetch();
  };

  return {
    basePricing,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to fetch base pricing") : null,
    refetch,
    upsertPricing,
    deletePricing,
  };
}
