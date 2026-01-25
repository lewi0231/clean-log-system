"use client";

import FieldPricingList from "@/components/pricing/field-pricing-list";

interface NumberPricingListProps {
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
  refreshToken?: number;
}

export default function NumberPricingList(props: NumberPricingListProps) {
  return <FieldPricingList {...props} fieldTypeFilter="number" />;
}
