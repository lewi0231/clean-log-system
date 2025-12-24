import { serve } from "server";
import {
  extractAuthToken,
  getAuthUser,
  getOrganizationIdFromAdmin,
  getOrganizationIdFromWorker,
} from "../_utils/auth.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "get-onboarding-data" });

  try {
    const supabase = createServiceRoleClient();

    // Get auth token and user info
    const token = extractAuthToken(req);
    if (!token) {
      return errorResponse("Authentication required", 401);
    }

    const authUser = await getAuthUser(token);
    if (!authUser) {
      return errorResponse("Invalid authentication token", 401);
    }

    const userId = authUser.id;
    const userEmail = authUser.email ?? null;

    // Get organization ID from authenticated user
    let organizationId: string | null = null;
    if (userEmail) {
      organizationId = await getOrganizationIdFromAdmin(supabase, userEmail);
    }

    // Fallback: try worker lookup if admin lookup failed
    if (!organizationId) {
      organizationId = await getOrganizationIdFromWorker(supabase, userId);
    }

    if (!organizationId) {
      return errorResponse("Unable to determine organization", 401);
    }

    // Fetch onboarding data
    const { data: org, error: orgError } = await supabase
      .from("organization")
      .select("onboarding_completed_at, onboarding_data")
      .eq("id", organizationId)
      .single();

    if (orgError) {
      logger.error("Failed to fetch organization", { error: orgError });
      throw orgError;
    }

    return jsonResponse({
      success: true,
      onboarding_completed_at: org.onboarding_completed_at,
      onboarding_data: org.onboarding_data,
    });
  } catch (error) {
    logger.error("Failed to get onboarding data", {
      error: extractErrorMessage(error),
    });

    return errorResponse(
      extractErrorMessage(error),
      getErrorStatusCode(error),
    );
  }
});
