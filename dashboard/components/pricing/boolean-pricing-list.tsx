"use client";

import type { FieldConfig } from "@clean-log/shared/types";
import FieldPricingList from "@/components/pricing/field-pricing-list";

interface BooleanPricingListProps {
  fieldConfigs: FieldConfig[];
  configsLoading: boolean;
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
  refreshToken?: number;
  organizationId: string | null;
}

export default function BooleanPricingList(props: BooleanPricingListProps) {
  return <FieldPricingList {...props} fieldTypeFilter="boolean" />;
}
