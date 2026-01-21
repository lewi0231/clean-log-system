import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { OrganizationUser } from "@/lib/types";
import type {
  CreateOrganizationUserRequest,
  DeleteOrganizationUserRequest,
  ListOrganizationUsersRequest,
  ListOrganizationUsersResponse,
  ResendAdminInvitationRequest,
  UpdateOrganizationUserRequest,
} from "@/lib/types/api";

export class OrganizationUsersService {
  /**
   * List organization users for an organization
   */
  static async list(
    request: ListOrganizationUsersRequest
  ): Promise<ListOrganizationUsersResponse> {
    try {
      log.debug("OrganizationUsersService: Fetching organization users", {
        organizationId: request.organization_id,
      });

      const { data, error } = await supabase.functions.invoke(
        "list-organization-users",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error("Failed to fetch organization users");
      }

      log.info(
        "OrganizationUsersService: Organization users fetched successfully"
      );
      return data as ListOrganizationUsersResponse;
    } catch (err) {
      log.error(
        "OrganizationUsersService: Failed to fetch organization users",
        {
          error: err instanceof Error ? err.message : "Unknown error",
        }
      );
      throw err;
    }
  }

  /**
   * Create a new organization user
   */
  static async create(
    request: CreateOrganizationUserRequest
  ): Promise<OrganizationUser> {
    try {
      log.debug("OrganizationUsersService: Creating organization user", {
        organizationId: request.organization_id,
        email: request.email,
        role: request.role,
      });

      const { data, error } = await supabase.functions.invoke(
        "create-organization-user",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.organization_user) {
        throw new Error("Failed to create organization user");
      }

      log.info(
        "OrganizationUsersService: Organization user created successfully",
        {
          userId: data.organization_user.id,
        }
      );
      return data.organization_user as OrganizationUser;
    } catch (err) {
      log.error(
        "OrganizationUsersService: Failed to create organization user",
        {
          error: err instanceof Error ? err.message : "Unknown error",
        }
      );
      throw err;
    }
  }

  /**
   * Update an existing organization user
   */
  static async update(
    request: UpdateOrganizationUserRequest
  ): Promise<OrganizationUser> {
    try {
      log.debug("OrganizationUsersService: Updating organization user", {
        userId: request.id,
      });

      const { data, error } = await supabase.functions.invoke(
        "update-organization-user",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.organization_user) {
        throw new Error("Failed to update organization user");
      }

      log.info(
        "OrganizationUsersService: Organization user updated successfully",
        {
          userId: data.organization_user.id,
        }
      );
      return data.organization_user as OrganizationUser;
    } catch (err) {
      log.error(
        "OrganizationUsersService: Failed to update organization user",
        {
          error: err instanceof Error ? err.message : "Unknown error",
        }
      );
      throw err;
    }
  }

  /**
   * Delete an organization user
   */
  static async delete(request: DeleteOrganizationUserRequest): Promise<void> {
    try {
      log.debug("OrganizationUsersService: Deleting organization user", {
        userId: request.id,
      });

      const { error } = await supabase.functions.invoke(
        "delete-organization-user",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      log.info(
        "OrganizationUsersService: Organization user deleted successfully",
        {
          userId: request.id,
        }
      );
    } catch (err) {
      log.error(
        "OrganizationUsersService: Failed to delete organization user",
        {
          error: err instanceof Error ? err.message : "Unknown error",
        }
      );
      throw err;
    }
  }

  /**
   * Resend invitation email for a pending organization user
   */
  static async resendInvitation(
    request: ResendAdminInvitationRequest
  ): Promise<void> {
    try {
      log.debug("OrganizationUsersService: Resending invitation", {
        userId: request.organization_user_id,
      });

      const { data, error } = await supabase.functions.invoke(
        "resend-admin-invitation",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.message || "Failed to resend invitation");
      }

      log.info(
        "OrganizationUsersService: Invitation resent successfully",
        {
          userId: request.organization_user_id,
        }
      );
    } catch (err) {
      log.error(
        "OrganizationUsersService: Failed to resend invitation",
        {
          error: err instanceof Error ? err.message : "Unknown error",
        }
      );
      throw err;
    }
  }

  /**
   * Convert an admin/viewer user to also be a worker
   * Allows them to use the mobile app with existing credentials
   */
  static async convertToWorker(
    organizationUserId: string,
    organizationId: string
  ): Promise<{ workerId: string; alreadyWorker: boolean }> {
    try {
      log.debug("OrganizationUsersService: Converting user to worker", {
        userId: organizationUserId,
      });

      const { data, error } = await supabase.functions.invoke(
        "convert-admin-to-worker",
        {
          body: {
            organization_user_id: organizationUserId,
            organization_id: organizationId,
          },
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.message || "Failed to convert user to worker");
      }

      log.info(
        "OrganizationUsersService: User converted to worker successfully",
        {
          userId: organizationUserId,
          workerId: data.worker?.id,
        }
      );

      return {
        workerId: data.worker?.id || data.worker_id,
        alreadyWorker: data.already_worker || false,
      };
    } catch (err) {
      log.error(
        "OrganizationUsersService: Failed to convert user to worker",
        {
          error: err instanceof Error ? err.message : "Unknown error",
        }
      );
      throw err;
    }
  }
}
