import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import {
  DEFAULT_BILLING_ADDRESS_CONFIG,
  DEFAULT_EMAIL_RECIPIENT_CONFIG,
  DEFAULT_INVOICE_TITLE,
  DEFAULT_LINE_ITEM_DISPLAY,
  DEFAULT_SERVICE_ADDRESS_CONFIG,
  getDefaultInvoiceTemplateConfig,
} from "../_utils/invoice-template-defaults.ts";
import { createLogger } from "../_utils/logger.ts";
import { requireAuthenticatedOrgMember } from "../_utils/require-authenticated-org-member.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "get-invoice-template-config" });
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

    const orgGate = await requireAuthenticatedOrgMember(req, organization_id, supabase);
    if (!orgGate.ok) {
      if (orgGate.response.status === 403) {
        logger.warn("Unauthorized organization access attempt", {
          organization_id,
        });
      }
      return orgGate.response;
    }

    // Fetch existing config
    let { data: config, error: configError } = await supabase
      .from("invoice_template_config")
      .select("*")
      .eq("organization_id", organization_id)
      .single();

    // If config doesn't exist, create default one
    if (configError && configError.code === "PGRST116") {
      const defaultConfig = getDefaultInvoiceTemplateConfig(organization_id);

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
        invoice_title: config.invoice_title ?? DEFAULT_INVOICE_TITLE,
        show_logo: config.show_logo ?? true,
        show_abn: config.show_abn ?? true,
        bill_to_fields: config.bill_to_fields ?? [],
        service_address_config: config.service_address_config ?? DEFAULT_SERVICE_ADDRESS_CONFIG,
        billing_address_config: config.billing_address_config ?? DEFAULT_BILLING_ADDRESS_CONFIG,
        email_recipient_config: config.email_recipient_config ?? DEFAULT_EMAIL_RECIPIENT_CONFIG,
        line_item_display: config.line_item_display ?? DEFAULT_LINE_ITEM_DISPLAY,
        created_at: config.created_at,
        updated_at: config.updated_at,
      },
    });
  } catch (error) {
    logger.error("Get invoice template config error", error);
    return errorResponse(error instanceof Error ? error : "Failed to get invoice template config");
  }
});
