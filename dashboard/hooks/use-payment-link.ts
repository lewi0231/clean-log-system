"use client";

import { PaymentService } from "@/lib/services/payment.service";
import type { CreatePaymentLinkRequest } from "@/lib/types/payment";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import useOrganization from "./useOrganization";

interface UsePaymentLinkResult {
    paymentLink: { id: string; url: string; status: string } | null;
    loading: boolean;
    error: string | null;
    createPaymentLink: (
        invoiceId: string,
        successUrl?: string,
        cancelUrl?: string,
    ) => Promise<{ id: string; url: string; status: string }>;
    refetch: () => Promise<void>;
}

/**
 * Hook to manage payment link for an invoice
 */
export function usePaymentLink(invoiceId: string | null): UsePaymentLinkResult {
    const { organizationId } = useOrganization();
    const queryClient = useQueryClient();

    // Query to fetch existing payment link
    const query = useQuery({
        queryKey: ["payment-link", invoiceId],
        enabled: !!invoiceId,
        queryFn: () => {
            if (!invoiceId) return null;
            return PaymentService.getPaymentLink(invoiceId);
        },
        placeholderData: (previous) => previous,
    });

    // Mutation to create new payment link
    const createMutation = useMutation({
        mutationFn: async (request: CreatePaymentLinkRequest) => {
            return PaymentService.createPaymentLink(request);
        },
        onSuccess: () => {
            // Invalidate payment link query
            if (invoiceId) {
                queryClient.invalidateQueries({
                    queryKey: ["payment-link", invoiceId],
                });
            }
            // Also invalidate invoice details to refresh payment data
            queryClient.invalidateQueries({
                queryKey: ["invoice-details", invoiceId],
            });
        },
    });

    const createPaymentLink = useCallback(
        async (
            invoiceId: string,
            successUrl?: string,
            cancelUrl?: string,
        ): Promise<{ id: string; url: string; status: string }> => {
            // Explicitly check for undefined, null, or empty string
            if (
                organizationId === undefined || organizationId === null ||
                organizationId === ""
            ) {
                throw new Error("Organization ID is required");
            }

            return createMutation.mutateAsync({
                invoice_id: invoiceId,
                organization_id: organizationId,
                success_url: successUrl,
                cancel_url: cancelUrl,
            });
        },
        [organizationId, createMutation],
    );

    return {
        paymentLink: query.data ?? null,
        loading: query.isLoading || createMutation.isPending,
        error: query.error
            ? (query.error as Error).message
            : createMutation.error
            ? (createMutation.error as Error).message
            : null,
        createPaymentLink,
        refetch: useCallback(
            () => query.refetch().then(() => undefined),
            [query],
        ),
    };
}
