"use client";

import type { WorkerSummary } from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { useMemo } from "react";
import { useJobs } from "./use-jobs";
import { useWorkerPaymentHistory } from "./use-worker-payment-history";

interface UseWorkerPaymentSummaryResult {
    workerSummary: WorkerSummary[];
    loading: boolean;
    totalPayments: number;
    totalJobs: number;
    averagePaymentPerWorker: number;
    filterByWorker: (workerId: string) => WorkerSummary | undefined;
    sortBy: (
        field: "name" | "totalPayment" | "jobCount" | "averagePayment",
        order?: "asc" | "desc",
    ) => WorkerSummary[];
}

export function useWorkerPaymentSummary(): UseWorkerPaymentSummaryResult {
    const { paymentHistory, loading } = useWorkerPaymentHistory();
    const { jobs } = useJobs();

    const workerSummary = useMemo(() => {
        if (paymentHistory.length === 0) return [];
        return WorkerPaymentService.aggregateByWorker(paymentHistory, jobs);
    }, [paymentHistory, jobs]);

    const totalPayments = useMemo(() => {
        return workerSummary.reduce(
            (sum, worker) => sum + worker.totalPayment,
            0,
        );
    }, [workerSummary]);

    const totalJobs = useMemo(() => {
        return workerSummary.reduce((sum, worker) => sum + worker.jobCount, 0);
    }, [workerSummary]);

    const averagePaymentPerWorker = useMemo(() => {
        if (workerSummary.length === 0) return 0;
        return totalPayments / workerSummary.length;
    }, [workerSummary.length, totalPayments]);

    const filterByWorker = useMemo(() => {
        return (workerId: string) => {
            return workerSummary.find((w) => w.workerId === workerId);
        };
    }, [workerSummary]);

    const sortBy = useMemo(() => {
        return (
            field: "name" | "totalPayment" | "jobCount" | "averagePayment",
            order: "asc" | "desc" = "desc",
        ) => {
            const sorted = [...workerSummary].sort((a, b) => {
                let comparison = 0;
                switch (field) {
                    case "name":
                        comparison = a.workerName.localeCompare(b.workerName);
                        break;
                    case "totalPayment":
                        comparison = a.totalPayment - b.totalPayment;
                        break;
                    case "jobCount":
                        comparison = a.jobCount - b.jobCount;
                        break;
                    case "averagePayment":
                        comparison = a.averagePayment - b.averagePayment;
                        break;
                }
                return order === "asc" ? comparison : -comparison;
            });
            return sorted;
        };
    }, [workerSummary]);

    return {
        workerSummary,
        loading,
        totalPayments,
        totalJobs,
        averagePaymentPerWorker,
        filterByWorker,
        sortBy,
    };
}
