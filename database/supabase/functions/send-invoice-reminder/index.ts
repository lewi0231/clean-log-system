import { serve } from "server";
import { sendInvoiceReminderEmail } from "../_utils/email.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { gateOrganizationRequest } from "../_utils/gate-organization-request.ts";
import { createLogger } from "../_utils/logger.ts";
import { uuidSchema, validateRequest } from "../_utils/zod-schemas.ts";

// Use fully qualified URL to avoid import map resolution issues
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Inline dependency is intentional for cross-function compatibility
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Schema for sending an invoice reminder
 */
const sendInvoiceReminderSchema = z.object({
  invoice_id: uuidSchema,
  organization_id: uuidSchema,
});

/**
 * Minimum days between reminders
 */
const MIN_DAYS_BETWEEN_REMINDERS = 3;

/**
 * Send Invoice Reminder Edge Function
 *
 * Sends a payment reminder email for an overdue invoice.
 * Enforces a minimum delay between reminders to avoid spam.
 */
serve(async (req: Request) => {
  // Load environment variables for local development
  await loadEnvIfLocal();

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "send-invoice-reminder" });

  try {
    const rawBody = await req.json();

    // Validate request body with Zod schema
    const validation = validateRequest(sendInvoiceReminderSchema, rawBody);
    if (!validation.success) {
      logger.warn("Invalid request body for send invoice reminder", {
        errors: validation.issues,
      });
      return errorResponse(validation.error, 400);
    }

    const { invoice_id, organization_id } = validation.data;

    const gated = await gateOrganizationRequest(req, organization_id, logger);
    if (!gated.ok) return gated.response;
    const supabase = gated.ctx.supabase;
    const now = new Date();

    logger.info("Sending invoice reminder", {
      invoice_id,
      organization_id,
    });

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoice")
      .select(
        `
        id,
        invoice_number,
        status,
        total,
        currency,
        due_date,
        payment_link_url,
        reminder_count,
        last_reminder_sent_at,
        organization_id
      `
      )
      .eq("id", invoice_id)
      .eq("organization_id", organization_id)
      .single();

    if (invoiceError || !invoice) {
      logger.warn("Invoice not found", { invoice_id, organization_id });
      return errorResponse("Invoice not found", 404);
    }

    // Verify invoice is overdue
    if (invoice.status !== "overdue") {
      logger.warn("Invoice is not overdue", {
        invoice_id,
        status: invoice.status,
      });
      return errorResponse(
        `Cannot send reminder for invoice with status '${invoice.status}'. Invoice must be overdue.`,
        400
      );
    }

    // Check minimum days between reminders
    if (invoice.last_reminder_sent_at) {
      const lastReminderDate = new Date(invoice.last_reminder_sent_at);
      const daysSinceLastReminder = Math.floor(
        (now.getTime() - lastReminderDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastReminder < MIN_DAYS_BETWEEN_REMINDERS) {
        logger.warn("Reminder sent too recently", {
          invoice_id,
          days_since_last_reminder: daysSinceLastReminder,
          min_days_required: MIN_DAYS_BETWEEN_REMINDERS,
        });
        return errorResponse(
          `A reminder was sent ${daysSinceLastReminder} day(s) ago. Please wait at least ${MIN_DAYS_BETWEEN_REMINDERS} days between reminders.`,
          429
        );
      }
    }

    // Get organization details
    const { data: organization, error: orgError } = await supabase
      .from("organization")
      .select("name, base_url")
      .eq("id", organization_id)
      .single();

    if (orgError || !organization) {
      logger.error("Failed to fetch organization", orgError);
      return errorResponse("Organization not found", 404);
    }

    // Get recipient emails from invoice settings or location
    // First, try to get from invoice_job -> job -> location
    const { data: invoiceJobs, error: jobsError } = await supabase
      .from("invoice_job")
      .select(
        `
        job:job_id (
          location:location_id (
            email
          )
        )
      `
      )
      .eq("invoice_id", invoice_id)
      .limit(1);

    let recipientEmails: string[] = [];

    if (!jobsError && invoiceJobs && invoiceJobs.length > 0) {
      const job = invoiceJobs[0].job as { location?: { email?: string } } | null;
      if (job?.location?.email) {
        recipientEmails = [job.location.email];
      }
    }

    if (recipientEmails.length === 0) {
      logger.warn("No recipient emails found for invoice", { invoice_id });
      return errorResponse(
        "No recipient email found for this invoice. Please ensure the location has an email configured.",
        400
      );
    }

    // Calculate days overdue
    const dueDate = new Date(invoice.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysOverdue = Math.max(
      0,
      Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Calculate new reminder count
    const newReminderCount = (invoice.reminder_count || 0) + 1;

    // Build invoice URL (public view)
    const baseUrl = organization.base_url || Deno.env.get("DASHBOARD_BASE_URL");
    const invoiceUrl = baseUrl ? `${baseUrl}/invoice/${invoice_id}` : undefined;

    // Send the reminder email
    const emailResult = await sendInvoiceReminderEmail(supabase, {
      invoiceNumber: invoice.invoice_number,
      organizationName: organization.name,
      organizationId: invoice.organization_id,
      recipientEmails,
      invoiceUrl,
      paymentLinkUrl: invoice.payment_link_url || undefined,
      total: invoice.total,
      currency: invoice.currency,
      dueDate: invoice.due_date,
      daysOverdue,
      reminderCount: newReminderCount,
    });

    if (!emailResult.success) {
      logger.error("Failed to send reminder email", {
        invoice_id,
        error: emailResult.error,
      });
      return errorResponse(emailResult.error || "Failed to send reminder email", 500);
    }

    // Update invoice with reminder tracking
    const { error: updateError } = await supabase
      .from("invoice")
      .update({
        reminder_count: newReminderCount,
        last_reminder_sent_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", invoice_id);

    if (updateError) {
      logger.warn("Failed to update reminder tracking", {
        invoice_id,
        error: updateError,
      });
      // Don't fail the request - email was sent successfully
    }

    logger.info("Invoice reminder sent successfully", {
      invoice_id,
      invoice_number: invoice.invoice_number,
      reminder_count: newReminderCount,
      days_overdue: daysOverdue,
      email_id: emailResult.emailId,
    });

    return jsonResponse({
      success: true,
      message: "Reminder sent successfully",
      invoice_id,
      invoice_number: invoice.invoice_number,
      reminder_count: newReminderCount,
      days_overdue: daysOverdue,
      email_id: emailResult.emailId,
    });
  } catch (error) {
    logger.error("Send invoice reminder error", error);
    const errorMessage = extractErrorMessage(error, "Failed to send invoice reminder");
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
});
