"use client";

import type {
    CalculateWorkerPaymentsResponse,
    PaymentRecord,
} from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import { useJobs } from "./use-jobs";
import useOrganization from "./useOrganization";

export function workerPaymentHistoryKey(organizationId: string | null) {
    return ["worker-payment-history", organizationId] as const;
}

interface UseWorkerPaymentHistoryResult {
    paymentHistory: PaymentRecord[];
    loading: boolean;
    error: string | null;
    addPayment: (
        calculation: CalculateWorkerPaymentsResponse,
        jobIds: string[],
    ) => void;
    clearHistory: () => void;
    filterByDateRange: (
        startDate?: string,
        endDate?: string,
    ) => PaymentRecord[];
    filterByWorker: (workerId: string) => PaymentRecord[];
}

// Store payment history in localStorage for persistence
const STORAGE_KEY = "worker-payment-history";

function loadPaymentHistory(
    organizationId: string | null,
): PaymentRecord[] {
    if (!organizationId) return [];
    try {
        const stored = localStorage.getItem(
            `${STORAGE_KEY}-${organizationId}`,
        );
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error(
            "Failed to load payment history from localStorage",
            error,
        );
    }
    return [];
}

function savePaymentHistory(
    organizationId: string | null,
    history: PaymentRecord[],
): void {
    if (!organizationId) return;
    try {
        localStorage.setItem(
            `${STORAGE_KEY}-${organizationId}`,
            JSON.stringify(history),
        );
    } catch (error) {
        console.error("Failed to save payment history to localStorage", error);
    }
}

export function useWorkerPaymentHistory(): UseWorkerPaymentHistoryResult {
    const { organizationId } = useOrganization();
    const { jobs } = useJobs();
    const queryClient = useQueryClient();

    const [localHistory, setLocalHistory] = useState<PaymentRecord[]>(() =>
        loadPaymentHistory(organizationId)
    );

    // Sync with localStorage when organizationId changes
    const query = useQuery({
        queryKey: workerPaymentHistoryKey(organizationId),
        enabled: !!organizationId,
        queryFn: () => loadPaymentHistory(organizationId),
        initialData: localHistory,
    });

    // Update local state when query data changes
    React.useEffect(() => {
        if (query.data) {
            setLocalHistory(query.data);
        }
    }, [query.data]);

    const addPayment = useCallback(
        (
            calculation: CalculateWorkerPaymentsResponse,
            jobIds: string[],
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
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));

            const newRecord: PaymentRecord = {
                id: `payment-${Date.now()}`,
                dateRange: {
                    start: minDate.toISOString(),
                    end: maxDate.toISOString(),
                },
                jobIds,
                totalPayment: calculation.calculation.total_worker_payment,
                workerCount: uniqueWorkers.size,
                calculation,
                calculatedAt: new Date().toISOString(),
            };

            const updatedHistory = [newRecord, ...localHistory];
            setLocalHistory(updatedHistory);
            savePaymentHistory(organizationId, updatedHistory);

            queryClient.setQueryData(
                workerPaymentHistoryKey(organizationId),
                updatedHistory,
            );
        },
        [organizationId, jobs, localHistory, queryClient],
    );

    const clearHistory = useCallback(() => {
        if (!organizationId) return;
        setLocalHistory([]);
        savePaymentHistory(organizationId, []);
        queryClient.setQueryData(workerPaymentHistoryKey(organizationId), []);
    }, [organizationId, queryClient]);

    const filterByDateRange = useCallback(
        (startDate?: string, endDate?: string) => {
            return WorkerPaymentService.filterByDateRange(
                localHistory,
                startDate,
                endDate,
            );
        },
        [localHistory],
    );

    const filterByWorker = useCallback(
        (workerId: string) => {
            return WorkerPaymentService.filterByWorker(
                localHistory,
                workerId,
                jobs,
            );
        },
        [localHistory, jobs],
    );

    return {
        paymentHistory: localHistory,
        loading: query.isLoading,
        error: query.error ? (query.error as Error).message : null,
        addPayment,
        clearHistory,
        filterByDateRange,
        filterByWorker,
    };
}
