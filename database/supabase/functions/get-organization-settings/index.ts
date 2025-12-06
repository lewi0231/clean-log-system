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

    const { data: organization, error: orgError } = await supabase
      .from("organization")
      .select(
        "name, use_predefined_locations, business_mode, abn, logo_url, primary_contact_email, invoice_send_immediately, feedback_email_send_immediately, stripe_account_id, payment_provider, currency, locale, default_exclusive_group_label",
      )
      .eq("id", organization_id)
      .single();

    if (orgError) throw orgError;

    return jsonResponse({
      success: true,
      settings: {
        name: organization?.name ?? "",
        use_predefined_locations: organization?.use_predefined_locations ??
          true,
        business_mode: organization?.business_mode ?? "service_based",
        abn: organization?.abn ?? null,
        logo_url: organization?.logo_url ?? null,
        primary_contact_email: organization?.primary_contact_email ?? null,
        invoice_send_immediately: organization?.invoice_send_immediately ??
          false,
        feedback_email_send_immediately:
          organization?.feedback_email_send_immediately ?? false,
        stripe_account_id: organization?.stripe_account_id ?? null,
        payment_provider: organization?.payment_provider ?? null,
        currency: organization?.currency ?? "AUD",
        locale: organization?.locale ?? "en-AU",
        default_exclusive_group_label:
          organization?.default_exclusive_group_label ?? null,
      },
    });
  } catch (error) {
    console.error("Get organization settings error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to get organization settings",
    );
  }
});
