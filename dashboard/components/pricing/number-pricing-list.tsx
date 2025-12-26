"use client";

import FieldPricingList from "@/components/pricing/field-pricing-list";

interface NumberPricingListProps {
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
  refreshToken?: number;
  pricingContext?: "customer" | "worker";
  showBothContexts?: boolean;
}

export default function NumberPricingList(props: NumberPricingListProps) {
  return <FieldPricingList {...props} fieldTypeFilter="number" />;
}
