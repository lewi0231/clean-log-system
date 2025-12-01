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

    const {
      organization_id,
      invoice_title,
      show_logo,
      show_abn,
      bill_to_fields,
      line_item_display,
    } = body;

    const supabase = createServiceRoleClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Validate and add invoice_title
    if (invoice_title !== undefined) {
      if (
        typeof invoice_title !== "string" ||
        invoice_title.trim().length === 0
      ) {
        return errorResponse("Invoice title cannot be empty", 400);
      }
      updateData.invoice_title = invoice_title.trim();
    }

    // Validate and add show_logo
    if (show_logo !== undefined) {
      if (typeof show_logo !== "boolean") {
        return errorResponse("show_logo must be a boolean", 400);
      }
      updateData.show_logo = show_logo;
    }

    // Validate and add show_abn
    if (show_abn !== undefined) {
      if (typeof show_abn !== "boolean") {
        return errorResponse("show_abn must be a boolean", 400);
      }
      updateData.show_abn = show_abn;
    }

    // Validate and add bill_to_fields
    if (bill_to_fields !== undefined) {
      if (!Array.isArray(bill_to_fields)) {
        return errorResponse("bill_to_fields must be an array", 400);
      }
      // Validate all items are strings
      if (!bill_to_fields.every((item) => typeof item === "string")) {
        return errorResponse("bill_to_fields must be an array of strings", 400);
      }
      updateData.bill_to_fields = bill_to_fields;
    }

    // Validate and add line_item_display
    if (line_item_display !== undefined) {
      if (typeof line_item_display !== "object" || line_item_display === null) {
        return errorResponse("line_item_display must be an object", 400);
      }

      // Validate line_item_display structure
      if (
        line_item_display.include_option_value !== undefined &&
        typeof line_item_display.include_option_value !== "boolean"
      ) {
        return errorResponse(
          "line_item_display.include_option_value must be a boolean",
          400
        );
      }

      if (
        line_item_display.description_format !== undefined &&
        typeof line_item_display.description_format !== "string"
      ) {
        return errorResponse(
          "line_item_display.description_format must be a string",
          400
        );
      }

      if (
        line_item_display.show_base_price_separately !== undefined &&
        typeof line_item_display.show_base_price_separately !== "boolean"
      ) {
        return errorResponse(
          "line_item_display.show_base_price_separately must be a boolean",
          400
        );
      }

      updateData.line_item_display = line_item_display;
    }

    // Check if config exists
    const { data: existingConfig } = await supabase
      .from("invoice_template_config")
      .select("id")
      .eq("organization_id", organization_id)
      .single();

    let config;
    if (existingConfig) {
      // Update existing config
      const { data: updatedConfig, error: updateError } = await supabase
        .from("invoice_template_config")
        .update(updateData)
        .eq("organization_id", organization_id)
        .select()
        .single();

      if (updateError) throw updateError;
      config = updatedConfig;
    } else {
      // Create new config with defaults
      const newConfig = {
        organization_id,
        invoice_title: invoice_title ?? "Tax Invoice",
        show_logo: show_logo ?? true,
        show_abn: show_abn ?? true,
        bill_to_fields: bill_to_fields ?? [],
        line_item_display: line_item_display ?? {
          include_option_value: true,
          description_format: "{field_label}: {option_value}",
          show_base_price_separately: true,
        },
        ...updateData,
      };

      const { data: createdConfig, error: insertError } = await supabase
        .from("invoice_template_config")
        .insert(newConfig)
        .select()
        .single();

      if (insertError) throw insertError;
      config = createdConfig;
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
    console.error("Update invoice template config error:", error);
    return errorResponse(
      error instanceof Error
        ? error
        : "Failed to update invoice template config"
    );
  }
});
