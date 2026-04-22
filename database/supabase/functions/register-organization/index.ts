import type { SupabaseClient } from "@supabase/supabase-js";
import { serve } from "server";
import {
  getOrganizationName,
  sendEmailVerificationEmail,
} from "../_utils/email.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

function generateOrgCode(businessName: string): string {
  // Take first 4 letters, uppercase
  let code = businessName
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 4)
    .toUpperCase();

  // Pad with X if less than 4
  while (code.length < 4) {
    code += "X";
  }

  return code;
}

async function ensureUniqueOrgCode(
  supabase: SupabaseClient,
  baseCode: string,
): Promise<string> {
  let code = baseCode;
  let counter = 1;

  while (true) {
    const { data } = await supabase
      .from("organization")
      .select("id")
      .eq("org_code", code)
      .maybeSingle();

    if (!data) return code; // Available!

    // Try: ACME -> ACM1, ACM2...
    code = baseCode.substring(0, 3) + counter;
    counter++;
  }
}

serve(async (req) => {
  const logger = createLogger(req, { functionName: "register-organization" });
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const { organisation: business_name, email: admin_email, password } = body;

    const validation = validateRequiredFields(body, [
      "organisation",
      "email",
      "password",
    ]);

    if (!validation.valid) {
      return errorResponse("Missing required fields", 400);
    }

    const supabase = createServiceRoleClient();

    // Generate unique org code
    const baseCode = generateOrgCode(business_name);
    const orgCode = await ensureUniqueOrgCode(supabase, baseCode);

    // Calculate trial end date (30 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    // 1. Create organization
    const { data: org, error: orgError } = await supabase
      .from("organization")
      .insert({
        name: business_name,
        org_code: orgCode,
        trial_ends_at: trialEndsAt.toISOString(),
        primary_contact_email: admin_email,
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // 2. Create admin user in Supabase Auth
    // email_confirm: false requires email verification before full access
    const { data: authData, error: authError } = await supabase.auth.admin
      .createUser({
        email: admin_email,
        password: password,
        email_confirm: false, // Require email verification
      });

    if (authError) throw authError;

    // 3. Generate verification link
    // Get the site URL from environment or use a default
    const siteUrl = Deno.env.get("SITE_URL") || "http://127.0.0.1:3000";
    const redirectTo = `${siteUrl}/verify-email?email=${
      encodeURIComponent(admin_email)
    }`;

    const { data: linkData, error: verificationLinkError } = await supabase.auth
      .admin
      .generateLink({
        type: "signup",
        email: admin_email,
        password: password, // Required for signup type
        options: {
          redirectTo: redirectTo,
        },
      });

    if (verificationLinkError) {
      logger.warn("Failed to generate verification link", {
        error: verificationLinkError.message,
      });
      // Don't fail registration if link generation fails - user can request resend later
    } else if (linkData?.properties?.action_link) {
      // 4. Send verification email
      const orgName = await getOrganizationName(supabase, org.id);
      await sendEmailVerificationEmail(
        supabase,
        {
          email: admin_email,
          verificationLink: linkData.properties.action_link,
          organizationName: orgName,
          organizationId: org.id,
        },
        false, // Don't throw on error - registration succeeded even if email fails
      );
    }

    // 5. Link user to organization (include auth_user_id so RLS policies work)
    // Normalize email to lowercase for consistent lookup (auth may normalize differently)
    const { error: _orgUserLinkError } = await supabase
      .from("organization_user")
      .insert({
        organization_id: org.id,
        email: admin_email.trim().toLowerCase(),
        role: "admin",
        auth_user_id: authData.user?.id ?? null,
        status: "active",
        activated_at: new Date().toISOString(),
      });

    if (_orgUserLinkError) throw _orgUserLinkError;

    // 6. Return success with org code
    return jsonResponse({
      success: true,
      message: "Organization created successfully",
      organization: {
        id: org.id,
        name: org.name,
        org_code: orgCode,
      },
      admin_email: admin_email,
      // Show org_code prominently - employees will need this
      instructions:
        `Your organization code is: ${orgCode}. Give this to your employees for mobile app login.`,
    });
  } catch (error) {
    logger.error("Registration error", error);
    return errorResponse(
      error instanceof Error ? error : "Registration failed",
    );
  }
});
