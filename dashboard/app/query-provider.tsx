"use client";

import {
  QueryClient,
  QueryClientProvider,
  QueryKey,
} from "@tanstack/react-query";
import { ReactNode, useState } from "react";

// Lazy-init QueryClient so it isn't recreated on every render
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Avoid aggressive refetching; callers can opt-in via refetch
            staleTime: 2 * 60 * 1000,
            retry: 1,
            // Don't refetch on mount if data exists in cache
            // This prevents showing loading states when navigating back
            refetchOnMount: false,
            // Don't refetch when window regains focus
            refetchOnWindowFocus: false,
            // Don't refetch on reconnect
            refetchOnReconnect: false,
          },
          mutations: {
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export const workersLocationsKey = (orgId: string | null): QueryKey => [
  "workers-locations",
  orgId,
];

export const organizationUsersKey = (orgId: string | null): QueryKey => [
  "organization-users",
  orgId,
];

export const jobsKey = (
  orgId: string | null,
  includeTests?: boolean,
): QueryKey => ["jobs", orgId, includeTests ?? false];

export const locationHierarchyKey = (orgId: string | null): QueryKey => [
  "location-hierarchy",
  orgId,
];

export const invoicesKey = (
  orgId: string | null,
  startDate?: string,
  endDate?: string,
  includeTests?: boolean,
): QueryKey => ["invoices", orgId, startDate, endDate, includeTests ?? false];

export const invoiceDetailsKey = (invoiceId: string | null): QueryKey => [
  "invoice-details",
  invoiceId,
];

export const organizationSettingsKey = (orgId: string | null): QueryKey => [
  "organization-settings",
  orgId,
];

export const mobileConfigKey = (orgId: string | null): QueryKey => [
  "mobile-config",
  orgId,
];

export const workerPaymentHistoryKey = (orgId: string | null): QueryKey => [
  "worker-payment-history",
  orgId,
];

export const notificationsKey = (
  orgId: string | null,
  receiverId: string | null
): QueryKey => ["notifications", orgId, receiverId];

// Pricing query keys
export const fieldPricingKey = (
  orgId: string | null,
  options?: {
    effectiveAt?: string | null;
    locationHierarchyId?: string | null;
    locationId?: string | null;
    pricingContext?: "customer" | "worker";
  },
): QueryKey => [
  "field-pricing",
  orgId,
  options?.effectiveAt ?? null,
  options?.locationHierarchyId ?? null,
  options?.locationId ?? null,
  options?.pricingContext ?? "customer",
];

export const optionPricingKey = (
  orgId: string | null,
  fieldConfigId?: string | null,
  options?: {
    effectiveAt?: string | null;
    locationHierarchyId?: string | null;
    locationId?: string | null;
    pricingContext?: "customer" | "worker";
  },
): QueryKey => [
  "option-pricing",
  orgId,
  fieldConfigId ?? null,
  options?.effectiveAt ?? null,
  options?.locationHierarchyId ?? null,
  options?.locationId ?? null,
  options?.pricingContext ?? "customer",
];

export const basePricingKey = (
  orgId: string | null,
  options?: {
    effectiveAt?: string | null;
    locationHierarchyId?: string | null;
    locationId?: string | null;
    pricingContext?: "customer" | "worker";
  },
): QueryKey => [
  "base-pricing",
  orgId,
  options?.effectiveAt ?? null,
  options?.locationHierarchyId ?? null,
  options?.locationId ?? null,
  options?.pricingContext ?? "customer",
];

export const pricingHistoryKey = (
  orgId: string | null,
  options?: {
    dateFrom?: string;
    dateTo?: string;
    pricingContext?: "customer" | "worker";
    refreshToken?: string | number;
  },
): QueryKey => [
  "pricing-history",
  orgId,
  options?.dateFrom ?? null,
  options?.dateTo ?? null,
  options?.pricingContext ?? null,
  options?.refreshToken ?? null,
];
