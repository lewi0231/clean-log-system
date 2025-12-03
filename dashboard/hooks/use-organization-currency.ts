"use client";

import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import type { SupportedCurrency } from "@/lib/types";
import { useCallback, useMemo } from "react";

interface UseOrganizationCurrencyResult {
  currency: SupportedCurrency;
  locale: string;
  formatCurrency: (value: number) => string;
  loading: boolean;
}

export function useOrganizationCurrency(): UseOrganizationCurrencyResult {
  const { settings, loading } = useOrganizationSettings();

  const currency = settings?.currency ?? "AUD";
  const locale = settings?.locale ?? "en-AU";

  const formatCurrency = useCallback(
    (value: number): string => {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
        maximumFractionDigits: 2,
      }).format(isNaN(value) ? 0 : value);
    },
    [currency, locale]
  );

  return useMemo(
    () => ({
      currency,
      locale,
      formatCurrency,
      loading,
    }),
    [currency, locale, formatCurrency, loading]
  );
}
