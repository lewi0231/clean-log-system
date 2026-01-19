"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { PaymentService } from "@/lib/services/payment.service";
import type { Payment } from "@/lib/types/payment";
import useOrganization from "./useOrganization";

interface UsePaymentsResult {
  payments: Payment[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  totalPaid: number;
  remainingBalance: number;
}

/**
 * Generate a unique query key for payments
 */
export function paymentsKey(
  organizationId: string | null,
  invoiceId: string
): (string | null)[] {
  return ["payments", organizationId, invoiceId];
}

/**
 * Fetch payments for a specific invoice using PaymentService
 */
async function fetchPayments(
  organizationId: string,
  invoiceId: string
): Promise<Payment[]> {
  return PaymentService.list({
    organization_id: organizationId,
    invoice_id: invoiceId,
  });
}

/**
 * Hook to fetch and manage payments for a specific invoice
 *
 * @param invoiceId - The invoice ID to fetch payments for
 * @param invoiceTotal - The total amount of the invoice (for calculating remaining balance)
 */
export function usePayments(
  invoiceId: string,
  invoiceTotal: number = 0
): UsePaymentsResult {
  const { organizationId } = useOrganization();

  const query = useQuery({
    queryKey: paymentsKey(organizationId, invoiceId),
    enabled: !!organizationId && !!invoiceId,
    queryFn: () => fetchPayments(organizationId as string, invoiceId),
    select: (data) => data ?? [],
    placeholderData: (previous) => previous,
  });

  // Calculate total paid from succeeded payments only
  const totalPaid =
    query.data
      ?.filter((p) => p.status === "succeeded")
      .reduce((sum, p) => sum + (p.amount || 0), 0) ?? 0;

  // Calculate remaining balance
  const remainingBalance = Math.max(0, invoiceTotal - totalPaid);

  return {
    payments: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: useCallback(() => query.refetch().then(() => undefined), [query]),
    totalPaid,
    remainingBalance,
  };
}

/**
 * Helper hook to invalidate payments cache
 */
export function useInvalidatePayments() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useCallback(
    (invoiceId: string) => {
      queryClient.invalidateQueries({
        queryKey: paymentsKey(organizationId, invoiceId),
      });
    },
    [queryClient, organizationId]
  );
}
