/** Defaults must stay aligned with edge `_utils/feedback-email.ts`. */

export const DEFAULT_FEEDBACK_EMAIL_SUBJECT = "How was your service? We'd love your feedback!";

export const DEFAULT_FEEDBACK_EMAIL_BODY = `Hi {{contact_name}},

Thank you for choosing {{organization_name}} for your recent service{{location_suffix}} on {{job_date}}.

We'd love to hear about your experience! Your feedback helps us improve our services and ensures we continue to meet your expectations.

{{cta_block}}

This review will only take a minute, and your feedback is greatly appreciated.

If you have any questions or concerns, please don't hesitate to reach out to us directly.

Best regards,
The {{organization_name}} Team`;

export const FEEDBACK_EMAIL_PLACEHOLDERS = [
  "{{organization_name}}",
  "{{location_name}}",
  "{{job_date}}",
  "{{contact_name}}",
  "{{internal_review_url}}",
  "{{public_review_url}}",
  "{{cta_block}}",
] as const;

export type FeedbackRequestMode = "internal" | "public" | "both";
