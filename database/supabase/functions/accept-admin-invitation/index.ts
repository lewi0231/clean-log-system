import { serve } from "server";
import { loadEnvIfLocal } from "../_utils/env.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createNotification } from "../_utils/notifications.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

// Load environment variables from .env file (for local development)
await loadEnvIfLocal();

/**
 * Accept admin invitation - called after user sets their password
 * This function updates the organization_user record to link it to the auth user
 * and sets the status to 'active'.
 *
 * The actual password setup is handled by Supabase Auth's invite flow.
 * This function just needs to be called to complete the activation.
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "accept-admin-invitation",
  });

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await req.json();
    const { email, auth_user_id } = body;

    if (!email) {
      logger.warn("Missing email in accept-admin-invitation request");
      return errorResponse("Email is required", 400);
    }

    const supabase = createServiceRoleClient();

    // If auth_user_id is provided, use it directly
    // Otherwise, look up the user by email
    let userId = auth_user_id;

    if (!userId) {
      const { data: authUser, error: authError } = await supabase.auth.admin
        .getUserByEmail(email);

      if (authError || !authUser?.user) {
        logger.warn("Auth user not found for email", { email });
        return errorResponse(
          "User account not found. Please complete the signup process first.",
          404,
        );
      }

      userId = authUser.user.id;
    }

    // Find the pending organization_user record
    const { data: orgUser, error: findError } = await supabase
      .from("organization_user")
      .select("*")
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (findError) {
      logger.error("Error finding organization user", findError, { email });
      throw findError;
    }

    if (!orgUser) {
      // Check if already activated
      const { data: activeUser } = await supabase
        .from("organization_user")
        .select("status")
        .eq("email", email)
        .eq("status", "active")
        .maybeSingle();

      if (activeUser) {
        logger.info("User already activated", { email });
        return jsonResponse({
          success: true,
          message: "Account already activated",
          already_active: true,
        });
      }

      logger.warn("No pending invitation found for email", { email });
      return errorResponse(
        "No pending invitation found for this email address",
        404,
      );
    }

    // Update organization_user with auth_user_id and set status to active
    const { data: updatedUser, error: updateError } = await supabase
      .from("organization_user")
      .update({
        auth_user_id: userId,
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .eq("id", orgUser.id)
      .select()
      .single();

    if (updateError) {
      logger.error("Error updating organization user", updateError, {
        orgUserId: orgUser.id,
      });
      throw updateError;
    }

    // Create notification for other admins (non-blocking)
    const userName = orgUser.first_name && orgUser.last_name
      ? `${orgUser.first_name} ${orgUser.last_name}`
      : email;

    const notificationResult = await createNotification(supabase, {
      organization_id: orgUser.organization_id,
      type: "admin_activated",
      title: "New Team Member Activated",
      message:
        `${userName} has joined the dashboard as a${orgUser.role === "admin" ? "n Administrator" : " Viewer"}.`,
      related_entity_type: "organization_user",
      related_entity_id: orgUser.id,
    });

    if (!notificationResult.success) {
      logger.warn("Failed to create notification:", notificationResult.error);
    }

    logger.info("Admin invitation accepted successfully", {
      organization_user_id: updatedUser.id,
      organization_id: orgUser.organization_id,
      email,
    });

    return jsonResponse({
      success: true,
      message: "Account activated successfully",
      organization_user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        organization_id: updatedUser.organization_id,
      },
    });
  } catch (error) {
    logger.error("Accept admin invitation error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to accept invitation"),
      getErrorStatusCode(error),
    );
  }
});
