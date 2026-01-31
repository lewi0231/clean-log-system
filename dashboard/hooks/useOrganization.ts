"use client";

import { log } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
interface OrganizationData {
  organizationId: string;
  organizationUserId: string | null;
  userRole: string | null;
}

async function fetchOrganization(
  email: string,
  userId: string,
): Promise<OrganizationData | null> {
  log.debug("useOrganization: Fetching organization for user", {
    email,
    userId,
  });

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

  log.debug("useOrganization: State check", {
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
    authLoading,
    queryEnabled,
  });

  const query = useQuery({
    queryKey: ["organization", user?.id],
    enabled: queryEnabled,
    queryFn: () => {
      if (!user?.id || !user?.email) {
        throw new Error("User not authenticated!");
      }
      log.debug("useOrganization: Query executing", {
        email: user.email,
        userId: user.id,
      });
      return fetchOrganization(user.email, user.id);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - allow refetch
    retry: 1,
    refetchOnMount: true, // Refetch when component mounts
  });

  log.debug("useOrganization: Query state", {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isEnabled: queryEnabled,
    hasData: !!query.data,
    error: query.error?.message,
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
