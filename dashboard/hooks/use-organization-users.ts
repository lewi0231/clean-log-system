"use client";

import { OrganizationUsersService } from "@/lib/services";
import type { OrganizationUser } from "@/lib/types";
import type {
  CreateOrganizationUserRequest,
  DeleteOrganizationUserRequest,
  UpdateOrganizationUserRequest,
} from "@/lib/types/api";
import { useEffect, useState } from "react";
import useOrganization from "./useOrganization";

interface UseOrganizationUsersResult {
  organizationUsers: OrganizationUser[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createOrganizationUser: (
    request: CreateOrganizationUserRequest
  ) => Promise<OrganizationUser>;
  updateOrganizationUser: (
    request: UpdateOrganizationUserRequest
  ) => Promise<OrganizationUser>;
  deleteOrganizationUser: (
    request: DeleteOrganizationUserRequest
  ) => Promise<void>;
}

export function useOrganizationUsers(): UseOrganizationUsersResult {
  const { organizationId } = useOrganization();
  const [organizationUsers, setOrganizationUsers] = useState<
    OrganizationUser[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizationUsers = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await OrganizationUsersService.list({
        organization_id: organizationId,
      });

      setOrganizationUsers(response.organization_users || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch organization users"
      );
      setOrganizationUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const createOrganizationUser = async (
    request: CreateOrganizationUserRequest
  ): Promise<OrganizationUser> => {
    const user = await OrganizationUsersService.create(request);
    await fetchOrganizationUsers();
    return user;
  };

  const updateOrganizationUser = async (
    request: UpdateOrganizationUserRequest
  ): Promise<OrganizationUser> => {
    const user = await OrganizationUsersService.update(request);
    await fetchOrganizationUsers();
    return user;
  };

  const deleteOrganizationUser = async (
    request: DeleteOrganizationUserRequest
  ): Promise<void> => {
    await OrganizationUsersService.delete(request);
    await fetchOrganizationUsers();
  };

  useEffect(() => {
    fetchOrganizationUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return {
    organizationUsers,
    loading,
    error,
    refetch: fetchOrganizationUsers,
    createOrganizationUser,
    updateOrganizationUser,
    deleteOrganizationUser,
  };
}
