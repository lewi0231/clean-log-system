// Email utilities for Edge Functions
// Provides email sending functionality using Resend API

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLoggerWithoutRequest } from "./logger.ts";

export interface EmailConfig {
  apiKey: string;
  resendFromDomain: string;
  workerInvitationBaseUrl: string;
}

export interface WorkerInvitationData {
  workerName: string;
  workerEmail: string;
  organizationName: string;
  invitationToken: string;
}

export interface EmailVerificationData {
  email: string;
  verificationLink: string;
  organizationName?: string;
}

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
  config?: EmailConfig;
}

/**
 * Validate email configuration environment variables
 */
export function validateEmailConfig(): EmailValidationResult {
  const logger = createLoggerWithoutRequest({ functionName: "validateEmailConfig" });
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const resendFromDomain = Deno.env.get("RESEND_FROM_DOMAIN");
  const workerInvitationBaseUrl = Deno.env.get("WORKER_INVITATION_BASE_URL");

  // Check if environment variables are set AND not the string "null" or "undefined"
  if (!apiKey || apiKey === "null" || apiKey === "undefined") {
    logger.error("RESEND_API_KEY is not set or invalid");
    return {
      valid: false,
      error: "Email service is not configured",
    };
  }

  if (
    !resendFromDomain ||
    resendFromDomain === "null" ||
    resendFromDomain === "undefined"
  ) {
    logger.error("RESEND_FROM_DOMAIN is not set or invalid");
    return {
      valid: false,
      error: "Email service configuration error: RESEND_FROM_DOMAIN is not set",
    };
  }

  if (
    !workerInvitationBaseUrl ||
    workerInvitationBaseUrl === "null" ||
    workerInvitationBaseUrl === "undefined"
  ) {
    logger.error("WORKER_INVITATION_BASE_URL is not set or invalid");
    return {
      valid: false,
      error: "Configuration error: WORKER_INVITATION_BASE_URL is not set",
    };
  }

  return {
    valid: true,
    config: {
      apiKey,
      resendFromDomain,
      workerInvitationBaseUrl,
    },
  };
}

/**
 * Check if test mode is enabled
 */
export function isTestMode(): boolean {
  return Deno.env.get("RESEND_TEST_MODE") === "true";
}

/**
 * Get test mode recipient address for a given email type and identifier
 * Returns Resend test address with label for tracking
 */
export function getTestModeRecipient(
  emailType: "feedback" | "invoice" | "invitation" | "payment",
  identifier: string,
  _originalRecipient: string,
): string {
  const testAddresses = {
    feedback: `delivered+feedback-${identifier}@resend.dev`,
    invoice: `delivered+invoice-${identifier}@resend.dev`,
    invitation: `delivered+invitation-${identifier}@resend.dev`,
    payment: `delivered+payment-${identifier}@resend.dev`,
  };

  return testAddresses[emailType];
}

/**
 * Sanitize a string for use as a Resend tag value.
 * Tags can only contain ASCII letters, numbers, underscores, or dashes.
 */
