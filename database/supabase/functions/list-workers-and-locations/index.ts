import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { requireAuthenticatedOrgMember } from "../_utils/require-authenticated-org-member.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "list-workers-and-locations" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id } = body;

    const supabase = createServiceRoleClient();

    const orgGate = await requireAuthenticatedOrgMember(req, organization_id, supabase);
    if (!orgGate.ok) {
      if (orgGate.response.status === 403) {
        logger.warn("Unauthorized organization access attempt", {
          organization_id,
        });
      }
      return orgGate.response;
    }

    const [workersResult, locationsResult] = await Promise.all([
      supabase
        .from("worker")
        .select("*")
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: false }),

      supabase
        .from("location")
        .select(
          `
          *,
          hierarchy_parent:hierarchy_parent_id (
            id,
            name,
            type
          )
        `
        )
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: false }),
    ]);

    if (workersResult.error && locationsResult.error) {
      throw new Error(
        `Failed to fetch workers and locations: ${workersResult.error.message}, ${locationsResult.error.message}`
      );
    }

    if (workersResult.error) {
      throw workersResult.error;
    }

    if (locationsResult.error) {
      throw locationsResult.error;
    }

    return jsonResponse({
      success: true,
      workers: workersResult.data || [],
      locations: locationsResult.data || [],
    });
  } catch (error) {
    logger.error("List workers and locations error", error);
    return errorResponse(error instanceof Error ? error : "Failed to list workers and locations");
  }
});
