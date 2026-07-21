import { serve } from "server";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { requireAuthenticatedOrgMember } from "../_utils/require-authenticated-org-member.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "get-organization-settings" });
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

    const { data: organization, error: orgError } = await supabase
      .from("organization")
      .select(
        "name, use_predefined_locations, business_mode, abn, logo_url, primary_contact_email, primary_contact_phone, business_address, invoice_send_immediately, feedback_requests_enabled, feedback_auto_send, feedback_request_mode, public_review_url, feedback_email_subject, feedback_email_body, feedback_email_reply_to, feedback_send_delay_hours, rating_config, stripe_account_id, payment_provider, currency, locale, default_exclusive_group_label, custom_email_domain_enabled, colleague_confirmation_timeout_hours"
      )
      .eq("id", organization_id)
      .single();

    if (orgError) throw orgError;

    // Fetch organization_settings for additional settings
    const { data: orgSettings, error: orgSettingsError } = await supabase
      .from("organization_settings")
      .select(
        "auto_generate_invoices_immediately, bank_transfer_bsb, bank_transfer_account_number, bank_transfer_account_name, show_bank_transfer_on_invoices, default_invoice_due_days, gst_registered, gst_inclusive, gst_rate_percent, edit_window_minutes, worker_payment_cycle_config, workforce_engagement"
      )
      .eq("organization_id", organization_id)
      .maybeSingle();

    // Don't throw if settings don't exist - they might not be created yet
    if (orgSettingsError && orgSettingsError.code !== "PGRST116") {
      // PGRST116 is "not found" which is OK
      logger.warn("Error fetching organization_settings", {
        error: orgSettingsError.message,
      });
    }

    // Parse rating_config with default fallback
    let ratingConfig = {
      type: "single" as const,
      dimensions: ["overall"],
    };
    if (organization?.rating_config) {
      try {
        const parsed =
          typeof organization.rating_config === "string"
            ? JSON.parse(organization.rating_config)
            : organization.rating_config;
        if (parsed && typeof parsed === "object" && "type" in parsed && "dimensions" in parsed) {
          ratingConfig = parsed;
        }
      } catch {
        // Use default if parsing fails
      }
    }

    return jsonResponse({
      success: true,
      settings: {
        name: organization?.name ?? "",
        use_predefined_locations: organization?.use_predefined_locations ?? true,
        business_mode: organization?.business_mode ?? "service_based",
        abn: organization?.abn ?? null,
        logo_url: organization?.logo_url ?? null,
        primary_contact_email: organization?.primary_contact_email ?? null,
        primary_contact_phone: organization?.primary_contact_phone ?? null,
        business_address: organization?.business_address ?? null,
        invoice_send_immediately: organization?.invoice_send_immediately ?? false,
        feedback_requests_enabled: organization?.feedback_requests_enabled ?? true,
        feedback_auto_send: organization?.feedback_auto_send ?? false,
        feedback_request_mode: organization?.feedback_request_mode ?? "internal",
        public_review_url: organization?.public_review_url ?? null,
        feedback_email_subject: organization?.feedback_email_subject ?? null,
        feedback_email_body: organization?.feedback_email_body ?? null,
        feedback_email_reply_to: organization?.feedback_email_reply_to ?? null,
        feedback_send_delay_hours: organization?.feedback_send_delay_hours ?? 0,
        rating_config: ratingConfig,
        stripe_account_id: organization?.stripe_account_id ?? null,
        payment_provider: organization?.payment_provider ?? null,
        currency: organization?.currency ?? "AUD",
        locale: organization?.locale ?? "en-AU",
        default_exclusive_group_label: organization?.default_exclusive_group_label ?? null,
        custom_email_domain_enabled: organization?.custom_email_domain_enabled ?? false,
        auto_generate_invoices_immediately:
          orgSettings?.auto_generate_invoices_immediately ?? false,
        bank_transfer_bsb: orgSettings?.bank_transfer_bsb ?? null,
        bank_transfer_account_number: orgSettings?.bank_transfer_account_number ?? null,
        bank_transfer_account_name: orgSettings?.bank_transfer_account_name ?? null,
        show_bank_transfer_on_invoices: orgSettings?.show_bank_transfer_on_invoices ?? true,
        default_invoice_due_days: orgSettings?.default_invoice_due_days ?? 30,
        gst_registered: orgSettings?.gst_registered ?? false,
        gst_inclusive: orgSettings?.gst_inclusive ?? true,
        gst_rate_percent: orgSettings?.gst_rate_percent ?? 10,
        edit_window_minutes: orgSettings?.edit_window_minutes ?? 180,
        colleague_confirmation_timeout_hours:
          organization?.colleague_confirmation_timeout_hours ?? 24,
        worker_payment_cycle_config: orgSettings?.worker_payment_cycle_config ?? null,
        workforce_engagement: orgSettings?.workforce_engagement ?? "employees",
      },
    });
  } catch (error) {
    logger.error("Get organization settings error", error);
    return errorResponse(error instanceof Error ? error : "Failed to get organization settings");
  }
});
