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

  const logger = createLogger(req, { functionName: "delete-worker" });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      logger.warn("Missing required field for worker deletion", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Worker ID is required", 400);
    }

    const { id } = body;

    const supabase = createServiceRoleClient();

    // Fetch worker to get organization_id and verify it exists
    const { data: worker, error: fetchError } = await supabase
      .from("worker")
      .select("id, organization_id, name")
      .eq("id", id)
      .single();

    if (fetchError || !worker) {
      logger.warn("Worker not found for deletion", fetchError, {
        worker_id: id,
      });
      return errorResponse("Worker not found", 404);
    }

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      worker.organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to delete worker", {
        worker_id: id,
        organization_id: worker.organization_id,
      });
      return errorResponse(
        "You do not have permission to delete this worker",
        403,
      );
    }

    const { error: deleteError } = await supabase
      .from("worker")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("Error deleting worker", deleteError, {
        worker_id: id,
        organization_id: worker.organization_id,
      });
      throw deleteError;
    }

    logger.info("Worker deleted successfully", {
      worker_id: id,
      organization_id: worker.organization_id,
      worker_name: worker.name,
    });

    return jsonResponse({ success: true });
  } catch (error) {
    logger.error("Delete worker error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to delete worker"),
      getErrorStatusCode(error),
    );
  }
});
