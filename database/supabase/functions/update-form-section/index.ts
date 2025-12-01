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

    const { id, title, description, order_position, collapsed_by_default } =
      body;

    const supabase = createServiceRoleClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (order_position !== undefined)
      updateData.order_position = order_position;
    if (collapsed_by_default !== undefined)
      updateData.collapsed_by_default = collapsed_by_default;

    const { data: section, error: updateError } = await supabase
      .from("form_section")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      section,
    });
  } catch (error) {
    console.error("Update form section error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to update form section"
    );
  }
});
