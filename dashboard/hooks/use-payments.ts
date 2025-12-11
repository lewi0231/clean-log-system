"use client";

import { PaymentService } from "@/lib/services/payment.service";
import type { Payment } from "@/lib/types/payment";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import useOrganization from "./useOrganization";

interface UsePaymentsResult {
    payments: Payment[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

/**
 * Hook to fetch payments for an invoice or organization
 */
export function usePayments(
    invoiceId?: string | null,
): UsePaymentsResult {
    const { organizationId } = useOrganization();

    const query = useQuery({
        queryKey: ["payments", organizationId, invoiceId],
        enabled: !!organizationId,
        queryFn: () => {
            if (!organizationId) return [];
            return PaymentService.list({
                organization_id: organizationId,
                invoice_id: invoiceId || undefined,
            });
        },
        select: (data) => data ?? [],
        placeholderData: (previous) => previous,
    });

    return {
        payments: query.data ?? [],
        loading: query.isLoading,
        error: query.error ? (query.error as Error).message : null,
        refetch: useCallback(
            () => query.refetch().then(() => undefined),
            [query],
        ),
    };
}
