import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields, validateRole } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "email",
      "role",
    ]);

    if (!validation.valid) {
      return errorResponse("Missing required fields", 400);
    }

    const { organization_id, email, role } = body;

    // Validate role
    if (!validateRole(role)) {
      return errorResponse("Invalid role. Must be 'admin' or 'viewer'", 400);
    }

    const supabase = createServiceRoleClient();

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

    // Try to get existing auth user by email
    // Note: We'll create the auth user if it doesn't exist, but for now
    // we'll just create the organization_user entry. The auth user can
    // be created when they first log in or via password reset.
    // This allows admins to invite users who don't have accounts yet.

    // Create organization_user entry
    const { data: organizationUser, error: createError } = await supabase
      .from("organization_user")
      .insert({
        organization_id,
        email,
        role,
      })
      .select()
      .single();

    if (createError) throw createError;

    return jsonResponse({
      success: true,
      organization_user: organizationUser,
    });
  } catch (error) {
    console.error("Create organization user error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to create organization user"
    );
  }
});
