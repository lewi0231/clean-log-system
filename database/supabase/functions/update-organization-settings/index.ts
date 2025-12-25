import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import {
  validateBusinessMode,
  validateRequiredFields,
} from "../_utils/validation.ts";

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
    } = body;

    const supabase = createServiceRoleClient();

    // Verify organization membership
    const membershipCheck = await verifyOrganizationMembershipFromRequest(
      req,
      organization_id,
      supabase,
    );
    if (!membershipCheck) {
      return errorResponse(
        "You do not have permission to access this organization",
        403,
      );
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
          400,
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

    if (business_address !== undefined) {
      updateData.business_address = business_address === ""
        ? null
        : business_address.trim();
    }

    if (invoice_send_immediately !== undefined) {
      if (typeof invoice_send_immediately !== "boolean") {
        return errorResponse("invoice_send_immediately must be a boolean", 400);
      }
      updateData.invoice_send_immediately = invoice_send_immediately;
    }

    if (feedback_email_send_immediately !== undefined) {
      if (typeof feedback_email_send_immediately !== "boolean") {
        return errorResponse(
          "feedback_email_send_immediately must be a boolean",
          400,
        );
      }
      updateData.feedback_email_send_immediately =
        feedback_email_send_immediately;
    }

    if (stripe_account_id !== undefined) {
      updateData.stripe_account_id = stripe_account_id === ""
        ? null
        : stripe_account_id;
    }

    if (payment_provider !== undefined) {
      // Validate payment provider if provided
      if (payment_provider && payment_provider.trim() !== "") {
        const validProviders = ["stripe"]; // TODO: Add more providers as they're implemented
        if (!validProviders.includes(payment_provider.trim().toLowerCase())) {
          return errorResponse(
            `Invalid payment provider. Must be one of: ${
              validProviders.join(
                ", ",
              )
            }`,
            400,
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
          400,
        );
      }
      updateData.currency = currency;
    }

    if (locale !== undefined) {
      updateData.locale = locale;
    }

    if (default_exclusive_group_label !== undefined) {
      updateData.default_exclusive_group_label =
        default_exclusive_group_label === ""
          ? null
          : default_exclusive_group_label;
    }

    if (rating_config !== undefined) {
      // Validate rating_config structure
      if (typeof rating_config !== "object" || rating_config === null) {
        return errorResponse(
          "rating_config must be an object with 'type' and 'dimensions'",
          400,
        );
      }
      if (!("type" in rating_config) || !("dimensions" in rating_config)) {
        return errorResponse(
          "rating_config must have 'type' and 'dimensions' properties",
          400,
        );
      }
      const validTypes = ["single", "three_dimensions", "rater"];
      if (!validTypes.includes(rating_config.type)) {
        return errorResponse(
          `rating_config.type must be one of: ${validTypes.join(", ")}`,
          400,
        );
      }
      if (!Array.isArray(rating_config.dimensions)) {
        return errorResponse("rating_config.dimensions must be an array", 400);
      }
      updateData.rating_config = rating_config;
    }

    // Handle auto_generate_invoices_immediately (stored in organization_settings table)
    if (auto_generate_invoices_immediately !== undefined) {
      if (typeof auto_generate_invoices_immediately !== "boolean") {
        return errorResponse(
          "auto_generate_invoices_immediately must be a boolean",
          400,
        );
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
            auto_generate_invoices_immediately:
              auto_generate_invoices_immediately,
          })
          .eq("id", existingSettings.id);

        if (settingsError) {
          logger.error("Failed to update auto_generate_invoices_immediately", {
            error: settingsError,
          });
          // Don't throw - continue with other updates
        }
      } else {
        const { error: settingsError } = await supabase
          .from("organization_settings")
          .insert({
            organization_id,
            auto_generate_invoices_immediately:
              auto_generate_invoices_immediately,
          });

        if (settingsError) {
          logger.error("Failed to create auto_generate_invoices_immediately", {
            error: settingsError,
          });
          // Don't throw - continue with other updates
        }
      }
    }

    const { data: organization, error: updateError } = await supabase
      .from("organization")
      .update(updateData)
      .eq("id", organization_id)
      .select(
        "name, use_predefined_locations, business_mode, abn, logo_url, primary_contact_email, business_address, invoice_send_immediately, feedback_email_send_immediately, rating_config, stripe_account_id, payment_provider, currency, locale, default_exclusive_group_label",
      )
      .single();

    if (updateError) throw updateError;

    // Fetch organization_settings for response
    const { data: orgSettings, error: orgSettingsError } = await supabase
      .from("organization_settings")
      .select("auto_generate_invoices_immediately")
      .eq("organization_id", organization_id)
      .maybeSingle();

    // Don't throw if settings don't exist
    if (orgSettingsError && orgSettingsError.code !== "PGRST116") {
      console.warn("Error fetching organization_settings", orgSettingsError);
    }

    // Parse rating_config with default fallback
    let ratingConfig = {
      type: "single" as const,
      dimensions: ["overall"],
    };
    if (organization?.rating_config) {
      try {
        const parsed = typeof organization.rating_config === "string"
          ? JSON.parse(organization.rating_config)
          : organization.rating_config;
        if (
          parsed && typeof parsed === "object" && "type" in parsed &&
          "dimensions" in parsed
        ) {
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
        use_predefined_locations: organization?.use_predefined_locations ??
          true,
        business_mode: organization?.business_mode ?? "service_based",
        abn: organization?.abn ?? null,
        logo_url: organization?.logo_url ?? null,
        primary_contact_email: organization?.primary_contact_email ?? null,
        business_address: organization?.business_address ?? null,
        invoice_send_immediately: organization?.invoice_send_immediately ??
          false,
        feedback_email_send_immediately:
          organization?.feedback_email_send_immediately ?? false,
        rating_config: ratingConfig,
        stripe_account_id: organization?.stripe_account_id ?? null,
        payment_provider: organization?.payment_provider ?? null,
        currency: organization?.currency ?? "AUD",
        locale: organization?.locale ?? "en-AU",
        default_exclusive_group_label:
          organization?.default_exclusive_group_label ?? null,
        auto_generate_invoices_immediately:
          orgSettings?.auto_generate_invoices_immediately ?? false,
      },
    });
  } catch (error) {
    console.error("Update organization settings error:", error);
    return errorResponse(
      error instanceof Error ? error : "Failed to update organization settings",
    );
  }
});
