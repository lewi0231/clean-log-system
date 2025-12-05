"use client";

import type {
    CalculateWorkerPaymentsRequest,
    CalculateWorkerPaymentsResponse,
} from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { useState } from "react";
import useOrganization from "./useOrganization";

interface UseWorkerPaymentsResult {
    calculatePayments: (
        jobIds: string[],
    ) => Promise<CalculateWorkerPaymentsResponse | null>;
    loading: boolean;
    error: string | null;
}

export function useWorkerPayments(): UseWorkerPaymentsResult {
    const { organizationId } = useOrganization();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const calculatePayments = async (
        jobIds: string[],
    ): Promise<CalculateWorkerPaymentsResponse | null> => {
        if (!organizationId) {
            setError("Organization ID is required");
            return null;
        }

        if (!jobIds || jobIds.length === 0) {
            setError("At least one job ID is required");
            return null;
        }

        try {
            setLoading(true);
            setError(null);

            const request: CalculateWorkerPaymentsRequest = {
                organization_id: organizationId,
                job_ids: jobIds,
            };

            const response = await WorkerPaymentService.calculatePayments(
                request,
            );
            return response;
        } catch (err) {
            const errorMessage = err instanceof Error
                ? err.message
                : "Failed to calculate worker payments";
            setError(errorMessage);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        calculatePayments,
        loading,
        error,
    };
}
