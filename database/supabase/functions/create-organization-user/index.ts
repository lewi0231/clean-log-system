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
import { createServiceRoleClient, getAuthUserByEmail } from "../_utils/supabase.ts";
import { validateRequiredFields, validateRole } from "../_utils/validation.ts";

// Load environment variables from .env file (for local development)
await loadEnvIfLocal();

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "create-organization-user",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "email",
      "role",
      "first_name",
      "last_name",
    ]);

    if (!validation.valid) {
      logger.warn("Missing required fields for organization user creation", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Missing required fields", 400);
    }

    const { organization_id, email, role, first_name, last_name, phone } = body;

    // Validate role
    if (!validateRole(role)) {
      logger.warn("Invalid role provided", { role });
      return errorResponse("Invalid role. Must be 'admin' or 'viewer'", 400);
    }

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      logger.warn("Unauthorized attempt to create organization user", {
        organization_id,
      });
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
    }

    // Check if user already exists in organization_user
    const { data: existingUser, error: checkError } = await supabase
      .from("organization_user")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("email", email)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingUser) {
      return errorResponse("User already exists in this organization", 400);
    }

    // Get organization name for email
    const organizationName = await getOrganizationName(supabase, organization_id);

    // If the user already exists in Supabase Auth, link them directly.
    // This avoids confusing "invite" flows for existing accounts and preserves
    // the expectation that they can log in with their existing credentials.
    const { data: existingAuthUserData, error: existingAuthUserError } =
      await getAuthUserByEmail(supabase, email);

    if (existingAuthUserError) {
      // Not fatal: some Supabase errors for "not found" can surface here depending on version.
      // We'll treat "no user" as the common case and continue to invite flow below.
      logger.warn("Unable to check auth user existence; continuing invite flow", {
        organization_id,
        // Avoid logging PII beyond what's needed for debugging.
        hasEmail: !!email,
        message:
          existingAuthUserError instanceof Error
            ? existingAuthUserError.message
            : String(existingAuthUserError),
      });
    }

    if (existingAuthUserData?.user) {
      // Create organization_user entry with existing auth_user_id
      // Set status to 'active' since they already have an account
      const { data: organizationUser, error: createError } = await supabase
        .from("organization_user")
        .insert({
          organization_id,
          email,
          role,
          first_name,
          last_name,
          phone: phone || null,
          status: "active",
          auth_user_id: existingAuthUserData.user.id,
          invited_at: new Date().toISOString(),
          activated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        logger.error("Error creating organization user", createError, {
          organization_id,
          email,
          role,
        });
        throw createError;
      }

      logger.info("Organization user created (existing auth user)", {
        organization_user_id: organizationUser?.id,
        organization_id,
        email,
        role,
      });

      return jsonResponse({
        success: true,
        organization_user: organizationUser,
        existing_user: true,
        message:
          "User already has an account. They can log in with their existing credentials.",
      });
    }

    // Generate an invitation link via Supabase Auth, then send it using our branded email.
    // Best practice: use `generateLink({ type: "invite" })` for custom email providers to
    // avoid sending both Supabase's default email and our branded one.
    const siteUrl = Deno.env.get("SITE_URL") || "http://127.0.0.1:3000";
    const redirectTo =
      `${siteUrl}/verify-email?type=admin_invite&email=${
        encodeURIComponent(email)
      }`;

    const { data: linkData, error: linkError } = await supabase.auth.admin
      .generateLink({
        type: "invite",
        email,
        options: {
          redirectTo,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      logger.error("Failed to generate invitation link", linkError, {
        organization_id,
        email,
        role,
      });
      return errorResponse(
        "Failed to generate invitation link. Please try again later.",
        500,
      );
    }

    // Create organization_user entry with pending status
    const { data: organizationUser, error: createError } = await supabase
      .from("organization_user")
      .insert({
        organization_id,
        email,
        role,
        first_name,
        last_name,
        phone: phone || null,
        status: "pending",
        invited_at: new Date().toISOString(),
        // auth_user_id will be set when they accept the invitation
      })
      .select()
      .single();

    if (createError) {
      logger.error("Error creating organization user", createError, {
        organization_id,
        email,
        role,
      });
      throw createError;
    }

    // Send branded invitation email containing the real Supabase `action_link`.
    // This prevents recipients receiving two invites and ensures the link contains
    // the required token/hash.
    const invitationLink = linkData.properties.action_link;
    const emailResult = await sendAdminInvitationEmail(
      supabase,
      {
        email,
        firstName: first_name,
        lastName: last_name,
        organizationName: organizationName || "Your Organization",
        organizationId: organization_id,
        invitationLink,
        role,
      },
      false, // Don't throw on email error - user is already created
    );

    if (!emailResult.success) {
      logger.warn("Failed to send custom invitation email", {
        error: emailResult.error,
        email,
      });
      // Don't fail the request - user was created; admin can resend later.
    }

    logger.info("Organization user created successfully", {
      organization_user_id: organizationUser?.id,
      organization_id,
      email,
      role,
      emailSent: emailResult.success,
    });

    return jsonResponse({
      success: true,
      organization_user: organizationUser,
      invitation_sent: true,
    });
  } catch (error) {
    logger.error("Create organization user error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to create organization user"),
      getErrorStatusCode(error),
    );
  }
});
