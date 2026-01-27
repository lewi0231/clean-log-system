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

export function useFieldPricing(
  organizationId: string | null,
  options?: UseFieldPricingOptions,
): UseFieldPricingResult {
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
    options?: UpsertPricingOptions,
  ): Promise<FieldPricing> => {
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    const targetLocationHierarchyId = options?.locationHierarchyId ?? null;
    const targetLocationId = options?.locationId ?? null;
    const targetPricingContext = options?.pricingContext || "customer";

    // Pricing timeline model:
    // - Multiple rules CAN exist for the same (field, location, context) with DIFFERENT effective_at dates
    // - This allows scheduling price changes: e.g., $77 from Dec 12, $99 from Dec 15
    // - The unique constraint includes effective_at to support this
    // - When saving: match by field/location/context AND effective_at date
    // - If match found: UPDATE that specific timeline point
    // - If no match: CREATE a new timeline point

    // Determine the target effective date
    // IMPORTANT: Don't use new Date() parsing for date-only strings as it causes timezone issues
    // "2024-12-15" parsed as Date becomes LOCAL midnight, which in UTC+11 is Dec 14 13:00 UTC
    let targetEffectiveAt: string;
    let targetEffectiveDate: string; // YYYY-MM-DD for comparison

    if (options?.effectiveAt) {
      // Check if it's already a date-only string (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(options.effectiveAt)) {
        targetEffectiveDate = options.effectiveAt;
        // Create a proper UTC timestamp for the start of that day
        targetEffectiveAt = `${options.effectiveAt}T00:00:00.000Z`;
      } else {
        // It's a full timestamp - extract the date part
        targetEffectiveAt = new Date(options.effectiveAt).toISOString();
        targetEffectiveDate = targetEffectiveAt.split("T")[0];
      }
    } else {
      // No date specified - use current timestamp
      targetEffectiveAt = new Date().toISOString();
      targetEffectiveDate = targetEffectiveAt.split("T")[0];
    }

    // Find existing rule matching field, location, context, AND effective date
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
        ruleEffectiveDate === targetEffectiveDate // Must match same effective date
      );
    });

    const request: UpsertPricingRuleRequest = {
      id: existingRule?.id, // If exists for this date, update; otherwise create new timeline point
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
      effective_at: targetEffectiveAt, // Use the target effective date for this timeline point
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
      // If we get a unique constraint error, a rule for this exact date may already exist
      // Refetch and try to find it to update instead
      if (
        !existingRule?.id &&
        error instanceof Error &&
        (error.message.includes("23505") ||
          error.message.includes("already exists") ||
          error.message.includes("unique constraint"))
      ) {
        console.log(
          "[Pricing Debug] Unique constraint error, attempting to find existing rule for date:",
          {
            fieldConfigId,
            locationId: targetLocationId,
            locationHierarchyId: targetLocationHierarchyId,
            pricingContext: targetPricingContext,
            effectiveDate: targetEffectiveDate,
          },
        );

        // Refetch to see if a rule exists now
        await fetchFieldPricing();
        const updatedExistingRule = fieldPricing.find((rule) => {
          const ruleContext = rule.source_rule?.pricing_context || "customer";
          const ruleEffectiveDate = rule.source_rule?.effective_at
            ? new Date(rule.source_rule.effective_at).toISOString().split(
              "T",
            )[0]
            : null;

          return (
            rule.field_config_id === fieldConfigId &&
            (rule.location_hierarchy_id || null) ===
              targetLocationHierarchyId &&
            (rule.location_id || null) === targetLocationId &&
            ruleContext === targetPricingContext &&
            ruleEffectiveDate === targetEffectiveDate
          );
        });

        if (updatedExistingRule) {
          // Found it for this date, update with the ID
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
