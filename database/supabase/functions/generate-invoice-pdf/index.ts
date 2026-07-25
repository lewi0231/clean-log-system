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
import { buildInvoiceContentModel, type InvoiceContentModel } from "../_utils/invoice-content.ts";
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
 * Escape text for safe interpolation into HTML templates.
 */
function escapeHtml(value: unknown): string {
  const s = value == null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function addressBlockHtml(title: string, lines: string[]): string {
  if (lines.length === 0) {
    return `
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p style="color:#6b7280;">—</p>
      </div>`;
  }
  return `
      <div>
        <h3>${escapeHtml(title)}</h3>
        ${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}
      </div>`;
}

/**
 * Generate HTML content for the invoice
 */
function generateInvoiceHtml(model: InvoiceContentModel): string {
  const invoiceNumber = escapeHtml(model.invoiceNumber);
  const createdAt = model.createdAt;
  const dueDate = model.dueDate;
  const subtotal = model.subtotal;
  const adjustments = model.adjustments;
  const total = model.total;
  const currency = model.currency;
  const status = model.status;

  const orgName = escapeHtml(model.orgName);
  const orgAbn = model.orgAbn ? escapeHtml(model.orgAbn) : null;

  const lineItemsHtml = model.lineItems
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${escapeHtml(item.quantity ?? 1)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price || 0, currency)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.amount || 0, currency)}</td>
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
  const statusLabel = escapeHtml(
    status === "pending_review"
      ? "Pending Review"
      : status.charAt(0).toUpperCase() + status.slice(1)
  );
  const safeNotes = model.notes ? escapeHtml(model.notes) : null;
  const serviceHtml = addressBlockHtml("Service Address", model.serviceAddressLines);
  const billingHtml = model.showBillingAddress
    ? addressBlockHtml("Billing Address", model.billingAddressLines)
    : "";

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

    <div class="details-section">
      ${serviceHtml}
      ${billingHtml}
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
      safeNotes
        ? `
    <div class="notes">
      <h3>Notes</h3>
      <p>${safeNotes}</p>
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

    logger.info("Generating invoice PDF", {
      invoice_id,
      organization_id,
    });

    const model = await buildInvoiceContentModel(supabase, invoice_id, organization_id);
    const html = generateInvoiceHtml(model);

    logger.info("Invoice HTML generated successfully", {
      invoice_id,
      invoice_number: model.invoiceNumber,
    });

    return jsonResponse({
      success: true,
      html,
      invoice_number: model.invoiceNumber,
    });
  } catch (error) {
    logger.error("Generate invoice PDF error", error);
    const errorMessage = extractErrorMessage(error, "Failed to generate invoice PDF");
    const statusCode = getErrorStatusCode(error);
    return errorResponse(errorMessage, statusCode);
  }
});
