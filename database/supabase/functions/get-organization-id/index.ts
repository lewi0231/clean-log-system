import { serve } from "server";
import {
  extractAuthToken,
  getAuthUser,
  getOrganizationIdFromAdmin,
  getOrganizationIdFromWorker,
  getOrganizationUserByEmail,
} from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "get-organization-id" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createServiceRoleClient();

    // Parse body first (can only be read once)
    let email: string | null = null;
    try {
      const body = await req.json();
      email = (body.email as string) || null;
      logger.debug("Parsed body email presence", { hasEmail: !!email });
    } catch {
      logger.debug("No JSON body or failed to parse");
    }

    // Try to get auth user from token
    const token = extractAuthToken(req);
    let authUserId: string | null = null;
    let authEmail: string | null = null;

    if (token) {
      logger.debug("Auth token found; validating");
      const authUser = await getAuthUser(token);
      if (authUser) {
        authUserId = authUser.id;
        authEmail = authUser.email ?? null;
        // Never log user email/token; only presence flags and IDs.
        logger.debug("Auth user found", {
          authUserId,
          hasEmail: !!authEmail,
        });
      } else {
        logger.warn("Auth token validation failed");
      }
    } else {
      logger.debug("No auth token in request");
    }

    // Use email from body, or fall back to auth email
    const lookupEmail = email || authEmail;

    // Strategy 1: Try admin user by email
    let organizationId: string | null = null;
    if (lookupEmail) {
      organizationId = await getOrganizationIdFromAdmin(supabase, lookupEmail);
      logger.debug("Admin lookup attempted", {
        hasLookupEmail: true,
        foundOrganizationId: !!organizationId,
      });
    }

    // Strategy 2: Try worker by auth_user_id
    if (!organizationId && authUserId) {
      organizationId = await getOrganizationIdFromWorker(supabase, authUserId);
      logger.debug("Worker lookup attempted", {
        authUserId,
        foundOrganizationId: !!organizationId,
      });
    }

    if (!organizationId) {
      logger.warn("Organization not found");
      return errorResponse("Organization not found", 404);
    }

    // Try to get organization_user id for admins
    let organizationUserId: string | null = null;
    let role: string | null = null;

    if (lookupEmail) {
      const orgUser = await getOrganizationUserByEmail(
        supabase,
        lookupEmail,
        organizationId,
      );
      if (orgUser) {
        organizationUserId = orgUser.id;
        role = orgUser.role;
      }
      logger.debug("Org user lookup completed", {
        hasOrganizationUserId: !!organizationUserId,
        role,
      });
    }

    logger.info("Resolved organization context", {
      organizationId,
      hasOrganizationUserId: !!organizationUserId,
      role,
    });

    return jsonResponse({
      organization_id: organizationId,
      organization_user_id: organizationUserId,
      role: role,
    });
  } catch (error) {
    logger.error("Unhandled error", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to get organization ID",
    );
  }
});
