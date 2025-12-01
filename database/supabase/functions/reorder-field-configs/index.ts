import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const { organization_id, field_config_ids } = body;

    if (!organization_id || !Array.isArray(field_config_ids)) {
      return errorResponse(
        "Organization ID and field_config_ids array are required",
        400
      );
    }

    const supabase = createServiceRoleClient();

    // Update order_position for each field config based on array index
    const updates = field_config_ids.map((id: string, index: number) =>
      supabase
        .from("organization_field_configs")
        .update({
          order_position: index,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organization_id", organization_id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter((result) => result.error);

    if (errors.length > 0) {
      throw new Error(
        `Failed to update some field configs: ${errors[0].error?.message}`
      );
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Reorder field configs error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to reorder field configs"
    );
  }
});
