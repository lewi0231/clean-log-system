import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import {
  getOrganizationName,
  sendAdminInvitationEmail,
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

/**
 * Resend admin invitation email for a pending organization user
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "resend-admin-invitation",
  });

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_user_id",
      "organization_id",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields for resend invitation", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Missing required fields", 400);
    }

    const { organization_user_id, organization_id } = body;

    const supabase = createServiceRoleClient();

    // Verify organization membership (caller must be admin of the organization)
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to resend invitation", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Get the organization user
    const { data: orgUser, error: findError } = await supabase
      .from("organization_user")
      .select("*")
      .eq("id", organization_user_id)
      .eq("organization_id", organization_id)
      .single();

    if (findError || !orgUser) {
      logger.warn("Organization user not found", { organization_user_id });
      return errorResponse("User not found", 404);
    }

    // Check if user is still pending
    if (orgUser.status !== "pending") {
      logger.info("User is not in pending status", {
        organization_user_id,
        status: orgUser.status,
      });
      return errorResponse(
        `Cannot resend invitation: user status is '${orgUser.status}'`,
        400,
      );
    }

    // Get organization name for email
    const organizationName = await getOrganizationName(supabase, organization_id);

    // Generate new invitation using Supabase's invite flow
    const siteUrl = Deno.env.get("SITE_URL") || "http://127.0.0.1:3000";
    const redirectTo =
      `${siteUrl}/verify-email?type=admin_invite&email=${encodeURIComponent(orgUser.email)}`;

    // Best practice: for branded/custom email providers, generate the invite link and
    // send it yourself (avoid sending Supabase's default email too).
    const { data: linkData, error: linkError } = await supabase.auth.admin
      .generateLink({
        type: "invite",
        email: orgUser.email,
        options: { redirectTo },
      });

    if (linkError || !linkData?.properties?.action_link) {
      logger.error("Failed to generate invitation link", linkError, {
        email: orgUser.email,
      });
      return errorResponse(
        "Failed to generate new invitation link. Please try again later.",
        500,
      );
    }

    const emailResult = await sendAdminInvitationEmail(
      supabase,
      {
        email: orgUser.email,
        firstName: orgUser.first_name || "",
        lastName: orgUser.last_name || "",
        organizationName: organizationName || "Your Organization",
        organizationId: organization_id,
        invitationLink: linkData.properties.action_link,
        role: orgUser.role,
      },
      false,
    );

    if (!emailResult.success) {
      logger.warn("Failed to send custom invitation email", {
        error: emailResult.error,
        email: orgUser.email,
      });
      return errorResponse(
        "Failed to send invitation email. Please try again.",
        500,
      );
    }

    // Update invited_at timestamp
    await supabase
      .from("organization_user")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", organization_user_id);

    logger.info("Invitation resent successfully", {
      organization_user_id,
      email: orgUser.email,
      emailSent: emailResult.success,
    });

    return jsonResponse({
      success: true,
      message: "Invitation email resent successfully",
    });
  } catch (error) {
    logger.error("Resend admin invitation error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to resend invitation"),
      getErrorStatusCode(error),
    );
  }
});
