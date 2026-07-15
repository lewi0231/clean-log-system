import { serve } from "server";
import { loadEnvIfLocal } from "../_utils/env.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { gateOrganizationRequest } from "../_utils/gate-organization-request.ts";
import {
  buildInvoiceDisplayRows,
  type LineItemDisplayConfig,
} from "../_utils/invoice-line-item-display.ts";
import { DEFAULT_LINE_ITEM_DISPLAY } from "../_utils/invoice-template-defaults.ts";
import { createLogger } from "../_utils/logger.ts";
import { uuidSchema, validateRequest } from "../_utils/zod-schemas.ts";

// Use fully qualified URL to avoid import map resolution issues
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Inline dependency is intentional for cross-function compatibility
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * Schema for generating invoice PDF
 */
const generateInvoicePdfSchema = z.object({
  invoice_id: uuidSchema,
  organization_id: uuidSchema,
});

/**
 * Format currency for display
 */
function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    AUD: "A$",
    USD: "$",
    GBP: "£",
    EUR: "€",
    CAD: "C$",
    NZD: "NZ$",
  };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Generate HTML content for the invoice
 */
function generateInvoiceHtml(
  invoice: Record<string, unknown>,
  organization: Record<string, unknown>,
  lineItems: Array<Record<string, unknown>>
): string {
  const invoiceNumber = invoice.invoice_number as string;
  const createdAt = invoice.created_at as string;
  const dueDate = invoice.due_date as string;
  const subtotal = invoice.subtotal as number;
  const adjustments = invoice.adjustments as number;
  const total = invoice.total as number;
  const currency = invoice.currency as string;
  const notes = invoice.notes as string | null;
  const status = invoice.status as string;

  const orgName = organization.name as string;
  const orgAbn = organization.abn as string | null;

  // Generate line items rows
  const lineItemsHtml = lineItems
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.description || ""}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity || 1}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency((item.unit_price as number) || 0, currency)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency((item.amount as number) || 0, currency)}</td>
    </tr>
  `
    )
    .join("");

  // Status badge color
  const statusColors: Record<string, string> = {
    draft: "#6b7280",
    pending_review: "#f59e0b",
    sent: "#3b82f6",
    paid: "#22c55e",
    overdue: "#ef4444",
    cancelled: "#9ca3af",
  };
  const statusColor = statusColors[status] || "#6b7280";
  const statusLabel =
    status === "pending_review"
      ? "Pending Review"
      : status.charAt(0).toUpperCase() + status.slice(1);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      background: white;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .company-info h1 {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 8px;
    }
    .company-info p {
      color: #6b7280;
      font-size: 11px;
    }
    .invoice-info {
      text-align: right;
    }
    .invoice-info h2 {
      font-size: 28px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 8px;
    }
    .invoice-info p {
      color: #6b7280;
      font-size: 11px;
    }
    .invoice-number {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      color: white;
      margin-top: 8px;
    }
    .details-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .details-section div {
      flex: 1;
    }
    .details-section h3 {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .details-section p {
      color: #111827;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    thead th {
      background: #f3f4f6;
      padding: 12px 10px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    thead th:last-child,
    thead th:nth-child(3) {
      text-align: right;
    }
    thead th:nth-child(2) {
      text-align: center;
    }
    .totals {
      margin-left: auto;
      width: 300px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals-row.total {
      border-bottom: none;
      padding-top: 12px;
      font-size: 16px;
      font-weight: 700;
    }
    .totals-label {
      color: #6b7280;
    }
    .totals-value {
      font-weight: 600;
      color: #111827;
    }
    .notes {
      margin-top: 30px;
      padding: 20px;
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
    }
    .notes h3 {
      font-size: 12px;
      font-weight: 600;
      color: #92400e;
      margin-bottom: 8px;
    }
    .notes p {
      color: #78350f;
      font-size: 12px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        <h1>${orgName}</h1>
        ${orgAbn ? `<p>ABN: ${orgAbn}</p>` : ""}
      </div>
      <div class="invoice-info">
        <h2>INVOICE</h2>
        <p class="invoice-number">${invoiceNumber}</p>
        <div class="status-badge" style="background-color: ${statusColor};">${statusLabel}</div>
      </div>
    </div>

    <div class="details-section">
      <div>
        <h3>Invoice Date</h3>
        <p>${formatDate(createdAt)}</p>
      </div>
      <div>
        <h3>Due Date</h3>
        <p>${formatDate(dueDate)}</p>
      </div>
      <div>
        <h3>Invoice Number</h3>
        <p>${invoiceNumber}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span class="totals-label">Subtotal</span>
        <span class="totals-value">${formatCurrency(subtotal, currency)}</span>
      </div>
      ${
        adjustments !== 0
          ? `
      <div class="totals-row">
        <span class="totals-label">Adjustments</span>
        <span class="totals-value">${formatCurrency(adjustments, currency)}</span>
      </div>
      `
          : ""
      }
      <div class="totals-row total">
        <span class="totals-label">Total</span>
        <span class="totals-value">${formatCurrency(total, currency)}</span>
      </div>
    </div>

    ${
      notes
        ? `
    <div class="notes">
      <h3>Notes</h3>
      <p>${notes}</p>
    </div>
    `
        : ""
    }

    <div class="footer">
      <p>Generated by ${orgName}</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate Invoice PDF Edge Function
 *
 * Generates a PDF from invoice data.
 * Note: This returns HTML that can be used for print/PDF generation client-side.
 * For server-side PDF generation with Puppeteer, additional infrastructure is needed.
 */
serve(async (req: Request) => {
  // Load environment variables for local development
  await loadEnvIfLocal();

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, { functionName: "generate-invoice-pdf" });

  try {
    const rawBody = await req.json();

    // Validate request body with Zod schema
    const validation = validateRequest(generateInvoicePdfSchema, rawBody);
    if (!validation.success) {
      logger.warn("Invalid request body for generate invoice PDF", {
        errors: validation.issues,
      });
      return errorResponse(validation.error, 400);
    }

    const { invoice_id, organization_id } = validation.data;

    const gated = await gateOrganizationRequest(req, organization_id, logger);
    if (!gated.ok) return gated.response;
    const supabase = gated.ctx.supabase;
    const userEmail = gated.ctx.userEmail;

    logger.info("Generating invoice PDF", {
      invoice_id,
      organization_id,
    });

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoice")
      .select(
        `
        id,
        invoice_number,
        created_at,
        due_date,
        subtotal,
        total,
        currency,
        notes,
        status,
        organization_id,
        invoice_job:invoice_job (
          job:job_id (
            id
          )
        )
      `
      )
      .eq("id", invoice_id)
      .eq("organization_id", organization_id)
      .single();

    if (invoiceError || !invoice) {
      logger.warn("Invoice not found", { invoice_id, organization_id });
      return errorResponse("Invoice not found", 404);
    }

    const jobIds: string[] = [];
    const invoiceJobs = invoice.invoice_job as Array<{ job?: { id?: string } }> | null;
    if (invoiceJobs && Array.isArray(invoiceJobs)) {
      for (const invoiceJob of invoiceJobs) {
        if (invoiceJob.job?.id) {
          jobIds.push(invoiceJob.job.id);
        }
      }
    }

    if (jobIds.length === 0) {
      return errorResponse("Invoice has no associated jobs", 404);
    }

    const { data: calculationData, error: calcError } = await supabase.functions.invoke(
      "calculate-invoice",
      {
        body: {
          organization_id,
          job_ids: jobIds,
          email: userEmail,
        },
      }
    );

    if (calcError) {
      logger.error("Failed to calculate invoice for PDF", calcError);
      return errorResponse("Failed to calculate invoice line items", 500);
    }

    const calculation = calculationData?.calculation as
      | {
          total_adjustments?: number;
          job_calculations?: Array<{
            base_price?: number;
            line_items: Array<{
              field_label: string;
              option_value?: string;
              quantity: number;
              unit_price: number;
              total: number;
            }>;
          }>;
        }
      | undefined;

    if (!calculation?.job_calculations) {
      return errorResponse("Failed to calculate invoice line items", 500);
    }

    // Get organization details
    const { data: organization, error: orgError } = await supabase
      .from("organization")
      .select("name, abn")
      .eq("id", organization_id)
      .single();

    if (orgError || !organization) {
      logger.error("Failed to fetch organization", orgError);
      return errorResponse("Organization not found", 404);
    }

    const { data: templateConfig } = await supabase
      .from("invoice_template_config")
      .select("line_item_display")
      .eq("organization_id", organization_id)
      .maybeSingle();

    const lineItemDisplay =
      (templateConfig?.line_item_display as LineItemDisplayConfig | null) ??
      DEFAULT_LINE_ITEM_DISPLAY;

    const lineItems = buildInvoiceDisplayRows(calculation.job_calculations, lineItemDisplay);
    const adjustments =
      calculation.total_adjustments ?? Number(invoice.total) - Number(invoice.subtotal);

    // Generate HTML
    const html = generateInvoiceHtml(
      {
        ...invoice,
        adjustments,
      } as Record<string, unknown>,
      organization as Record<string, unknown>,
      lineItems
    );

    logger.info("Invoice HTML generated successfully", {
      invoice_id,
      invoice_number: invoice.invoice_number,
    });

    // Return JSON with HTML and metadata
    // Client can use browser print-to-PDF or a library like jsPDF/html2pdf
    return jsonResponse({
      success: true,
      html,
      invoice_number: invoice.invoice_number,
    });
  } catch (error) {
    logger.error("Generate invoice PDF error", error);
    const errorMessage = extractErrorMessage(error, "Failed to generate invoice PDF");
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
});
