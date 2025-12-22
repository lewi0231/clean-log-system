import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import {
  getOrganizationName,
  sendWorkerInvitationEmail,
} from "../_utils/email.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
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

// Load environment variables from .env file (for local development)
await loadEnvIfLocal();

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "resend-worker-invitation",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "worker_id",
      "organization_id",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields for worker invitation resend", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Worker ID and Organization ID are required", 400);
    }

    const { worker_id, organization_id } = body;

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to resend worker invitation", {
        organization_id,
        worker_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Fetch worker details
    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("*")
      .eq("id", worker_id)
      .eq("organization_id", organization_id)
      .single();

    if (workerError || !worker) {
      return errorResponse("Worker not found", 404);
    }

    // Check if worker has already accepted invitation (has auth_user_id)
    if (worker.auth_user_id) {
      return errorResponse("Worker has already accepted their invitation", 400);
    }

    // Check for existing invitation
    const { data: existingInvitation, error: inviteCheckError } = await supabase
      .from("worker_invitation")
      .select("*")
      .eq("worker_id", worker_id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (inviteCheckError) {
      logger.error("Error checking existing invitation", inviteCheckError, {
        worker_id,
        organization_id,
      });
    }

    let invitationToken: string;
    let expiresAt: Date;

    // If there's an existing unaccepted invitation that hasn't expired, reuse it
    if (
      existingInvitation &&
      !existingInvitation.accepted_at &&
      new Date(existingInvitation.expires_at) > new Date()
    ) {
      invitationToken = existingInvitation.id;
      expiresAt = new Date(existingInvitation.expires_at);
    } else {
      // Generate new invitation token
      invitationToken = crypto.randomUUID();

      // Calculate expiration date (7 days from now)
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create or update worker invitation
      if (existingInvitation) {
        // Update existing expired invitation
        const { error: updateError } = await supabase
          .from("worker_invitation")
          .update({
            id: invitationToken,
            expires_at: expiresAt.toISOString(),
            accepted_at: null, // Reset acceptance
          })
          .eq("worker_id", worker_id);

        if (updateError) throw updateError;
      } else {
        // Create new invitation
        const { error: invitationError } = await supabase
          .from("worker_invitation")
          .insert({
            id: invitationToken,
            organization_id,
            worker_id: worker.id,
            worker_email: worker.email,
            expires_at: expiresAt.toISOString(),
          });

        if (invitationError) throw invitationError;
      }
    }

    // Get organization name
    const orgName = await getOrganizationName(supabase, organization_id);

    // Send invitation email using shared utility
    const emailResult = await sendWorkerInvitationEmail(
      {
        workerName: worker.name,
        workerEmail: worker.email,
        organizationName: orgName,
        invitationToken,
      },
      true, // throw on error
    );

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Failed to send invitation email");
    }

    logger.info("Worker invitation resent successfully", {
      worker_id,
      organization_id,
      invitation_token: invitationToken,
      expires_at: expiresAt.toISOString(),
      reused_existing: !!(
        existingInvitation &&
        !existingInvitation.accepted_at &&
        new Date(existingInvitation.expires_at) > new Date()
      ),
    });

    return jsonResponse({
      success: true,
      message: "Invitation email sent successfully",
      invitation: {
        token: invitationToken,
        expires_at: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error("Resend worker invitation error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to resend invitation"),
      getErrorStatusCode(error),
    );
  }
});
