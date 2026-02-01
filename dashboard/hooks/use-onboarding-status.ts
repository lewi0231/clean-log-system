"use client";

import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
import { useQuery } from "@tanstack/react-query";
import useOrganization from "./useOrganization";

interface OnboardingStatus {
    completed: boolean;
    completedAt: string | null;
    data: Record<string, unknown> | null;
}

export function useOnboardingStatus() {
    const { organizationId, loading: orgLoading } = useOrganization();

    const { data, isLoading, error } = useQuery<OnboardingStatus>({
        queryKey: ["onboarding-status", organizationId],
        queryFn: async () => {
            if (!organizationId) {
                return { completed: false, completedAt: null, data: null };
            }

            // Use edge function to get onboarding data (bypasses RLS)
            const result = await invokeEdgeFunction<{
                success?: boolean;
                onboarding_completed_at?: string | null;
                onboarding_data?: Record<string, unknown> | null;
            }>("get-onboarding-data");

            if (!result?.success) {
                throw new Error("Failed to fetch onboarding data");
            }

            return {
                completed: result.onboarding_completed_at != null,
                completedAt: result.onboarding_completed_at ?? null,
                data: result.onboarding_data ?? null,
            };
        },
        enabled: !!organizationId && !orgLoading,
    });

    return {
        onboardingStatus: data,
        loading: isLoading || orgLoading,
        error,
    };
}
