/**
 * Feedback Email Utilities
 * Handles feedback request email sending and token generation
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  getTestModeRecipient,
  getTestModeTags,
  isTestMode,
  validateEmailConfig,
} from "./email.ts";
import {
  getInvoiceEmailRecipient,
  type InvoiceEmailRecipientConfig,
  type JobContext,
} from "./invoice-email.ts";

export interface FeedbackEmailData {
  recipientEmail: string;
  recipientName: string | null;
  organizationName: string;
  jobId: string;
  jobCompletedAt: string;
  locationName: string | null;
  feedbackToken: string;
  feedbackReviewUrl: string;
}

/**
 * Generate a secure, unique feedback token
 * Uses Web Crypto API to generate 32 random bytes, then converts to base64url
 * This provides 256 bits of entropy, making it cryptographically secure
 */
export function generateFeedbackToken(): string {
  // Generate 32 random bytes (256 bits)
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  // Convert to base64
  const base64 = btoa(String.fromCharCode(...randomBytes));

  // Convert to base64url (URL-safe: replace + with -, / with _, remove = padding)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Get feedback email recipient using invoice email recipient logic
 * Reuses the proven invoice email recipient selection logic for consistency
 */
export async function getFeedbackEmailRecipient(
  supabase: SupabaseClient,
  job: JobContext,
  config: InvoiceEmailRecipientConfig,
  fieldConfigMap?: Map<string, { name: string }>,
): Promise<string | null> {
  // Reuse invoice email recipient logic
  return await getInvoiceEmailRecipient(supabase, job, config, fieldConfigMap);
}

/**
 * Send feedback request email via Resend API
 * Sends a personalized email with a secure token-based review link
 */
export async function sendFeedbackRequestEmail(
  data: FeedbackEmailData,
  throwOnError = false,
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  // Validate email config
  const configResult = validateEmailConfig();
  if (!configResult.valid || !configResult.config) {
    const error = configResult.error || "Email service not configured";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  const config = configResult.config;
  const feedbackReviewBaseUrl = Deno.env.get("FEEDBACK_REVIEW_BASE_URL");

  if (!feedbackReviewBaseUrl) {
    const error = "FEEDBACK_REVIEW_BASE_URL environment variable not set";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Check if test mode is enabled
  const testMode = isTestMode();

  // Build review URL
  const reviewUrl = `${
    feedbackReviewBaseUrl.replace(/\/$/, "")
  }/review/${data.feedbackToken}`;

  // Format recipient name
  const recipientName = data.recipientName || "Valued Customer";

  // Format job date
  const jobDate = new Date(data.jobCompletedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build email HTML
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>We'd Love Your Feedback</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h1 style="color: #1a1a1a; margin-top: 0;">Hi ${recipientName},</h1>
        
        <p style="font-size: 16px; color: #666;">
          Thank you for choosing ${data.organizationName} for your recent service${
    data.locationName ? ` at ${data.locationName}` : ""
  } on ${jobDate}.
        </p>
        
        <p style="font-size: 16px; color: #666;">
          We'd love to hear about your experience! Your feedback helps us improve our services and ensures we continue to meet your expectations.
        </p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${reviewUrl}" 
             style="display: inline-block; background-color: #007bff; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Leave Your Review
          </a>
        </div>
        
        <p style="font-size: 14px; color: #999; margin-top: 40px;">
          This review will only take a minute, and your feedback is greatly appreciated.
        </p>
        
        <p style="font-size: 14px; color: #999; margin-top: 20px;">
          If you have any questions or concerns, please don't hesitate to reach out to us directly.
        </p>
        
        <p style="font-size: 14px; color: #999; margin-top: 40px;">
          Best regards,<br>
          The ${data.organizationName} Team
        </p>
      </div>
    </body>
    </html>
  `;

  // Build email text version
  const emailText = `
Hi ${recipientName},

Thank you for choosing ${data.organizationName} for your recent service${
    data.locationName ? ` at ${data.locationName}` : ""
  } on ${jobDate}.

We'd love to hear about your experience! Your feedback helps us improve our services and ensures we continue to meet your expectations.

Please leave your review here: ${reviewUrl}

This review will only take a minute, and your feedback is greatly appreciated.

If you have any questions or concerns, please don't hesitate to reach out to us directly.

Best regards,
The ${data.organizationName} Team
  `.trim();

  // Determine recipient and subject based on test mode
  const testRecipient = testMode
    ? getTestModeRecipient("feedback", data.jobId, data.recipientEmail)
    : data.recipientEmail;

  const emailSubject = testMode
    ? `[TEST] How was your service? We'd love your feedback!`
    : `How was your service? We'd love your feedback!`;

  // Log test mode redirection if enabled
  if (testMode) {
    console.log("[TEST MODE] Feedback email redirected to test address", {
      testRecipient,
      originalRecipient: data.recipientEmail,
      jobId: data.jobId,
    });
  }

  // Send email via Resend
  try {
    const emailBody: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
      tags?: Array<{ name: string; value: string }>;
    } = {
      from: `noreply@${config.resendFromDomain}`,
      to: [testRecipient],
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
    };

    // Add test mode tags if in test mode
    if (testMode) {
      emailBody.tags = getTestModeTags(
        "feedback",
        data.jobId,
        data.recipientEmail,
      );
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

      const errorMessage = (errorBody &&
        typeof errorBody === "object" &&
        "message" in errorBody &&
        typeof errorBody.message === "string" &&
        errorBody.message) ||
        res.statusText ||
        "Unknown error";

      const error = `Failed to send feedback email: ${errorMessage}`;
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }

    const emailResponse = await res.json();
    const emailId = emailResponse.id;

    if (emailId) {
      if (testMode) {
        console.log("[TEST MODE] Feedback email sent to test address", {
          mode: "test",
          emailType: "feedback",
          testRecipient,
          originalRecipient: data.recipientEmail,
          jobId: data.jobId,
          emailId,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log("Feedback email sent successfully:", emailId);
      }
      return { success: true, emailId };
    } else {
      console.warn("Resend response missing ID:", emailResponse);
      return { success: true }; // Consider it successful even without ID
    }
  } catch (error) {
    console.error("Failed to send feedback email:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    if (throwOnError) {
      throw new Error(errorMsg);
    }
    return { success: false, error: errorMsg };
  }
}
