/**
 * Feedback Email Utilities
 * Template rendering (escaped), token generation, recipient resolution, Resend send.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { getTestModeRecipient, getTestModeTags, isTestMode, validateEmailConfig } from "./email.ts";
import { resolveOrgMailFrom } from "./org-mail-from.ts";
import { createLoggerWithoutRequest } from "./logger.ts";
import {
  getInvoiceEmailRecipient,
  type InvoiceEmailRecipientConfig,
  type JobContext,
} from "./invoice-email.ts";

export type FeedbackRequestMode = "internal" | "public" | "both";

export interface FeedbackEmailData {
  recipientEmail: string;
  recipientName: string | null;
  organizationName: string;
  organizationId: string;
  jobId: string;
  jobCompletedAt: string;
  locationName: string | null;
  feedbackToken: string | null;
  feedbackReviewUrl: string;
  mode?: FeedbackRequestMode;
  publicReviewUrl?: string | null;
  subjectTemplate?: string | null;
  bodyTemplate?: string | null;
  replyTo?: string | null;
  locale?: string | null;
  /** Extra subject prefix (e.g. synthetic test send). RESEND_TEST_MODE also prefixes [TEST]. */
  subjectPrefix?: string | null;
}

export const DEFAULT_FEEDBACK_EMAIL_SUBJECT = "How was your service? We'd love your feedback!";

export const DEFAULT_FEEDBACK_EMAIL_BODY = `Hi {{contact_name}},

Thank you for choosing {{organization_name}} for your recent service{{location_suffix}} on {{job_date}}.

We'd love to hear about your experience! Your feedback helps us improve our services and ensures we continue to meet your expectations.

{{cta_block}}

This review will only take a minute, and your feedback is greatly appreciated.

If you have any questions or concerns, please don't hesitate to reach out to us directly.

Best regards,
The {{organization_name}} Team`;

/** Escape text for safe HTML interpolation. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateFeedbackToken(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const base64 = btoa(String.fromCharCode(...randomBytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function getFeedbackEmailRecipient(
  supabase: SupabaseClient,
  job: JobContext,
  config: InvoiceEmailRecipientConfig,
  fieldConfigMap?: Map<string, { name: string }>
): Promise<string | null> {
  return await getInvoiceEmailRecipient(supabase, job, config, fieldConfigMap);
}

/**
 * Resolve the dashboard origin used for `/review/{token}` links.
 *
 * Precedence (first non-empty):
 * 1. explicit override arg
 * 2. `FEEDBACK_REVIEW_BASE_URL`
 * 3. `DASHBOARD_BASE_URL` (same as invoice public links)
 * 4. `NEXT_PUBLIC_APP_URL`
 * 5. `WORKER_INVITATION_BASE_URL` (admin/dashboard origin in most envs)
 * 6. `https://app.tallyrunner.com`
 *
 * Never use `RESEND_FROM_DOMAIN` / `send.tallyrunner.com` — that host is for
 * Resend From: headers, not the web app that serves the review page.
 */
export function resolveFeedbackReviewBaseUrl(explicit?: string | null): string {
  const candidates = [
    explicit,
    Deno.env.get("FEEDBACK_REVIEW_BASE_URL"),
    Deno.env.get("DASHBOARD_BASE_URL"),
    Deno.env.get("NEXT_PUBLIC_APP_URL"),
    Deno.env.get("WORKER_INVITATION_BASE_URL"),
    "https://app.tallyrunner.com",
  ];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    // Reject mail-only platform domains that cannot host /review.
    if (/^https?:\/\/send\.tallyrunner\.com\/?$/i.test(value)) continue;
    return value.replace(/\/$/, "");
  }
  return "https://app.tallyrunner.com";
}

export function buildInternalReviewUrl(
  feedbackToken: string,
  baseUrl?: string | null
): string | null {
  if (!feedbackToken) return null;
  const origin = resolveFeedbackReviewBaseUrl(baseUrl);
  return `${origin}/review/${feedbackToken}`;
}

