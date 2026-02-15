"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fieldPricingKey } from "@/app/query-provider";
import { PricingService } from "@/lib/services";
import type { UpsertPricingRuleRequest } from "@/lib/services/pricing.service";
import { log } from "@/lib/logger";
import type {
  FieldPricing,
  PricingRule,
  PricingType,
  WorkerPaymentType,
} from "@/lib/types";

interface UseFieldPricingOptions {
  locationId?: string | null;
  locationHierarchyId?: string | null;
  effectiveAt?: string | null;
  refreshToken?: number;
  pricingContext?: "customer" | "worker"; // Defaults to 'customer'
}

interface UpsertPricingOptions {
  currency?: string;
  locationId?: string | null;
  locationHierarchyId?: string | null;
  pricingType?: PricingType;
  appliesToFieldType?: string;
  workerPaymentType?: WorkerPaymentType | null;
  workerPaymentValue?: number | null;
  conditions?: UpsertPricingRuleRequest["conditions"];
  expirationDate?: string | null;
  pricingContext?: "customer" | "worker";
  effectiveAt?: string | null; // Explicit effective date override
}

interface UseFieldPricingResult {
  fieldPricing: FieldPricing[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  upsertPricing: (
    fieldConfigId: string,
    customerPrice: number,
    options?: UpsertPricingOptions,
  ) => Promise<FieldPricing>;
  deletePricing: (id: string) => Promise<void>;
}

function transformFieldPricing(rule: PricingRule): FieldPricing {
  const isWorkerContext = rule.pricing_context === "worker";
  const basePrice =
    rule.pricing_type === "percentage"
      ? rule.percentage_rate ?? 0
      : rule.base_price ?? 0;

  return {
    id: rule.id,
    organization_id: rule.organization_id,
    field_config_id: rule.field_config_id || "",
    location_id: rule.location_id,
    location_hierarchy_id: rule.location_hierarchy_id,
    pricing_type: rule.pricing_type,
    customer_price: basePrice,
    currency: rule.currency,
    applies_to_field_type: rule.applies_to_field_type || null,
    worker_payment_type: rule.worker_payment_type,
    worker_payment_value: isWorkerContext
      ? basePrice
      : rule.worker_payment_value,
    source_rule: rule,
    field_config: rule.field_config,
    location: rule.location,
    location_node: rule.location_node,
  };
}

export function useFieldPricing(
  organizationId: string | null,
  options?: UseFieldPricingOptions,
): UseFieldPricingResult {
  const queryClient = useQueryClient();

  const queryKey = fieldPricingKey(organizationId, {
    effectiveAt: options?.effectiveAt,
    locationHierarchyId: options?.locationHierarchyId,
    locationId: options?.locationId,
    pricingContext: options?.pricingContext,
  });

  const {
    data: fieldPricing = [],
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return [];
      const pricing = await PricingService.listRules({
        organization_id: organizationId,
        scopes: ["field"],
        location_hierarchy_id: null,
        location_id: null,
        effective_at: options?.effectiveAt ?? undefined,
        pricing_context: options?.pricingContext || "customer",
      });
      return pricing.map(transformFieldPricing);
    },
    enabled: !!organizationId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (params: {
      request: UpsertPricingRuleRequest;
      existingRule: FieldPricing | null;
      optimisticFieldPricing: FieldPricing;
    }) => {
      const { request } = params;
      const pricing = await PricingService.upsertRule(request);
      return transformFieldPricing(pricing);
    },
    onMutate: async (params) => {
      const { request, existingRule, optimisticFieldPricing } = params;
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<FieldPricing[]>(queryKey);

      queryClient.setQueryData<FieldPricing[]>(queryKey, (old) => {
        if (!old) return old;
        if (existingRule) {
          return old.map((r) =>
            r.id === existingRule.id ? optimisticFieldPricing : r,
          );
        }
        return [...old, optimisticFieldPricing];
      });

      return { previousData, request };
    },
    onError: (err, params, context) => {
      log.error("MobileConfig: Failed to upsert field pricing", {
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
      const previousData = queryClient.getQueryData<FieldPricing[]>(queryKey);

      queryClient.setQueryData<FieldPricing[]>(queryKey, (old) =>
        old ? old.filter((r) => r.id !== id) : old,
      );

      return { previousData };
    },
    onError: (err, _id, context) => {
      log.error("MobileConfig: Failed to delete field pricing", {
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

  const upsertPricing = async (
    fieldConfigId: string,
    customerPrice: number,
    opts?: UpsertPricingOptions,
  ): Promise<FieldPricing> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const targetLocationHierarchyId = opts?.locationHierarchyId ?? options?.locationHierarchyId ?? null;
    const targetLocationId = opts?.locationId ?? options?.locationId ?? null;
    const targetPricingContext = opts?.pricingContext || options?.pricingContext || "customer";

    let targetEffectiveAt: string;
    let targetEffectiveDate: string;

    if (opts?.effectiveAt) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(opts.effectiveAt)) {
        targetEffectiveDate = opts.effectiveAt;
        targetEffectiveAt = `${opts.effectiveAt}T00:00:00.000Z`;
      } else {
        targetEffectiveAt = new Date(opts.effectiveAt).toISOString();
        targetEffectiveDate = targetEffectiveAt.split("T")[0];
      }
    } else {
      targetEffectiveAt = new Date().toISOString();
      targetEffectiveDate = targetEffectiveAt.split("T")[0];
    }

    const existingRule = fieldPricing.find((rule) => {
      const ruleContext = rule.source_rule?.pricing_context || "customer";
      const ruleEffectiveDate = rule.source_rule?.effective_at
        ? new Date(rule.source_rule.effective_at).toISOString().split("T")[0]
        : null;
      return (
        rule.field_config_id === fieldConfigId &&
        (rule.location_hierarchy_id || null) === targetLocationHierarchyId &&
        (rule.location_id || null) === targetLocationId &&
        ruleContext === targetPricingContext &&
        ruleEffectiveDate === targetEffectiveDate
      );
    });

    const request: UpsertPricingRuleRequest = {
      id: existingRule?.id,
      organization_id: organizationId,
      scope: "field",
      pricing_type: opts?.pricingType || "unit",
      pricing_context: targetPricingContext,
      field_config_id: fieldConfigId,
      applies_to_field_type: opts?.appliesToFieldType,
      base_price: customerPrice,
      currency: opts?.currency || "USD",
      location_hierarchy_id: targetLocationHierarchyId,
      location_id: targetLocationId,
      conditions: opts?.conditions,
      expires_at: opts?.expirationDate || null,
      effective_at: targetEffectiveAt,
    };

    if (targetPricingContext === "customer") {
      request.worker_payment_type = opts?.workerPaymentType || null;
      request.worker_payment_value = opts?.workerPaymentValue ?? null;
    }

    const tempId = existingRule?.id ?? `temp-${Date.now()}`;
    const basePrice =
      request.pricing_type === "percentage"
        ? request.percentage_rate ?? 0
        : request.base_price ?? 0;

    const optimisticSourceRule: PricingRule = {
      id: tempId,
      organization_id: organizationId,
      scope: "field",
      pricing_type: request.pricing_type,
      pricing_context: targetPricingContext,
      field_config_id: fieldConfigId,
      option_value: null,
      applies_to_field_type: opts?.appliesToFieldType ?? null,
      location_hierarchy_id: targetLocationHierarchyId,
      location_id: targetLocationId,
      currency: request.currency || "USD",
      base_price: request.base_price,
      percentage_rate: request.percentage_rate ?? null,
      minimum_quantity: null,
      maximum_quantity: null,
      tier_definition: null,
      metadata: {},
      worker_payment_type: request.worker_payment_type ?? null,
      worker_payment_value: request.worker_payment_value ?? null,
      priority: 0,
      effective_at: targetEffectiveAt,
      expires_at: request.expires_at ?? null,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      field_config: existingRule?.field_config,
      location: existingRule?.location,
      location_node: existingRule?.location_node,
    } as PricingRule;

    const optimisticFieldPricing: FieldPricing = {
      id: tempId,
      organization_id: organizationId,
      field_config_id: fieldConfigId,
      location_id: targetLocationId,
      location_hierarchy_id: targetLocationHierarchyId,
      pricing_type: request.pricing_type,
      customer_price: basePrice,
      currency: request.currency || "USD",
      applies_to_field_type: opts?.appliesToFieldType ?? null,
      worker_payment_type: request.worker_payment_type ?? null,
      worker_payment_value:
        targetPricingContext === "worker"
          ? basePrice
          : request.worker_payment_value ?? null,
      source_rule: optimisticSourceRule,
      field_config: existingRule?.field_config,
      location: existingRule?.location,
      location_node: existingRule?.location_node,
    };

    const result = await upsertMutation.mutateAsync({
      request,
      existingRule: existingRule ?? null,
      optimisticFieldPricing,
    });

    return result;
  };

  const deletePricing = async (id: string): Promise<void> => {
    await deleteMutation.mutateAsync(id);
  };

  const refetch = async () => {
    await queryRefetch();
  };

  return {
    fieldPricing,
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Failed to fetch field pricing"
      : null,
    refetch,
    upsertPricing,
    deletePricing,
  };
}
