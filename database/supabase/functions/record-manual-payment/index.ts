import { serve } from "server";
import { loadEnvIfLocal } from "../_utils/env.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createNotification } from "../_utils/notifications.ts";
import { requireAuthenticatedOrgMember } from "../_utils/require-authenticated-org-member.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { nonNegativeNumberSchema, uuidSchema, validateRequest } from "../_utils/zod-schemas.ts";

// Use fully qualified URL to avoid import map resolution issues
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Inline dependency is intentional for cross-function compatibility
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Schema for recording a manual payment
 */
const recordManualPaymentSchema = z.object({
  invoice_id: uuidSchema,
  organization_id: uuidSchema,
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.string().default("AUD"),
  payment_method: z.enum(["bank_transfer_manual", "other"]),
  payment_reference: z.string().nullable().optional(),
  payment_date: z.string().datetime(),
  notes: z.string().nullable().optional(),
});

/**
 * Record Manual Payment Edge Function
 *
 * Records a manual payment (bank transfer, cash, etc.) for an invoice.
 * Updates the invoice status to "paid" if fully paid.
 */
serve(async (req: Request) => {
  // Load environment variables for local development
  await loadEnvIfLocal();

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "record-manual-payment" });

  try {
    const rawBody = await req.json();

    // Validate request body with Zod schema
    const validation = validateRequest(recordManualPaymentSchema, rawBody);
    if (!validation.success) {
      logger.warn("Invalid request body for record manual payment", {
        errors: validation.issues,
      });
      return errorResponse(validation.error, 400);
    }

    const {
      invoice_id,
      organization_id,
      amount,
      currency,
      payment_method,
      payment_reference,
      payment_date,
      notes,
    } = validation.data;

    const supabase = createServiceRoleClient();

    const orgGate = await requireAuthenticatedOrgMember(req, organization_id, supabase);
    if (!orgGate.ok) {
      if (orgGate.response.status === 403) {
        logger.warn("Unauthorized organization access attempt", {
          organization_id,
        });
      }
      return orgGate.response;
    }

    logger.info("Recording manual payment", {
      invoice_id,
      organization_id,
      amount,
      payment_method,
    });

    const now = new Date();

    // Get the invoice to verify it exists and get the total
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoice")
      .select("id, total, total_paid, status, organization_id, payment_count")
      .eq("id", invoice_id)
      .eq("organization_id", organization_id)
      .single();

    if (invoiceError || !invoice) {
      logger.warn("Invoice not found", { invoice_id, organization_id });
      return errorResponse("Invoice not found", 404);
    }

    // Calculate remaining balance
    const currentTotalPaid = invoice.total_paid || 0;
    const remainingBalance = invoice.total - currentTotalPaid;

    // Validate payment amount doesn't exceed remaining balance
    if (amount > remainingBalance + 0.01) {
      // Allow small floating point variance
      logger.warn("Payment amount exceeds remaining balance", {
        invoice_id,
        amount,
        remainingBalance,
      });
      return errorResponse(
        `Payment amount (${amount}) exceeds remaining balance (${remainingBalance.toFixed(2)})`,
        400
      );
    }

    // Create the payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payment")
      .insert({
        organization_id,
        invoice_id,
        amount,
        currency,
        payment_method,
        status: "succeeded", // Manual payments are immediately succeeded
        payment_reference: payment_reference || null,
        payment_date,
        received_at: now.toISOString(),
        fees: 0, // No fees for manual payments
        net_amount: amount, // Net = amount for manual payments
        metadata: notes ? { notes } : {},
      })
      .select()
      .single();

    if (paymentError) {
      logger.error("Failed to create payment record", paymentError);
      throw paymentError;
    }

    logger.info("Payment record created", { payment_id: payment.id });

    // Calculate new total paid
    const newTotalPaid = currentTotalPaid + amount;
    const isFullyPaid = newTotalPaid >= invoice.total - 0.01; // Allow small floating point variance

    // Update invoice with new payment totals
    const invoiceUpdate: {
      total_paid: number;
      payment_count: number;
      updated_at: string;
      status?: string;
      paid_at?: string;
      payment_method_used?: string;
    } = {
      total_paid: newTotalPaid,
      payment_count: (invoice.payment_count || 0) + 1,
      updated_at: now.toISOString(),
    };

    // If fully paid, update status
    if (isFullyPaid) {
      invoiceUpdate.status = "paid";
      invoiceUpdate.paid_at = now.toISOString();
      invoiceUpdate.payment_method_used = payment_method;
      logger.info("Invoice fully paid, updating status", { invoice_id });
    }

    const { error: updateError } = await supabase
      .from("invoice")
      .update(invoiceUpdate)
      .eq("id", invoice_id);

    if (updateError) {
      logger.error("Failed to update invoice", updateError);
      // Don't fail the request - payment was recorded successfully
      logger.warn("Payment recorded but invoice update failed", {
        payment_id: payment.id,
        invoice_id,
      });
    }

    logger.info("Manual payment recorded successfully", {
      payment_id: payment.id,
      invoice_id,
      amount,
      is_fully_paid: isFullyPaid,
    });

    // Notify admins when invoice is fully paid (non-blocking)
    if (isFullyPaid) {
      const notificationResult = await createNotification(supabase, {
        organization_id: invoice.organization_id,
        type: "payment_received",
        title: "Invoice paid",
        message: "An invoice has been paid.",
        related_entity_type: "invoice",
        related_entity_id: invoice_id,
      });
      if (!notificationResult.success) {
        logger.warn("Failed to create payment notification", {
          error: notificationResult.error,
          invoice_id,
        });
      }
    }

    return jsonResponse({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        payment_method: payment.payment_method,
      },
      invoice_updated: isFullyPaid,
      new_total_paid: newTotalPaid,
      remaining_balance: Math.max(0, invoice.total - newTotalPaid),
    });
  } catch (error) {
    logger.error("Record manual payment error", error);
    const errorMessage = extractErrorMessage(error, "Failed to record payment");
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
});
