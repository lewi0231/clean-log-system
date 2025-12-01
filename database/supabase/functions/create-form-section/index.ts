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
      "title",
    ]);

    if (!validation.valid) {
      return errorResponse("Missing required fields", 400);
    }

    const {
      organization_id,
      title,
      description,
      order_position,
      collapsed_by_default,
    } = body;

    const supabase = createServiceRoleClient();

    // If order_position not provided, get the max and add 1
    let finalOrderPosition = order_position;
    if (finalOrderPosition === undefined || finalOrderPosition === null) {
      const { data: existingSections } = await supabase
        .from("form_section")
        .select("order_position")
        .eq("organization_id", organization_id)
        .order("order_position", { ascending: false })
        .limit(1)
        .maybeSingle();

      finalOrderPosition = existingSections?.order_position
        ? existingSections.order_position + 1
        : 0;
    }

    const { data: section, error: createError } = await supabase
      .from("form_section")
      .insert({
        organization_id,
        title,
        description: description || null,
        order_position: finalOrderPosition,
        collapsed_by_default: collapsed_by_default || false,
      })
      .select()
      .single();

    if (createError) throw createError;

    return jsonResponse({
      success: true,
      section,
    });
  } catch (error) {
    console.error("Create form section error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to create form section"
    );
  }
});
