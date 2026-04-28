/**
 * Edge function: send-worker-remittance-email
 * S2 §5: Send remittance email to worker. Payment recording is primary;
 * email failure does NOT roll back paid status.
 */
import { serve } from "server";
import {
  extractAuthToken,
  getAuthUser,
  verifyOrganizationMembership,
} from "../_utils/auth.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";
import {
  validateEmailConfig,
  isTestMode,
  getTestModeRecipient,
  getTestModeTags,
  isValidEmail,
} from "../_utils/email.ts";
import { resolveOrgMailFrom } from "../_utils/org-mail-from.ts";

interface RemittanceLineItem {
  jobName: string;
  amount: number;
  paidAt: string | null;
  paymentReference: string | null;
  pool_weight?: number | null;
  hours_worked?: number | null;
}

interface SendWorkerRemittanceRequest {
  organization_id: string;
  worker_email: string;
  worker_name: string;
  period_label: string;
  currency: string;
  lines: RemittanceLineItem[];
  payment_method?: string | null;
  payment_reference?: string | null;
  payment_date?: string | null;
  total_amount: number;
}

function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    AUD: "A$",
    USD: "$",
    GBP: "£",
    EUR: "€",
    CAD: "C$",
    NZD: "NZ$",
  };
  const symbol = symbols[currency] ?? currency;
  return `${symbol}${amount.toFixed(2)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-AU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function buildEmailHtml(
  data: SendWorkerRemittanceRequest,
  organizationName: string
): string {
  const formattedTotal = formatCurrency(data.total_amount, data.currency);
  const paymentMethodLabel = data.payment_method
    ? data.payment_method.replace(/_/g, " ")
    : null;

  const showSplit = data.lines.some(
    (l) =>
      (l.pool_weight != null && Number.isFinite(l.pool_weight as number)) ||
      (l.hours_worked != null && Number.isFinite(l.hours_worked as number) && (l.hours_worked as number) > 0),
  );

  const fmtW = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return "—";
    return Number.isInteger(n) ? String(n) : (n as number).toFixed(1);
  };

  const linesHtml = data.lines
    .map(
      (line) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${line.jobName}</td>
        ${
    showSplit
      ? `<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${fmtW(line.pool_weight)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${fmtW(line.hours_worked)}</td>`
      : ""
  }
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(line.amount, data.currency)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatDate(line.paidAt)}</td>
      </tr>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
          <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #1f2937;">Remittance Advice</h1>
          <p style="margin: 0; color: #6b7280;">${organizationName}</p>
        </div>

        <div style="margin-bottom: 24px;">
          <p style="margin: 0 0 16px 0;">Hi ${data.worker_name},</p>
          <p style="margin: 0;">This is to confirm that the following payment has been recorded for the period <strong>${data.period_label}</strong>.</p>
        </div>

        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0 0 4px 0; font-size: 14px; color: #065f46;">Total Amount</p>
          <p style="margin: 0; font-size: 28px; font-weight: bold; color: #047857;">${formattedTotal}</p>
        </div>

        ${
          paymentMethodLabel || data.payment_reference || data.payment_date
            ? `
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 16px; color: #374151; margin: 0 0 12px 0;">Payment Details</h2>
          ${paymentMethodLabel ? `<p style="margin: 4px 0;"><strong>Method:</strong> ${paymentMethodLabel}</p>` : ""}
          ${data.payment_reference ? `<p style="margin: 4px 0;"><strong>Reference:</strong> ${data.payment_reference}</p>` : ""}
          ${data.payment_date ? `<p style="margin: 4px 0;"><strong>Date:</strong> ${formatDate(data.payment_date)}</p>` : ""}
        </div>
        `
            : ""
        }

        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 16px; color: #374151; margin: 0 0 12px 0;">Itemised Jobs (${data.lines.length})</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 10px 8px; text-align: left; border-bottom: 2px solid #d1d5db; font-size: 14px;">Job</th>
                ${
  showSplit
    ? `<th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid #d1d5db; font-size: 12px;">Wt</th>
                <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid #d1d5db; font-size: 12px;">Hrs</th>`
    : ""
}
                <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid #d1d5db; font-size: 14px;">Amount</th>
                <th style="padding: 10px 8px; text-align: right; border-bottom: 2px solid #d1d5db; font-size: 14px;">Paid</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
            </tbody>
            <tfoot>
              <tr style="background-color: #f9fafb;">
                <td style="padding: 12px 8px; font-weight: bold;">Total</td>
                ${
  showSplit
    ? `<td style="padding: 12px 8px;"></td>
                <td style="padding: 12px 8px;"></td>`
    : ""
}
                <td style="padding: 12px 8px; text-align: right; font-weight: bold;">${formattedTotal}</td>
                <td style="padding: 12px 8px;"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0 0 8px 0;">This is a record of payments as stored in Tally. It is not a bank statement or official payslip.</p>
          <p style="margin: 0;">If you have questions about this payment, please contact ${organizationName}.</p>
        </div>
      </body>
    </html>
  `;
}

function buildEmailText(
  data: SendWorkerRemittanceRequest,
  organizationName: string
): string {
  const formattedTotal = formatCurrency(data.total_amount, data.currency);
  const paymentMethodLabel = data.payment_method
    ? data.payment_method.replace(/_/g, " ")
    : null;

  const linesText = data.lines
    .map((line) => `- ${line.jobName}: ${formatCurrency(line.amount, data.currency)}`)
    .join("\n");

  return `
Remittance Advice from ${organizationName}

