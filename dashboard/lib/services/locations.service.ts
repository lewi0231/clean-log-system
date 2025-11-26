import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { Location } from "@/lib/types";
import type {
  CreateLocationRequest,
  DeleteLocationRequest,
  ListWorkersAndLocationsRequest,
  ListWorkersAndLocationsResponse,
  UpdateLocationRequest,
} from "@/lib/types/api";

export class LocationsService {
  /**
   * List workers and locations for an organization
   */
  static async listWorkersAndLocations(
    request: ListWorkersAndLocationsRequest
  ): Promise<ListWorkersAndLocationsResponse> {
    try {
      log.debug("LocationsService: Fetching workers and locations", {
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

      log.info("LocationsService: Workers and locations fetched successfully");
      return data as ListWorkersAndLocationsResponse;
    } catch (err) {
      log.error("LocationsService: Failed to fetch workers and locations", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Create a new location
   */
  static async create(request: CreateLocationRequest): Promise<Location> {
    try {
      log.debug("LocationsService: Creating location", {
        organizationId: request.organization_id,
        name: request.name,
      });

      const { data, error } = await supabase.functions.invoke(
        "create-location",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.location) {
        throw new Error("Failed to create location");
      }

      log.info("LocationsService: Location created successfully", {
        locationId: data.location.id,
      });
      return data.location as Location;
    } catch (err) {
      log.error("LocationsService: Failed to create location", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Update an existing location
   */
  static async update(request: UpdateLocationRequest): Promise<Location> {
    try {
      log.debug("LocationsService: Updating location", {
        locationId: request.id,
      });

      const { data, error } = await supabase.functions.invoke(
        "update-location",
        {
          body: request,
        }
      );

      if (error) {
        throw error;
      }

      if (!data || !data.location) {
        throw new Error("Failed to update location");
      }

      log.info("LocationsService: Location updated successfully", {
        locationId: data.location.id,
      });
      return data.location as Location;
    } catch (err) {
      log.error("LocationsService: Failed to update location", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Delete a location
   */
  static async delete(request: DeleteLocationRequest): Promise<void> {
    try {
      log.debug("LocationsService: Deleting location", {
        locationId: request.id,
      });

      const { error } = await supabase.functions.invoke("delete-location", {
        body: request,
      });

      if (error) {
        throw error;
      }

      log.info("LocationsService: Location deleted successfully", {
        locationId: request.id,
      });
    } catch (err) {
      log.error("LocationsService: Failed to delete location", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
