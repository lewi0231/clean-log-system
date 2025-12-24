"use client";

import { supabase } from "@/lib/supabase";
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
            const { data: result, error: fetchError } = await supabase.functions
                .invoke(
                    "get-onboarding-data",
                );

            if (fetchError) {
                throw fetchError;
            }

            if (!result?.success) {
                throw new Error("Failed to fetch onboarding data");
            }

            return {
                completed: result.onboarding_completed_at !== null,
                completedAt: result.onboarding_completed_at,
                data: result.onboarding_data,
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
