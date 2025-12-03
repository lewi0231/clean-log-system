"use client";

import { FeedbackService } from "@/lib/services";
import type { Feedback } from "@/lib/types";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseFeedbackResult {
    feedback: Feedback[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useFeedback(): UseFeedbackResult {
    const { organizationId } = useOrganization();
    const [feedback, setFeedback] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFeedback = async () => {
        if (!organizationId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await FeedbackService.list({
                organization_id: organizationId,
            });

            setFeedback(response.feedback || []);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to fetch feedback",
            );
            setFeedback([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeedback();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationId]);

    return {
        feedback,
        loading,
        error,
        refetch: fetchFeedback,
    };
}
