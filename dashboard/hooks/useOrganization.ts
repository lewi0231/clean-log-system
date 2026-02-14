"use client";

import { log } from "@/lib/logger";
import {
  EdgeFunctionError,
  invokeEdgeFunction,
} from "@/lib/supabase/invoke-edge-function";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

interface OrganizationData {
  organizationId: string;
  organizationUserId: string | null;
  userRole: string | null;
}

async function fetchOrganization(
  email: string,
  userId: string
): Promise<OrganizationData | null> {
  const data = await invokeEdgeFunction<{
    organization_id?: string;
    organization_user_id?: string;
    role?: string;
  }>("get-organization-id", { email });

  if (data?.organization_id) {
    log.info("useOrganization: Organization found", {
      organizationId: data.organization_id,
      organizationUserId: data.organization_user_id,
      role: data.role,
    });

    return {
      organizationId: data.organization_id,
      organizationUserId: data.organization_user_id || null,
      userRole: data.role || null,
    };
  }

  log.warn("useOrganization: No organization found for user", {
    email,
    userId,
  });

  return null;
}

function useOrganization() {
  const { user, loading: authLoading } = useAuth();

  const queryEnabled = !!user?.id && !authLoading;

  const query = useQuery({
    queryKey: ["organization", user?.id],
    enabled: queryEnabled,
    queryFn: () => {
      if (!user?.id || !user?.email) {
        throw new Error("User not authenticated!");
      }
      return fetchOrganization(user.email, user.id);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - allow refetch
    // Don't retry on network/fetch errors - they'll likely fail again immediately
    retry: (failureCount, error) => {
      if (error instanceof EdgeFunctionError && error.code === "fetch_error") {
        return false;
      }
      return failureCount < 1;
    },
  });

  return {
    organizationId: query.data?.organizationId ?? null,
    organizationUserId: query.data?.organizationUserId,
    userRole: query.data?.userRole,
    loading: query.isLoading || authLoading,
    error: query.error?.message,
  };
}

export default useOrganization;
