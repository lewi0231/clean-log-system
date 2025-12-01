import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const { organization_id } = body;

    const supabase = createServiceRoleClient();

    // Fetch existing config
    let { data: config, error: configError } = await supabase
      .from("invoice_template_config")
      .select("*")
      .eq("organization_id", organization_id)
      .single();

    // If config doesn't exist, create default one
    if (configError && configError.code === "PGRST116") {
      const defaultConfig = {
        organization_id,
        invoice_title: "Tax Invoice",
        show_logo: true,
        show_abn: true,
        bill_to_fields: [],
        line_item_display: {
          include_option_value: true,
          description_format: "{field_label}: {option_value}",
          show_base_price_separately: true,
        },
      };

      const { data: newConfig, error: insertError } = await supabase
        .from("invoice_template_config")
        .insert(defaultConfig)
        .select()
        .single();

      if (insertError) throw insertError;
      config = newConfig;
    } else if (configError) {
      throw configError;
    }

    return jsonResponse({
      success: true,
      config: {
        id: config.id,
        organization_id: config.organization_id,
        invoice_title: config.invoice_title ?? "Tax Invoice",
        show_logo: config.show_logo ?? true,
        show_abn: config.show_abn ?? true,
        bill_to_fields: config.bill_to_fields ?? [],
        line_item_display: config.line_item_display ?? {
          include_option_value: true,
          description_format: "{field_label}: {option_value}",
          show_base_price_separately: true,
        },
        created_at: config.created_at,
        updated_at: config.updated_at,
      },
    });
  } catch (error) {
    console.error("Get invoice template config error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to get invoice template config"
    );
  }
});
