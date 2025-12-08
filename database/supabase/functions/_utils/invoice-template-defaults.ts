/**
 * Default invoice template configuration values
 * Shared constants for backend edge functions
 */

export const DEFAULT_INVOICE_TITLE = "Tax Invoice";

export const DEFAULT_SERVICE_ADDRESS_CONFIG = {
  source: "auto",
  location_fields: ["name", "address", "contact_person", "email", "phone"],
  form_fields: [],
} as const;

export const DEFAULT_BILLING_ADDRESS_CONFIG = {
  enabled: false,
  source: "auto",
} as const;

export const DEFAULT_EMAIL_RECIPIENT_CONFIG = {
  location_email_source: "location_email",
  form_field_email: null,
  default_email: null,
} as const;

export const DEFAULT_LINE_ITEM_DISPLAY = {
  include_option_value: true,
  description_format: "{field_label}: {option_value}",
  show_base_price_separately: true,
} as const;

/**
 * Get default invoice template config for an organization
 */
export function getDefaultInvoiceTemplateConfig(organizationId: string) {
  return {
    organization_id: organizationId,
    invoice_title: DEFAULT_INVOICE_TITLE,
    show_logo: true,
    show_abn: true,
    bill_to_fields: [],
    service_address_config: DEFAULT_SERVICE_ADDRESS_CONFIG,
    billing_address_config: DEFAULT_BILLING_ADDRESS_CONFIG,
    email_recipient_config: DEFAULT_EMAIL_RECIPIENT_CONFIG,
    line_item_display: DEFAULT_LINE_ITEM_DISPLAY,
  };
}
