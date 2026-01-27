"use client";

import type {
    CalculateWorkerPaymentsResponse,
    PaymentRecord,
} from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { Job } from "@/lib/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import useOrganization from "./useOrganization";

export function workerPaymentHistoryKey(organizationId: string | null) {
    return ["worker-payment-history", organizationId] as const;
}

export type WorkerPaymentStatus = PaymentRecord["status"];

interface UseWorkerPaymentHistoryResult {
    paymentHistory: PaymentRecord[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
    invalidate: () => void;
    addPayment: (
        calculation: CalculateWorkerPaymentsResponse,
        jobIds: string[],
        batchId?: string,
    ) => void;
    filterByDateRange: (
        startDate?: string,
        endDate?: string,
    ) => PaymentRecord[];
    filterByWorker: (workerId: string) => PaymentRecord[];
}

/**
 * Hook for managing worker payment history
 *
 * Data is fetched from the database via the list-worker-payments edge function.
 * The hook provides methods for filtering and accessing payment records.
 */
export function useWorkerPaymentHistory(jobs: Job[]): UseWorkerPaymentHistoryResult {
    const { organizationId } = useOrganization();
    const queryClient = useQueryClient();

    // Fetch payment history from database
    const query = useQuery({
        queryKey: workerPaymentHistoryKey(organizationId),
        enabled: !!organizationId,
        queryFn: async () => {
            if (!organizationId) return [];
            const result = await WorkerPaymentService.listPayments(
                organizationId,
            );
            return result.payments;
        },
        staleTime: 30000, // 30 seconds
        refetchOnWindowFocus: true,
    });

    // Memoize payment history to prevent unnecessary re-renders in dependent callbacks
    const paymentHistory = useMemo(() => query.data ?? [], [query.data]);

    // Invalidate cache to trigger refetch
    const invalidate = useCallback(() => {
        if (organizationId) {
            queryClient.invalidateQueries({
                queryKey: workerPaymentHistoryKey(organizationId),
            });
        }
    }, [organizationId, queryClient]);

    // Add payment optimistically updates cache after save
    const addPayment = useCallback(
        (
            calculation: CalculateWorkerPaymentsResponse,
            jobIds: string[],
            batchId?: string,
        ) => {
            if (!organizationId) return;

            const selectedJobs = jobs.filter((job) => jobIds.includes(job.id));
            const uniqueWorkers = new Set<string>();
            selectedJobs.forEach((job) => {
                job.workers.forEach((worker) => {
                    uniqueWorkers.add(worker.id);
                });
            });

            const dates = selectedJobs.map((job) =>
                new Date(job.completed_at).getTime()
            );
            const minDate = dates.length > 0
                ? new Date(Math.min(...dates))
                : new Date();
            const maxDate = dates.length > 0
                ? new Date(Math.max(...dates))
                : new Date();

            const newRecord: PaymentRecord = {
                id: batchId || `payment-${Date.now()}`,
                batch_id: batchId,
                dateRange: {
                    start: minDate.toISOString(),
                    end: maxDate.toISOString(),
                },
                jobIds,
                totalPayment: calculation.calculation.total_worker_payment,
                workerCount: uniqueWorkers.size,
                calculation,
                calculatedAt: new Date().toISOString(),
                status: "calculated",
            };

            // Optimistic update - add to cache immediately
            queryClient.setQueryData(
                workerPaymentHistoryKey(organizationId),
                (oldData: PaymentRecord[] | undefined) => {
                    return [newRecord, ...(oldData ?? [])];
                },
            );

            // Refetch to ensure sync with database
            // Small delay to allow database write to complete
            setTimeout(() => invalidate(), 500);
        },
        [organizationId, jobs, queryClient, invalidate],
    );

    const filterByDateRange = useCallback(
        (startDate?: string, endDate?: string) => {
            return WorkerPaymentService.filterByDateRange(
                paymentHistory,
                startDate,
                endDate,
            );
        },
        [paymentHistory],
    );

    const filterByWorker = useCallback(
        (workerId: string) => {
            return WorkerPaymentService.filterByWorker(
                paymentHistory,
                workerId,
                jobs,
            );
        },
        [paymentHistory, jobs],
    );

    return {
        paymentHistory,
        loading: query.isLoading,
        error: query.error ? (query.error as Error).message : null,
        refetch: query.refetch,
        invalidate,
        addPayment,
        filterByDateRange,
        filterByWorker,
    };
}
