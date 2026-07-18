/**
 * Validation utilities for invoice template configuration
 * Uses manual validation (zod not available in all edge functions)
 */

import { VALID_LOCATION_FIELDS } from "./invoice-template-defaults.ts";

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate service address configuration
 */
export function validateServiceAddressConfig(config: unknown): ValidationResult {
  if (!config || typeof config !== "object") {
    return {
      valid: false,
      errors: ["service_address_config must be an object"],
    };
  }

  const cfg = config as Record<string, unknown>;
  const errors: string[] = [];

  // Validate source
  if (
    cfg.source !== undefined &&
    !["auto", "location", "form_fields"].includes(cfg.source as string)
  ) {
    errors.push("service_address_config.source must be 'auto', 'location', or 'form_fields'");
  }

  // Validate location_fields if provided
  if (cfg.location_fields !== undefined) {
    if (!Array.isArray(cfg.location_fields)) {
      errors.push("service_address_config.location_fields must be an array");
    } else {
      const invalidFields = (cfg.location_fields as string[]).filter(
        (field) => !VALID_LOCATION_FIELDS.includes(field as (typeof VALID_LOCATION_FIELDS)[number])
      );
      if (invalidFields.length > 0) {
        errors.push(
          `service_address_config.location_fields contains invalid fields: ${invalidFields.join(
            ", "
          )}`
        );
      }
    }
  }

  // Validate form_fields if provided
  if (cfg.form_fields !== undefined) {
    if (!Array.isArray(cfg.form_fields)) {
      errors.push("service_address_config.form_fields must be an array");
    } else if (
      !(cfg.form_fields as string[]).every((f) => typeof f === "string" && f.trim() !== "")
    ) {
      errors.push("service_address_config.form_fields must be an array of non-empty strings");
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate billing address configuration
 */
export function validateBillingAddressConfig(config: unknown): ValidationResult {
  if (!config || typeof config !== "object") {
    return {
      valid: false,
      errors: ["billing_address_config must be an object"],
    };
  }

  const cfg = config as Record<string, unknown>;
  const errors: string[] = [];

  // Validate enabled
  if (cfg.enabled !== undefined && typeof cfg.enabled !== "boolean") {
    errors.push("billing_address_config.enabled must be a boolean");
  }

  // Validate source
  if (
    cfg.source !== undefined &&
    !["auto", "organization", "hierarchy", "form_fields"].includes(cfg.source as string)
  ) {
    errors.push(
      "billing_address_config.source must be 'auto', 'organization', 'hierarchy', or 'form_fields'"
    );
  }

  // Validate form_fields if provided
  if (cfg.form_fields !== undefined) {
    if (!Array.isArray(cfg.form_fields)) {
      errors.push("billing_address_config.form_fields must be an array");
    } else if (
      !(cfg.form_fields as string[]).every((f) => typeof f === "string" && f.trim() !== "")
    ) {
      errors.push("billing_address_config.form_fields must be an array of non-empty strings");
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate email recipient configuration
 */
export function validateEmailRecipientConfig(config: unknown): ValidationResult {
  if (!config || typeof config !== "object") {
    return {
      valid: false,
      errors: ["email_recipient_config must be an object"],
    };
  }

  const cfg = config as Record<string, unknown>;
  const errors: string[] = [];

  // Validate location_email_source (location_contact_email deprecated)
  if (cfg.location_email_source !== undefined) {
    if (cfg.location_email_source === "location_contact_email") {
      cfg.location_email_source = "location_email";
    } else if (
      !["location_email", "hierarchy_billing_email"].includes(cfg.location_email_source as string)
    ) {
      errors.push(
        "email_recipient_config.location_email_source must be 'location_email' or 'hierarchy_billing_email'"
      );
    }
  }

  // Validate form_field_email
  if (cfg.form_field_email !== undefined) {
    if (
      cfg.form_field_email !== null &&
      (typeof cfg.form_field_email !== "string" || cfg.form_field_email.trim() === "")
    ) {
      errors.push("email_recipient_config.form_field_email must be a non-empty string or null");
    }
  }

  // Validate default_email
  if (cfg.default_email !== undefined) {
    if (cfg.default_email !== null) {
      if (typeof cfg.default_email !== "string") {
        errors.push("email_recipient_config.default_email must be a string or null");
      } else {
        const email = cfg.default_email.trim();
        // RFC-compliant email regex
        const emailRegex =
          /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (email !== "" && !emailRegex.test(email)) {
          errors.push("email_recipient_config.default_email must be a valid email address");
        }
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate line item display configuration
 */
export function validateLineItemDisplayConfig(config: unknown): ValidationResult {
  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["line_item_display must be an object"] };
  }

  const cfg = config as Record<string, unknown>;
  const errors: string[] = [];

  // Validate include_option_value
  if (cfg.include_option_value !== undefined && typeof cfg.include_option_value !== "boolean") {
    errors.push("line_item_display.include_option_value must be a boolean");
  }

  // Validate description_format
  if (cfg.description_format !== undefined) {
    if (typeof cfg.description_format !== "string") {
      errors.push("line_item_display.description_format must be a string");
    } else {
      const format = cfg.description_format.trim();
      if (format === "") {
        errors.push("line_item_display.description_format cannot be empty");
      } else if (!format.includes("{field_label}") || !format.includes("{option_value}")) {
        errors.push(
          "line_item_display.description_format must include {field_label} and {option_value} placeholders"
        );
      }
    }
  }

  // Validate show_base_price_separately
  if (
    cfg.show_base_price_separately !== undefined &&
    typeof cfg.show_base_price_separately !== "boolean"
  ) {
    errors.push("line_item_display.show_base_price_separately must be a boolean");
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate complete invoice template config
 */
export function validateInvoiceTemplateConfigUpdate(
  data: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];

  // Validate invoice_title
  if (data.invoice_title !== undefined) {
    if (typeof data.invoice_title !== "string" || data.invoice_title.trim() === "") {
      errors.push("invoice_title cannot be empty");
    } else if (!["Invoice", "Tax Invoice"].includes(data.invoice_title.trim())) {
      errors.push("invoice_title must be 'Invoice' or 'Tax Invoice'");
    }
  }

  // Validate show_logo
  if (data.show_logo !== undefined && typeof data.show_logo !== "boolean") {
    errors.push("show_logo must be a boolean");
  }

  // Validate show_abn
  if (data.show_abn !== undefined && typeof data.show_abn !== "boolean") {
    errors.push("show_abn must be a boolean");
  }

  // Validate service_address_config
  if (data.service_address_config !== undefined) {
    const serviceResult = validateServiceAddressConfig(data.service_address_config);
    if (!serviceResult.valid && serviceResult.errors) {
      errors.push(...serviceResult.errors);
    }
  }

  // Validate billing_address_config
  if (data.billing_address_config !== undefined) {
    const billingResult = validateBillingAddressConfig(data.billing_address_config);
    if (!billingResult.valid && billingResult.errors) {
      errors.push(...billingResult.errors);
    }
  }

  // Validate email_recipient_config
  if (data.email_recipient_config !== undefined) {
    const emailResult = validateEmailRecipientConfig(data.email_recipient_config);
    if (!emailResult.valid && emailResult.errors) {
      errors.push(...emailResult.errors);
    }
  }

  // Validate line_item_display
  if (data.line_item_display !== undefined) {
    const lineItemResult = validateLineItemDisplayConfig(data.line_item_display);
    if (!lineItemResult.valid && lineItemResult.errors) {
      errors.push(...lineItemResult.errors);
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
