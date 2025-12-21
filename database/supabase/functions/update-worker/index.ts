import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "update-worker" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for worker update", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Worker ID is required", 400);
    }

    const { id, name, email, phone, active } = body;

    // Build update object with only provided fields
    const updateData: {
      name?: string;
      email?: string;
      phone?: string;
      active?: boolean;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (active !== undefined) updateData.active = active;

    if (Object.keys(updateData).length === 0) {
      logger.warn("No fields provided for worker update", { worker_id: id });
      return errorResponse("At least one field must be provided", 400);
    }

    const supabase = createServiceRoleClient();

    // Fetch worker to get organization_id and verify it exists
    const { data: existingWorker, error: fetchError } = await supabase
      .from("worker")
      .select("id, organization_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingWorker) {
      logger.warn("Worker not found for update", fetchError, {
        worker_id: id,
      });
      return errorResponse("Worker not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      existingWorker.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to update worker", {
        worker_id: id,
        organization_id: existingWorker.organization_id,
      });
      return errorResponse(
        "You do not have permission to update this worker",
        403,
      );
    }

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (workerError) {
      logger.error("Error updating worker", workerError, {
        worker_id: id,
        organization_id: existingWorker.organization_id,
      });
      throw workerError;
    }

    logger.info("Worker updated successfully", {
      worker_id: id,
      organization_id: existingWorker.organization_id,
    });

    return jsonResponse({ success: true, worker });
  } catch (error) {
    logger.error("Update worker error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to update worker"),
      getErrorStatusCode(error),
    );
  }
});
