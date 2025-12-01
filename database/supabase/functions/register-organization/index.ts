import type { SupabaseClient } from "@supabase/supabase-js";
import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
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
  baseCode: string
): Promise<string> {
  let code = baseCode;
  let counter = 1;

  while (true) {
    const { data } = await supabase
      .from("organizations")
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
    const { data: _authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: admin_email,
        password: password,
        email_confirm: true, // Auto-confirm for now (add email verification later)
      });

    if (authError) throw authError;

    // 3. Link user to organization
    const { error: linkError } = await supabase
      .from("organization_user")
      .insert({
        organization_id: org.id,
        email: admin_email,
        role: "admin",
      });

    if (linkError) throw linkError;

    // 4. Return success with org code
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
      instructions: `Your organization code is: ${orgCode}. Give this to your employees for mobile app login.`,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return errorResponse(
      error instanceof Error ? error : "Registration failed"
    );
  }
});
