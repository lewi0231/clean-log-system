import { serve } from "server";
import {
  getOrganizationIdFromUser,
  getOrganizationUserByEmail,
} from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Clone request to read body twice if needed
    const clonedReq = req.clone();

    const organizationId = await getOrganizationIdFromUser(req);

    if (!organizationId) {
      return errorResponse("Organization not found", 404);
    }

    // Try to get organization_user id for admins
    let organizationUserId: string | null = null;
    let role: string | null = null;

    try {
      const body = await clonedReq.json();
      if (body.email) {
        const supabase = createServiceRoleClient();
        const orgUser = await getOrganizationUserByEmail(supabase, body.email);
        if (orgUser && orgUser.organization_id === organizationId) {
          organizationUserId = orgUser.id;
          role = orgUser.role;
        }
      }
    } catch {
      // Body might be empty, that's okay
    }

    return jsonResponse({
      organization_id: organizationId,
      organization_user_id: organizationUserId,
      role: role,
    });
  } catch (error) {
    console.error("Get organization ID error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to get organization ID"
    );
  }
});
