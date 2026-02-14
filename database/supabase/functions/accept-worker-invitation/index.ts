import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createNotification } from "../_utils/notifications.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "accept-worker-invitation" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const validation = validateRequiredFields(body, [
        "invitation_token",
        "password",
        "address",
        "abn",
      ]);

      if (!validation.valid) {
        return errorResponse(
          "Missing required fields: invitation_token, password, address, and abn",
          400,
        );
      }

      const { invitation_token, password, address, abn } = body;

      const supabase = createServiceRoleClient();

      // Step 1: Verify invitation exists and not expired
      const { data: invitation, error: inviteError } = await supabase
        .from("worker_invitation")
        .select("*, worker(id, organization_id, email)")
        .eq("id", invitation_token)
        .single();

      if (inviteError || !invitation) {
        return errorResponse("Invitation not found", 404);
      }

      if (new Date(invitation.expires_at) < new Date()) {
        return errorResponse("Invitation expired", 410);
      }

      if (invitation.accepted_at) {
        return errorResponse("Invitation already used", 400);
      }

      // Step 2: Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.admin
        .createUser({
          email: invitation.worker_email,
          password: password,
          email_confirm: true, // Auto-confirm via email link
          user_metadata: {
            role: "worker",
            organization_id: invitation.organization_id,
            worker_id: invitation.worker.id,
          },
        });

      if (authError) {
        return errorResponse(`Auth error: ${authError.message}`, 400);
      }

      // Step 3: Update worker with auth_user_id, address, abn, and set active to true
      // Worker becomes active once they accept invitation and create password
      const { error: updateError } = await supabase
        .from("worker")
        .update({
          auth_user_id: authData.user.id,
          address: address,
          abn: abn,
          active: true,
        })
        .eq("id", invitation.worker.id);

      if (updateError) {
        logger.error("Update worker error", undefined, { error: updateError.message });
        return errorResponse("Failed to update worker", 500);
      }

      // Step 4: Mark invitation as accepted
      const { error: acceptError } = await supabase
        .from("worker_invitation")
        .update({
          accepted_at: new Date().toISOString(),
          auth_user_id: authData.user.id,
        })
        .eq("id", invitation_token);

      if (acceptError) {
        logger.error("Accept invitation error", undefined, { error: acceptError.message });
        return errorResponse("Failed to mark invitation as accepted", 500);
      }

      // Step 5: Create notification for admins (non-blocking)
      // Get worker name for notification message
      const { data: workerData } = await supabase
        .from("worker")
        .select("first_name, last_name")
        .eq("id", invitation.worker.id)
        .single();

      const workerName = workerData
        ? `${workerData.first_name} ${workerData.last_name}`.trim()
        : invitation.worker_email;

      const notificationResult = await createNotification(supabase, {
        organization_id: invitation.organization_id,
        type: "worker_active",
        title: "Worker Activated",
        message: `${workerName} has completed onboarding and is now active.`,
        related_entity_type: "worker",
        related_entity_id: invitation.worker.id,
      });

      if (!notificationResult.success) {
        // Log but don't fail the request - notification is non-critical
        logger.warn("Failed to create notification", {
          error: notificationResult.error,
        });
      }

      return jsonResponse({
        success: true,
        message: "Account created successfully",
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
      });
    } catch (error) {
      logger.error("Accept invitation error", error);
      return errorResponse(
        error instanceof Error ? error : "Failed to accept invitation",
      );
    }
  }

  return errorResponse("Method not allowed", 405);
});
