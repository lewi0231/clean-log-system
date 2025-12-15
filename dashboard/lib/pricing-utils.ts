import type { LocationOverrideRow } from "@/components/pricing/location-overrides-matrix";
import type { FieldPricing } from "@/lib/types";

/**
 * Get location overrides for a specific field configuration.
 * Filters pricing rules that have location or location hierarchy scope,
 * excluding the current scope to avoid showing it as an override.
 */
export function getLocationOverrides(
    allPricing: FieldPricing[],
    fieldConfigId: string,
    currentLocationId: string | null = null,
    currentLocationHierarchyId: string | null = null,
    pricingContext: "customer" | "worker" = "customer",
): LocationOverrideRow[] {
    const now = new Date().toISOString();

    return allPricing
        .filter(
            (pricing) =>
                pricing.field_config_id === fieldConfigId &&
                (pricing.location_id || pricing.location_hierarchy_id) &&
                // Filter by pricing context - CRITICAL: ensure worker rules don't appear in customer overrides
                // Default to "customer" for backward compatibility if pricing_context is missing
                (pricing.source_rule?.pricing_context || "customer") ===
                    pricingContext &&
                // Exclude current scope to avoid showing it as an override
                !(
                    (currentLocationId &&
                        pricing.location_id === currentLocationId) ||
                    (currentLocationHierarchyId &&
                        pricing.location_hierarchy_id ===
                            currentLocationHierarchyId) ||
                    (!currentLocationId &&
                        !currentLocationHierarchyId &&
                        !pricing.location_id &&
                        !pricing.location_hierarchy_id)
                ),
        )
        .map<LocationOverrideRow>((pricing) => {
            const effectiveAt = pricing.source_rule?.effective_at;
            const expiresAt = pricing.source_rule?.expires_at || null;
            const isActive = effectiveAt
                ? effectiveAt <= now && (!expiresAt || expiresAt > now)
                : undefined;
            const isFuture = effectiveAt ? effectiveAt > now : undefined;

            // For customer context: show customer_price and worker_payment_value
            // For worker context: show customer_price (which is actually the worker payment)
            const isWorkerContext = pricingContext === "worker";

            return {
                id: pricing.id,
                scopeLabel: pricing.location?.name ||
                    pricing.location_node?.name ||
                    pricing.location_id ||
                    pricing.location_hierarchy_id ||
                    "Custom scope",
                scopeType: pricing.location ? "location" : "hierarchy",
                // For customer context: show customer price
                // For worker context: show worker price (stored in customer_price field for worker rules)
                price: isWorkerContext
                    ? pricing.customer_price // For worker rules, customer_price is actually the worker payment
                    : pricing.customer_price,
                // Worker payment only applies to customer context rules
                // For worker context rules, the price IS the worker payment
                workerPayment: isWorkerContext
                    ? null // Worker context rules don't have separate worker payment
                    : pricing.worker_payment_value,
                effectiveAt,
                expiresAt,
                isActive,
                isFuture,
                // Track the pricing context to help with debugging and display
                pricingContext: pricing.source_rule?.pricing_context ||
                    "customer",
            };
        });
}
