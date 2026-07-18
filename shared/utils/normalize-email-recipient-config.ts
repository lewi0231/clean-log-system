/**
 * Normalize email recipient config: migrate deprecated location_contact_email.
 */

export type InvoiceEmailRecipientConfigLike = {
  location_email_source?: string;
  form_field_email?: string | null;
  default_email?: string | null;
};

/**
 * Coerce deprecated location_contact_email → location_email.
 */
export function normalizeEmailRecipientConfig<T extends InvoiceEmailRecipientConfigLike>(
  config: T
): T {
  if (config.location_email_source !== "location_contact_email") {
    return config;
  }

  return {
    ...config,
    location_email_source: "location_email",
  };
}

export function normalizeEmailRecipientConfigOrDefault<T extends InvoiceEmailRecipientConfigLike>(
  config: T | null | undefined,
  fallback: T
): T {
  if (!config) return fallback;
  return normalizeEmailRecipientConfig(config);
}

/** Allowed write values after deprecation of location_contact_email. */
export const VALID_LOCATION_EMAIL_SOURCES = ["location_email", "hierarchy_billing_email"] as const;

export type ValidLocationEmailSource = (typeof VALID_LOCATION_EMAIL_SOURCES)[number];
