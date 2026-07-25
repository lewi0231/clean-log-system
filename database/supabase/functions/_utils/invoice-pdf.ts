/**
 * Server-side invoice PDF generation for email attachments (pdf-lib).
 * Content from buildInvoiceContentModel — parity with InvoiceDocument fields.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";
import { buildInvoiceContentModel } from "./invoice-content.ts";

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.length;
  const chunk = 0x8000;
  for (let i = 0; i < len; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as number[]);
  }
  return btoa(binary);
}

function sanitizeFilenamePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      current = trial;
    } else {
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
      } else {
        let chunk = "";
        for (const ch of word) {
          const t = chunk + ch;
          if (font.widthOfTextAtSize(t, size) <= maxWidth) chunk = t;
          else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const BOTTOM = 56;

async function tryEmbedLogo(
  pdfDoc: PDFDocument,
  logoUrl: string | null
): Promise<{
  width: number;
  height: number;
  draw: (page: PDFPage, x: number, y: number) => void;
} | null> {
  // HTTPS only — avoids embedding http://localhost and reduces SSRF surface.
  if (!logoUrl || !logoUrl.startsWith("https://")) return null;
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    let image;
    if (contentType.includes("png") || logoUrl.toLowerCase().endsWith(".png")) {
      image = await pdfDoc.embedPng(bytes);
    } else if (
      contentType.includes("jpeg") ||
      contentType.includes("jpg") ||
      /\.jpe?g($|\?)/i.test(logoUrl)
    ) {
      image = await pdfDoc.embedJpg(bytes);
    } else {
      // Try PNG then JPG
      try {
        image = await pdfDoc.embedPng(bytes);
      } catch {
        image = await pdfDoc.embedJpg(bytes);
      }
    }
    const maxW = 140;
    const maxH = 48;
    const scale = Math.min(maxW / image.width, maxH / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    return {
      width,
      height,
      draw: (page, x, y) => {
        page.drawImage(image, { x, y: y - height, width, height });
      },
    };
  } catch {
    return null;
  }
}

export async function generateInvoicePdfBase64(
  supabase: SupabaseClient,
  invoiceId: string,
  organizationId: string
): Promise<{ base64: string; filename: string; invoiceNumber: string }> {
  const model = await buildInvoiceContentModel(supabase, invoiceId, organizationId);
  const rows = model.lineItems;
  const currency = model.currency || "AUD";
  const invoiceNumber = model.invoiceNumber;
  const orgName = model.orgName;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await tryEmbedLogo(pdfDoc, model.orgLogoUrl);

  let page: PDFPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < BOTTOM) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const draw = (text: string, size: number, bold = false, color = rgb(0, 0, 0)) => {
    const f = bold ? fontBold : font;
    page.drawText(text, {
      x: MARGIN,
      y,
      size,
      font: f,
      color,
    });
    y -= size + 6;
  };

  const drawRightAt = (text: string, size: number, xRight: number, yPos: number, bold = false) => {
    const f = bold ? fontBold : font;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: xRight - w,
      y: yPos,
      size,
      font: f,
      color: rgb(0, 0, 0),
    });
  };

  ensureSpace(100);
  if (logo) {
    logo.draw(page, MARGIN, y);
    y -= logo.height + 10;
  }

  draw(model.documentTitle, 18, true);
  draw(orgName, 11, true);
  if (model.orgAbn) draw(`ABN ${model.orgAbn}`, 10);
  if (model.orgBusinessAddress) {
    for (const line of wrapLine(model.orgBusinessAddress, font, 9, PAGE_W - 2 * MARGIN)) {
      draw(line, 9);
    }
  }
  if (model.orgContactEmail) draw(model.orgContactEmail, 9);
  if (model.orgContactPhone) draw(model.orgContactPhone, 9);

  y -= 4;
  draw(`Invoice ${invoiceNumber}`, 11, true);
  draw(`Status: ${String(model.status)}`, 9);
  draw(`Issued: ${formatDate(model.createdAt)}`, 9);
  draw(`Due: ${formatDate(model.dueDate)}`, 9);
  y -= 8;

  if (model.serviceAddressLines.length > 0) {
    ensureSpace(20 + model.serviceAddressLines.length * 12);
    draw("Service Address", 9, true);
    for (const line of model.serviceAddressLines) {
      draw(line, 9);
    }
    y -= 4;
  }

  if (model.showBillingAddress) {
    ensureSpace(20 + model.billingAddressLines.length * 12);
    draw("Billing Address", 9, true);
    for (const line of model.billingAddressLines) {
      draw(line, 9);
    }
    y -= 4;
  }

  y -= 6;
  ensureSpace(40);
  const headerY = y;
  page.drawText("Description", {
    x: MARGIN,
    y: headerY,
    size: 9,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  drawRightAt("Qty", 9, MARGIN + 300, headerY);
  drawRightAt("Unit", 9, MARGIN + 380, headerY);
  drawRightAt("Amount", 9, MARGIN + 520, headerY, true);
  y = headerY - 14;
  page.drawLine({
    start: { x: MARGIN, y: y + 8 },
    end: { x: PAGE_W - MARGIN, y: y + 8 },
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.75),
  });
  y -= 8;

  const descWidth = 250;
  for (const row of rows) {
    const desc = (row.description || "").trim() || "—";
    const qty = row.quantity ?? 1;
    const unit = row.unit_price ?? 0;
    const amt = row.amount ?? 0;
    const lines = wrapLine(desc, font, 9, descWidth);
    const blockH = lines.length * 12 + 10;
    ensureSpace(blockH);

    const rowTop = y;
    let lineY = rowTop;
    for (const line of lines) {
      page.drawText(line, {
        x: MARGIN,
        y: lineY,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });
      lineY -= 12;
    }
    drawRightAt(String(qty), 9, MARGIN + 300, rowTop);
    drawRightAt(formatCurrency(unit, currency), 9, MARGIN + 380, rowTop);
    drawRightAt(formatCurrency(amt, currency), 9, MARGIN + 520, rowTop);
    y = lineY - 6;
  }

  if (rows.length === 0) {
    ensureSpace(20);
    draw("No line items on file — totals reflect invoice totals.", 9);
  }

  y -= 10;
  ensureSpace(120);
  const subtotal = model.subtotal || 0;
  const adjustments = model.adjustments || 0;
  const total = model.total || 0;

  if (model.showGstBreakdown) {
    drawRightAt(
      `Subtotal (ex. GST): ${formatCurrency(model.subtotalExGst, currency)}`,
      10,
      PAGE_W - MARGIN,
      y
    );
    y -= 16;
    drawRightAt(`GST: ${formatCurrency(model.gstAmount, currency)}`, 10, PAGE_W - MARGIN, y);
    y -= 16;
  } else {
    drawRightAt(`Subtotal: ${formatCurrency(subtotal, currency)}`, 10, PAGE_W - MARGIN, y);
    y -= 16;
    if (adjustments !== 0) {
      drawRightAt(`Adjustments: ${formatCurrency(adjustments, currency)}`, 10, PAGE_W - MARGIN, y);
      y -= 16;
    }
  }
  drawRightAt(`Total: ${formatCurrency(total, currency)}`, 12, PAGE_W - MARGIN, y, true);
  y -= 18;

  if (model.showAmountDue) {
    drawRightAt(`Amount due: ${formatCurrency(model.amountDue, currency)}`, 10, PAGE_W - MARGIN, y);
    y -= 16;
  } else if (model.isPaidInFull) {
    drawRightAt("Paid in full", 10, PAGE_W - MARGIN, y);
    y -= 16;
  }

  if (model.paymentMethodsText) {
    y -= 6;
    ensureSpace(20);
    draw(model.paymentMethodsText, 9, false, rgb(0.35, 0.35, 0.35));
  }

  if (model.showBankTransfer && model.bankTransferBsb && model.bankTransferAccountNumber) {
    y -= 8;
    ensureSpace(70);
    draw("Payment via Bank Transfer", 10, true);
    if (model.bankTransferAccountName) {
      draw(`Account Name: ${model.bankTransferAccountName}`, 9);
    }
    draw(`BSB: ${model.bankTransferBsb}`, 9);
    draw(`Account Number: ${model.bankTransferAccountNumber}`, 9);
    draw(`Reference: ${invoiceNumber}`, 9);
    draw(
      "Payments via bank transfer will not be automatically tracked.",
      8,
      false,
      rgb(0.4, 0.4, 0.4)
    );
  }

  if (model.notes && String(model.notes).trim()) {
    y -= 10;
    ensureSpace(40);
    draw("Notes", 10, true);
    const noteLines = wrapLine(String(model.notes), font, 9, PAGE_W - 2 * MARGIN);
    for (const nl of noteLines) {
      ensureSpace(16);
      draw(nl, 9);
    }
  }

  y -= 10;
  ensureSpace(20);
  draw(`Generated by ${orgName}`, 8, false, rgb(0.4, 0.4, 0.4));

  const pdfBytes = await pdfDoc.save();
  const base64 = uint8ToBase64(pdfBytes);
  const filename = `Invoice-${sanitizeFilenamePart(invoiceNumber)}.pdf`;

  return { base64, filename, invoiceNumber };
}