Hi ${data.worker_name},

This is to confirm that the following payment has been recorded for the period ${data.period_label}.

Total Amount: ${formattedTotal}

${paymentMethodLabel ? `Payment Method: ${paymentMethodLabel}\n` : ""}${data.payment_reference ? `Reference: ${data.payment_reference}\n` : ""}${data.payment_date ? `Date: ${formatDate(data.payment_date)}\n` : ""}

Itemised Jobs:
${linesText}

---
This is a record of payments as stored in Tally. It is not a bank statement or official payslip.
If you have questions about this payment, please contact ${organizationName}.
`.trim();
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "send-worker-remittance-email",
  });

  try {
    const body = (await req.json()) as SendWorkerRemittanceRequest;

    const validation = validateRequiredFields(
      body as unknown as Record<string, unknown>,
      ["organization_id", "worker_email", "worker_name", "period_label", "currency", "lines", "total_amount"]
    );

    if (!validation.valid) {
      logger.warn("Missing required fields", {
        missingFields: validation.missingFields,
      });
      return errorResponse("Missing required fields", 400);
    }

    const {
      organization_id,
      worker_email,
      worker_name,
      period_label,
      currency,
      lines,
      payment_method,
      payment_reference,
      payment_date,
      total_amount,
    } = body;

    if (!isValidEmail(worker_email)) {
      return errorResponse("Invalid worker email address", 400);
    }

    if (!lines || lines.length === 0) {
      return errorResponse("At least one line item is required", 400);
    }

    let userId: string | null = null;
    let userEmail: string | null = null;
    const token = extractAuthToken(req);
    if (token) {
      const authUser = await getAuthUser(token);
      if (authUser?.id) {
        userId = authUser.id;
        userEmail = authUser.email ?? null;
      }
    }

    const supabase = createServiceRoleClient();

    const { data: org, error: orgError } = await supabase
      .from("organization")
      .select("id, name")
      .eq("id", organization_id)
      .single();

    if (orgError || !org) {
      return errorResponse("Organization not found", 404);
    }

    if (userId || userEmail) {
      const isMember = await verifyOrganizationMembership(
        supabase,
        organization_id,
        userEmail,
        userId
      );
      if (!isMember) {
        return errorResponse(
          "You do not have permission to access this organization",
          403
        );
      }
    }

    const configResult = validateEmailConfig();
    if (!configResult.valid || !configResult.config) {
      logger.warn("Email configuration invalid", {
        error: configResult.error,
      });
      return jsonResponse({
        ok: false,
        code: "EMAIL_NOT_CONFIGURED",
        message: configResult.error || "Email service is not configured",
      });
    }

    const resolvedFrom = await resolveOrgMailFrom({
      supabase,
      organizationId: organization_id,
      organizationName: org.name,
      mailKind: "worker_remittance",
      platformDomain: configResult.config.resendFromDomain,
    });

    logger.info("Email from resolved", {
      mail_kind: "worker_remittance",
      from_domain_source: resolvedFrom.fromDomainSource,
      organization_id,
    });

    const testMode = isTestMode();
    const testRecipient = testMode
      ? getTestModeRecipient("payment", `remittance-${Date.now()}`, worker_email)
      : worker_email;

    const emailSubject = testMode
      ? `[TEST] Payment Remittance - ${period_label}`
      : `Payment Remittance - ${period_label}`;

    if (testMode) {
      logger.info("Test mode: worker remittance email redirected", {
        hasRecipient: Boolean(testRecipient),
        hasOriginalRecipient: Boolean(worker_email),
      });
    }

    const html = buildEmailHtml(
      {
        organization_id,
        worker_email,
        worker_name,
        period_label,
        currency,
        lines,
        payment_method,
        payment_reference,
        payment_date,
        total_amount,
      },
      org.name
    );

    const text = buildEmailText(
      {
        organization_id,
        worker_email,
        worker_name,
        period_label,
        currency,
        lines,
        payment_method,
        payment_reference,
        payment_date,
        total_amount,
      },
      org.name
    );

    const requestBody: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
      tags?: Array<{ name: string; value: string }>;
    } = {
      from: resolvedFrom.from,
      to: [testRecipient],
      subject: emailSubject,
      html,
      text,
    };

    if (testMode) {
      requestBody.tags = getTestModeTags("payment", `remittance-${Date.now()}`, worker_email);
    }

    const skipEmailSending = Deno.env.get("SKIP_EMAIL_SENDING") === "true";
    if (skipEmailSending) {
      logger.info("Email sending skipped for integration tests", {
        emailType: "worker_remittance",
        worker_email,
      });
      return jsonResponse({
        ok: true,
        emailId: `mock-remittance-email-${Date.now()}`,
      });
    }

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

      const errorMessage =
        (errorBody &&
          typeof errorBody === "object" &&
          "message" in errorBody &&
          typeof errorBody.message === "string" &&
          errorBody.message) ||
        res.statusText ||
        "Unknown error";

      return jsonResponse({
        ok: false,
        code: "EMAIL_SEND_FAILED",
        message: `Failed to send remittance email: ${errorMessage}`,
      });
    }

    const emailResponse = await res.json();
    const emailId = emailResponse.id;

    logger.info("Worker remittance email sent", {
      emailId,
      organization_id,
      testMode,
    });

    return jsonResponse({
      ok: true,
      emailId,
    });
  } catch (error) {
    logger.error("Send worker remittance email error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to send remittance email"),
      getErrorStatusCode(error)
    );
  }
});
