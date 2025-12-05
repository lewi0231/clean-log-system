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
    request: ListWorkersAndLocationsRequest,
  ): Promise<ListWorkersAndLocationsResponse> {
    try {
      log.debug("LocationsService: Fetching workers and locations", {
        organizationId: request.organization_id,
      });

      const { data, error } = await supabase.functions.invoke(
        "list-workers-and-locations",
        {
          body: request,
        },
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

      // Validate pricing mode and fixed price fields
      if (request.pricing_mode === "fixed_price") {
        if (
          request.fixed_customer_price === undefined ||
          request.fixed_customer_price === null
        ) {
          throw new Error(
            "Fixed customer price is required when pricing mode is fixed price",
          );
        }
        if (request.fixed_customer_price < 0) {
          throw new Error("Fixed customer price must be non-negative");
        }
        if (request.fixed_price_currency) {
          const currencyRegex = /^[A-Z]{3}$/;
          if (!currencyRegex.test(request.fixed_price_currency)) {
            throw new Error(
              "Fixed price currency must be a valid 3-letter ISO code",
            );
          }
        }
      }

      const { data, error } = await supabase.functions.invoke(
        "create-location",
        {
          body: request,
        },
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

      // Validate pricing mode and fixed price fields
      if (request.pricing_mode === "fixed_price") {
        if (
          request.fixed_customer_price !== undefined &&
          request.fixed_customer_price !== null &&
          request.fixed_customer_price < 0
        ) {
          throw new Error("Fixed customer price must be non-negative");
        }
        if (request.fixed_price_currency) {
          const currencyRegex = /^[A-Z]{3}$/;
          if (!currencyRegex.test(request.fixed_price_currency)) {
            throw new Error(
              "Fixed price currency must be a valid 3-letter ISO code",
            );
          }
        }
        // If switching to fixed_price mode, require fixed_customer_price
        if (
          request.pricing_mode === "fixed_price" &&
          (request.fixed_customer_price === undefined ||
            request.fixed_customer_price === null)
        ) {
          throw new Error(
            "Fixed customer price is required when pricing mode is fixed price",
          );
        }
      }

      const { data, error } = await supabase.functions.invoke(
        "update-location",
        {
          body: request,
        },
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
