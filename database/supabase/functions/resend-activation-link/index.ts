import { serve } from "server";
import {
  getOrganizationName,
  sendEmailVerificationEmail,
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
import { validateRequiredFields } from "../_utils/validation.ts";

// Load environment variables from .env file (for local development)
await loadEnvIfLocal();

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "resend-activation-link",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["email"]);

    if (!validation.valid) {
      logger.warn("Missing required fields for activation link resend", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Email address is required", 400);
    }

    const { email } = body;

    const supabase = createServiceRoleClient();

    // 1. Check if user exists in Supabase Auth
    const { data: authData, error: getUserError } = await getAuthUserByEmail(
      supabase,
      email,
    );

    const user = authData?.user;
    if (getUserError || !user) {
      logger.warn("User not found for activation link resend", {
        email,
        error: getUserError && typeof getUserError === "object" && "message" in getUserError ? (getUserError as { message: string }).message : undefined,
      });
      // Don't reveal if user exists or not for security
      return jsonResponse({
        success: true,
        message: "If an account exists with this email, a verification link has been sent.",
      });
    }

    // 2. Check if user is already verified
    if (user.email_confirmed_at) {
      logger.info("User already verified, skipping activation link resend", {
        email,
        userId: user.id,
      });
      return jsonResponse({
        success: true,
        message: "This email address has already been verified.",
      });
    }

    // 3. Get organization for the user to include in email
    const { data: orgUser, error: orgUserError } = await supabase
      .from("organization_user")
      .select("organization_id")
      .eq("email", email)
      .maybeSingle();

    let organizationName: string | undefined;
    if (orgUser && !orgUserError) {
      organizationName = await getOrganizationName(
        supabase,
        orgUser.organization_id,
      );
    }

    // 4. Generate new verification link
    // Use type "magiclink" for resending verification (one-time link, no password required)
    const siteUrl = Deno.env.get("SITE_URL") || "http://127.0.0.1:3000";
    const redirectTo = `${siteUrl}/verify-email?email=${encodeURIComponent(email)}`;

    const { data: linkData, error: verificationLinkError } = await supabase.auth
      .admin
      .generateLink({
        type: "magiclink",
        email: email,
        options: {
          redirectTo: redirectTo,
        },
      });

    if (verificationLinkError || !linkData?.properties?.action_link) {
      logger.error("Failed to generate verification link", verificationLinkError, {
        email,
        userId: user.id,
      });
      return errorResponse(
        "Failed to generate verification link. Please try again later.",
        500,
      );
    }

    // 5. Send verification email using custom template
    const emailResult = await sendEmailVerificationEmail(
      supabase,
      {
        email: email,
        verificationLink: linkData.properties.action_link,
        organizationName: organizationName,
        organizationId: orgUser?.organization_id ?? "",
      },
      false, // Don't throw on error - we'll handle it gracefully
    );

    if (!emailResult.success) {
      logger.error("Failed to send verification email", {
        email,
        userId: user.id,
        error: emailResult.error,
      });
      // Still return success to user (don't reveal email sending issues)
      // But log the error for debugging
      return jsonResponse({
        success: true,
        message: "If an account exists with this email, a verification link has been sent.",
      });
    }

    logger.info("Activation link resent successfully", {
      email,
      userId: user.id,
      emailId: emailResult.emailId,
    });

    return jsonResponse({
      success: true,
      message: "Verification email sent successfully. Please check your inbox.",
    });
  } catch (error) {
    logger.error("Resend activation link error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to resend activation link"),
      getErrorStatusCode(error),
    );
  }
});
