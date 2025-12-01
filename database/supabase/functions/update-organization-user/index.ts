import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields, validateRole } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      return errorResponse("Organization user ID is required", 400);
    }

    const { id, role } = body;

    const updateData: { role?: string } = {};

    if (role !== undefined) {
      // Validate role
      if (!validateRole(role)) {
        return errorResponse("Invalid role. Must be 'admin' or 'viewer'", 400);
      }
      updateData.role = role;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse("At least one field must be provided", 400);
    }

    const supabase = createServiceRoleClient();

    const { data: organizationUser, error: updateError } = await supabase
      .from("organization_user")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      organization_user: organizationUser,
    });
  } catch (error) {
    console.error("Update organization user error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to update organization user"
    );
  }
});
