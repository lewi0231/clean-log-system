/**
 * Worker invitation preview for the accept-invite flow.
 * Body is the invitation row UUID (see dashboard accept-invite page); callers are typically unauthenticated.
 * Org membership via JWT does not apply here — capability is the invitation id + expiry.
 */
import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "get-worker" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Get token from request body
    const token = await req.text();

    if (!token) {
      return errorResponse("Token is required", 400);
    }

    const supabase = createServiceRoleClient();

    // Fetch invitation with worker details
    const { data: invitation, error: inviteError } = await supabase
      .from("worker_invitation")
      .select("*, worker(id, name, email, organization_id)")
      .eq("id", token)
      .single();

    if (inviteError || !invitation) {
      return errorResponse("Invitation not found", 404);
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return jsonResponse(
        {
          error: "Invitation expired",
          invitation: {
            id: invitation.id,
            worker_email: invitation.worker_email,
            expires_at: invitation.expires_at,
          },
        },
        410
      );
    }

    // Check if invitation is already accepted
    if (invitation.accepted_at) {
      return jsonResponse(
        {
          error: "Invitation already used",
          invitation: {
            id: invitation.id,
            worker_email: invitation.worker_email,
            accepted_at: invitation.accepted_at,
          },
        },
        400
      );
    }

    // Return invitation details (without sensitive info)
    return jsonResponse({
      success: true,
      invitation: {
        id: invitation.id,
        worker_email: invitation.worker_email,
        expires_at: invitation.expires_at,
        worker: invitation.worker,
      },
    });
  } catch (error) {
    logger.error("Get worker invitation error", error);
    return errorResponse(error instanceof Error ? error : "Failed to fetch invitation");
  }
});
