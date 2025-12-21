// Email utilities for Edge Functions
// Provides email sending functionality using Resend API

import type { SupabaseClient } from "@supabase/supabase-js";

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

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
  config?: EmailConfig;
}

/**
 * Validate email configuration environment variables
 */
export function validateEmailConfig(): EmailValidationResult {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const resendFromDomain = Deno.env.get("RESEND_FROM_DOMAIN");
  const workerInvitationBaseUrl = Deno.env.get("WORKER_INVITATION_BASE_URL");

  // Check if environment variables are set AND not the string "null" or "undefined"
  if (!apiKey || apiKey === "null" || apiKey === "undefined") {
    console.error("RESEND_API_KEY is not set or invalid!");
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
    console.error("RESEND_FROM_DOMAIN is not set or invalid!");
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
    console.error("WORKER_INVITATION_BASE_URL is not set or invalid!");
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
    console.log(
      "[TEST MODE] Worker invitation email redirected to test address",
      {
        testRecipient,
        originalRecipient: data.workerEmail,
        invitationToken: data.invitationToken,
      },
    );
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
    console.error("Request body contains null values:", requestBodyStr);
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
    console.error("Invalid fromEmail:", emailData.from);
    const error = "Invalid from email address";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  try {
    console.log("Sending invitation email to:", data.workerEmail);
    console.log("Template variables:", emailData.templateVariables);

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

      console.error("Resend API error:", {
        status: res.status,
        statusText: res.statusText,
        error: errorBody,
        rawResponse: errorText,
        requestBody: requestBodyStr,
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
        console.log(
          "[TEST MODE] Worker invitation email sent to test address",
          {
            mode: "test",
            emailType: "invitation",
            testRecipient,
            originalRecipient: data.workerEmail,
            invitationToken: data.invitationToken,
            emailId,
            timestamp: new Date().toISOString(),
          },
        );
      } else {
        console.log("Invitation email sent successfully:", emailId);
      }
      return { success: true, emailId };
    } else {
      console.warn("Resend response missing ID:", emailResponse);
      return { success: true }; // Consider it successful even without ID
    }
  } catch (error) {
    console.error("Failed to send invitation email:", error);
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
 * Get organization name from Supabase
 */
export async function getOrganizationName(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string> {
  const { data: organization, error: orgError } = await supabase
    .from("organization")
    .select("name")
    .eq("id", organizationId)
    .single();

  if (orgError) {
    console.error("Failed to fetch organization name:", orgError);
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
  // Check if email sending should be skipped entirely (for integration tests)
  // This prevents hitting Resend rate limits during testing
  // Check this FIRST before any validation or processing
  const skipEmailSendingEnv = Deno.env.get("SKIP_EMAIL_SENDING");
  const skipEmailSending = skipEmailSendingEnv === "true";

  // Debug logging to verify env var is being read
  console.log("[SKIP EMAIL DEBUG] Checking SKIP_EMAIL_SENDING:", {
    value: skipEmailSendingEnv,
    willSkip: skipEmailSending,
    allEnvKeys: Object.keys(Deno.env.toObject()).filter((k) =>
      k.includes("SKIP") || k.includes("RESEND")
    ),
  });

  if (skipEmailSending) {
    console.log("[SKIP EMAIL] Email sending skipped for integration tests", {
      invoiceNumber: data.invoiceNumber,
      recipients: data.recipientEmails,
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
      const error = `Invalid recipient email: ${email}`;
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
    console.log("[TEST MODE] Invoice email redirected to test addresses", {
      testRecipients,
      originalRecipients: data.recipientEmails,
      invoiceNumber: data.invoiceNumber,
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
    console.error("Request body contains null values:", requestBodyStr);
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
    console.error("Invalid fromEmail:", fromEmail);
    const error = "Invalid from email address";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  try {
    if (testMode) {
      console.log("[TEST MODE] Sending invoice email to test addresses", {
        invoiceNumber: data.invoiceNumber,
        testRecipients,
        originalRecipients: data.recipientEmails,
      });
    } else {
      console.log("Sending invoice email:", {
        invoiceNumber: data.invoiceNumber,
        recipients: data.recipientEmails,
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

      console.error("Resend API error:", {
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
        console.log("[TEST MODE] Invoice email sent to test addresses", {
          mode: "test",
          emailType: "invoice",
          testRecipients,
          originalRecipients: data.recipientEmails,
          invoiceNumber: data.invoiceNumber,
          emailId,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log("Invoice email sent successfully:", emailId);
      }
      return { success: true, emailId };
    } else {
      console.warn("Resend response missing ID:", emailResponse);
      return { success: true }; // Consider it successful even without ID
    }
  } catch (error) {
    console.error("Failed to send invoice email:", error);
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
      const error = `Invalid recipient email: ${email}`;
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
    console.log(
      "[SKIP EMAIL] Payment confirmation email sending skipped for integration tests",
      {
        invoiceNumber: data.invoiceNumber,
        transactionId: data.transactionId,
        recipients: data.recipientEmails,
      },
    );
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
    console.log(
      "[TEST MODE] Payment confirmation email redirected to test addresses",
      {
        testRecipients,
        originalRecipients: data.recipientEmails,
        invoiceNumber: data.invoiceNumber,
        transactionId: data.transactionId,
      },
    );
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
    console.error("Request body contains null values:", requestBodyStr);
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
    console.error("Invalid fromEmail:", fromEmail);
    const error = "Invalid from email address";
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, error };
  }

  try {
    if (testMode) {
      console.log(
        "[TEST MODE] Sending payment confirmation email to test addresses",
        {
          invoiceNumber: data.invoiceNumber,
          transactionId: data.transactionId,
          testRecipients,
          originalRecipients: data.recipientEmails,
        },
      );
    } else {
      console.log("Sending payment confirmation email:", {
        invoiceNumber: data.invoiceNumber,
        transactionId: data.transactionId,
        recipients: data.recipientEmails,
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

      console.error("Resend API error:", {
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
        console.log(
          "[TEST MODE] Payment confirmation email sent to test addresses",
          {
            mode: "test",
            emailType: "payment",
            testRecipients,
            originalRecipients: data.recipientEmails,
            invoiceNumber: data.invoiceNumber,
            transactionId: data.transactionId,
            emailId,
            timestamp: new Date().toISOString(),
          },
        );
      } else {
        console.log("Payment confirmation email sent successfully:", emailId);
      }
      return { success: true, emailId };
    } else {
      console.warn("Resend response missing ID:", emailResponse);
      return { success: true }; // Consider it successful even without ID
    }
  } catch (error) {
    console.error("Failed to send payment confirmation email:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to send payment confirmation email";
    if (throwOnError) {
      throw error;
    }
    return { success: false, error: errorMessage };
  }
}
