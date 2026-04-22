/**
 * Server-side invoice PDF generation for email attachments (pdf-lib).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";

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
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as number[],
    );
  }
  return btoa(binary);
}

function sanitizeFilenamePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function wrapLine(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
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

export async function generateInvoicePdfBase64(
  supabase: SupabaseClient,
  invoiceId: string,
  organizationId: string,
): Promise<{ base64: string; filename: string; invoiceNumber: string }> {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoice")
    .select(
      `
        id,
        invoice_number,
        created_at,
        due_date,
        subtotal,
        adjustments,
        total,
        currency,
        notes,
        status,
        organization_id
      `,
    )
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error("Invoice not found");
  }

  const { data: organization, error: orgError } = await supabase
    .from("organization")
    .select("name, abn")
    .eq("id", organizationId)
    .single();

  if (orgError || !organization) {
    throw new Error("Organization not found");
  }

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("invoice_line_item")
    .select("description, quantity, unit_price, amount")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  if (lineItemsError) {
    throw new Error("Failed to fetch invoice line items");
  }

  const rows = (lineItems || []) as Array<{
    description: string | null;
    quantity: number | null;
    unit_price: number | null;
    amount: number | null;
  }>;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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

  const drawRightAt = (
    text: string,
    size: number,
    xRight: number,
    yPos: number,
    bold = false,
  ) => {
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

  const currency = (invoice.currency as string) || "AUD";
  const invoiceNumber = invoice.invoice_number as string;
  const orgName = (organization.name as string) || "Organization";

  ensureSpace(80);
  draw(`Invoice ${invoiceNumber}`, 18, true);
  draw(orgName, 11);
  if (organization.abn) {
    draw(`ABN ${organization.abn}`, 10);
  }
  y -= 6;
  draw(`Status: ${String(invoice.status)}`, 9);
  draw(`Issued: ${formatDate(invoice.created_at as string)}`, 9);
  draw(`Due: ${formatDate(invoice.due_date as string)}`, 9);
  y -= 10;

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
  ensureSpace(90);
  const subtotal = Number(invoice.subtotal) || 0;
  const adjustments = Number(invoice.adjustments) || 0;
  const total = Number(invoice.total) || 0;

  drawRightAt(
    `Subtotal: ${formatCurrency(subtotal, currency)}`,
    10,
    PAGE_W - MARGIN,
    y,
  );
  y -= 16;
  drawRightAt(
    `Adjustments: ${formatCurrency(adjustments, currency)}`,
    10,
    PAGE_W - MARGIN,
    y,
  );
  y -= 18;
  drawRightAt(
    `Total: ${formatCurrency(total, currency)}`,
    12,
    PAGE_W - MARGIN,
    y,
    true,
  );
  y -= 20;

  if (invoice.notes && String(invoice.notes).trim()) {
    y -= 10;
    ensureSpace(40);
    draw("Notes", 10, true);
    const noteLines = wrapLine(String(invoice.notes), font, 9, PAGE_W - 2 * MARGIN);
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
