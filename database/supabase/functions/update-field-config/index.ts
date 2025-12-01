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

    const {
      id,
      name,
      label,
      field_type,
      description,
      required,
      order_position,
      validation_rules,
      options,
      mutually_exclusive_group,
      group_cluster,
      section_id,
      conditional_logic,
    } = body;

    const supabase = createServiceRoleClient();

    // Validate group/cluster consistency
    if (group_cluster !== undefined && !mutually_exclusive_group) {
      return errorResponse(
        "Group cluster requires a mutually exclusive group to be set",
        400
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (label !== undefined) updateData.label = label;
    if (field_type !== undefined) updateData.field_type = field_type;
    if (description !== undefined) updateData.description = description;
    if (required !== undefined) updateData.required = required;
    if (order_position !== undefined)
      updateData.order_position = order_position;
    if (validation_rules !== undefined)
      updateData.validation_rules = validation_rules;
    if (options !== undefined) updateData.options = options;
    if (mutually_exclusive_group !== undefined)
      updateData.mutually_exclusive_group = mutually_exclusive_group || null;
    if (group_cluster !== undefined)
      updateData.group_cluster = group_cluster || null;
    if (section_id !== undefined) updateData.section_id = section_id || null;
    if (conditional_logic !== undefined)
      updateData.conditional_logic = conditional_logic || null;

    const { data: fieldConfig, error: updateError } = await supabase
      .from("organization_field_configs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      field_config: fieldConfig,
    });
  } catch (error) {
    console.error("Update field config error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to update field config"
    );
  }
});
