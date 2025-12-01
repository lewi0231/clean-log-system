import { serve } from "server";
import { getOrganizationIdFromUser } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const organizationId = await getOrganizationIdFromUser(req);

    if (!organizationId) {
      return errorResponse("Organization not found", 404);
    }

    return jsonResponse({
      organization_id: organizationId,
    });
  } catch (error) {
    console.error("Get organization ID error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to get organization ID"
    );
  }
});
