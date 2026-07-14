import type { LocationOverrideRow } from "@/components/pricing/location-overrides-matrix";
import type { FieldPricing } from "@/lib/types";

/**
 * Parse a user-entered price string into a non-negative number.
 * Returns undefined for empty, invalid, or negative values.
 */
export function parsePriceString(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const price = parseFloat(value);
  if (isNaN(price) || price < 0) return undefined;
  return price;
}

export interface OverridePricingRecord {
  id: string;
  field_config_id: string;
  option_value?: string;
  location_id?: string | null;
  location_hierarchy_id?: string | null;
  customer_price: number;
  worker_payment_rate?: number | null;
  worker_payment_value?: number | null;
  location?: { name: string; active?: boolean } | null;
  location_node?: { name: string } | null;
  source_rule?: {
    pricing_context?: "customer" | "worker";
    effective_at?: string;
    expires_at?: string | null;
  } | null;
}

function viewDateToIsoEnd(viewDate: string | null | undefined): string {
  if (!viewDate) {
    return new Date().toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(viewDate)) {
    return `${viewDate}T23:59:59.999Z`;
  }
  return new Date(viewDate).toISOString();
}

function ruleActiveAtViewDate(
  effectiveAt: string | undefined,
  expiresAt: string | null | undefined,
  viewIso: string
): { isActive: boolean | undefined; isFuture: boolean | undefined } {
  if (!effectiveAt) {
    return { isActive: undefined, isFuture: undefined };
  }
  const isFuture = effectiveAt > viewIso;
  const isActive = effectiveAt <= viewIso && (!expiresAt || expiresAt > viewIso);
  return { isActive, isFuture };
}

/**
 * Location-scoped pricing rules for a field or option (yard/hierarchy overrides).
 */
export function getScopedPricingOverrides(
  allPricing: OverridePricingRecord[],
  fieldConfigId: string,
  optionValue: string | null,
  pricingContext: "customer" | "worker",
  viewDate?: string | null
): LocationOverrideRow[] {
  const viewIso = viewDateToIsoEnd(viewDate);

  return allPricing
    .filter(
      (pricing) =>
        pricing.field_config_id === fieldConfigId &&
        (optionValue === null || pricing.option_value === optionValue) &&
        (pricing.location_id || pricing.location_hierarchy_id) &&
        (pricing.source_rule?.pricing_context || "customer") === pricingContext
    )
    .map<LocationOverrideRow>((pricing) => {
      const effectiveAt = pricing.source_rule?.effective_at;
      const expiresAt = pricing.source_rule?.expires_at || null;
      const { isActive, isFuture } = ruleActiveAtViewDate(effectiveAt, expiresAt, viewIso);
      const isWorkerContext = pricingContext === "worker";
      const workerPayment = pricing.worker_payment_value ?? pricing.worker_payment_rate ?? null;

      const scopeLabel =
        pricing.location?.name ||
        pricing.location_node?.name ||
        pricing.location_id ||
        pricing.location_hierarchy_id ||
        "Custom scope";

      const inactiveSuffix = pricing.location?.active === false ? " (inactive)" : "";

      return {
        id: pricing.id,
        scopeLabel: `${scopeLabel}${inactiveSuffix}`,
        scopeType: pricing.location_id ? "location" : "hierarchy",
        price: pricing.customer_price,
        workerPayment: isWorkerContext ? null : workerPayment,
        effectiveAt,
        expiresAt,
        isActive,
        isFuture,
        pricingContext,
      };
    });
}

/** Merge customer + worker override rows by location for display */
export function mergeOverrideRowsByLocation(
  customerRows: LocationOverrideRow[],
  workerRows: LocationOverrideRow[]
): Array<
  LocationOverrideRow & {
    locationKey: string;
    customerRuleId?: string;
    workerRuleId?: string;
  }
> {
  const byLocation = new Map<
    string,
    LocationOverrideRow & {
      locationKey: string;
      customerRuleId?: string;
      workerRuleId?: string;
    }
  >();

  customerRows.forEach((row) => {
    const key = row.scopeLabel;
    byLocation.set(key, {
      ...row,
      locationKey: key,
      customerRuleId: row.id,
      workerRuleId: undefined,
    });
  });

  workerRows.forEach((row) => {
    const key = row.scopeLabel;
    const existing = byLocation.get(key);
    if (existing) {
      byLocation.set(key, {
        ...existing,
        workerPayment: row.price,
        workerRuleId: row.id,
      });
    } else {
      byLocation.set(key, {
        ...row,
        locationKey: key,
        price: 0,
        workerPayment: row.price,
        workerRuleId: row.id,
        customerRuleId: undefined,
      });
    }
  });

  return Array.from(byLocation.values());
}

/**
 * Get location overrides for a number/boolean field (legacy wrapper).
 */
export function getLocationOverrides(
  allPricing: FieldPricing[],
  fieldConfigId: string,
  currentLocationId: string | null = null,
  currentLocationHierarchyId: string | null = null,
  pricingContext: "customer" | "worker" = "customer",
  viewDate?: string | null
): LocationOverrideRow[] {
  const rows = getScopedPricingOverrides(
    allPricing as OverridePricingRecord[],
    fieldConfigId,
    null,
    pricingContext,
    viewDate
  );

  return rows.filter(
    (row) =>
      !(
        (currentLocationId &&
          allPricing.find((p) => p.id === row.id)?.location_id === currentLocationId) ||
        (currentLocationHierarchyId &&
          allPricing.find((p) => p.id === row.id)?.location_hierarchy_id ===
            currentLocationHierarchyId)
      )
  );
}
