/**
 * Zod validation schemas for invoice template configuration
 */

import {
  BILLING_ADDRESS_SOURCE,
  EMAIL_RECIPIENT_SOURCE,
  INVOICE_TITLE_OPTIONS,
  SERVICE_ADDRESS_SOURCE,
} from "@/lib/constants/invoice-constants";
import { VALID_LOCATION_FIELDS } from "@/lib/constants/invoice-template-defaults";
import { z } from "zod";

// Valid location field names
const validLocationFields = VALID_LOCATION_FIELDS as readonly string[];

// Service Address Config Schema
export const serviceAddressConfigSchema = z
  .object({
    source: z.enum([
      SERVICE_ADDRESS_SOURCE.AUTO,
      SERVICE_ADDRESS_SOURCE.LOCATION,
      SERVICE_ADDRESS_SOURCE.FORM_FIELDS,
    ]),
    location_fields: z.array(z.enum(validLocationFields as [string, ...string[]])).optional(),
    form_fields: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (data) => {
      // If source is "location", location_fields must be provided
      if (
        data.source === SERVICE_ADDRESS_SOURCE.LOCATION &&
        (!data.location_fields || data.location_fields.length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Location fields are required when source is 'location'",
      path: ["location_fields"],
    }
  )
  .refine(
    (data) => {
      // If source is "form_fields", form_fields must be provided
      if (
        data.source === SERVICE_ADDRESS_SOURCE.FORM_FIELDS &&
        (!data.form_fields || data.form_fields.length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Form fields are required when source is 'form_fields'",
      path: ["form_fields"],
    }
  )
  .refine(
    (data) => {
      // If source is "auto", at least one of location_fields or form_fields should be provided
      if (data.source === SERVICE_ADDRESS_SOURCE.AUTO) {
        const hasLocationFields = data.location_fields && data.location_fields.length > 0;
        const hasFormFields = data.form_fields && data.form_fields.length > 0;
        return hasLocationFields || hasFormFields;
      }
      return true;
    },
    {
      message: "At least location fields or form fields must be configured when source is 'auto'",
      path: ["source"],
    }
  );

export type ServiceAddressConfigInput = z.infer<typeof serviceAddressConfigSchema>;

// Billing Address Config Schema
export const billingAddressConfigSchema = z.object({
  enabled: z.boolean(),
  source: z.enum([
    BILLING_ADDRESS_SOURCE.AUTO,
    BILLING_ADDRESS_SOURCE.ORGANIZATION,
    BILLING_ADDRESS_SOURCE.HIERARCHY,
    BILLING_ADDRESS_SOURCE.FORM_FIELDS,
  ]),
  form_fields: z.array(z.string().min(1)).optional(),
});

export type BillingAddressConfigInput = z.infer<typeof billingAddressConfigSchema>;

// Email Recipient Config Schema — reject deprecated location_contact_email on write
// (clients should migrate; normalizeEmailRecipientConfig coerces on read)
export const emailRecipientConfigSchema = z.object({
  location_email_source: z.enum([
    EMAIL_RECIPIENT_SOURCE.LOCATION_EMAIL,
    EMAIL_RECIPIENT_SOURCE.HIERARCHY_BILLING_EMAIL,
  ]),
  form_field_email: z.string().nullable(),
  // default_email removed: fallback not used; always null when saving
  default_email: z.string().email().nullable().optional(),
});

export type EmailRecipientConfigInput = z.infer<typeof emailRecipientConfigSchema>;

// Line Item Display Config Schema
export const lineItemDisplayConfigSchema = z.object({
  include_option_value: z.boolean(),
  description_format: z.string().min(1, "Description format is required").optional(),
  show_base_price_separately: z.boolean(),
});

export type LineItemDisplayConfigInput = z.infer<typeof lineItemDisplayConfigSchema>;

// Complete Invoice Template Config Schema
export const invoiceTemplateConfigSchema = z
  .object({
    invoice_title: z.enum([INVOICE_TITLE_OPTIONS.INVOICE, INVOICE_TITLE_OPTIONS.TAX_INVOICE]),
    show_logo: z.boolean(),
    show_abn: z.boolean(),
    service_address_config: serviceAddressConfigSchema,
    billing_address_config: billingAddressConfigSchema,
    email_recipient_config: emailRecipientConfigSchema,
    line_item_display: lineItemDisplayConfigSchema,
  })
  .refine(
    (data) => {
      // If include_option_value is true, description_format must contain placeholders
      if (data.line_item_display.include_option_value) {
        const format = data.line_item_display.description_format;
        if (!format) return false;
        return format.includes("{field_label}") && format.includes("{option_value}");
      }
      return true;
    },
    {
      message:
        "Description format must include {field_label} and {option_value} when option values are included",
      path: ["line_item_display", "description_format"],
    }
  );

export type InvoiceTemplateConfigInput = z.infer<typeof invoiceTemplateConfigSchema>;

/**
 * Validate invoice template config with detailed error messages
 */
export function validateInvoiceTemplateConfig(data: unknown): {
  success: boolean;
  data?: InvoiceTemplateConfigInput;
  errors?: Partial<Record<string, string>>;
} {
  const result = invoiceTemplateConfigSchema.safeParse(data);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    result.error.issues.forEach((issue) => {
      const path = issue.path.join(".");
      errors[path] = issue.message;
    });
    return { success: false, errors };
  }

  return { success: true, data: result.data };
}

/**
 * Format zod errors for display in UI
 */
export function formatInvoiceTemplateErrors(error: z.ZodError): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};

  error.issues.forEach((issue) => {
    const path = issue.path.join(".");
    if (path) {
      errors[path] = issue.message;
    }
  });

  return errors;
}
