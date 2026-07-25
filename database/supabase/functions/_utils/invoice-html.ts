/**
 * HTML invoice document for Open PDF (parity with React InvoiceDocument).
 */

import type { InvoiceContentModel } from "./invoice-content.ts";

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
 * Generate HTML content for the invoice (parity with React InvoiceDocument).
 */
export function generateInvoiceHtml(model: InvoiceContentModel): string {
  const invoiceNumber = escapeHtml(model.invoiceNumber);
  const documentTitle = escapeHtml(model.documentTitle);
  const createdAt = model.createdAt;
  const dueDate = model.dueDate;
  const subtotal = model.subtotal;
  const adjustments = model.adjustments;
  const total = model.total;
  const currency = model.currency;
  const status = model.status;

  const orgName = escapeHtml(model.orgName);
  const orgAbn = model.orgAbn ? escapeHtml(model.orgAbn) : null;
  const orgLogoUrl = model.orgLogoUrl ? escapeHtml(model.orgLogoUrl) : null;
  const orgBusinessAddress = model.orgBusinessAddress ? escapeHtml(model.orgBusinessAddress) : null;
  const orgContactEmail = model.orgContactEmail ? escapeHtml(model.orgContactEmail) : null;
  const orgContactPhone = model.orgContactPhone ? escapeHtml(model.orgContactPhone) : null;

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

  const gstRows = model.showGstBreakdown
    ? `
      <div class="totals-row">
        <span class="totals-label">Subtotal (ex. GST)</span>
        <span class="totals-value">${formatCurrency(model.subtotalExGst, currency)}</span>
      </div>
      <div class="totals-row">
        <span class="totals-label">GST</span>
        <span class="totals-value">${formatCurrency(model.gstAmount, currency)}</span>
      </div>
      `
    : `
      <div class="totals-row">
        <span class="totals-label">Subtotal</span>
        <span class="totals-value">${formatCurrency(subtotal, currency)}</span>
      </div>
      ${
        adjustments !== 0
          ? `<div class="totals-row">
        <span class="totals-label">Adjustments</span>
        <span class="totals-value">${formatCurrency(adjustments, currency)}</span>
      </div>`
          : ""
      }
      `;

  // Match InvoiceDocument: amount due only after partial payment; paid-in-full separate.
  const amountDueRow = model.showAmountDue
    ? `<div class="totals-row">
        <span class="totals-label">Amount due</span>
        <span class="totals-value">${formatCurrency(model.amountDue, currency)}</span>
      </div>`
    : model.isPaidInFull
      ? `<div class="totals-row">
        <span class="totals-label">Paid in full</span>
        <span class="totals-value"></span>
      </div>`
      : "";

  const bankBlock =
    model.showBankTransfer && model.bankTransferBsb && model.bankTransferAccountNumber
      ? `
    <div class="bank">
      <h3>Payment via Bank Transfer</h3>
      ${
        model.bankTransferAccountName
          ? `<p><strong>Account Name:</strong> ${escapeHtml(model.bankTransferAccountName)}</p>`
          : ""
      }
      <p><strong>BSB:</strong> <span style="font-family:monospace;">${escapeHtml(model.bankTransferBsb)}</span></p>
      <p><strong>Account Number:</strong> <span style="font-family:monospace;">${escapeHtml(model.bankTransferAccountNumber)}</span></p>
      <p style="margin-top:8px;"><strong>Reference:</strong> ${invoiceNumber}</p>
      <p style="color:#6b7280;margin-top:8px;font-size:11px;">Payments via bank transfer will not be automatically tracked. Please include the invoice number in your transfer reference.</p>
    </div>`
      : "";

  const paymentMethods = model.paymentMethodsText
    ? `<p class="payment-methods">${escapeHtml(model.paymentMethodsText)}</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${documentTitle} ${invoiceNumber}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      background: white;
    }
    .invoice-container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 40px; }
    .company-info h1 { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px; }
    .company-info p { color: #6b7280; font-size: 11px; }
    .company-logo { max-height: 64px; max-width: 180px; margin-bottom: 12px; object-fit: contain; }
    .invoice-info { text-align: right; }
    .invoice-info h2 { font-size: 26px; font-weight: 700; color: #111827; margin-bottom: 8px; letter-spacing: 0.02em; }
    .invoice-info p { color: #6b7280; font-size: 11px; }
    .invoice-number { font-size: 14px; font-weight: 600; color: #111827; }
    .status-badge {
      display: inline-block; padding: 4px 12px; border-radius: 4px;
      font-size: 11px; font-weight: 600; color: white; margin-top: 8px;
    }
    .details-section {
      display: flex; justify-content: space-between; gap: 16px;
      margin-bottom: 24px; padding: 20px; background: #f9fafb; border-radius: 8px;
    }
    .details-section div { flex: 1; }
    .details-section h3 {
      font-size: 11px; font-weight: 600; color: #6b7280;
      text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;
    }
    .details-section p { color: #111827; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead th {
      background: #f3f4f6; padding: 12px 10px; text-align: left;
      font-weight: 600; font-size: 11px; color: #374151;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    thead th:last-child, thead th:nth-child(3) { text-align: right; }
    thead th:nth-child(2) { text-align: center; }
    .totals { margin-left: auto; width: 300px; }
    .totals-row {
      display: flex; justify-content: space-between;
      padding: 8px 0; border-bottom: 1px solid #e5e7eb;
    }
    .totals-row.total { border-bottom: none; padding-top: 12px; font-size: 16px; font-weight: 700; }
    .totals-label { color: #6b7280; }
    .totals-value { font-weight: 600; color: #111827; }
    .notes {
      margin-top: 30px; padding: 20px; background: #fffbeb;
      border: 1px solid #fcd34d; border-radius: 8px;
    }
    .notes h3 { font-size: 12px; font-weight: 600; color: #92400e; margin-bottom: 8px; }
    .notes p { color: #78350f; font-size: 12px; }
    .payment-methods { margin-top: 20px; color: #6b7280; font-size: 12px; }
    .bank {
      margin-top: 20px; padding: 16px; border: 1px solid #e5e7eb;
      border-radius: 8px; background: #f9fafb;
    }
    .bank h3 { font-size: 12px; font-weight: 600; margin-bottom: 8px; }
    .bank p { font-size: 12px; color: #111827; }
    .footer {
      margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;
      text-align: center; color: #9ca3af; font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        ${orgLogoUrl ? `<img class="company-logo" src="${orgLogoUrl}" alt="Company logo" />` : ""}
        <h1>${orgName}</h1>
        ${orgAbn ? `<p>ABN: ${orgAbn}</p>` : ""}
        ${orgBusinessAddress ? `<p>${orgBusinessAddress}</p>` : ""}
        ${orgContactEmail ? `<p>${orgContactEmail}</p>` : ""}
        ${orgContactPhone ? `<p>${orgContactPhone}</p>` : ""}
      </div>
      <div class="invoice-info">
        <h2>${documentTitle}</h2>
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
      ${gstRows}
      <div class="totals-row total">
        <span class="totals-label">Total</span>
        <span class="totals-value">${formatCurrency(total, currency)}</span>
      </div>
      ${amountDueRow}
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

    ${paymentMethods}
    ${bankBlock}

    <div class="footer">
      <p>Generated by ${orgName}</p>
    </div>
  </div>
</body>
</html>
  `;
}
