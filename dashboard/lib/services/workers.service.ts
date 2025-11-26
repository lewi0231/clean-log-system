import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { Worker } from "@/lib/types";
import type {
  CreateWorkerRequest,
  DeleteWorkerRequest,
  ListWorkersAndLocationsRequest,
  ListWorkersAndLocationsResponse,
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

      const { data, error } = await supabase.functions.invoke(
        "list-workers-and-locations",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error("Failed to fetch workers and locations");
      }

      log.info("WorkersService: Workers and locations fetched successfully");
      return data as ListWorkersAndLocationsResponse;
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
  static async create(request: CreateWorkerRequest): Promise<Worker> {
    try {
      log.debug("WorkersService: Creating worker", {
        organizationId: request.organization_id,
        name: request.name,
      });

      const { data, error } = await supabase.functions.invoke("create-worker", {
        body: request,
      });

      if (error) {
        throw error;
      }

      if (!data || !data.worker) {
        throw new Error("Failed to create worker");
      }

      log.info("WorkersService: Worker created successfully", {
        workerId: data.worker.id,
      });
      return data.worker as Worker;
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

      const { data, error } = await supabase.functions.invoke("update-worker", {
        body: request,
      });

      if (error) {
        throw error;
      }

      if (!data || !data.worker) {
        throw new Error("Failed to update worker");
      }

      log.info("WorkersService: Worker updated successfully", {
        workerId: data.worker.id,
      });
      return data.worker as Worker;
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

      const { error } = await supabase.functions.invoke("delete-worker", {
        body: request,
      });

      if (error) {
        throw error;
      }

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
}
