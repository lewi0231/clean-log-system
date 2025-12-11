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
            staleTime: 30 * 1000,
            retry: 1,
          },
          mutations: {
            retry: 1,
          },
        },
      })
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

export const jobsKey = (orgId: string | null): QueryKey => ["jobs", orgId];

export const locationHierarchyKey = (orgId: string | null): QueryKey => [
  "location-hierarchy",
  orgId,
];

export const invoicesKey = (
  orgId: string | null,
  startDate?: string,
  endDate?: string
): QueryKey => ["invoices", orgId, startDate, endDate];

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
