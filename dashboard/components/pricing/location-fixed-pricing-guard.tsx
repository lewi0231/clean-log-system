"use client";

import { useLocations } from "@/hooks/use-locations";
import type { Location } from "@/lib/types";
import { useMemo } from "react";

interface UseLocationFixedPricingGuardResult {
  isFixedPricing: boolean;
  location: Location | null;
  loading: boolean;
  error: string | null;
}

export function useLocationFixedPricingGuard(
  locationId: string | null
): UseLocationFixedPricingGuardResult {
  const { locations, loading, error } = useLocations();

  const location = useMemo(() => {
    if (!locationId) return null;
    return locations.find((loc) => loc.id === locationId) || null;
  }, [locations, locationId]);

  const isFixedPricing = location?.pricing_mode === "fixed_price";

  return {
    isFixedPricing,
    location,
    loading,
    error,
  };
}