function sanitizeTagValue(value: string): string {
  // Replace @ with _at_, . with _dot_, and any other invalid chars with underscore
  return value
    .replace(/@/g, "_at_")
    .replace(/\./g, "_dot_")
    .replace(/,/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Get test mode tags for Resend API
 */
export function getTestModeTags(
  emailType: "feedback" | "invoice" | "invitation" | "payment",
  identifier: string,
  originalRecipient: string,
): Array<{ name: string; value: string }> {
  return [
    { name: "test-mode", value: emailType },
    { name: "identifier", value: sanitizeTagValue(identifier) },
    { name: "original-recipient", value: sanitizeTagValue(originalRecipient) },
  ];
}

/**
 * Format worker invitation email data
 */
export function formatWorkerInvitationData(
  data: WorkerInvitationData,
  config: EmailConfig,
): {
  from: string;
  to: string[];
  subject: string;
  templateVariables: Record<
    "WORKER_NAME" | "ORGANIZATION_NAME" | "INVITATION_LINK",
    string
  >;
} {
  // Format worker name (capitalize first letter)
  const workerName = data.workerName.charAt(0).toUpperCase() +
    data.workerName.substring(1).toLowerCase();

  // Ensure base URL doesn't end with /
  const baseUrl = config.workerInvitationBaseUrl.replace(/\/$/, "");
  const invitationLink =
    `${baseUrl}/worker/accept-invite/${data.invitationToken}`;

  const templateVariables = {
    WORKER_NAME: workerName || "Worker",
    ORGANIZATION_NAME: data.organizationName || "Organization",
    INVITATION_LINK: invitationLink,
  };

  const fromEmail =
    `${data.organizationName} <onboarding@${config.resendFromDomain}>`;
  const emailSubject = `${data.organizationName} requires you to authenticate`;

  return {
    from: fromEmail,
    to: [data.workerEmail],
    subject: emailSubject,
    templateVariables,
  };
}

/**
 * Validate worker invitation data
 */
export function validateWorkerInvitationData(
  workerName: string,
  workerEmail: string,
  organizationName: string,
  invitationToken: string,
): { valid: boolean; error?: string } {
  if (
    !workerName ||
    typeof workerName !== "string" ||
    workerName.trim() === ""
  ) {
    return {
      valid: false,
      error:
        "Worker data is incomplete: name is required and must be a non-empty string",
    };
  }

  if (
    !workerEmail ||
    typeof workerEmail !== "string" ||
    workerEmail.trim() === "" ||
    !workerEmail.includes("@")
  ) {
    return {
      valid: false,
      error:
        "Worker data is incomplete: email is required and must be a valid email address",
    };
  }

  if (
    !organizationName ||
    organizationName === "null" ||
    organizationName.trim() === ""
  ) {
    return {
      valid: false,
      error: "Organization name is invalid",
    };
  }

  if (!invitationToken || typeof invitationToken !== "string") {
    return {
      valid: false,
      error: "Invalid invitation token",
    };
  }

  return { valid: true };
}

/**
 * Send worker invitation email via Resend API
 */
export async function sendWorkerInvitationEmail(
  data: WorkerInvitationData,
  throwOnError = false,
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const logger = createLoggerWithoutRequest({ functionName: "sendWorkerInvitationEmail" });
  // Validate configuration
  const configResult = validateEmailConfig();
  if (!configResult.valid || !configResult.config) {
    const error = configResult.error || "Email configuration is invalid";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate worker data
  const validationResult = validateWorkerInvitationData(
    data.workerName,
    data.workerEmail,
    data.organizationName,
    data.invitationToken,
  );
  if (!validationResult.valid) {
    const error = validationResult.error || "Invalid worker invitation data";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Format email data
  const emailData = formatWorkerInvitationData(data, configResult.config);

  // Check if test mode is enabled
  const testMode = isTestMode();

  // Determine recipient and subject based on test mode
  // Use invitation token as identifier since we don't have worker ID yet
  const testRecipient = testMode
    ? getTestModeRecipient("invitation", data.invitationToken, data.workerEmail)
    : emailData.to[0];

  const emailSubject = testMode
    ? `[TEST] ${emailData.subject}`
    : emailData.subject;

  // Log test mode redirection if enabled
  if (testMode) {
    logger.info("Test mode: worker invitation email redirected", {
      testRecipient,
      originalRecipient: data.workerEmail,
      invitationToken: data.invitationToken,
    });
  }

  //   TODO - Troubleshoot why template isn't working.
  // Final validation - ensure email doesn't contain null values
  const requestBody: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    tags?: Array<{ name: string; value: string }>;
  } = {
    from: emailData.from,
    to: [testRecipient],
    subject: emailSubject,
    // template: {
    //   id: "cleanlogworkerinvite",
    //   variables: emailData.templateVariables,
    // },
    html:
      `<p>Click this to sign up - ${emailData.templateVariables.INVITATION_LINK}</p>`,
  };

  // Add test mode tags if in test mode
  if (testMode) {
    requestBody.tags = getTestModeTags(
      "invitation",
      data.invitationToken,
      data.workerEmail,
    );
  }

  const requestBodyStr = JSON.stringify(requestBody);
  if (requestBodyStr.includes(":null") || requestBodyStr.includes("null,")) {
    // Never log full request bodies (can contain emails/tokens).
    logger.error("Request body contains null values");
    const error = "Request contains null values";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate from email
  if (
    !emailData.from ||
    emailData.from.includes("null") ||
    emailData.from.includes("undefined")
  ) {
    logger.error("Invalid fromEmail", undefined, { from: emailData.from });
    const error = "Invalid from email address";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  try {
    logger.info("Sending worker invitation email", {
      to: data.workerEmail,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configResult.config.apiKey}`,
      },
      body: requestBodyStr,
    });

    if (!res.ok) {
      // Read response once as text first, then parse
      const errorText = await res.text();
      let errorBody: unknown;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = { message: errorText };
      }

      logger.error("Resend API error", undefined, {
        status: res.status,
        statusText: res.statusText,
        error: errorBody,
        rawResponse: errorText,
      });

      const errorMessage = (errorBody &&
        typeof errorBody === "object" &&
        "message" in errorBody &&
        typeof errorBody.message === "string" &&
        errorBody.message) ||
        (errorBody &&
          typeof errorBody === "object" &&
          "error" in errorBody &&
          errorBody.error &&
          typeof errorBody.error === "object" &&
          "message" in errorBody.error &&
          typeof errorBody.error.message === "string" &&
          errorBody.error.message) ||
        res.statusText ||
        "Unknown error";

      const error = `Failed to send email: ${errorMessage}`;
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }

    const emailResponse = await res.json();
    const emailId = emailResponse.id;

    if (emailId) {
      if (testMode) {
        logger.info("Test mode: worker invitation email sent", {
          testRecipient,
          originalRecipient: data.workerEmail,
          invitationToken: data.invitationToken,
          emailId,
        });
      } else {
        logger.info("Worker invitation email sent", { emailId });
      }
      return { success: true, emailId };
    } else {
      logger.warn("Resend response missing ID", { emailResponse });
      return { success: true }; // Consider it successful even without ID
    }
  } catch (error) {
    logger.error("Failed to send invitation email", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to send invitation email";
    if (throwOnError) {
      throw error;
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Send email verification email via Resend API
 */
export async function sendEmailVerificationEmail(
  data: EmailVerificationData,
  throwOnError = false,
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const logger = createLoggerWithoutRequest({ functionName: "sendEmailVerificationEmail" });
  // Validate configuration
  const configResult = validateEmailConfig();
  if (!configResult.valid || !configResult.config) {
    const error = configResult.error || "Email configuration is invalid";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate email data
  if (!data.email || !data.verificationLink) {
    const error = "Email and verification link are required";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Check if test mode is enabled
  const testMode = isTestMode();

  // Determine recipient based on test mode
  const testRecipient = testMode
    ? getTestModeRecipient("invitation", data.email, data.email) // Reuse invitation type for test mode
    : data.email;

  const emailSubject = testMode
    ? `[TEST] Verify your email address`
    : `Verify your email address`;

  // Log test mode redirection if enabled
  if (testMode) {
    logger.info("Test mode: verification email redirected", {
      hasRecipient: Boolean(testRecipient),
      hasOriginalRecipient: Boolean(data.email),
    });
  }

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Verify Your Email Address</h2>
          <p>Thank you for signing up${
    data.organizationName ? ` with ${data.organizationName}` : ""
  }!</p>
          <p>Please click the button below to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.verificationLink}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${data.verificationLink}</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
      </body>
    </html>
  `;

  const requestBody: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    tags?: Array<{ name: string; value: string }>;
  } = {
    from: `Clean Log <noreply@${configResult.config.resendFromDomain}>`,
    to: [testRecipient],
    subject: emailSubject,
    html,
  };

  // Add test mode tags if in test mode
  if (testMode) {
    requestBody.tags = getTestModeTags("invitation", data.email, data.email);
  }

  try {
    logger.info("Sending verification email", { hasRecipient: Boolean(data.email) });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configResult.config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorBody: unknown;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = { message: errorText };
      }

      logger.error("Resend API error", undefined, {
        status: res.status,
        statusText: res.statusText,
        error: errorBody,
      });

      const errorMessage = (errorBody &&
        typeof errorBody === "object" &&
        "message" in errorBody &&
        typeof errorBody.message === "string" &&
        errorBody.message) ||
        res.statusText ||
        "Unknown error";

      const error = `Failed to send verification email: ${errorMessage}`;
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }

    const emailResponse = await res.json();
    const emailId = emailResponse.id;

    if (emailId) {
      logger.info("Verification email sent", { emailId });
      return { success: true, emailId };
    } else {
      logger.warn("Resend response missing ID");
      return { success: true };
    }
  } catch (error) {
    logger.error("Failed to send verification email", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to send verification email";
    if (throwOnError) {
      throw error;
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Get organization name from Supabase
 */
export async function getOrganizationName(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string> {
  const logger = createLoggerWithoutRequest({ functionName: "getOrganizationName" });
  const { data: organization, error: orgError } = await supabase
    .from("organization")
    .select("name")
    .eq("id", organizationId)
    .single();

  if (orgError) {
    logger.warn("Failed to fetch organization name", { error: orgError.message });
  }

  // Ensure orgName is always a non-null string
  const orgName: string = (
    organization?.name ||
    organizationId ||
    "Organization"
  ).toString();

  // Validate orgName is not null/empty
  if (!orgName || orgName === "null" || orgName.trim() === "") {
    throw new Error("Organization name is invalid");
  }

  return orgName;
}

/**
 * Validate email address using RFC-compliant regex
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;

  const trimmed = email.trim();
  if (trimmed === "") return false;

  // RFC 5322 compliant regex (simplified but covers most cases)
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return emailRegex.test(trimmed);
}

export interface InvoiceEmailData {
  invoiceNumber: string;
  organizationName: string;
  recipientEmails: string[];
  invoiceUrl?: string; // URL to view invoice (optional, can be added later)
  paymentLinkUrl?: string; // Stripe payment link URL (optional)
  total: number;
  currency: string;
  dueDate: string;
}

export interface InvoiceReminderEmailData {
  invoiceNumber: string;
  organizationName: string;
  recipientEmails: string[];
  invoiceUrl?: string;
  paymentLinkUrl?: string;
  total: number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  reminderCount: number;
}

export interface AdminInvoiceNotificationData {
  organizationName: string;
  recipientEmails: string[];
  invoiceCount: number;
  invoices: Array<{
    invoice_number: string;
    location_name: string;
    job_count: number;
    total: number;
    currency: string;
  }>;
  reviewUrl: string; // URL to the invoice review page
}

export interface PaymentConfirmationEmailData {
  invoiceNumber: string;
  organizationName: string;
  recipientEmails: string[];
  paymentAmount: number;
  currency: string;
  paymentMethod: string; // e.g., "Visa ending in 4242"
  transactionId: string; // Stripe payment intent ID
  paymentDate: string; // ISO date string
  invoiceUrl?: string; // URL to view invoice (optional)
  receiptDownloadUrl?: string; // Optional receipt download link
}

/**
 * Send invoice email via Resend API
 */
export async function sendInvoiceEmail(
  data: InvoiceEmailData,
  throwOnError = false,
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const logger = createLoggerWithoutRequest({ functionName: "sendInvoiceEmail" });
  // Check if email sending should be skipped entirely (for integration tests)
  // This prevents hitting Resend rate limits during testing
  // Check this FIRST before any validation or processing
  const skipEmailSendingEnv = Deno.env.get("SKIP_EMAIL_SENDING");
  const skipEmailSending = skipEmailSendingEnv === "true";

  logger.debug("Checked SKIP_EMAIL_SENDING", {
    hasValue: skipEmailSendingEnv !== undefined,
    willSkip: skipEmailSending,
  });

  if (skipEmailSending) {
    logger.info("Email sending skipped for integration tests", {
      emailType: "invoice",
      invoiceNumber: data.invoiceNumber,
      recipientCount: data.recipientEmails?.length ?? 0,
    });
    // Return success without actually sending
    return { success: true, emailId: `mock-email-${Date.now()}` };
  }

  // Validate configuration
  const configResult = validateEmailConfig();
  if (!configResult.valid || !configResult.config) {
    const error = configResult.error || "Email configuration is invalid";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate recipient emails
  if (!data.recipientEmails || data.recipientEmails.length === 0) {
    const error = "No recipient emails provided";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate all recipient emails
  for (const email of data.recipientEmails) {
    if (!isValidEmail(email)) {
      const error = "Invalid recipient email";
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }
  }

  // Format currency
  const currencySymbol = data.currency === "AUD"
    ? "A$"
    : data.currency === "USD"
    ? "$"
    : data.currency === "GBP"
    ? "£"
    : data.currency === "EUR"
    ? "€"
    : data.currency === "CAD"
    ? "C$"
    : data.currency === "NZD"
    ? "NZ$"
    : data.currency;

  const formattedTotal = `${currencySymbol}${data.total.toFixed(2)}`;

  // Format due date
  const dueDate = new Date(data.dueDate);
  const formattedDueDate = dueDate.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fromEmail =
    `${data.organizationName} <invoices@${configResult.config.resendFromDomain}>`;

  // Check if test mode is enabled
  const testMode = isTestMode();

  // Determine recipients and subject based on test mode
  // In test mode, redirect all recipients to test address
  const testRecipients = testMode
    ? data.recipientEmails.map((email) =>
      getTestModeRecipient("invoice", data.invoiceNumber, email)
    )
    : data.recipientEmails;

  const emailSubject = testMode
    ? `[TEST] Invoice ${data.invoiceNumber} from ${data.organizationName}`
    : `Invoice ${data.invoiceNumber} from ${data.organizationName}`;

  // Log test mode redirection if enabled
  if (testMode) {
    logger.info("Test mode: invoice email redirected", {
      invoiceNumber: data.invoiceNumber,
      testRecipientCount: testRecipients.length,
      originalRecipientCount: data.recipientEmails.length,
    });
  }

  // Build email HTML
  const invoiceUrlHtml = data.invoiceUrl
    ? `<p><a href="${data.invoiceUrl}" style="background-color: #6c757d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">View Invoice</a></p>`
    : "";

  const paymentLinkHtml = data.paymentLinkUrl
    ? `<p style="margin-top: 20px;"><a href="${data.paymentLinkUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Pay Now</a></p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .invoice-details { background-color: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
          .total { font-size: 18px; font-weight: bold; color: #007bff; margin-top: 20px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice ${data.invoiceNumber}</h1>
            <p>From: ${data.organizationName}</p>
          </div>
          <div class="invoice-details">
            <p>Dear Customer,</p>
            <p>Please find your invoice details below:</p>
            <ul>
              <li><strong>Invoice Number:</strong> ${data.invoiceNumber}</li>
              <li><strong>Total Amount:</strong> ${formattedTotal}</li>
              <li><strong>Due Date:</strong> ${formattedDueDate}</li>
            </ul>
            ${invoiceUrlHtml}
            ${paymentLinkHtml}
            <p class="total">Total Due: ${formattedTotal}</p>
          </div>
          <div class="footer">
            <p>This is an automated email from ${data.organizationName}.</p>
            <p>If you have any questions, please contact us.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const requestBody: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    tags?: Array<{ name: string; value: string }>;
  } = {
    from: fromEmail,
    to: testRecipients,
    subject: emailSubject,
    html: html,
  };

  // Add test mode tags if in test mode
  // Use first recipient for original-recipient tag (or combine all)
  if (testMode && data.recipientEmails.length > 0) {
    requestBody.tags = getTestModeTags(
      "invoice",
      data.invoiceNumber,
      data.recipientEmails.join(","),
    );
  }

  const requestBodyStr = JSON.stringify(requestBody);
  if (requestBodyStr.includes(":null") || requestBodyStr.includes("null,")) {
    logger.error("Request body contains null values");
    const error = "Request contains null values";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate from email
  if (
    !fromEmail ||
    fromEmail.includes("null") ||
    fromEmail.includes("undefined")
  ) {
    logger.error("Invalid from email address");
    const error = "Invalid from email address";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  try {
    if (testMode) {
      logger.info("Sending invoice email (test mode)", {
        invoiceNumber: data.invoiceNumber,
        testRecipientCount: testRecipients.length,
        originalRecipientCount: data.recipientEmails.length,
      });
    } else {
      logger.info("Sending invoice email", {
        invoiceNumber: data.invoiceNumber,
        recipientCount: data.recipientEmails.length,
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configResult.config.apiKey}`,
      },
      body: requestBodyStr,
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorBody: unknown;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = { message: errorText };
      }

      logger.error("Resend API error", undefined, {
        status: res.status,
        statusText: res.statusText,
        error: errorBody,
      });

      const errorMessage = (errorBody &&
        typeof errorBody === "object" &&
        "message" in errorBody &&
        typeof errorBody.message === "string" &&
        errorBody.message) ||
        (errorBody &&
          typeof errorBody === "object" &&
          "error" in errorBody &&
          errorBody.error &&
          typeof errorBody.error === "object" &&
          "message" in errorBody.error &&
          typeof errorBody.error.message === "string" &&
          errorBody.error.message) ||
        res.statusText ||
        "Unknown error";

      const error = `Failed to send invoice email: ${errorMessage}`;
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }

    const emailResponse = await res.json();
    const emailId = emailResponse.id;

    if (emailId) {
      if (testMode) {
        logger.info("Invoice email sent (test mode)", {
          mode: "test",
          emailType: "invoice",
          testRecipientCount: testRecipients.length,
          originalRecipientCount: data.recipientEmails.length,
          invoiceNumber: data.invoiceNumber,
          emailId,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.info("Invoice email sent", { emailId, invoiceNumber: data.invoiceNumber });
      }
      return { success: true, emailId };
    } else {
      logger.warn("Resend response missing ID");
      return { success: true }; // Consider it successful even without ID
    }
  } catch (error) {
    logger.error("Failed to send invoice email", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to send invoice email";
    if (throwOnError) {
      throw error;
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Send payment confirmation email via Resend API
 * This is a receipt-style email sent after successful payment
 */
export async function sendPaymentConfirmationEmail(
  data: PaymentConfirmationEmailData,
  throwOnError = false,
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const logger = createLoggerWithoutRequest({ functionName: "sendPaymentConfirmationEmail" });
  // Validate configuration
  const configResult = validateEmailConfig();
  if (!configResult.valid || !configResult.config) {
    const error = configResult.error || "Email configuration is invalid";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate recipient emails
  if (!data.recipientEmails || data.recipientEmails.length === 0) {
    const error = "No recipient emails provided";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate all recipient emails
  for (const email of data.recipientEmails) {
    if (!isValidEmail(email)) {
      const error = "Invalid recipient email";
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }
  }

  // Format currency
  const currencySymbol = data.currency === "AUD"
    ? "A$"
    : data.currency === "USD"
    ? "$"
    : data.currency === "GBP"
    ? "£"
    : data.currency === "EUR"
    ? "€"
    : data.currency === "CAD"
    ? "C$"
    : data.currency === "NZD"
    ? "NZ$"
    : data.currency;

  const formattedAmount = `${currencySymbol}${data.paymentAmount.toFixed(2)}`;

  // Format payment date
  const paymentDate = new Date(data.paymentDate);
  const formattedPaymentDate = paymentDate.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const fromEmail =
    `${data.organizationName} <payments@${configResult.config.resendFromDomain}>`;

  // Check if test mode is enabled
  const testMode = isTestMode();

  // Check if email sending should be skipped entirely (for integration tests)
  // This prevents hitting Resend rate limits during testing
  const skipEmailSendingEnv = Deno.env.get("SKIP_EMAIL_SENDING");
  const skipEmailSending = skipEmailSendingEnv === "true";

  if (skipEmailSending) {
    logger.info("Email sending skipped for integration tests", {
      emailType: "payment_confirmation",
      invoiceNumber: data.invoiceNumber,
      transactionId: data.transactionId,
      recipientCount: data.recipientEmails?.length ?? 0,
    });
    // Return success without actually sending
    return { success: true, emailId: `mock-payment-email-${Date.now()}` };
  }

  // Determine recipients and subject based on test mode
  // In test mode, redirect all recipients to test address
  const testRecipients = testMode
    ? data.recipientEmails.map((email) =>
      getTestModeRecipient("payment", data.transactionId, email)
    )
    : data.recipientEmails;

  const emailSubject = testMode
    ? `[TEST] Payment Confirmation - Invoice ${data.invoiceNumber}`
    : `Payment Confirmation - Invoice ${data.invoiceNumber}`;

  // Log test mode redirection if enabled
  if (testMode) {
    logger.info("Test mode: payment confirmation email redirected", {
      invoiceNumber: data.invoiceNumber,
      transactionId: data.transactionId,
      testRecipientCount: testRecipients.length,
      originalRecipientCount: data.recipientEmails.length,
    });
  }

  // Build email HTML with receipt-style layout
  const invoiceUrlHtml = data.invoiceUrl
    ? `<p><a href="${data.invoiceUrl}" style="background-color: #6c757d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">View Invoice</a></p>`
    : "";

  const receiptDownloadHtml = data.receiptDownloadUrl
    ? `<p><a href="${data.receiptDownloadUrl}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Download Receipt</a></p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #28a745; color: white; padding: 20px; border-radius: 5px 5px 0 0; margin-bottom: 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .receipt-details { background-color: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 0 0 5px 5px; }
          .receipt-section { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
          .receipt-section:last-child { border-bottom: none; }
          .receipt-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .receipt-label { font-weight: bold; color: #666; }
          .receipt-value { color: #333; }
          .amount-paid { font-size: 24px; font-weight: bold; color: #28a745; margin: 20px 0; text-align: center; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }
          .transaction-id { font-family: monospace; font-size: 12px; color: #666; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
          .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Payment Confirmed</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px;">Thank you for your payment</p>
          </div>
          <div class="receipt-details">
            <div class="receipt-section">
              <div class="amount-paid">Amount Paid: ${formattedAmount}</div>
            </div>
            
            <div class="receipt-section">
              <h2 style="margin-top: 0; font-size: 18px; color: #333;">Payment Details</h2>
              <div class="receipt-row">
                <span class="receipt-label">Invoice Number:</span>
                <span class="receipt-value">${data.invoiceNumber}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Payment Method:</span>
                <span class="receipt-value">${data.paymentMethod}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Transaction ID:</span>
                <span class="receipt-value transaction-id">${data.transactionId}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Payment Date:</span>
                <span class="receipt-value">${formattedPaymentDate}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Amount:</span>
                <span class="receipt-value">${formattedAmount}</span>
              </div>
            </div>

            ${invoiceUrlHtml}
            ${receiptDownloadHtml}

            <div class="footer">
              <p><strong>From:</strong> ${data.organizationName}</p>
              <p>This is an automated payment confirmation email. Please keep this email for your records.</p>
              <p>If you have any questions about this payment, please contact us.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const requestBody: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    tags?: Array<{ name: string; value: string }>;
  } = {
    from: fromEmail,
    to: testRecipients,
    subject: emailSubject,
    html: html,
  };

  // Add test mode tags if in test mode
  if (testMode && data.recipientEmails.length > 0) {
    requestBody.tags = getTestModeTags(
      "payment",
      data.transactionId,
      data.recipientEmails.join(","),
    );
  }

  const requestBodyStr = JSON.stringify(requestBody);
  if (requestBodyStr.includes(":null") || requestBodyStr.includes("null,")) {
    logger.error("Request body contains null values");
    const error = "Request contains null values";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate from email
  if (
    !fromEmail ||
    fromEmail.includes("null") ||
    fromEmail.includes("undefined")
  ) {
    logger.error("Invalid from email address");
    const error = "Invalid from email address";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  try {
    if (testMode) {
      logger.info("Sending payment confirmation email (test mode)", {
        invoiceNumber: data.invoiceNumber,
        transactionId: data.transactionId,
        testRecipientCount: testRecipients.length,
        originalRecipientCount: data.recipientEmails.length,
      });
    } else {
      logger.info("Sending payment confirmation email", {
        invoiceNumber: data.invoiceNumber,
        transactionId: data.transactionId,
        recipientCount: data.recipientEmails.length,
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configResult.config.apiKey}`,
      },
      body: requestBodyStr,
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorBody: unknown;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = { message: errorText };
      }

      logger.error("Resend API error", undefined, {
        status: res.status,
        statusText: res.statusText,
        error: errorBody,
      });

      const errorMessage = (errorBody &&
        typeof errorBody === "object" &&
        "message" in errorBody &&
        typeof errorBody.message === "string" &&
        errorBody.message) ||
        (errorBody &&
          typeof errorBody === "object" &&
          "error" in errorBody &&
          errorBody.error &&
          typeof errorBody.error === "object" &&
          "message" in errorBody.error &&
          typeof errorBody.error.message === "string" &&
          errorBody.error.message) ||
        res.statusText ||
        "Unknown error";

      const error =
        `Failed to send payment confirmation email: ${errorMessage}`;
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }

    const emailResponse = await res.json();
    const emailId = emailResponse.id;

    if (emailId) {
      if (testMode) {
        logger.info("Payment confirmation email sent (test mode)", {
          mode: "test",
          emailType: "payment",
          testRecipientCount: testRecipients.length,
          originalRecipientCount: data.recipientEmails.length,
          invoiceNumber: data.invoiceNumber,
          transactionId: data.transactionId,
          emailId,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.info("Payment confirmation email sent", {
          emailId,
          invoiceNumber: data.invoiceNumber,
          transactionId: data.transactionId,
        });
      }
      return { success: true, emailId };
    } else {
      logger.warn("Resend response missing ID");
      return { success: true }; // Consider it successful even without ID
    }
  } catch (error) {
    logger.error("Failed to send payment confirmation email", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to send payment confirmation email";
    if (throwOnError) {
      throw error;
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Send admin notification email when invoices are auto-generated
 */
export async function sendAdminInvoiceNotificationEmail(
  data: AdminInvoiceNotificationData,
  throwOnError = false,
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const logger = createLoggerWithoutRequest({ functionName: "sendAdminInvoiceNotificationEmail" });
  // Validate configuration
  const configResult = validateEmailConfig();
  if (!configResult.valid || !configResult.config) {
    const error = configResult.error || "Email configuration is invalid";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate recipient emails
  if (!data.recipientEmails || data.recipientEmails.length === 0) {
    const error = "No recipient emails provided";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate all recipient emails
  for (const email of data.recipientEmails) {
    if (!isValidEmail(email)) {
      const error = "Invalid recipient email";
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }
  }

  // Check if email sending should be skipped
  const skipEmailSendingEnv = Deno.env.get("SKIP_EMAIL_SENDING");
  const skipEmailSending = skipEmailSendingEnv === "true";

  if (skipEmailSending) {
    logger.info("Email sending skipped for integration tests", {
      emailType: "admin_invoice_notification",
      invoiceCount: data.invoiceCount,
      recipientCount: data.recipientEmails?.length ?? 0,
    });
    return { success: true, emailId: `mock-admin-notification-${Date.now()}` };
  }

  const fromEmail =
    `${data.organizationName} <noreply@${configResult.config.resendFromDomain}>`;

  // Check if test mode is enabled
  const testMode = isTestMode();

  // Format invoice list
  const invoiceListHtml = data.invoices.map((inv) => {
    const currencySymbol = inv.currency === "AUD"
      ? "A$"
      : inv.currency === "USD"
      ? "$"
      : inv.currency === "GBP"
      ? "£"
      : inv.currency === "EUR"
      ? "€"
      : inv.currency === "CAD"
      ? "C$"
      : inv.currency === "NZD"
      ? "NZ$"
      : inv.currency;
    const formattedTotal = `${currencySymbol}${inv.total.toFixed(2)}`;
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inv.invoice_number}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inv.location_name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inv.job_count} job(s)</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formattedTotal}</td>
      </tr>
    `;
  }).join("");

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1f2937; margin-top: 0;">New Invoices Ready for Review</h2>
        <p>Hello,</p>
        <p>${data.invoiceCount} new invoice${
    data.invoiceCount === 1 ? "" : "s"
  } ${
    data.invoiceCount === 1 ? "has" : "have"
  } been automatically generated and ${
    data.invoiceCount === 1 ? "is" : "are"
  } ready for your review.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Invoice #</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Location</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Jobs</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #d1d5db;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceListHtml}
          </tbody>
        </table>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${data.reviewUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Review Invoices</a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          This is an automated notification from ${data.organizationName}.
        </p>
      </body>
    </html>
  `;

  const emailText = `
New Invoices Ready for Review

Hello,

${data.invoiceCount} new invoice${data.invoiceCount === 1 ? "" : "s"} ${
    data.invoiceCount === 1 ? "has" : "have"
  } been automatically generated and ${
    data.invoiceCount === 1 ? "is" : "are"
  } ready for your review.

${
    data.invoices.map((inv) =>
      `- ${inv.invoice_number}: ${inv.location_name} (${inv.job_count} job(s)) - ${inv.currency} ${
        inv.total.toFixed(2)
      }`
    ).join("\n")
  }

Review invoices: ${data.reviewUrl}

This is an automated notification from ${data.organizationName}.
  `;

  // Determine recipients based on test mode
  const testRecipients = testMode
    ? data.recipientEmails.map((email, idx) =>
      getTestModeRecipient("invoice", `admin-${idx}`, email)
    )
    : data.recipientEmails;

  const emailSubject = testMode
    ? `[TEST] ${data.invoiceCount} New Invoice${
      data.invoiceCount === 1 ? "" : "s"
    } Ready for Review - ${data.organizationName}`
    : `${data.invoiceCount} New Invoice${
      data.invoiceCount === 1 ? "" : "s"
    } Ready for Review - ${data.organizationName}`;

  const requestBody = {
    from: fromEmail,
    to: testRecipients,
    subject: emailSubject,
    html: emailHtml,
    text: emailText,
  };

  const requestBodyStr = JSON.stringify(requestBody);

  try {
    if (testMode) {
      logger.info("Sending admin invoice notification email (test mode)", {
        invoiceCount: data.invoiceCount,
        testRecipientCount: testRecipients.length,
        originalRecipientCount: data.recipientEmails.length,
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configResult.config.apiKey}`,
      },
      body: requestBodyStr,
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorBody: unknown;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = { message: errorText };
      }

      logger.error("Resend API error", undefined, {
        status: res.status,
        statusText: res.statusText,
        error: errorBody,
      });

      const errorMessage = (errorBody &&
        typeof errorBody === "object" &&
        "message" in errorBody &&
        typeof errorBody.message === "string" &&
        errorBody.message) ||
        (errorBody &&
          typeof errorBody === "object" &&
          "error" in errorBody &&
          errorBody.error &&
          typeof errorBody.error === "object" &&
          "message" in errorBody.error &&
          typeof errorBody.error.message === "string" &&
          errorBody.error.message) ||
        res.statusText ||
        "Unknown error";

      const error = `Failed to send admin notification email: ${errorMessage}`;
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }

    const emailResponse = await res.json();
    const emailId = emailResponse.id;

    if (emailId) {
      if (testMode) {
        logger.info("Admin invoice notification email sent (test mode)", {
          mode: "test",
          emailType: "admin_notification",
          testRecipientCount: testRecipients.length,
          originalRecipientCount: data.recipientEmails.length,
          invoiceCount: data.invoiceCount,
          emailId,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.info("Admin invoice notification email sent", {
          emailId,
          invoiceCount: data.invoiceCount,
        });
      }
      return { success: true, emailId };
    } else {
      logger.warn("Resend response missing ID");
      return { success: true };
    }
  } catch (error) {
    logger.error("Failed to send admin invoice notification email", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to send admin notification email";
    if (throwOnError) {
      throw error;
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Send invoice reminder email via Resend API
 * Used for overdue invoices with more urgent messaging
 */
export async function sendInvoiceReminderEmail(
  data: InvoiceReminderEmailData,
  throwOnError = false,
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const logger = createLoggerWithoutRequest({ functionName: "sendInvoiceReminderEmail" });
  // Check if email sending should be skipped
  const skipEmailSendingEnv = Deno.env.get("SKIP_EMAIL_SENDING");
  const skipEmailSending = skipEmailSendingEnv === "true";

  if (skipEmailSending) {
    logger.info("Email sending skipped for integration tests", {
      emailType: "invoice_reminder",
      invoiceNumber: data.invoiceNumber,
      recipientCount: data.recipientEmails?.length ?? 0,
    });
    return { success: true, emailId: `mock-reminder-email-${Date.now()}` };
  }

  // Validate configuration
  const configResult = validateEmailConfig();
  if (!configResult.valid || !configResult.config) {
    const error = configResult.error || "Email configuration is invalid";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate recipient emails
  if (!data.recipientEmails || data.recipientEmails.length === 0) {
    const error = "No recipient emails provided";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate all recipient emails
  for (const email of data.recipientEmails) {
    if (!isValidEmail(email)) {
      const error = "Invalid recipient email";
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }
  }

  // Format currency
  const currencySymbol = data.currency === "AUD"
    ? "A$"
    : data.currency === "USD"
    ? "$"
    : data.currency === "GBP"
    ? "£"
    : data.currency === "EUR"
    ? "€"
    : data.currency === "CAD"
    ? "C$"
    : data.currency === "NZD"
    ? "NZ$"
    : data.currency;

  const formattedTotal = `${currencySymbol}${data.total.toFixed(2)}`;

  // Format due date
  const dueDate = new Date(data.dueDate);
  const formattedDueDate = dueDate.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fromEmail =
    `${data.organizationName} <invoices@${configResult.config.resendFromDomain}>`;

  // Check if test mode is enabled
  const testMode = isTestMode();

  // Determine recipients based on test mode
  const testRecipients = testMode
    ? data.recipientEmails.map((email) =>
      getTestModeRecipient("invoice", `reminder-${data.invoiceNumber}`, email)
    )
    : data.recipientEmails;

  // Urgent subject line
  const urgencyPrefix = data.daysOverdue > 14 ? "URGENT: " : "";
  const reminderLabel = data.reminderCount > 1 ? `(Reminder #${data.reminderCount}) ` : "";
  
  const emailSubject = testMode
    ? `[TEST] ${urgencyPrefix}${reminderLabel}Payment Overdue - Invoice ${data.invoiceNumber}`
    : `${urgencyPrefix}${reminderLabel}Payment Overdue - Invoice ${data.invoiceNumber}`;

  // Log test mode redirection if enabled
  if (testMode) {
    logger.info("Test mode: invoice reminder email redirected", {
      invoiceNumber: data.invoiceNumber,
      daysOverdue: data.daysOverdue,
      testRecipientCount: testRecipients.length,
      originalRecipientCount: data.recipientEmails.length,
    });
  }

  // Build email HTML with urgent styling
  const urgentBannerColor = data.daysOverdue > 14 ? "#dc2626" : data.daysOverdue > 7 ? "#ea580c" : "#f59e0b";
  
  const paymentLinkHtml = data.paymentLinkUrl
    ? `<p style="margin-top: 20px; text-align: center;"><a href="${data.paymentLinkUrl}" style="background-color: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Pay Now - ${formattedTotal}</a></p>`
    : "";

  const invoiceUrlHtml = data.invoiceUrl
    ? `<p style="text-align: center;"><a href="${data.invoiceUrl}" style="color: #6b7280; text-decoration: underline; font-size: 14px;">View Invoice Details</a></p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .urgent-banner { background-color: ${urgentBannerColor}; color: white; padding: 15px 20px; border-radius: 5px 5px 0 0; text-align: center; }
          .urgent-banner h2 { margin: 0; font-size: 20px; }
          .content { background-color: #fff; border: 1px solid #ddd; padding: 25px; border-radius: 0 0 5px 5px; }
          .overdue-details { background-color: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .amount { font-size: 28px; font-weight: bold; color: ${urgentBannerColor}; text-align: center; margin: 20px 0; }
          .footer { margin-top: 25px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="urgent-banner">
            <h2>⚠️ Payment Overdue</h2>
          </div>
          <div class="content">
            <p>Dear Customer,</p>
            <p><strong>This is a reminder that payment for invoice ${data.invoiceNumber} is now overdue.</strong></p>
            
            <div class="overdue-details">
              <p style="margin: 0;"><strong>Invoice:</strong> ${data.invoiceNumber}</p>
              <p style="margin: 8px 0;"><strong>Original Due Date:</strong> ${formattedDueDate}</p>
              <p style="margin: 8px 0;"><strong>Days Overdue:</strong> <span style="color: ${urgentBannerColor}; font-weight: bold;">${data.daysOverdue} days</span></p>
            </div>

            <div class="amount">Amount Due: ${formattedTotal}</div>

            ${paymentLinkHtml}
            ${invoiceUrlHtml}

            <p style="margin-top: 25px;">If you have already made payment, please disregard this reminder. Otherwise, please arrange payment at your earliest convenience to avoid any further action.</p>
            
            <p>If you are experiencing difficulties with payment or have any questions regarding this invoice, please contact us immediately.</p>

            <div class="footer">
              <p>This is an automated reminder from ${data.organizationName}.</p>
              <p>If you believe you have received this email in error, please contact us.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const requestBody: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    tags?: Array<{ name: string; value: string }>;
  } = {
    from: fromEmail,
    to: testRecipients,
    subject: emailSubject,
    html: html,
  };

  // Add test mode tags if in test mode
  if (testMode && data.recipientEmails.length > 0) {
    requestBody.tags = getTestModeTags(
      "invoice",
      `reminder-${data.invoiceNumber}`,
      data.recipientEmails.join(","),
    );
  }

  const requestBodyStr = JSON.stringify(requestBody);
  if (requestBodyStr.includes(":null") || requestBodyStr.includes("null,")) {
    logger.error("Request body contains null values");
    const error = "Request contains null values";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  try {
    logger.info("Sending invoice reminder email", {
      invoiceNumber: data.invoiceNumber,
      daysOverdue: data.daysOverdue,
      reminderCount: data.reminderCount,
      recipientCount: testRecipients.length,
      testMode,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configResult.config.apiKey}`,
      },
      body: requestBodyStr,
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorBody: unknown;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = { message: errorText };
      }

      logger.error("Resend API error", undefined, {
        status: res.status,
        statusText: res.statusText,
        error: errorBody,
      });

      const errorMessage = (errorBody &&
        typeof errorBody === "object" &&
        "message" in errorBody &&
        typeof errorBody.message === "string" &&
        errorBody.message) ||
        res.statusText ||
        "Unknown error";

      const error = `Failed to send invoice reminder email: ${errorMessage}`;
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }

    const emailResponse = await res.json();
    const emailId = emailResponse.id;

    if (emailId) {
      if (testMode) {
        logger.info("Invoice reminder email sent (test mode)", {
          mode: "test",
          emailType: "invoice_reminder",
          testRecipientCount: testRecipients.length,
          originalRecipientCount: data.recipientEmails.length,
          invoiceNumber: data.invoiceNumber,
          daysOverdue: data.daysOverdue,
          emailId,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.info("Invoice reminder email sent", {
          emailId,
          invoiceNumber: data.invoiceNumber,
        });
      }
      return { success: true, emailId };
    } else {
      logger.warn("Resend response missing ID");
      return { success: true };
    }
  } catch (error) {
    logger.error("Failed to send invoice reminder email", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to send invoice reminder email";
    if (throwOnError) {
      throw error;
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Admin invitation email data
 */
export interface AdminInvitationEmailData {
  email: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  invitationLink: string;
  role: "admin" | "viewer";
}

/**
 * Send admin user invitation email via Resend API
 * This is for inviting dashboard users (admins/viewers), not workers
 */
export async function sendAdminInvitationEmail(
  data: AdminInvitationEmailData,
  throwOnError = false,
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  const logger = createLoggerWithoutRequest({ functionName: "sendAdminInvitationEmail" });
  // Validate configuration
  const configResult = validateEmailConfig();
  if (!configResult.valid || !configResult.config) {
    const error = configResult.error || "Email configuration is invalid";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Validate email data
  if (!data.email || !data.invitationLink || !data.organizationName) {
    const error = "Email, invitation link, and organization name are required";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  // Check if test mode is enabled
  const testMode = isTestMode();

  // Determine recipient based on test mode
  const testRecipient = testMode
    ? getTestModeRecipient("invitation", data.email, data.email)
    : data.email;

  const roleName = data.role === "admin" ? "Administrator" : "Viewer";
  const emailSubject = testMode
    ? `[TEST] You've been invited to join ${data.organizationName}`
    : `You've been invited to join ${data.organizationName}`;

  // Log test mode redirection if enabled
  if (testMode) {
    logger.info("Test mode: admin invitation email redirected", {
      hasRecipient: Boolean(testRecipient),
      hasOriginalRecipient: Boolean(data.email),
    });
  }

  const userName = data.firstName
    ? `${data.firstName}${data.lastName ? ` ${data.lastName}` : ""}`
    : "there";

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">You're Invited to Join ${data.organizationName}</h2>
          <p>Hi ${userName},</p>
          <p>You've been invited to join <strong>${data.organizationName}</strong> as a <strong>${roleName}</strong> on the Clean Log dashboard.</p>
          <p>${
    data.role === "admin"
      ? "As an Administrator, you'll be able to manage workers, jobs, invoices, and organization settings."
      : "As a Viewer, you'll be able to view workers, jobs, invoices, and reports."
  }</p>
          <p>Click the button below to set up your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.invitationLink}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${data.invitationLink}</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This invitation link will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      </body>
    </html>
  `;

  const requestBody: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    tags?: Array<{ name: string; value: string }>;
  } = {
    // Future note: we intend to send admin/org emails from a dedicated
    // "admin users (organizations)" domain for a more professional experience.
    // For now, allow an override while defaulting to `RESEND_FROM_DOMAIN`.
    from: `${data.organizationName} <invitations@${
      Deno.env.get("RESEND_ADMIN_INVITES_FROM_DOMAIN") ||
      configResult.config.resendFromDomain
    }>`,
    to: [testRecipient],
    subject: emailSubject,
    html,
  };

  // Add test mode tags if in test mode
  if (testMode) {
    requestBody.tags = getTestModeTags("invitation", data.email, data.email);
  }

  try {
    logger.info("Sending admin invitation email", { hasRecipient: Boolean(data.email) });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configResult.config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorBody: unknown;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        errorBody = { message: errorText };
      }

      logger.error("Resend API error", undefined, {
        status: res.status,
        statusText: res.statusText,
        error: errorBody,
      });

      const errorMessage = (errorBody &&
        typeof errorBody === "object" &&
        "message" in errorBody &&
        typeof errorBody.message === "string" &&
        errorBody.message) ||
        res.statusText ||
        "Unknown error";

      const error = `Failed to send admin invitation email: ${errorMessage}`;
      if (throwOnError) {
        throw new Error(error);
      }
      return { success: false, error };
    }

    const emailResponse = await res.json();
    const emailId = emailResponse.id;

    if (emailId) {
      if (testMode) {
        logger.info("Admin invitation email sent (test mode)", {
          emailType: "admin_invitation",
          emailId,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.info("Admin invitation email sent", { emailId });
      }
      return { success: true, emailId };
    } else {
      logger.warn("Resend response missing ID");
      return { success: true };
    }
  } catch (error) {
    logger.error("Failed to send admin invitation email", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to send admin invitation email";
    if (throwOnError) {
      throw error;
    }
    return { success: false, error: errorMessage };
  }
}
