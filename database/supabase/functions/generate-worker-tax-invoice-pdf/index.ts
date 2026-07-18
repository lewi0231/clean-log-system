import { serve } from "server";
import { extractAuthToken, getAuthUser, resolveOrganizationWorkerId } from "../_utils/auth.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { isActiveOrgStaff } from "../_utils/org-sending-domain-edge.ts";
import { requireAuthenticatedOrgMember } from "../_utils/require-authenticated-org-member.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { validateRequiredFields } from "../_utils/validation.ts";
import { WORKFORCE_ENGAGEMENT_DISCLAIMER } from "../_utils/workforce-engagement.ts";

await loadEnvIfLocal();

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return `A$${amount.toFixed(2)}`;
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
 * Escape text for safe HTML
 */
function escapeHtml(value: unknown): string {
  const s = value == null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Generate HTML content for the tax invoice
 */
function generateTaxInvoiceHtml(
  invoice: Record<string, unknown>,
  organization: Record<string, unknown>,
  worker: Record<string, unknown>,
  lines: Array<Record<string, unknown>>
): string {
  const invoiceNumber = escapeHtml(invoice.invoice_number);
  const createdAt = invoice.created_at as string;
  const subtotal = Number(invoice.subtotal ?? 0);
  const gstAmount =
    invoice.gst_amount === null || invoice.gst_amount === undefined
      ? null
      : Number(invoice.gst_amount);
  const total = Number(invoice.total ?? 0);

  const orgName = escapeHtml(organization.name);
  const orgAbn = organization.abn ? escapeHtml(organization.abn) : "N/A";
  const workerDisplay =
    (worker.name as string | undefined)?.trim() ||
    [worker.first_name, worker.last_name].filter(Boolean).join(" ").trim() ||
    "Worker";
  const workerName = escapeHtml(workerDisplay);
  const workerAbn = worker.abn ? escapeHtml(worker.abn) : "N/A";

  const linesHtml = lines
    .map(
      (line) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(line.description)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency((line.amount as number) || 0)}</td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Invoice ${invoiceNumber}</title>
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
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #3b82f6;
    }
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 8px;
    }
    .header p {
      font-size: 14px;
      color: #6b7280;
    }
    .details-section {
      margin-bottom: 30px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .detail-label {
      font-weight: 600;
      color: #6b7280;
    }
    .detail-value {
      color: #111827;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th {
      background: #f9fafb;
      padding: 12px 10px;
      text-align: left;
      font-weight: 600;
      color: #111827;
      border-bottom: 2px solid #e5e7eb;
    }
    th:last-child {
      text-align: right;
    }
    .totals-section {
      margin-left: auto;
      width: 300px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
    }
    .total-label {
      font-weight: 600;
    }
    .final-total {
      border-top: 2px solid #111827;
      margin-top: 10px;
      padding-top: 10px;
      font-size: 16px;
      font-weight: 700;
    }
    .disclaimer {
      margin-top: 40px;
      padding: 15px;
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      font-size: 10px;
      color: #78350f;
      line-height: 1.6;
    }
    .disclaimer strong {
      display: block;
      margin-bottom: 8px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <h1>TAX INVOICE</h1>
      <p>${invoiceNumber}</p>
    </div>

    <div class="details-section">
      <div class="detail-row">
        <span class="detail-label">Invoice Date:</span>
        <span class="detail-value">${formatDate(createdAt)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Organisation:</span>
        <span class="detail-value">${orgName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Organisation ABN:</span>
        <span class="detail-value">${orgAbn}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Worker:</span>
        <span class="detail-value">${workerName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Worker ABN:</span>
        <span class="detail-value">${workerAbn}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${linesHtml}
      </tbody>
    </table>

    <div class="totals-section">
      <div class="total-row">
        <span class="total-label">Subtotal:</span>
        <span>${formatCurrency(subtotal)}</span>
      </div>
      ${
        gstAmount !== null
          ? `
      <div class="total-row">
        <span class="total-label">GST:</span>
        <span>${formatCurrency(gstAmount)}</span>
      </div>
      `
          : ""
      }
      <div class="total-row final-total">
        <span class="total-label">Total:</span>
        <span>${formatCurrency(total)}</span>
      </div>
    </div>

    <div class="disclaimer">
      <strong>IMPORTANT DISCLAIMER</strong>
      <p>${WORKFORCE_ENGAGEMENT_DISCLAIMER}</p>
      <p style="margin-top: 8px;">This document is a workflow aid generated by Tally Runner and does not guarantee compliance with Australian Taxation Office requirements for valid tax invoices. Seek professional advice for tax and compliance matters.</p>
    </div>
  </div>
</body>
</html>
`;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const logger = createLogger(req, {
    functionName: "generate-worker-tax-invoice-pdf",
  });

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await req.json();
    const v = validateRequiredFields(body, ["organization_id", "invoice_id"]);
    if (!v.valid) {
      return errorResponse("organization_id and invoice_id are required", 400);
    }

    const organization_id = body.organization_id as string;
    const invoice_id = body.invoice_id as string;

    const supabase = createServiceRoleClient();

    const authCheck = await requireAuthenticatedOrgMember(req, organization_id, supabase);
    if (!authCheck.ok) return authCheck.response;

    const token = extractAuthToken(req);
    const authUser = token ? await getAuthUser(token) : null;
    if (!authUser) return errorResponse("Authentication required", 401);

    // Get invoice with details
    const { data: invoice, error: invoiceError } = await supabase
      .from("worker_tax_invoice")
      .select(
        `
        *,
        worker:worker_id(id, first_name, last_name, name, abn),
        lines:worker_tax_invoice_line(id, job_id, description, amount)
      `
      )
      .eq("id", invoice_id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return errorResponse("Tax invoice not found", 404);
    }

    const staff = await isActiveOrgStaff(supabase, organization_id, authUser.id);
    if (!staff) {
      const workerId = await resolveOrganizationWorkerId(
        supabase,
        organization_id,
        authUser.id,
        authUser.user_metadata as Record<string, unknown>
      );
      if (invoice.worker_id !== workerId) {
        return errorResponse("Tax invoice not found", 404);
      }
    }

    if (invoice.status === "draft" || !invoice.invoice_number) {
      return errorResponse("PDF is available after the tax invoice is submitted", 400);
    }

    // Get organization details
    const { data: organization, error: orgError } = await supabase
      .from("organization")
      .select("id, name, abn")
      .eq("id", organization_id)
      .single();

    if (orgError || !organization) {
      return errorResponse("Organization not found", 404);
    }

    const worker = invoice.worker as Record<string, unknown>;
    const lines = (invoice.lines as Array<Record<string, unknown>>) || [];

    // Generate HTML
    const html = generateTaxInvoiceHtml(invoice, organization, worker, lines);

    logger.info("Generated tax invoice PDF", {
      invoice_id,
      invoice_number: invoice.invoice_number,
    });

    // Return HTML (caller will convert to PDF using browser or similar)
    return jsonResponse({
      success: true,
      html,
      invoice_number: invoice.invoice_number,
    });
  } catch (e) {
    logger.error("generate-worker-tax-invoice-pdf", e);
    return errorResponse("Unexpected error", 500);
  }
});
