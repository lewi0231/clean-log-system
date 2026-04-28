"use client";

import type { FieldConfig } from "@clean-log/shared/types";
import FieldPricingList from "@/components/pricing/field-pricing-list";

interface NumberPricingListProps {
  fieldConfigs: FieldConfig[];
  configsLoading: boolean;
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
  refreshToken?: number;
  organizationId: string | null;
  onNavigateToHistory?: () => void;
}

export default function NumberPricingList(props: NumberPricingListProps) {
  return <FieldPricingList {...props} fieldTypeFilter="number" />;
}
