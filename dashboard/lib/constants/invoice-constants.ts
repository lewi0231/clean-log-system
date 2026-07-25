/**
 * Invoice-related constants
 * Magic strings and configuration values
 */

// Invoice status values
export const INVOICE_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

// Invoice title options
export const INVOICE_TITLE_OPTIONS = {
  INVOICE: "Invoice",
  TAX_INVOICE: "Tax Invoice",
} as const;

// Service address source options
export const SERVICE_ADDRESS_SOURCE = {
  AUTO: "auto",
  LOCATION: "location",
  FORM_FIELDS: "form_fields",
} as const;

export type ServiceAddressSource =
  (typeof SERVICE_ADDRESS_SOURCE)[keyof typeof SERVICE_ADDRESS_SOURCE];

// Billing address source options
export const BILLING_ADDRESS_SOURCE = {
  AUTO: "auto",
  ORGANIZATION: "organization",
  HIERARCHY: "hierarchy",
  FORM_FIELDS: "form_fields",
} as const;

export type BillingAddressSource =
  (typeof BILLING_ADDRESS_SOURCE)[keyof typeof BILLING_ADDRESS_SOURCE];

// Email recipient source options (location_contact_email deprecated / removed from writes)
export const EMAIL_RECIPIENT_SOURCE = {
  LOCATION_EMAIL: "location_email",
  HIERARCHY_BILLING_EMAIL: "hierarchy_billing_email",
  /** @deprecated Unimplemented; coerce to LOCATION_EMAIL on read/write. */
  LOCATION_CONTACT_EMAIL: "location_contact_email",
} as const;

export type EmailRecipientSource =
  | typeof EMAIL_RECIPIENT_SOURCE.LOCATION_EMAIL
  | typeof EMAIL_RECIPIENT_SOURCE.HIERARCHY_BILLING_EMAIL;

// Auto-send period options
export const AUTO_SEND_PERIOD = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
} as const;

export type AutoSendPeriod = (typeof AUTO_SEND_PERIOD)[keyof typeof AUTO_SEND_PERIOD];

// Day of week (for weekly auto-send)
export const DAY_OF_WEEK = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const;

// Default auto-send time
export const DEFAULT_AUTO_SEND_TIME = "09:00" as const;

// Default currency
export const DEFAULT_CURRENCY = "AUD" as const;

// GST/Tax (Australian) — title + obligation-threshold SoT: @clean-log/shared/utils/invoice-tax
export const GST_RATE_DEFAULT = 10;
/** ATO obligation reference ($82.50). Title uses gst_registered only — see resolveInvoiceDocumentTitle. */
export { TAX_INVOICE_THRESHOLD_AUD } from "@clean-log/shared/utils/invoice-tax";

// ABN (Australian Business Number) - 11 digits
export const ABN_LENGTH = 11;
