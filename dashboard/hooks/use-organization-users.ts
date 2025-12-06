"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { organizationUsersKey } from "@/app/query-provider";
import { OrganizationUsersService } from "@/lib/services";
import type { OrganizationUser } from "@/lib/types";
import type {
  CreateOrganizationUserRequest,
  DeleteOrganizationUserRequest,
  UpdateOrganizationUserRequest,
} from "@/lib/types/api";
import { useCallback } from "react";
import useOrganization from "./useOrganization";

interface UseOrganizationUsersResult {
  organizationUsers: OrganizationUser[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createOrganizationUser: (
    request: CreateOrganizationUserRequest,
  ) => Promise<OrganizationUser>;
  updateOrganizationUser: (
    request: UpdateOrganizationUserRequest,
  ) => Promise<OrganizationUser>;
  deleteOrganizationUser: (
    request: DeleteOrganizationUserRequest,
  ) => Promise<void>;
}

async function fetchOrganizationUsers(
  organizationId: string,
): Promise<OrganizationUser[]> {
  const response = await OrganizationUsersService.list({
    organization_id: organizationId,
  });
  return response.organization_users || [];
}

export function useOrganizationUsers(): UseOrganizationUsersResult {
  const { organizationId } = useOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: organizationUsersKey(organizationId),
    enabled: !!organizationId,
    queryFn: () => fetchOrganizationUsers(organizationId as string),
    select: (data) => data ?? [],
    placeholderData: (previous) => previous,
  });

  const createMutation = useMutation({
    mutationFn: OrganizationUsersService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationUsersKey(organizationId),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: OrganizationUsersService.update,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationUsersKey(organizationId),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: OrganizationUsersService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationUsersKey(organizationId),
      });
    },
  });

  const createOrganizationUser = useCallback(
    async (
      request: CreateOrganizationUserRequest,
    ): Promise<OrganizationUser> => {
      const user = await createMutation.mutateAsync(request);
      await query.refetch();
      return user;
    },
    [createMutation, query],
  );

  const updateOrganizationUser = useCallback(
    async (
      request: UpdateOrganizationUserRequest,
    ): Promise<OrganizationUser> => {
      const user = await updateMutation.mutateAsync(request);
      await query.refetch();
      return user;
    },
    [updateMutation, query],
  );

  const deleteOrganizationUser = useCallback(
    async (request: DeleteOrganizationUserRequest): Promise<void> => {
      await deleteMutation.mutateAsync(request);
      await query.refetch();
    },
    [deleteMutation, query],
  );

  return {
    organizationUsers: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: useCallback(() => query.refetch().then(() => undefined), [query]),
    createOrganizationUser,
    updateOrganizationUser,
    deleteOrganizationUser,
  };
}
