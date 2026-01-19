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
import { createServiceRoleClient } from "../_utils/supabase.ts";

/**
 * Mark Overdue Invoices Edge Function
 *
 * This function is designed to run as a daily cron job to automatically
 * mark invoices as overdue when they are past their due date.
 *
 * Criteria for marking as overdue:
 * - Status is 'sent' (invoice has been sent to customer)
 * - Due date is in the past (before today)
 * - Invoice has not been paid (paid_at is null)
 *
 * Can also be called manually via HTTP request for testing purposes.
 */
serve(async (req: Request) => {
  // Load environment variables for local development
  await loadEnvIfLocal();

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "mark-overdue-invoices" });

  try {
    const supabase = createServiceRoleClient();
    const now = new Date();

    // Get today's date at midnight for comparison (UTC)
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    logger.info("Starting overdue invoice detection", {
      today: todayIso,
    });

    // Find all invoices that should be marked as overdue
    // Criteria: status = 'sent', due_date < today, paid_at IS NULL
    const { data: overdueInvoices, error: selectError } = await supabase
      .from("invoice")
      .select("id, invoice_number, due_date, organization_id")
      .eq("status", "sent")
      .lt("due_date", todayIso)
      .is("paid_at", null);

    if (selectError) {
      logger.error("Failed to query overdue invoices", selectError);
      throw selectError;
    }

    if (!overdueInvoices || overdueInvoices.length === 0) {
      logger.info("No invoices to mark as overdue");
      return jsonResponse({
        success: true,
        message: "No invoices to mark as overdue",
        count: 0,
        invoices: [],
      });
    }

    logger.info("Found invoices to mark as overdue", {
      count: overdueInvoices.length,
      invoice_numbers: overdueInvoices.map((inv) => inv.invoice_number),
    });

    // Extract invoice IDs for bulk update
    const invoiceIds = overdueInvoices.map((inv) => inv.id);

    // Update all matching invoices to 'overdue' status
    const { data: updatedInvoices, error: updateError } = await supabase
      .from("invoice")
      .update({
        status: "overdue",
        updated_at: now.toISOString(),
      })
      .in("id", invoiceIds)
      .select("id, invoice_number, due_date, organization_id");

    if (updateError) {
      logger.error("Failed to update invoices to overdue", updateError);
      throw updateError;
    }

    const updatedCount = updatedInvoices?.length || 0;

    logger.info("Successfully marked invoices as overdue", {
      count: updatedCount,
      invoice_numbers: updatedInvoices?.map((inv) => inv.invoice_number),
    });

    // Return summary of the operation
    return jsonResponse({
      success: true,
      message: `Marked ${updatedCount} invoice(s) as overdue`,
      count: updatedCount,
      invoices: updatedInvoices?.map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        due_date: inv.due_date,
        organization_id: inv.organization_id,
      })) || [],
    });
  } catch (error) {
    logger.error("Mark overdue invoices error", error);
    const errorMessage = extractErrorMessage(
      error,
      "Failed to mark overdue invoices",
    );
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
});
