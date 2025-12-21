import { serve } from "server";
import {
  getOrganizationName,
  type InvoiceEmailData,
  sendInvoiceEmail,
} from "../_utils/email.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import {
  getInvoiceEmailRecipients,
  type InvoiceEmailRecipientConfig,
  type JobContext,
} from "../_utils/invoice-email.ts";
import { createLogger } from "../_utils/logger.ts";
import { createStripeClient } from "../_utils/stripe.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import {
  updateInvoiceStatusSchema,
  validateRequest,
} from "../_utils/zod-schemas.ts";

/**
 * Create or get existing payment link for an invoice
 * @param forceNew - If true, always creates a new payment link (for resending)
 * @param logger - Optional logger for structured logging
 */
async function getOrCreatePaymentLink(
  supabase: ReturnType<typeof createServiceRoleClient>,
  invoice: {
    id: string;
    invoice_number: string;
    organization_id: string;
    total: number;
    currency: string;
    payment_link_id?: string | null;
  },
  forceNew = false,
  logger?: ReturnType<typeof createLogger>,
): Promise<string | null> {
  try {
    // Check if invoice already has a valid payment link (unless forcing new)
    if (invoice.payment_link_id && !forceNew) {
      const { data: existingLink } = await supabase
        .from("payment_link")
        .select("id, checkout_url, status, expires_at")
        .eq("id", invoice.payment_link_id)
        .single();

      if (existingLink && existingLink.status === "open") {
        // Check if not expired
        const expiresAt = new Date(existingLink.expires_at);
        if (expiresAt > new Date()) {
          logger?.debug("Using existing payment link", {
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            payment_link_id: existingLink.id,
          });
          return existingLink.checkout_url;
        }
      }
    }

    // Create new payment link via Stripe
    const stripe = createStripeClient();
    const baseUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") ||
      "http://localhost:3000";

    // Note: Stripe Checkout Sessions expire after 24 hours maximum
    // For longer-lived payment options, a new session is created when needed
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: (invoice.currency || "AUD").toLowerCase(),
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: `Payment for invoice ${invoice.invoice_number}`,
            },
            unit_amount: Math.round(invoice.total * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/invoice/${invoice.id}?payment=success`,
      cancel_url: `${baseUrl}/invoice/${invoice.id}?payment=cancelled`,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        organization_id: invoice.organization_id,
      },
      // Stripe Checkout Sessions max expiry is 24 hours
      expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    });

    // Store payment link in database
    const { data: paymentLink, error: linkInsertError } = await supabase
      .from("payment_link")
      .insert({
        organization_id: invoice.organization_id,
        invoice_id: invoice.id,
        stripe_checkout_session_id: session.id,
        checkout_url: session.url!,
        status: "open",
        amount_total: invoice.total,
        expires_at: new Date(session.expires_at! * 1000).toISOString(),
      })
      .select()
      .single();

    if (linkInsertError) {
      logger?.error("Error creating payment link", linkInsertError, {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
      });
      return null;
    }

    // Update invoice with payment link reference
    await supabase
      .from("invoice")
      .update({ payment_link_id: paymentLink.id })
      .eq("id", invoice.id);

    logger?.info("Created new payment link", {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      payment_link_id: paymentLink.id,
      checkout_url: session.url,
    });
    return session.url!;
  } catch (error) {
    logger?.error("Error creating payment link", error, {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
    });
    // Don't fail the invoice send if payment link creation fails
    // The invoice can still be sent without a payment link
    return null;
  }
}

serve(async (req: Request) => {
  // Load environment variables for local development
  await loadEnvIfLocal();

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "update-invoice-status" });

  try {
    const rawBody = await req.json();

    // Validate request body with Zod schema
    const validation = validateRequest(updateInvoiceStatusSchema, rawBody);
    if (!validation.success) {
      logger.warn("Invalid request body for invoice status update", {
        errors: validation.issues,
      });
      return errorResponse(validation.error, 400);
    }

    const body = validation.data as {
      invoice_id: string;
      status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
      resend?: boolean;
    };
    const { invoice_id, status, resend = false } = body;

    const supabase = createServiceRoleClient();
    const now = new Date();

    // If changing status to "sent" (or resending), we need to send the invoice email
    if (status === "sent") {
      // Get the invoice with full details
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoice")
        .select(
          `
          id,
          invoice_number,
          organization_id,
          total,
          currency,
          due_date,
          status,
          payment_link_id,
          invoice_job:invoice_job (
            job:job_id (
              id,
              location_id,
              submission_data,
              location:location_id (
                id,
                email,
                contact_person,
                hierarchy_parent_id
              )
            )
          )
        `,
        )
        .eq("id", invoice_id)
        .single();

      if (invoiceError) throw invoiceError;

      if (!invoice) {
        return errorResponse("Invoice not found", 404);
      }

      // Check if invoice is already sent (unless resending)
      if (invoice.status === "sent" && !resend) {
        return jsonResponse({
          success: true,
          message: "Invoice is already sent",
          invoice: invoice,
        });
      }

      // Get invoice template config for email recipient configuration
      const { data: templateConfig } = await supabase
        .from("invoice_template_config")
        .select("email_recipient_config")
        .eq("organization_id", invoice.organization_id)
        .single();

      const emailConfig: InvoiceEmailRecipientConfig = (templateConfig
        ?.email_recipient_config as InvoiceEmailRecipientConfig) ||
        {
          location_email_source: "location_email",
          form_field_email: null,
          default_email: null,
        };

      // Get field configs for form field email mapping
      const { data: fieldConfigs } = await supabase
        .from("organization_field_configs")
        .select("id, name")
        .eq("organization_id", invoice.organization_id)
        .eq("active", true);

      const fieldConfigMap = new Map<string, { name: string }>(
        (fieldConfigs || []).map(
          (fc: { id: string; name: string }) => [fc.id, { name: fc.name }],
        ),
      );

      // Build job contexts for email recipient determination
      const jobContexts: JobContext[] = [];
      if (invoice.invoice_job && Array.isArray(invoice.invoice_job)) {
        for (const invoiceJob of invoice.invoice_job) {
          // Handle Supabase query result - job might be returned as array or object
          const jobRaw = invoiceJob.job as unknown;
          const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;

          if (job && typeof job === "object" && job !== null) {
            const jobObj = job as {
              id?: string;
              location_id?: string | null;
              submission_data?: Record<string, unknown> | null;
              location?:
                | {
                  id?: string;
                  email?: string | null;
                  contact_person?: string | null;
                  hierarchy_parent_id?: string | null;
                }
                | null
                | Array<{
                  id?: string;
                  email?: string | null;
                  contact_person?: string | null;
                  hierarchy_parent_id?: string | null;
                }>;
            };

            // Handle location - might be array or object
            const locationRaw = jobObj.location;
            const location = Array.isArray(locationRaw)
              ? locationRaw[0]
              : locationRaw;

            jobContexts.push({
              location_id: jobObj.location_id || null,
              location: location && typeof location === "object"
                ? {
                  id: location.id || "",
                  email: location.email || null,
                  contact_person: location.contact_person || null,
                  hierarchy_parent_id: location.hierarchy_parent_id || null,
                }
                : null,
              submission_data: jobObj.submission_data || null,
            });
          }
        }
      }

      // Determine email recipients
      const emailRecipients = await getInvoiceEmailRecipients(
        supabase,
        jobContexts,
        emailConfig,
        fieldConfigMap,
      );

      // If no valid email recipients, return error
      if (emailRecipients.length === 0) {
        return errorResponse(
          "Cannot send invoice: no valid email recipients found. Please configure email recipients in invoice settings or ensure the location has an email address.",
          400,
        );
      }

      // Get organization name for email
      let organizationName: string;
      try {
        organizationName = await getOrganizationName(
          supabase,
          invoice.organization_id,
        );
      } catch (err) {
        logger.error("Failed to get organization name", err, {
          organization_id: invoice.organization_id,
          invoice_id: invoice_id,
        });
        return errorResponse("Failed to get organization details", 500);
      }

      // Create or get existing payment link (force new if resending)
      const paymentLinkUrl = await getOrCreatePaymentLink(
        supabase,
        {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          organization_id: invoice.organization_id,
          total: invoice.total,
          currency: invoice.currency || "AUD",
          payment_link_id: invoice.payment_link_id,
        },
        resend, // Force new payment link if resending
        logger,
      );

      // Determine the base URL for the invoice view
      const baseUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") ||
        "http://localhost:3000";
      const invoiceUrl = `${baseUrl}/invoice/${invoice.id}`;

      // Send invoice email with payment link
      const emailData: InvoiceEmailData = {
        invoiceNumber: invoice.invoice_number,
        organizationName,
        recipientEmails: emailRecipients,
        total: invoice.total,
        currency: invoice.currency || "AUD",
        dueDate: invoice.due_date,
        invoiceUrl: invoiceUrl,
        paymentLinkUrl: paymentLinkUrl || undefined,
      };

      logger.info("Sending invoice email", {
        invoice_id: invoice_id,
        invoice_number: invoice.invoice_number,
        recipient_count: emailRecipients.length,
        has_payment_link: !!paymentLinkUrl,
      });

      const emailResult = await sendInvoiceEmail(emailData, false);

      if (!emailResult.success) {
        logger.error("Failed to send invoice email", undefined, {
          invoice_id: invoice_id,
          invoice_number: invoice.invoice_number,
          error: emailResult.error,
        });
        return errorResponse(
          `Failed to send invoice email: ${emailResult.error}`,
          500,
        );
      }

      logger.info("Invoice email sent successfully", {
        invoice_id: invoice_id,
        invoice_number: invoice.invoice_number,
        email_id: emailResult.emailId,
        recipient_count: emailRecipients.length,
      });

      // Only update status after successful email send
      const { data: updatedInvoice, error: updateError } = await supabase
        .from("invoice")
        .update({
          status: "sent",
          sent_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", invoice_id)
        .select()
        .single();

      if (updateError) throw updateError;

      return jsonResponse({
        success: true,
        message: `Invoice sent successfully to: ${emailRecipients.join(", ")}`,
        invoice: updatedInvoice,
        emailSent: true,
        recipients: emailRecipients,
        paymentLinkIncluded: !!paymentLinkUrl,
      });
    }

    // For other status changes (draft, paid, overdue, cancelled), just update the status
    const { data: invoice, error: updateError } = await supabase
      .from("invoice")
      .update({
        status: status,
        updated_at: now.toISOString(),
      })
      .eq("id", invoice_id)
      .select()
      .single();

    if (updateError) throw updateError;

    if (!invoice) {
      return errorResponse("Invoice not found", 404);
    }

    return jsonResponse({
      success: true,
      invoice: invoice,
    });
  } catch (error) {
    logger.error("Update invoice status error", error);
    const errorMessage = extractErrorMessage(
      error,
      "Failed to update invoice status",
    );
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
});
