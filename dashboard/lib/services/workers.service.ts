import { log } from "@/lib/logger";
import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import type { Worker } from "@/lib/types";
import type {
  CreateWorkerRequest,
  CreateWorkerResult,
  DeleteWorkerRequest,
  ListWorkersAndLocationsRequest,
  ListWorkersAndLocationsResponse,
  ResendWorkerInvitationRequest,
  UpdateWorkerRequest,
} from "@/lib/types/api";

export class WorkersService {
  /**
   * List workers and locations for an organization
   */
  static async listWorkersAndLocations(
    request: ListWorkersAndLocationsRequest
  ): Promise<ListWorkersAndLocationsResponse> {
    try {
      log.debug("WorkersService: Fetching workers and locations", {
        organizationId: request.organization_id,
      });

      const data = await invokeTypedEdge("list-workers-and-locations", request);

      if (!data || !data.success) {
        throw new Error("Failed to fetch workers and locations");
      }

      log.info("WorkersService: Workers and locations fetched successfully");
      return data;
    } catch (err) {
      log.error("WorkersService: Failed to fetch workers and locations", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Create a new worker
   */
  static async create(request: CreateWorkerRequest): Promise<CreateWorkerResult> {
    try {
      log.debug("WorkersService: Creating worker", {
        organizationId: request.organization_id,
        name: `${request.first_name} ${request.last_name}`,
      });

      const data = await invokeTypedEdge("create-worker", request);

      if (!data || !data.worker) {
        throw new Error("Failed to create worker");
      }

      if (!data.email_sent && data.email_error) {
        log.warn("WorkersService: Worker created but invitation email failed", {
          workerId: data.worker.id,
          error: data.email_error,
        });
      }

      log.info("WorkersService: Worker created successfully", {
        workerId: data.worker.id,
        emailSent: data.email_sent,
      });
      return {
        worker: data.worker,
        emailSent: Boolean(data.email_sent),
        ...(data.email_error && { emailError: data.email_error }),
      };
    } catch (err) {
      log.error("WorkersService: Failed to create worker", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Update an existing worker
   */
  static async update(request: UpdateWorkerRequest): Promise<Worker> {
    try {
      log.debug("WorkersService: Updating worker", {
        workerId: request.id,
      });

      const data = await invokeTypedEdge("update-worker", request);

      if (!data || !data.worker) {
        throw new Error("Failed to update worker");
      }

      log.info("WorkersService: Worker updated successfully", {
        workerId: data.worker.id,
      });
      return data.worker;
    } catch (err) {
      log.error("WorkersService: Failed to update worker", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Delete a worker
   */
  static async delete(request: DeleteWorkerRequest): Promise<void> {
    try {
      log.debug("WorkersService: Deleting worker", {
        workerId: request.id,
      });

      await invokeTypedEdge("delete-worker", request);

      log.info("WorkersService: Worker deleted successfully", {
        workerId: request.id,
      });
    } catch (err) {
      log.error("WorkersService: Failed to delete worker", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Resend invitation email to a worker
   */
  static async resendInvitation(request: ResendWorkerInvitationRequest): Promise<void> {
    try {
      log.debug("WorkersService: Resending invitation", {
        workerId: request.worker_id,
        organizationId: request.organization_id,
      });

      const data = await invokeTypedEdge("resend-worker-invitation", request);

      if (!data || !data.success) {
        throw new Error("Failed to resend invitation");
      }

      log.info("WorkersService: Invitation resent successfully", {
        workerId: request.worker_id,
      });
    } catch (err) {
      log.error("WorkersService: Failed to resend invitation", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
