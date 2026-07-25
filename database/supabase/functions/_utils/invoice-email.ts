/**
 * Invoice Email Recipient Utilities
 * Determines the email address to send invoices to based on configuration
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { isBillingEmailFormat, resolveHierarchyBilling } from "./hierarchy-billing.ts";

/**
 * Validate email address using RFC-compliant regex
 * @param email - Email address to validate
 * @returns true if email is valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed === "") return false;
  return isBillingEmailFormat(trimmed);
}

export interface InvoiceEmailRecipientConfig {
  location_email_source: "location_email" | "hierarchy_billing_email";
  form_field_email: string | null;
  /** @deprecated No longer used; fallback removed. Kept for backward compatibility. */
  default_email?: string | null;
}

export interface JobContext {
  location_id: string | null;
  location?: {
    id: string;
    email: string | null;
    contact_person: string | null;
    hierarchy_parent_id: string | null;
  } | null;
  submission_data: Record<string, unknown> | null;
}

/**
 * Determine invoice email recipient for a job
 */
export async function getInvoiceEmailRecipient(
  supabase: SupabaseClient,
  job: JobContext,
  config: InvoiceEmailRecipientConfig,
  fieldConfigMap?: Map<string, { name: string }>
): Promise<string | null> {
  // If job has location_id
  if (job.location_id && job.location) {
    const location = job.location;

    const locationEmailOrNull = (): string | null => {
      if (!location.email) return null;
      const locationEmail = location.email.trim();
      return isValidEmail(locationEmail) ? locationEmail : null;
    };

    // Prefer hierarchy billing email when configured; fall back to location email
    // if hierarchy is missing or has no valid billing email.
    if (config.location_email_source === "hierarchy_billing_email") {
      if (location.hierarchy_parent_id) {
        const resolved = await resolveHierarchyBilling(
          supabase,
          location.hierarchy_parent_id,
          "email"
        );
        const email = resolved?.billing_address.email?.trim();
        if (email && isValidEmail(email)) {
          return email;
        }
      }

      return locationEmailOrNull();
    }

    if (config.location_email_source === "location_email") {
      return locationEmailOrNull();
    }

    // location_contact_email was never implemented (contact_person is a name, not email).
    // Deprecated: configs are coerced to location_email on read/write.
  }

  // If job has no location_id, check form fields
  if (!job.location_id && job.submission_data && config.form_field_email) {
    // Need field config name to submission_data field name mapping
    if (fieldConfigMap) {
      const fieldConfig = fieldConfigMap.get(config.form_field_email);
      if (fieldConfig) {
        const emailValue = job.submission_data[fieldConfig.name];
        if (emailValue && typeof emailValue === "string") {
          const email = emailValue.trim();
          // Validate email format
          if (isValidEmail(email)) {
            return email;
          }
        }
      }
    } else {
      // Fallback: try direct field name match
      const emailValue = job.submission_data[config.form_field_email];
      if (emailValue && typeof emailValue === "string") {
        const email = emailValue.trim();
        if (isValidEmail(email)) {
          return email;
        }
      }
    }
  }

  return null;
}

/**
 * Get invoice email recipients for multiple jobs (returns unique emails)
 */
export async function getInvoiceEmailRecipients(
  supabase: SupabaseClient,
  jobs: JobContext[],
  config: InvoiceEmailRecipientConfig,
  fieldConfigMap?: Map<string, { name: string }>
): Promise<string[]> {
  const emailSet = new Set<string>();

  for (const job of jobs) {
    const email = await getInvoiceEmailRecipient(supabase, job, config, fieldConfigMap);
    if (email) {
      emailSet.add(email);
    }
  }

  return Array.from(emailSet);
}

/**
 * First name for "Hello …" from location contact_person (first matching job).
 */
export function greetingFirstNameFromJobContexts(jobs: JobContext[]): string | null {
  for (const job of jobs) {
    const raw = job.location?.contact_person;
    if (raw && typeof raw === "string") {
      const t = raw.trim();
      if (!t) continue;
      const first = t.split(/\s+/)[0];
      const cleaned = first.replace(/^[^a-zA-Z]+/, "");
      if (cleaned.length > 0) return cleaned;
    }
  }
  return null;
}
