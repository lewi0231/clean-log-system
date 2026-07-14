import {
  buildScopedPricingMap,
  type PricingScopeSource,
  type ScopedPricingEntry,
} from "@/lib/pricing-scope";

export type ScopeChipVariant = "all-yards-default" | "yard-override" | "inherited" | "mixed";

export interface PricingScopeParams {
  locationId?: string | null;
  locationHierarchyId?: string | null;
}

export interface LocatablePricingRecord {
  location_id?: string | null;
  location_hierarchy_id?: string | null;
  customer_price?: number | null;
  worker_payment_rate?: number | null;
}

export interface DisplayScopeResult {
  chip: ScopeChipVariant;
  inheritedLabel: string | null;
  effectiveCustomerPrice: number | null;
  effectiveWorkerPrice: number | null;
  overrideCount: number;
  hasEffectivePrice: boolean;
  effectiveSource: PricingScopeSource | null;
}

export function buildOrgDefaultPricingMap<T extends LocatablePricingRecord, K extends string>(
  records: T[],
  getKey: (record: T) => K | null | undefined
): Partial<Record<K, ScopedPricingEntry<T>>> {
  return buildScopedPricingMap(records, { locationId: null, locationHierarchyId: null }, getKey);
}

export function buildPreviewPricingMap<T extends LocatablePricingRecord, K extends string>(
  records: T[],
  previewParams: PricingScopeParams,
  getKey: (record: T) => K | null | undefined
): Partial<Record<K, ScopedPricingEntry<T>>> {
  return buildScopedPricingMap(records, previewParams, getKey);
}

export function countLocationOverrides<T extends LocatablePricingRecord>(records: T[]): number {
  const locationIds = new Set<string>();
  records.forEach((record) => {
    if (record.location_id) {
      locationIds.add(record.location_id);
    }
  });
  return locationIds.size;
}

export function hasEffectiveOptionPrice(
  customerEntry: ScopedPricingEntry<LocatablePricingRecord> | undefined,
  workerEntry: ScopedPricingEntry<LocatablePricingRecord> | undefined,
  showBothContexts: boolean
): boolean {
  const hasCustomer =
    customerEntry?.record.customer_price != null && customerEntry.record.customer_price >= 0;
  const hasWorker =
    workerEntry?.record.worker_payment_rate != null && workerEntry.record.worker_payment_rate >= 0;

  if (showBothContexts) {
    return hasCustomer || hasWorker;
  }
  return hasCustomer;
}

export function resolveDisplayScope(
  orgCustomerEntry: ScopedPricingEntry<LocatablePricingRecord> | undefined,
  orgWorkerEntry: ScopedPricingEntry<LocatablePricingRecord> | undefined,
  previewCustomerEntry: ScopedPricingEntry<LocatablePricingRecord> | undefined,
  previewWorkerEntry: ScopedPricingEntry<LocatablePricingRecord> | undefined,
  overrideCount: number,
  previewActive: boolean,
  formatCurrency: (amount: number) => string
): DisplayScopeResult {
  const orgCustomerPrice = orgCustomerEntry?.record.customer_price ?? null;
  const orgWorkerPrice = orgWorkerEntry?.record.worker_payment_rate ?? null;

  if (!previewActive) {
    const hasOrg = orgCustomerPrice != null || orgWorkerPrice != null || overrideCount > 0;
    return {
      chip: overrideCount > 0 ? "mixed" : "all-yards-default",
      inheritedLabel: null,
      effectiveCustomerPrice: orgCustomerPrice,
      effectiveWorkerPrice: orgWorkerPrice,
      overrideCount,
      hasEffectivePrice: hasOrg,
      effectiveSource: orgCustomerEntry?.source ?? orgWorkerEntry?.source ?? null,
    };
  }

  const previewCustomerSource = previewCustomerEntry?.source;
  const previewWorkerSource = previewWorkerEntry?.source;
  const effectiveCustomerPrice = previewCustomerEntry?.record.customer_price ?? orgCustomerPrice;
  const effectiveWorkerPrice = previewWorkerEntry?.record.worker_payment_rate ?? orgWorkerPrice;

  const customerInherited =
    previewCustomerSource === "organization" || previewCustomerSource === "hierarchy";
  const customerOverride = previewCustomerSource === "location";

  let chip: ScopeChipVariant = "inherited";
  if (customerOverride) {
    chip = "yard-override";
  } else if (overrideCount > 0 && !previewActive) {
    chip = "mixed";
  } else if (!previewActive && overrideCount === 0) {
    chip = "all-yards-default";
  }

  let inheritedLabel: string | null = null;
  if (customerInherited && orgCustomerPrice != null) {
    inheritedLabel = `Inherited from All yards: ${formatCurrency(orgCustomerPrice)}`;
  }

  const hasEffectivePrice = hasEffectiveOptionPrice(
    previewCustomerEntry ?? orgCustomerEntry,
    previewWorkerEntry ?? orgWorkerEntry,
    true
  );

  if (previewCustomerSource !== previewWorkerSource && previewWorkerSource != null) {
    chip = "mixed";
  }

  return {
    chip,
    inheritedLabel,
    effectiveCustomerPrice,
    effectiveWorkerPrice,
    overrideCount,
    hasEffectivePrice,
    effectiveSource: previewCustomerEntry?.source ?? previewWorkerEntry?.source ?? null,
  };
}
