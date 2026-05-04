import {
  extractAuthToken,
  getAuthUser,
  getOrganizationIdFromAdmin,
  getOrganizationIdFromWorker,
} from "../../_utils/auth.ts";
import { errorResponse } from "../../_utils/http.ts";
import { createLogger } from "../../_utils/logger.ts";
import { createServiceRoleClient } from "../../_utils/supabase.ts";
import type { CreateJobContext } from "./types.ts";

type EdgeLogger = ReturnType<typeof createLogger>;

/**
 * JWT → org resolution → organization row + settings needed before body parse.
 * Returns `Response` on auth/org failures (parity with monolithic handler).
 */
export async function resolveCreateJobContext(
  req: Request,
  logger: EdgeLogger
): Promise<Response | CreateJobContext> {
  const token = extractAuthToken(req);

  if (!token) {
    logger.warn("No authentication token provided for job creation");
    return errorResponse("Authentication required", 401);
  }

  const supabaseAdmin = createServiceRoleClient();

  const authUser = await getAuthUser(token);

  if (!authUser) {
    logger.warn("User not found after token verification");
    return errorResponse("User not found", 401);
  }

  const authUserId = authUser.id;
  const userEmail = authUser.email ?? null;
  logger.debug("Token verified for job creation", {
    userId: authUserId,
    email: userEmail,
  });

  let organizationId: string | null = null;

  if (userEmail) {
    organizationId = await getOrganizationIdFromAdmin(supabaseAdmin, userEmail);
    if (organizationId) {
      logger.debug("Organization ID found from admin user", {
        organizationId,
        email: userEmail,
      });
    }
  }

  if (!organizationId) {
    organizationId = await getOrganizationIdFromWorker(supabaseAdmin, authUserId);
    if (organizationId) {
      logger.debug("Organization ID found from worker", {
        organizationId,
        authUserId,
      });
    }
  }

  if (!organizationId) {
    logger.warn("Organization ID not found for user", {
      authUserId,
      email: userEmail,
    });
    return errorResponse(
      "User is not associated with any organization. Please contact your administrator.",
      404
    );
  }

  logger.debug("Fetching organization settings", {
    organizationId,
  });
  const { data: organization, error: orgError } = await supabaseAdmin
    .from("organization")
    .select("use_predefined_locations, colleague_confirmation_timeout_hours")
    .eq("id", organizationId)
    .single();

  if (orgError) {
    logger.error("Error fetching organization settings", orgError, {
      organizationId,
    });
    throw orgError;
  }

  const { data: orgSettings } = await supabaseAdmin
    .from("organization_settings")
    .select("edit_window_minutes")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const usePredefinedLocations = organization?.use_predefined_locations ?? true;
  const confirmationTimeoutHours = organization?.colleague_confirmation_timeout_hours ?? 24;
  const editWindowMinutes = orgSettings?.edit_window_minutes ?? 180;

  logger.debug("Organization settings fetched", {
    usePredefinedLocations,
    confirmationTimeoutHours,
    editWindowMinutes,
  });

  return {
    supabaseAdmin,
    authUser,
    authUserId,
    userEmail,
    organizationId,
    usePredefinedLocations,
    confirmationTimeoutHours,
    editWindowMinutes,
  };
}
