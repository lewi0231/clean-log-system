"use client";

import FieldPricingList from "@/components/pricing/field-pricing-list";

interface BooleanPricingListProps {
  locationHierarchyId?: string | null;
  locationId?: string | null;
  effectiveAt?: string | null;
  refreshToken?: number;
  pricingContext?: "customer" | "worker";
  showBothContexts?: boolean;
}

export default function BooleanPricingList(props: BooleanPricingListProps) {
  return <FieldPricingList {...props} fieldTypeFilter="boolean" />;
}
