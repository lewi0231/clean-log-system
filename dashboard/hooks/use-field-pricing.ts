"use client";

import { PricingService } from "@/lib/services";
import type { UpsertPricingRuleRequest } from "@/lib/services/pricing.service";
import type {
  FieldPricing,
  PricingRule,
  PricingType,
  WorkerPaymentType,
} from "@/lib/types";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseFieldPricingOptions {
  locationId?: string | null;
  locationHierarchyId?: string | null;
  effectiveAt?: string | null;
  refreshToken?: number;
  pricingContext?: "customer" | "worker"; // Defaults to 'customer'
}

interface UseFieldPricingResult {
  fieldPricing: FieldPricing[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  upsertPricing: (
    fieldConfigId: string,
    customerPrice: number,
    options?: {
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
    },
  ) => Promise<FieldPricing>;
  deletePricing: (id: string) => Promise<void>;
}

export function useFieldPricing(
  options?: UseFieldPricingOptions,
): UseFieldPricingResult {
  const { organizationId } = useOrganization();
  const [fieldPricing, setFieldPricing] = useState<FieldPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFieldPricing = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch ALL pricing for field scope to show all overrides
      // We'll filter by scope in the component for the main price display
      const pricing = await PricingService.listRules({
        organization_id: organizationId,
        scopes: ["field"],
        // Don't filter by location - fetch all to show all overrides
        location_hierarchy_id: null,
        location_id: null,
        effective_at: options?.effectiveAt ?? undefined,
        pricing_context: options?.pricingContext || "customer",
      });

      setFieldPricing(pricing.map(transformFieldPricing));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch field pricing",
      );
      setFieldPricing([]);
    } finally {
      setLoading(false);
    }
  };

  const upsertPricing = async (
    fieldConfigId: string,
    customerPrice: number,
    options?: {
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
    },
  ): Promise<FieldPricing> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const targetLocationHierarchyId = options?.locationHierarchyId ?? null;
    const targetLocationId = options?.locationId ?? null;
    const targetPricingContext = options?.pricingContext || "customer";

    // Find existing rule matching field, location, AND pricing_context
    // Customer and worker pricing are separate rules
    const existingRule = fieldPricing.find(
      (rule) => {
        const ruleContext = rule.source_rule?.pricing_context || "customer"; // Default to 'customer' for backward compatibility
        return (
          rule.field_config_id === fieldConfigId &&
          (rule.location_hierarchy_id || null) === targetLocationHierarchyId &&
          (rule.location_id || null) === targetLocationId &&
          ruleContext === targetPricingContext
        );
      },
    );

    // Build the request object
    const request: UpsertPricingRuleRequest = {
      id: existingRule?.id,
      organization_id: organizationId,
      scope: "field",
      pricing_type: options?.pricingType || "unit",
      pricing_context: targetPricingContext,
      field_config_id: fieldConfigId,
      applies_to_field_type: options?.appliesToFieldType,
      base_price: customerPrice,
      currency: options?.currency || "USD",
      location_hierarchy_id: targetLocationHierarchyId,
      location_id: targetLocationId,
      conditions: options?.conditions,
      expires_at: options?.expirationDate || null,
    };

    // Only include worker_payment fields for customer pricing rules
    // Worker pricing rules use base_price directly and cannot have worker_payment fields
    if (targetPricingContext === "customer") {
      request.worker_payment_type = options?.workerPaymentType || null;
      request.worker_payment_value = options?.workerPaymentValue ?? null;
    }

    try {
      const pricing = await PricingService.upsertRule(request);
      await fetchFieldPricing();
      return transformFieldPricing(pricing);
    } catch (error) {
      // If we get a unique constraint error and we don't have an existing rule ID,
      // it might be because a rule was just deleted. Try to find and update it instead.
      if (
        !existingRule?.id &&
        error instanceof Error &&
        (error.message.includes("23505") ||
          error.message.includes("already exists") ||
          error.message.includes("unique constraint"))
      ) {
        console.log(
          "[Pricing Debug] Unique constraint error, attempting to find existing rule:",
          {
            fieldConfigId,
            locationId: targetLocationId,
            locationHierarchyId: targetLocationHierarchyId,
            pricingContext: targetPricingContext,
          },
        );

        // Refetch to see if a rule exists now
        await fetchFieldPricing();
        const updatedExistingRule = fieldPricing.find(
          (rule) => {
            const ruleContext = rule.source_rule?.pricing_context || "customer";
            return (
              rule.field_config_id === fieldConfigId &&
              (rule.location_hierarchy_id || null) ===
                targetLocationHierarchyId &&
              (rule.location_id || null) === targetLocationId &&
              ruleContext === targetPricingContext
            );
          },
        );

        if (updatedExistingRule) {
          // Found it, update with the ID
          request.id = updatedExistingRule.id;
          const pricing = await PricingService.upsertRule(request);
          await fetchFieldPricing();
          return transformFieldPricing(pricing);
        }
      }
      throw error;
    }
  };

  const deletePricing = async (id: string): Promise<void> => {
    await PricingService.deleteRule(id);
    await fetchFieldPricing();
  };

  useEffect(() => {
    fetchFieldPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    organizationId,
    options?.effectiveAt,
    options?.refreshToken,
  ]);

  return {
    fieldPricing,
    loading,
    error,
    refetch: fetchFieldPricing,
    upsertPricing,
    deletePricing,
  };
}

const transformFieldPricing = (rule: PricingRule): FieldPricing => {
  const isWorkerContext = rule.pricing_context === "worker";
  const basePrice = rule.pricing_type === "percentage"
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
    // For worker context rules, worker_payment_value comes from base_price
    // For customer context rules, it comes from worker_payment_value field
    worker_payment_value: isWorkerContext
      ? basePrice
      : rule.worker_payment_value,
    source_rule: rule,
    field_config: rule.field_config,
    location: rule.location,
    location_node: rule.location_node,
  };
};
