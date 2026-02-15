"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { optionPricingKey } from "@/app/query-provider";
import { PricingService } from "@/lib/services";
import type { UpsertPricingRuleRequest } from "@/lib/services/pricing.service";
import { log } from "@/lib/logger";
import type { OptionPricing, PricingRule } from "@/lib/types";

interface UseOptionPricingOptions {
  locationId?: string | null;
  locationHierarchyId?: string | null;
  effectiveAt?: string | null;
  pricingContext?: "customer" | "worker";
}

interface UpsertOptions {
  workerPaymentRate?: number | null;
  locationId?: string | null;
  locationHierarchyId?: string | null;
  currency?: string;
  expirationDate?: string | null;
  effectiveAt?: string | null;
  pricingContext?: "customer" | "worker";
  skipRefetch?: boolean;
}

interface UseOptionPricingResult {
  optionPricing: OptionPricing[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  upsertPricing: (
    fieldConfigId: string,
    optionValue: string,
    customerPrice: number,
    options?: UpsertOptions,
  ) => Promise<OptionPricing>;
  deletePricing: (id: string) => Promise<void>;
}

function transformOptionRule(rule: PricingRule): OptionPricing {
  const isWorkerContext = rule.pricing_context === "worker";
  const basePrice = rule.base_price ?? 0;

  return {
    id: rule.id,
    organization_id: rule.organization_id,
    field_config_id: rule.field_config_id || "",
    option_value: rule.option_value || "",
    customer_price: basePrice,
    worker_payment_rate: isWorkerContext
      ? basePrice
      : rule.worker_payment_value ?? null,
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

export function useOptionPricing(
  organizationId: string | null,
  fieldConfigId?: string,
  filters?: UseOptionPricingOptions,
): UseOptionPricingResult {
  const queryClient = useQueryClient();

  const queryKey = optionPricingKey(organizationId, fieldConfigId ?? null, {
    effectiveAt: filters?.effectiveAt,
    locationHierarchyId: filters?.locationHierarchyId,
    locationId: filters?.locationId,
    pricingContext: filters?.pricingContext,
  });

  const {
    data: optionPricing = [],
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return [];
      const pricing = await PricingService.listRules({
        organization_id: organizationId,
        scopes: ["option"],
        field_config_id: fieldConfigId,
        location_hierarchy_id: null,
        location_id: null,
        effective_at: filters?.effectiveAt ?? undefined,
        pricing_context: filters?.pricingContext || "customer",
      });
      return pricing.map(transformOptionRule);
    },
    enabled: !!organizationId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (params: {
      request: UpsertPricingRuleRequest;
      existingPricing: OptionPricing | null;
      optimisticPricing: OptionPricing;
      skipInvalidation?: boolean;
    }) => {
      const { request } = params;
      const pricing = await PricingService.upsertRule(request);
      return transformOptionRule(pricing);
    },
    onMutate: async (params) => {
      const { existingPricing, optimisticPricing } = params;
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<OptionPricing[]>(queryKey);

      queryClient.setQueryData<OptionPricing[]>(queryKey, (old) => {
        if (!old) return old;
        if (existingPricing) {
          return old.map((p) =>
            p.id === existingPricing.id ? optimisticPricing : p,
          );
        }
        return [...old, optimisticPricing];
      });

      return { previousData };
    },
    onError: (err, _params, context) => {
      log.error("Failed to upsert option pricing", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: (_data, _error, variables) => {
      if (!variables?.skipInvalidation) {
        queryClient.invalidateQueries({ queryKey });
        if (organizationId) {
          queryClient.invalidateQueries({
            queryKey: ["pricing-history", organizationId],
          });
        }
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => PricingService.deleteRule(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<OptionPricing[]>(queryKey);

      queryClient.setQueryData<OptionPricing[]>(queryKey, (old) =>
        old ? old.filter((p) => p.id !== id) : old,
      );

      return { previousData };
    },
    onError: (err, _id, context) => {
      log.error("Failed to delete option pricing", {
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
    optionValue: string,
    customerPrice: number,
    opts?: UpsertOptions,
  ): Promise<OptionPricing> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const targetLocationHierarchyId =
      opts?.locationHierarchyId ?? filters?.locationHierarchyId ?? null;
    const targetLocationId = opts?.locationId ?? filters?.locationId ?? null;
    const targetPricingContext =
      opts?.pricingContext ?? filters?.pricingContext ?? "customer";

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

    const existingPricing = optionPricing.find((pricing) => {
      const ruleContext = pricing.source_rule?.pricing_context || "customer";
      const ruleEffectiveDate = pricing.source_rule?.effective_at
        ? new Date(pricing.source_rule.effective_at).toISOString().split("T")[0]
        : null;
      return (
        pricing.field_config_id === fieldConfigId &&
        pricing.option_value === optionValue &&
        (pricing.location_hierarchy_id || null) === targetLocationHierarchyId &&
        (pricing.location_id || null) === targetLocationId &&
        ruleContext === targetPricingContext &&
        ruleEffectiveDate === targetEffectiveDate
      );
    });

    const request: UpsertPricingRuleRequest = {
      id: existingPricing?.id,
      organization_id: organizationId,
      scope: "option",
      pricing_type: "fixed",
      pricing_context: targetPricingContext,
      field_config_id: fieldConfigId,
      option_value: optionValue,
      base_price: customerPrice,
      currency: opts?.currency || "USD",
      location_hierarchy_id: targetLocationHierarchyId,
      location_id: targetLocationId,
      expires_at: opts?.expirationDate || null,
      effective_at: targetEffectiveAt,
    };

    if (targetPricingContext === "customer") {
      request.worker_payment_type = opts?.workerPaymentRate
        ? "fixed_rate"
        : existingPricing?.worker_payment_type ?? null;
      request.worker_payment_value = opts?.workerPaymentRate ?? null;
    }

    const tempId = existingPricing?.id ?? `temp-${Date.now()}`;
    const optimisticSourceRule: PricingRule = {
      id: tempId,
      organization_id: organizationId,
      scope: "option",
      pricing_type: "fixed",
      pricing_context: targetPricingContext,
      field_config_id: fieldConfigId,
      option_value: optionValue,
      applies_to_field_type: null,
      location_hierarchy_id: targetLocationHierarchyId,
      location_id: targetLocationId,
      currency: request.currency || "USD",
      base_price: customerPrice,
      percentage_rate: null,
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
      field_config: existingPricing?.field_config,
      location: existingPricing?.location,
      location_node: existingPricing?.location_node,
    } as PricingRule;

    const optimisticPricing: OptionPricing = {
      id: tempId,
      organization_id: organizationId,
      field_config_id: fieldConfigId,
      option_value: optionValue,
      customer_price: customerPrice,
      worker_payment_rate:
        targetPricingContext === "worker"
          ? customerPrice
          : request.worker_payment_value ?? null,
      worker_payment_type: request.worker_payment_type ?? null,
      location_id: targetLocationId,
      location_hierarchy_id: targetLocationHierarchyId,
      currency: request.currency || "USD",
      source_rule: optimisticSourceRule,
      field_config: existingPricing?.field_config,
      location: existingPricing?.location,
      location_node: existingPricing?.location_node,
    };

    const result = await upsertMutation.mutateAsync({
      request,
      existingPricing: existingPricing ?? null,
      optimisticPricing,
      skipInvalidation: opts?.skipRefetch ?? false,
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
    optionPricing,
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Failed to fetch option pricing"
      : null,
    refetch,
    upsertPricing,
    deletePricing,
  };
}
