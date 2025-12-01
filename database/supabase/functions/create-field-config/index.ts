import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, [
      "organization_id",
      "name",
      "label",
      "field_type",
    ]);

    if (!validation.valid) {
      return errorResponse("Missing required fields", 400);
    }

    const {
      organization_id,
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
    } = body;

    const supabase = createServiceRoleClient();

    // Validate group/cluster consistency
    if (group_cluster && !mutually_exclusive_group) {
      return errorResponse(
        "Group cluster requires a mutually exclusive group to be set",
        400
      );
    }

    // If order_position not provided, get the max and add 1
    let finalOrderPosition = order_position;
    if (finalOrderPosition === undefined || finalOrderPosition === null) {
      const { data: existingConfigs } = await supabase
        .from("organization_field_configs")
        .select("order_position")
        .eq("organization_id", organization_id)
        .eq("active", true)
        .order("order_position", { ascending: false })
        .limit(1)
        .maybeSingle();

      finalOrderPosition = existingConfigs?.order_position
        ? existingConfigs.order_position + 1
        : 0;
    }

    const { data: fieldConfig, error: createError } = await supabase
      .from("organization_field_configs")
      .insert({
        organization_id,
        name,
        label,
        field_type,
        description: description || null,
        required: required || false,
        order_position: finalOrderPosition,
        validation_rules: validation_rules || null,
        options: options || null,
        mutually_exclusive_group: mutually_exclusive_group || null,
        group_cluster: group_cluster || null,
        active: true,
      })
      .select()
      .single();

    if (createError) throw createError;

    return jsonResponse({
      success: true,
      field_config: fieldConfig,
    });
  } catch (error) {
    console.error("Create field config error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to create field config"
    );
  }
});
