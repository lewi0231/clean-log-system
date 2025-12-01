import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["id"]);

    if (!validation.valid) {
      return errorResponse("Organization user ID is required", 400);
    }

    const { id } = body;

    const supabase = createServiceRoleClient();

    // Check how many admins exist for this organization
    const { data: userToDelete, error: fetchError } = await supabase
      .from("organization_user")
      .select("organization_id, role")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    if (userToDelete.role === "admin") {
      const { data: admins, error: countError } = await supabase
        .from("organization_user")
        .select("id")
        .eq("organization_id", userToDelete.organization_id)
        .eq("role", "admin");

      if (countError) throw countError;

      if (admins && admins.length <= 1) {
        return errorResponse(
          "Cannot delete the last admin user. Please assign another admin first.",
          400
        );
      }
    }

    const { error: deleteError } = await supabase
      .from("organization_user")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Delete organization user error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to delete organization user"
    );
  }
});