function formatJobDate(iso: string, locale: string | null | undefined): string {
  const tag = locale && locale.trim() ? locale.trim() : "en-AU";
  try {
    return new Date(iso).toLocaleDateString(tag, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return new Date(iso).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

function buildCtaBlockPlain(
  mode: FeedbackRequestMode,
  internalUrl: string,
  publicUrl: string
): string {
  if (mode === "public") {
    return publicUrl ? `Please leave your review here: ${publicUrl}` : "";
  }
  if (mode === "both") {
    const lines: string[] = [];
    if (internalUrl) {
      lines.push(`Leave private feedback: ${internalUrl}`);
    }
    if (publicUrl) {
      lines.push(`Leave a public review: ${publicUrl}`);
    }
    return lines.join("\n\n");
  }
  return internalUrl ? `Please leave your review here: ${internalUrl}` : "";
}

function buildCtaButtonHtml(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<div style="text-align: center; margin: 40px 0;">
          <a href="${safeHref}"
             style="display: inline-block; background-color: #007bff; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">
            ${safeLabel}
          </a>
        </div>`;
}

function buildCtaBlockHtml(
  mode: FeedbackRequestMode,
  internalUrl: string,
  publicUrl: string
): string {
  if (mode === "public") {
    return publicUrl ? buildCtaButtonHtml(publicUrl, "Leave Your Review") : "";
  }
  if (mode === "both") {
    const parts: string[] = [];
    if (internalUrl) {
      parts.push(buildCtaButtonHtml(internalUrl, "Leave Private Feedback"));
    }
    if (publicUrl) {
      parts.push(buildCtaButtonHtml(publicUrl, "Leave a Public Review"));
    }
    return parts.join("\n");
  }
  return internalUrl ? buildCtaButtonHtml(internalUrl, "Leave Your Review") : "";
}

export interface RenderedFeedbackEmail {
  subject: string;
  text: string;
  html: string;
  internalReviewUrl: string;
  publicReviewUrl: string;
}

/**
 * Render subject/body with placeholders. All substituted values are HTML-escaped
 * for the HTML part; plain body is never interpreted as HTML (escape then <br>).
 */
export function renderFeedbackEmailContent(data: FeedbackEmailData): RenderedFeedbackEmail {
  const mode: FeedbackRequestMode = data.mode ?? "internal";
  const contactName = data.recipientName || "Valued Customer";
  const organizationName = data.organizationName || "Our Team";
  const locationName = data.locationName || "";
  const jobDate = formatJobDate(data.jobCompletedAt, data.locale);

  const internalUrl = data.feedbackToken ? (buildInternalReviewUrl(data.feedbackToken) ?? "") : "";
  const publicUrl = mode === "internal" ? "" : data.publicReviewUrl?.trim() || "";

  const locationSuffixPlain = locationName ? ` at ${locationName}` : "";
  const ctaPlain = buildCtaBlockPlain(mode, internalUrl, publicUrl);

  const placeholdersPlain: Record<string, string> = {
    organization_name: organizationName,
    location_name: locationName,
    location_suffix: locationSuffixPlain,
    job_date: jobDate,
    contact_name: contactName,
    internal_review_url: mode === "public" ? "" : internalUrl,
    public_review_url: publicUrl,
    cta_block: ctaPlain,
  };

  const subjectTemplate = data.subjectTemplate?.trim() || DEFAULT_FEEDBACK_EMAIL_SUBJECT;
  const bodyTemplate = data.bodyTemplate?.trim() || DEFAULT_FEEDBACK_EMAIL_BODY;

  const applyPlaceholders = (template: string, values: Record<string, string>): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
      return values[key] ?? "";
    });
  };

  let subject = applyPlaceholders(subjectTemplate, placeholdersPlain);
  const text = applyPlaceholders(bodyTemplate, placeholdersPlain).trim();

  const prefixes: string[] = [];
  if (data.subjectPrefix?.trim()) {
    prefixes.push(data.subjectPrefix.trim());
  }
  if (isTestMode() && !subject.includes("[TEST]")) {
    prefixes.push("[TEST]");
  }
  if (prefixes.length > 0) {
    subject = `${prefixes.join(" ")} ${subject}`;
  }

  const placeholdersHtml: Record<string, string> = {
    organization_name: escapeHtml(organizationName),
    location_name: escapeHtml(locationName),
    location_suffix: locationName ? ` at ${escapeHtml(locationName)}` : "",
    job_date: escapeHtml(jobDate),
    contact_name: escapeHtml(contactName),
    internal_review_url: mode === "public" ? "" : escapeHtml(internalUrl),
    public_review_url: escapeHtml(publicUrl),
    cta_block: buildCtaBlockHtml(mode, internalUrl, publicUrl),
  };

  // Admin/body template is plain text: escape entire substituted body, then newlines → <br>.
  // When using product default with {{cta_block}}, inject pre-built HTML CTA after escaping
  // by substituting a marker that is not HTML-special.
  const ctaMarker = "___FEEDBACK_CTA_HTML___";
  const bodyForHtmlEscape = applyPlaceholders(bodyTemplate, {
    ...placeholdersPlain,
    cta_block: ctaMarker,
  });
  const escapedBody = escapeHtml(bodyForHtmlEscape).replace(/\n/g, "<br>\n");
  const bodyHtmlInner = escapedBody.replace(
    new RegExp(escapeHtml(ctaMarker), "g"),
    placeholdersHtml.cta_block
  );

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="font-size: 16px; color: #666;">
      ${bodyHtmlInner}
    </div>
  </div>
</body>
</html>`;

  return {
    subject,
    text,
    html,
    internalReviewUrl: internalUrl,
    publicReviewUrl: publicUrl,
  };
}

/**
 * Send feedback request email via Resend API.
 */
export async function sendFeedbackRequestEmail(
  supabase: SupabaseClient,
  data: FeedbackEmailData,
  throwOnError = false
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const logger = createLoggerWithoutRequest({
    functionName: "sendFeedbackRequestEmail",
  });
  const configResult = validateEmailConfig();
  if (!configResult.valid || !configResult.config) {
    const error = configResult.error || "Email service not configured";
    if (throwOnError) throw new Error(error);
    return { success: false, error };
  }

  const config = configResult.config;
  const mode: FeedbackRequestMode = data.mode ?? "internal";

  if (mode !== "public" && !data.feedbackToken) {
    const error = "Feedback token required for internal review link";
    if (throwOnError) throw new Error(error);
    return { success: false, error };
  }

  if (mode !== "internal") {
    const pub = data.publicReviewUrl?.trim() || "";
    if (!pub || !/^https:\/\//i.test(pub)) {
      const error = "Valid https public_review_url required for public/both mode";
      if (throwOnError) throw new Error(error);
      return { success: false, error };
    }
  }

  const resolvedFrom = await resolveOrgMailFrom({
    supabase,
    organizationId: data.organizationId,
    organizationName: data.organizationName,
    mailKind: "feedback_request",
    platformDomain: config.resendFromDomain,
  });

  logger.info("email from resolved", {
    mail_kind: "feedback_request",
    from_domain_source: resolvedFrom.fromDomainSource,
    organization_id: data.organizationId,
  });

  const testMode = isTestMode();
  const rendered = renderFeedbackEmailContent(data);

  const testRecipient = testMode
    ? getTestModeRecipient("feedback", data.jobId, data.recipientEmail)
    : data.recipientEmail;

  if (testMode) {
    logger.info("Test mode: feedback email redirected", {
      jobId: data.jobId,
      hasRecipient: Boolean(testRecipient),
      hasOriginalRecipient: Boolean(data.recipientEmail),
    });
  }

  try {
    const emailBody: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
      reply_to?: string;
      tags?: Array<{ name: string; value: string }>;
    } = {
      from: resolvedFrom.from,
      to: [testRecipient],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    };

    if (data.replyTo?.trim()) {
      emailBody.reply_to = data.replyTo.trim();
    }

    if (testMode) {
      emailBody.tags = getTestModeTags("feedback", data.jobId, data.recipientEmail);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(emailBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorBody: unknown;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = { message: errorText };
      }

      const errorMessage =
        (errorBody &&
          typeof errorBody === "object" &&
          "message" in errorBody &&
          typeof errorBody.message === "string" &&
          errorBody.message) ||
        res.statusText ||
        "Unknown error";

      const error = `Failed to send feedback email: ${errorMessage}`;
      if (throwOnError) throw new Error(error);
      return { success: false, error };
    }

    const emailResponse = await res.json();
    const emailId = emailResponse.id;

    if (emailId) {
      if (testMode) {
        logger.info("Feedback email sent (test mode)", {
          mode: "test",
          emailType: "feedback",
          jobId: data.jobId,
          emailId,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.info("Feedback email sent", { emailId, jobId: data.jobId });
      }
      return { success: true, emailId };
    }

    logger.warn("Resend response missing ID");
    return { success: true };
  } catch (error) {
    logger.error("Failed to send feedback email", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    if (throwOnError) throw new Error(errorMsg);
    return { success: false, error: errorMsg };
  }
}
