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
 * Format worker invitation email data
 */
export function formatWorkerInvitationData(
  data: WorkerInvitationData,
  config: EmailConfig
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
  const workerName =
    data.workerName.charAt(0).toUpperCase() +
    data.workerName.substring(1).toLowerCase();

  // Ensure base URL doesn't end with /
  const baseUrl = config.workerInvitationBaseUrl.replace(/\/$/, "");
  const invitationLink = `${baseUrl}/worker/accept-invite/${data.invitationToken}`;

  const templateVariables = {
    WORKER_NAME: workerName || "Worker",
    ORGANIZATION_NAME: data.organizationName || "Organization",
    INVITATION_LINK: invitationLink,
  };

  const fromEmail = `${data.organizationName} <onboarding@${config.resendFromDomain}>`;
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
  invitationToken: string
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
  throwOnError = false
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
    data.invitationToken
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

  //   TODO - Troubleshoot why template isn't working.
  // Final validation - ensure email doesn't contain null values
  const requestBody = {
    from: emailData.from,
    to: emailData.to,
    subject: emailData.subject,
    // template: {
    //   id: "cleanlogworkerinvite",
    //   variables: emailData.templateVariables,
    // },
    html: `<p>Click this to sign up - ${emailData.templateVariables.INVITATION_LINK}</p>`,
  };

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

      const errorMessage =
        (errorBody &&
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
      console.log("Invitation email sent successfully:", emailId);
      return { success: true, emailId };
    } else {
      console.warn("Resend response missing ID:", emailResponse);
      return { success: true }; // Consider it successful even without ID
    }
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    const errorMessage =
      error instanceof Error
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
  organizationId: string
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
