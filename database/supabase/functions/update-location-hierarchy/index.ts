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
      return errorResponse("Node ID is required", 400);
    }

    const { id, name, metadata } = body;

    const supabase = createServiceRoleClient();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (metadata !== undefined) updateData.metadata = metadata;

    if (Object.keys(updateData).length === 0) {
      return errorResponse("No fields to update", 400);
    }

    const { data: node, error: updateError } = await supabase
      .from("location_hierarchy")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      node,
    });
  } catch (error) {
    console.error("Update location hierarchy error:", error);
    return errorResponse(
      error instanceof Error
        ? error
        : "Failed to update location hierarchy node"
    );
  }
});
