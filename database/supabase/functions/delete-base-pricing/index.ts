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
      return errorResponse("ID is required", 400);
    }

    const { id } = body;

    const supabase = createServiceRoleClient();

    const { error: deleteError } = await supabase
      .from("base_pricing")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Delete base pricing error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to delete base pricing"
    );
  }
});
