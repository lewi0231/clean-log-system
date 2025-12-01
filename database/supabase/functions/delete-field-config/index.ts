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

    // TODO - think about the logic here - we're hard deleting - may want to archive in the future. Or warn the user that all this data will be lost.
    const { error: deleteError } = await supabase
      .from("organization_field_configs")
      .delete()
      // .update({
      //   active: false,
      //   archived_at: new Date().toISOString(),
      //   updated_at: new Date().toISOString(),
      // })
      .eq("id", id);

    if (deleteError) throw deleteError;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Delete field config error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to delete field config"
    );
  }
});
