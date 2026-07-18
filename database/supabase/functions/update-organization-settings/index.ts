import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateBusinessMode, validateRequiredFields } from "../_utils/validation.ts";
import { isWorkforceEngagement } from "../_utils/workforce-engagement.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "update-organization-settings",
  });

  try {
    const body = await req.json();
    const validation = validateRequiredFields(body, ["organization_id"]);

    if (!validation.valid) {
      return errorResponse("Organization ID is required", 400);
    }

    const {
      organization_id,
      use_predefined_locations,
      business_mode,
      name,
      abn,
      logo_url,
      primary_contact_email,
      primary_contact_phone,
      business_address,
      invoice_send_immediately,
      feedback_email_send_immediately,
      rating_config,
      stripe_account_id,
      payment_provider,
      currency,
      locale,
      default_exclusive_group_label,
      auto_generate_invoices_immediately,
      bank_transfer_bsb,
      bank_transfer_account_number,
      bank_transfer_account_name,
      show_bank_transfer_on_invoices,
      default_invoice_due_days,
      gst_registered,
      gst_inclusive,
      gst_rate_percent,
      edit_window_minutes,
      worker_payment_cycle_config,
      workforce_engagement,
    } = body;

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase
    );
    if (!membershipCheck) {
      return errorResponse("You do not have permission to access this organization", 403);
    }

    const updateData: Record<string, unknown> = {};

    if (use_predefined_locations !== undefined) {
      updateData.use_predefined_locations = use_predefined_locations;
    }

    if (business_mode !== undefined) {
      // Validate business_mode value
      if (!validateBusinessMode(business_mode)) {
        return errorResponse(
          "Invalid business_mode. Must be 'service_based' or 'resource_tracking'",
          400
        );
      }
      updateData.business_mode = business_mode;
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return errorResponse("Organization name cannot be empty", 400);
      }
      updateData.name = name.trim();
    }

    if (abn !== undefined) {
      updateData.abn = abn === "" ? null : abn;
    }

    if (logo_url !== undefined) {
      updateData.logo_url = logo_url === "" ? null : logo_url;
    }

    if (primary_contact_email !== undefined) {
      // Validate email format if provided
      if (primary_contact_email && primary_contact_email.trim() !== "") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(primary_contact_email.trim())) {
          return errorResponse("Invalid email format", 400);
        }
        updateData.primary_contact_email = primary_contact_email.trim();
      } else {
        updateData.primary_contact_email = null;
      }
    }

    if (primary_contact_phone !== undefined) {
      updateData.primary_contact_phone =
        primary_contact_phone === "" ? null : primary_contact_phone.trim();
    }

    if (business_address !== undefined) {
      updateData.business_address = business_address === "" ? null : business_address.trim();
    }

    if (invoice_send_immediately !== undefined) {
      if (typeof invoice_send_immediately !== "boolean") {
        return errorResponse("invoice_send_immediately must be a boolean", 400);
      }
      updateData.invoice_send_immediately = invoice_send_immediately;
    }

    if (feedback_email_send_immediately !== undefined) {
      if (typeof feedback_email_send_immediately !== "boolean") {
        return errorResponse("feedback_email_send_immediately must be a boolean", 400);
      }
      updateData.feedback_email_send_immediately = feedback_email_send_immediately;
    }

    if (stripe_account_id !== undefined) {
      updateData.stripe_account_id = stripe_account_id === "" ? null : stripe_account_id;
    }

    if (payment_provider !== undefined) {
      // Validate payment provider if provided
      if (payment_provider && payment_provider.trim() !== "") {
        const validProviders = ["stripe"]; // TODO: Add more providers as they're implemented
        if (!validProviders.includes(payment_provider.trim().toLowerCase())) {
          return errorResponse(
            `Invalid payment provider. Must be one of: ${validProviders.join(", ")}`,
            400
          );
        }
        updateData.payment_provider = payment_provider.trim().toLowerCase();
      } else {
        updateData.payment_provider = null;
      }
    }

    if (currency !== undefined) {
      const validCurrencies = ["AUD", "USD", "GBP", "EUR", "CAD", "NZD"];
      if (!validCurrencies.includes(currency)) {
        return errorResponse(
          `Invalid currency. Must be one of: ${validCurrencies.join(", ")}`,
          400
        );
      }
      updateData.currency = currency;
    }

    if (locale !== undefined) {
      updateData.locale = locale;
    }

    if (default_exclusive_group_label !== undefined) {
      updateData.default_exclusive_group_label =
        default_exclusive_group_label === "" ? null : default_exclusive_group_label;
    }

    if (rating_config !== undefined) {
      // Validate rating_config structure
      if (typeof rating_config !== "object" || rating_config === null) {
        return errorResponse("rating_config must be an object with 'type' and 'dimensions'", 400);
      }
      if (!("type" in rating_config) || !("dimensions" in rating_config)) {
        return errorResponse("rating_config must have 'type' and 'dimensions' properties", 400);
      }
      const validTypes = ["single", "three_dimensions", "rater"];
      if (!validTypes.includes(rating_config.type)) {
        return errorResponse(`rating_config.type must be one of: ${validTypes.join(", ")}`, 400);
      }
      if (!Array.isArray(rating_config.dimensions)) {
        return errorResponse("rating_config.dimensions must be an array", 400);
      }
      updateData.rating_config = rating_config;
    }

    // Handle auto_generate_invoices_immediately (stored in organization_settings table)
    if (auto_generate_invoices_immediately !== undefined) {
      if (typeof auto_generate_invoices_immediately !== "boolean") {
        return errorResponse("auto_generate_invoices_immediately must be a boolean", 400);
      }

      // Get or create organization_settings record
      const { data: existingSettings } = await supabase
        .from("organization_settings")
        .select("id")
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (existingSettings) {
        const { error: settingsError } = await supabase
          .from("organization_settings")
          .update({
            auto_generate_invoices_immediately: auto_generate_invoices_immediately,
          })
          .eq("id", existingSettings.id);

        if (settingsError) {
          logger.error("Failed to update auto_generate_invoices_immediately", {
            error: settingsError,
          });
          // Don't throw - continue with other updates
        }
      } else {
        const { error: settingsError } = await supabase.from("organization_settings").insert({
          organization_id,
          auto_generate_invoices_immediately: auto_generate_invoices_immediately,
        });

        if (settingsError) {
          logger.error("Failed to create auto_generate_invoices_immediately", {
            error: settingsError,
          });
          // Don't throw - continue with other updates
        }
      }
    }

    // Handle bank transfer details (stored in organization_settings table)
    if (
      bank_transfer_bsb !== undefined ||
      bank_transfer_account_number !== undefined ||
      bank_transfer_account_name !== undefined ||
      show_bank_transfer_on_invoices !== undefined
    ) {
      // Validate BSB format if provided (Australian format: XXX-XXX)
      if (bank_transfer_bsb !== undefined && bank_transfer_bsb !== null) {
        const trimmedBsb = typeof bank_transfer_bsb === "string" ? bank_transfer_bsb.trim() : "";
        if (trimmedBsb && !/^\d{3}-\d{3}$/.test(trimmedBsb)) {
          return errorResponse("BSB must be in format XXX-XXX (e.g., 123-456)", 400);
        }
      }

      // Validate account number if provided
      if (bank_transfer_account_number !== undefined && bank_transfer_account_number !== null) {
        const trimmedAccount =
          typeof bank_transfer_account_number === "string"
            ? bank_transfer_account_number.trim()
            : "";
        if (
          trimmedAccount &&
          (!/^\d+$/.test(trimmedAccount) || trimmedAccount.length < 6 || trimmedAccount.length > 10)
        ) {
          return errorResponse("Account number must be 6-10 digits", 400);
        }
      }

      // Get or create organization_settings record
      const { data: existingSettings } = await supabase
        .from("organization_settings")
        .select("id")
        .eq("organization_id", organization_id)
        .maybeSingle();

      const settingsUpdate: Record<string, unknown> = {};

      if (bank_transfer_bsb !== undefined) {
        settingsUpdate.bank_transfer_bsb =
          typeof bank_transfer_bsb === "string" && bank_transfer_bsb.trim()
            ? bank_transfer_bsb.trim()
            : null;
      }
      if (bank_transfer_account_number !== undefined) {
        settingsUpdate.bank_transfer_account_number =
          typeof bank_transfer_account_number === "string" && bank_transfer_account_number.trim()
            ? bank_transfer_account_number.trim()
            : null;
      }
      if (bank_transfer_account_name !== undefined) {
        settingsUpdate.bank_transfer_account_name =
          typeof bank_transfer_account_name === "string" && bank_transfer_account_name.trim()
            ? bank_transfer_account_name.trim()
            : null;
      }
      if (show_bank_transfer_on_invoices !== undefined) {
        if (typeof show_bank_transfer_on_invoices !== "boolean") {
          return errorResponse("show_bank_transfer_on_invoices must be a boolean", 400);
        }
        settingsUpdate.show_bank_transfer_on_invoices = show_bank_transfer_on_invoices;
      }

      if (default_invoice_due_days !== undefined) {
        const days = Number(default_invoice_due_days);
        if (isNaN(days) || days < 1 || days > 365) {
          return errorResponse("default_invoice_due_days must be a number between 1 and 365", 400);
        }
        settingsUpdate.default_invoice_due_days = days;
      }

      if (edit_window_minutes !== undefined) {
        const minutes = Number(edit_window_minutes);
        if (isNaN(minutes) || minutes < 15 || minutes > 1440) {
          return errorResponse("edit_window_minutes must be a number between 15 and 1440", 400);
        }
        settingsUpdate.edit_window_minutes = minutes;
      }

      if (existingSettings) {
        const { error: settingsError } = await supabase
          .from("organization_settings")
          .update(settingsUpdate)
          .eq("id", existingSettings.id);

        if (settingsError) {
          logger.error("Failed to update bank transfer settings", {
            error: settingsError,
          });
          // Don't throw - continue with other updates
        }
      } else {
        const { error: settingsError } = await supabase.from("organization_settings").insert({
          organization_id,
          ...settingsUpdate,
        });

        if (settingsError) {
          logger.error("Failed to create bank transfer settings", {
            error: settingsError,
          });
          // Don't throw - continue with other updates
        }
      }
    }

    // Handle GST settings (stored in organization_settings table)
    if (
      gst_registered !== undefined ||
      gst_inclusive !== undefined ||
      gst_rate_percent !== undefined
    ) {
      if (gst_rate_percent !== undefined) {
        const rate = Number(gst_rate_percent);
        if (isNaN(rate) || rate < 0 || rate > 100) {
          return errorResponse("gst_rate_percent must be a number between 0 and 100", 400);
        }
      }

      const { data: existingGstSettings } = await supabase
        .from("organization_settings")
        .select("id")
        .eq("organization_id", organization_id)
        .maybeSingle();

      const gstUpdate: Record<string, unknown> = {};
      if (gst_registered !== undefined) {
        if (typeof gst_registered !== "boolean") {
          return errorResponse("gst_registered must be a boolean", 400);
        }
        gstUpdate.gst_registered = gst_registered;
      }
      if (gst_inclusive !== undefined) {
        if (typeof gst_inclusive !== "boolean") {
          return errorResponse("gst_inclusive must be a boolean", 400);
        }
        gstUpdate.gst_inclusive = gst_inclusive;
      }
      if (gst_rate_percent !== undefined) {
        gstUpdate.gst_rate_percent = Number(gst_rate_percent);
      }

      if (existingGstSettings) {
        const { error: gstError } = await supabase
          .from("organization_settings")
          .update(gstUpdate)
          .eq("id", existingGstSettings.id);

        if (gstError) {
          logger.error("Failed to update GST settings", { error: gstError });
        }
      } else {
        const { error: gstError } = await supabase.from("organization_settings").insert({
          organization_id,
          ...gstUpdate,
        });

        if (gstError) {
          logger.error("Failed to create organization_settings with GST", {
            error: gstError,
          });
        }
      }
    }

    // Handle worker pay period config (organization_settings.worker_payment_cycle_config JSONB)
    if (worker_payment_cycle_config !== undefined) {
      if (worker_payment_cycle_config !== null && typeof worker_payment_cycle_config !== "object") {
        return errorResponse("worker_payment_cycle_config must be an object or null", 400);
      }

      if (worker_payment_cycle_config !== null) {
        const cfg = worker_payment_cycle_config as Record<string, unknown>;
        const freq = cfg.payment_frequency;
        if (freq != null && freq !== "weekly" && freq !== "fortnightly" && freq !== "monthly") {
          return errorResponse(
            "worker_payment_cycle_config.payment_frequency must be weekly, fortnightly, or monthly",
            400
          );
        }
        const dow = cfg.payment_day_of_week;
        if (dow != null) {
          const n = Number(dow);
          if (isNaN(n) || !Number.isInteger(n) || n < 1 || n > 7) {
            return errorResponse(
              "worker_payment_cycle_config.payment_day_of_week must be 1–7 (ISO: Mon=1 … Sun=7)",
              400
            );
          }
        }
        const dom = cfg.payment_day_of_month;
        if (dom != null) {
          const n = Number(dom);
          if (isNaN(n) || !Number.isInteger(n) || n < 1 || n > 31) {
            return errorResponse(
              "worker_payment_cycle_config.payment_day_of_month must be 1–31",
              400
            );
          }
        }
        const tz = cfg.timezone;
        if (tz != null && typeof tz === "string" && tz.trim()) {
          try {
            new Intl.DateTimeFormat("en-US", { timeZone: tz.trim() });
          } catch {
            return errorResponse(
              "worker_payment_cycle_config.timezone must be a valid IANA time zone",
              400
            );
          }
        } else if (tz != null && typeof tz !== "string") {
          return errorResponse(
            "worker_payment_cycle_config.timezone must be a string or null",
            400
          );
        }
      }

      const { data: existingPaySettings } = await supabase
        .from("organization_settings")
        .select("id")
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (existingPaySettings) {
        const { error: payErr } = await supabase
          .from("organization_settings")
          .update({
            worker_payment_cycle_config,
          })
          .eq("id", existingPaySettings.id);

        if (payErr) {
          logger.error("Failed to update worker_payment_cycle_config", {
            error: payErr,
          });
        }
      } else {
        const { error: payErr } = await supabase.from("organization_settings").insert({
          organization_id,
          worker_payment_cycle_config,
        });

        if (payErr) {
          logger.error("Failed to create organization_settings with pay period", {
            error: payErr,
          });
        }
      }
    }

    // Handle workforce_engagement (organization_settings)
    if (workforce_engagement !== undefined) {
      if (!isWorkforceEngagement(workforce_engagement)) {
        return errorResponse("workforce_engagement must be employees, contractors, or both", 400);
      }

      const { data: existingEngagementSettings } = await supabase
        .from("organization_settings")
        .select("id")
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (existingEngagementSettings) {
        const { error: engErr } = await supabase
          .from("organization_settings")
          .update({ workforce_engagement })
          .eq("id", existingEngagementSettings.id);

        if (engErr) {
          logger.error("Failed to update workforce_engagement", { error: engErr });
          return errorResponse("Failed to update workforce engagement", 500);
        }
      } else {
        const { error: engErr } = await supabase.from("organization_settings").insert({
          organization_id,
          workforce_engagement,
        });

        if (engErr) {
          logger.error("Failed to create organization_settings with workforce_engagement", {
            error: engErr,
          });
          return errorResponse("Failed to save workforce engagement", 500);
        }
      }
    }

    // Only update organization table if there are fields to update
    let organization = null;
    if (Object.keys(updateData).length > 0) {
      const { data: orgData, error: updateError } = await supabase
        .from("organization")
        .update(updateData)
        .eq("id", organization_id)
        .select(
          "name, use_predefined_locations, business_mode, abn, logo_url, primary_contact_email, primary_contact_phone, business_address, invoice_send_immediately, feedback_email_send_immediately, rating_config, stripe_account_id, payment_provider, currency, locale, default_exclusive_group_label"
        )
        .single();

      if (updateError) throw updateError;
      organization = orgData;
    } else {
      // If no organization fields to update, just fetch the current organization data
      const { data: orgData, error: fetchError } = await supabase
        .from("organization")
        .select(
          "name, use_predefined_locations, business_mode, abn, logo_url, primary_contact_email, primary_contact_phone, business_address, invoice_send_immediately, feedback_email_send_immediately, rating_config, stripe_account_id, payment_provider, currency, locale, default_exclusive_group_label"
        )
        .eq("id", organization_id)
        .single();

      if (fetchError) throw fetchError;
      organization = orgData;
    }

    // Fetch organization_settings for response
    const { data: orgSettings, error: orgSettingsError } = await supabase
      .from("organization_settings")
      .select(
        "auto_generate_invoices_immediately, bank_transfer_bsb, bank_transfer_account_number, bank_transfer_account_name, show_bank_transfer_on_invoices, default_invoice_due_days, gst_registered, gst_inclusive, gst_rate_percent, edit_window_minutes, worker_payment_cycle_config, workforce_engagement"
      )
      .eq("organization_id", organization_id)
      .maybeSingle();

    // Don't throw if settings don't exist
    if (orgSettingsError && orgSettingsError.code !== "PGRST116") {
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
        feedback_email_send_immediately: organization?.feedback_email_send_immediately ?? false,
        rating_config: ratingConfig,
        stripe_account_id: organization?.stripe_account_id ?? null,
        payment_provider: organization?.payment_provider ?? null,
        currency: organization?.currency ?? "AUD",
        locale: organization?.locale ?? "en-AU",
        default_exclusive_group_label: organization?.default_exclusive_group_label ?? null,
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
        worker_payment_cycle_config: orgSettings?.worker_payment_cycle_config ?? null,
        workforce_engagement: orgSettings?.workforce_engagement ?? "employees",
      },
    });
  } catch (error) {
    logger.error("Update organization settings error", error);
    return errorResponse(error instanceof Error ? error : "Failed to update organization settings");
  }
});
