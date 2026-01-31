import { serve } from "server";
import {
  extractAuthToken,
  getAuthUser,
  getOrganizationIdFromAdmin,
  getOrganizationIdFromWorker,
  getOrganizationUserByEmail,
} from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createServiceRoleClient();

    // Parse body first (can only be read once)
    let email: string | null = null;
    try {
      const body = await req.json();
      email = (body.email as string) || null;
      console.log("[get-organization-id] Email from body:", email);
    } catch {
      console.log("[get-organization-id] No body or failed to parse");
    }

    // Try to get auth user from token
    const token = extractAuthToken(req);
    let authUserId: string | null = null;
    let authEmail: string | null = null;

    if (token) {
      console.log("[get-organization-id] Token found, validating...");
      const authUser = await getAuthUser(token);
      if (authUser) {
        authUserId = authUser.id;
        authEmail = authUser.email ?? null;
        console.log("[get-organization-id] Auth user found:", {
          id: authUserId,
          email: authEmail,
        });
      } else {
        console.log("[get-organization-id] Token validation failed");
      }
    } else {
      console.log("[get-organization-id] No auth token in request");
    }

    // Use email from body, or fall back to auth email
    const lookupEmail = email || authEmail;

    // Strategy 1: Try admin user by email
    let organizationId: string | null = null;
    if (lookupEmail) {
      organizationId = await getOrganizationIdFromAdmin(supabase, lookupEmail);
      console.log(
        "[get-organization-id] Admin lookup by email:",
        lookupEmail,
        "->",
        organizationId,
      );
    }

    // Strategy 2: Try worker by auth_user_id
    if (!organizationId && authUserId) {
      organizationId = await getOrganizationIdFromWorker(supabase, authUserId);
      console.log(
        "[get-organization-id] Worker lookup by auth_user_id:",
        authUserId,
        "->",
        organizationId,
      );
    }

    if (!organizationId) {
      console.log("[get-organization-id] Organization not found");
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
      console.log("[get-organization-id] OrgUser lookup:", {
        organizationUserId,
        role,
      });
    }

    console.log("[get-organization-id] Success:", {
      organization_id: organizationId,
      organization_user_id: organizationUserId,
      role,
    });

    return jsonResponse({
      organization_id: organizationId,
      organization_user_id: organizationUserId,
      role: role,
    });
  } catch (error) {
    console.error("[get-organization-id] Error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to get organization ID",
    );
  }
});
