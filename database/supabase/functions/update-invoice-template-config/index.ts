import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import {
  DEFAULT_BILLING_ADDRESS_CONFIG,
  DEFAULT_EMAIL_RECIPIENT_CONFIG,
  DEFAULT_INVOICE_TITLE,
  DEFAULT_LINE_ITEM_DISPLAY,
  DEFAULT_SERVICE_ADDRESS_CONFIG,
} from "../_utils/invoice-template-defaults.ts";
import { validateInvoiceTemplateConfigUpdate } from "../_utils/invoice-template-validation.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";

serve(async (req) => {
  const logger = createLogger(req, { functionName: "update-invoice-template-config" });
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
      service_address_config,
      billing_address_config,
      email_recipient_config,
      line_item_display,
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

    // Validate all config updates before processing
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Build update data object for validation
    const configToValidate: Record<string, unknown> = {};
    if (invoice_title !== undefined) {
      configToValidate.invoice_title = invoice_title;
    }
    if (show_logo !== undefined) configToValidate.show_logo = show_logo;
    if (show_abn !== undefined) configToValidate.show_abn = show_abn;
    if (service_address_config !== undefined) {
      configToValidate.service_address_config = service_address_config;
    }
    if (billing_address_config !== undefined) {
      configToValidate.billing_address_config = billing_address_config;
    }
    if (email_recipient_config !== undefined) {
      configToValidate.email_recipient_config = email_recipient_config;
    }
    if (line_item_display !== undefined) {
      configToValidate.line_item_display = line_item_display;
    }

    // Run validation
    if (Object.keys(configToValidate).length > 0) {
      const validation = validateInvoiceTemplateConfigUpdate(configToValidate);
      if (!validation.valid && validation.errors) {
        return errorResponse(
          `Validation failed: ${validation.errors.join("; ")}`,
          400,
        );
      }
    }

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
          400,
        );
      }

      if (
        line_item_display.description_format !== undefined &&
        typeof line_item_display.description_format !== "string"
      ) {
        return errorResponse(
          "line_item_display.description_format must be a string",
          400,
        );
      }

      if (
        line_item_display.show_base_price_separately !== undefined &&
        typeof line_item_display.show_base_price_separately !== "boolean"
      ) {
        return errorResponse(
          "line_item_display.show_base_price_separately must be a boolean",
          400,
        );
      }

      updateData.line_item_display = line_item_display;
    }

    // Validate and add service_address_config
    if (service_address_config !== undefined) {
      if (
        typeof service_address_config !== "object" ||
        service_address_config === null
      ) {
        return errorResponse("service_address_config must be an object", 400);
      }

      // Validate source
      if (
        service_address_config.source !== undefined &&
        !["auto", "location", "form_fields"].includes(
          service_address_config.source,
        )
      ) {
        return errorResponse(
          "service_address_config.source must be 'auto', 'location', or 'form_fields'",
          400,
        );
      }

      // Validate location_fields if provided
      if (service_address_config.location_fields !== undefined) {
        if (!Array.isArray(service_address_config.location_fields)) {
          return errorResponse(
            "service_address_config.location_fields must be an array",
            400,
          );
        }
        const validFields = [
          "name",
          "email",
          "address",
          "contact_person",
          "phone",
        ];
        if (
          !service_address_config.location_fields.every((field: string) =>
            validFields.includes(field)
          )
        ) {
          return errorResponse(
            "service_address_config.location_fields must contain only valid field names",
            400,
          );
        }
      }

      updateData.service_address_config = service_address_config;
    }

    // Validate and add billing_address_config
    if (billing_address_config !== undefined) {
      if (
        typeof billing_address_config !== "object" ||
        billing_address_config === null
      ) {
        return errorResponse("billing_address_config must be an object", 400);
      }

      // Validate enabled
      if (
        billing_address_config.enabled !== undefined &&
        typeof billing_address_config.enabled !== "boolean"
      ) {
        return errorResponse(
          "billing_address_config.enabled must be a boolean",
          400,
        );
      }

      // Validate source
      if (
        billing_address_config.source !== undefined &&
        !["auto", "organization", "hierarchy", "form_fields"].includes(
          billing_address_config.source,
        )
      ) {
        return errorResponse(
          "billing_address_config.source must be 'auto', 'organization', 'hierarchy', or 'form_fields'",
          400,
        );
      }

      updateData.billing_address_config = billing_address_config;
    }

    // Validate and add email_recipient_config
    if (email_recipient_config !== undefined) {
      if (
        typeof email_recipient_config !== "object" ||
        email_recipient_config === null
      ) {
        return errorResponse("email_recipient_config must be an object", 400);
      }

      // Validate location_email_source
      if (
        email_recipient_config.location_email_source !== undefined &&
        !["location_email", "hierarchy_billing_email", "location_contact_email"]
          .includes(email_recipient_config.location_email_source)
      ) {
        return errorResponse(
          "email_recipient_config.location_email_source must be 'location_email', 'hierarchy_billing_email', or 'location_contact_email'",
          400,
        );
      }

      // Validate form_field_email
      if (email_recipient_config.form_field_email !== undefined) {
        if (
          email_recipient_config.form_field_email !== null &&
          typeof email_recipient_config.form_field_email !== "string"
        ) {
          return errorResponse(
            "email_recipient_config.form_field_email must be a string or null",
            400,
          );
        }
      }

      // Validate default_email
      if (email_recipient_config.default_email !== undefined) {
        if (
          email_recipient_config.default_email !== null &&
          typeof email_recipient_config.default_email !== "string"
        ) {
          return errorResponse(
            "email_recipient_config.default_email must be a string or null",
            400,
          );
        }
        // Validate email format if provided (RFC-compliant)
        if (email_recipient_config.default_email) {
          const emailRegex =
            /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
          if (!emailRegex.test(email_recipient_config.default_email.trim())) {
            return errorResponse(
              "email_recipient_config.default_email must be a valid email address",
              400,
            );
          }
        }
      }

      updateData.email_recipient_config = email_recipient_config;
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
        invoice_title: invoice_title ?? DEFAULT_INVOICE_TITLE,
        show_logo: show_logo ?? true,
        show_abn: show_abn ?? true,
        bill_to_fields: bill_to_fields ?? [],
        line_item_display: line_item_display ?? DEFAULT_LINE_ITEM_DISPLAY,
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
        invoice_title: config.invoice_title ?? DEFAULT_INVOICE_TITLE,
        show_logo: config.show_logo ?? true,
        show_abn: config.show_abn ?? true,
        bill_to_fields: config.bill_to_fields ?? [],
        service_address_config: config.service_address_config ??
          DEFAULT_SERVICE_ADDRESS_CONFIG,
        billing_address_config: config.billing_address_config ??
          DEFAULT_BILLING_ADDRESS_CONFIG,
        email_recipient_config: config.email_recipient_config ??
          DEFAULT_EMAIL_RECIPIENT_CONFIG,
        line_item_display: config.line_item_display ??
          DEFAULT_LINE_ITEM_DISPLAY,
        created_at: config.created_at,
        updated_at: config.updated_at,
      },
    });
  } catch (error) {
    logger.error("Update invoice template config error", error);
    return errorResponse(
      error instanceof Error
        ? error
        : "Failed to update invoice template config",
    );
  }
});
