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

    // Use Supabase's inviteUserByEmail to send invitation
    // This handles token generation and email sending
    const siteUrl = Deno.env.get("SITE_URL") || "http://127.0.0.1:3000";
    const redirectTo = `${siteUrl}/verify-email?type=admin_invite&email=${encodeURIComponent(email)}`;

    const { data: inviteData, error: inviteError } = await supabase.auth.admin
      .inviteUserByEmail(email, {
        redirectTo,
        data: {
          role: role,
          user_type: "admin",
          organization_id: organization_id,
          first_name: first_name,
          last_name: last_name,
        },
      });

    if (inviteError) {
      // Check if user already exists in auth (maybe from another org or as a worker)
      if (inviteError.message?.includes("already been registered")) {
        // User exists in auth, we can still create the organization_user record
        // They'll need to use their existing password to log in
        logger.info(
          "User already exists in auth, creating organization_user link",
          { email },
        );

        // Get existing auth user
        const { data: authUser, error: authError } = await supabase.auth.admin
          .getUserByEmail(email);

        if (authError || !authUser?.user) {
          logger.error("Failed to get existing auth user", authError, { email });
          return errorResponse("Failed to process invitation", 500);
        }

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
            auth_user_id: authUser.user.id,
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
          message: "User already has an account. They can log in with their existing credentials.",
        });
      }

      logger.error("Error inviting user", inviteError, {
        organization_id,
        email,
      });
      throw inviteError;
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

    // Send custom invitation email (in addition to Supabase's default)
    // This provides a branded experience with organization name
    const invitationLink = inviteData?.user?.confirmation_sent_at
      ? `${siteUrl}/verify-email?type=admin_invite&email=${encodeURIComponent(email)}`
      : redirectTo;

    const emailResult = await sendAdminInvitationEmail(
      {
        email,
        firstName: first_name,
        lastName: last_name,
        organizationName: organizationName || "Your Organization",
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
      // Don't fail the request - Supabase already sent an email
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
