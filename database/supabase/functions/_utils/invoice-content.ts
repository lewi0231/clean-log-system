/**
 * Shared invoice content for HTML PDF + pdf-lib attachments.
 * Aims for parity with React InvoiceDocument (title, GST, branding, bank).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatBillingAddressLines,
  formatServiceAddressLines,
  resolveHierarchyBilling,
  selectPrimaryInvoiceJob,
  type ResolvedHierarchyBilling,
} from "./hierarchy-billing.ts";
import {
  buildInvoiceDisplayRows,
  DEFAULT_LINE_ITEM_DISPLAY,
  type LineItemDisplayConfig,
} from "./invoice-line-item-display.ts";
import {
  finiteMoney,
  resolveInvoiceDocumentTitle,
  TAX_INVOICE_THRESHOLD_AUD,
} from "./invoice-tax.ts";

export { TAX_INVOICE_THRESHOLD_AUD, resolveInvoiceDocumentTitle as resolveDocumentTitle };

export interface InvoiceContentLocation {
  id?: string;
  name?: string | null;
  email?: string | null;
  address?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  hierarchy_parent_id?: string | null;
}

export interface InvoiceContentModel {
  invoiceNumber: string;
  documentTitle: "TAX INVOICE" | "INVOICE";
  status: string;
  createdAt: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  adjustments: number;
  total: number;
  totalPaid: number;
  amountDue: number;
  /** Match InvoiceDocument: only after a partial payment. */
  showAmountDue: boolean;
  /** Match InvoiceDocument: paid in full with at least one payment recorded. */
  isPaidInFull: boolean;
  notes: string | null;
  orgName: string;
  orgAbn: string | null;
  orgLogoUrl: string | null;
  orgBusinessAddress: string | null;
  orgContactEmail: string | null;
  orgContactPhone: string | null;
  gstRegistered: boolean;
  showGstBreakdown: boolean;
  gstAmount: number;
  subtotalExGst: number;
  showBankTransfer: boolean;
  bankTransferBsb: string | null;
  bankTransferAccountNumber: string | null;
  bankTransferAccountName: string | null;
  paymentMethodsText: string | null;
  serviceAddressLines: string[];
  billingAddressLines: string[];
  showBillingAddress: boolean;
  resolvedBilling: ResolvedHierarchyBilling | null;
  lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
}

function normalizeLogoUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let logoUrl = raw.trim();
  if (logoUrl.includes("kong:8000")) {
    logoUrl = logoUrl.replace(/http:\/\/kong:8000/, "http://127.0.0.1:54321");
  }
  if (!logoUrl.startsWith("http")) return null;
  return logoUrl;
}

/**
 * Build display content for an invoice (used by generate-invoice-pdf + invoice-pdf).
 */
export async function buildInvoiceContentModel(
  supabase: SupabaseClient,
  invoiceId: string,
  organizationId: string
): Promise<InvoiceContentModel> {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoice")
    .select(
      `
      *,
        invoice_job:invoice_job (
        job:job_id (
          id,
          submission_data,
          location:location_id (
            id,
            name,
            email,
            address,
            contact_person,
            phone,
            hierarchy_parent_id
          )
        )
      )
    `
    )
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message || "Invoice not found");
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organization")
    .select(
      "name, abn, logo_url, business_address, primary_contact_email, primary_contact_phone, stripe_account_id"
    )
    .eq("id", organizationId)
    .single();

  if (organizationError || !organization) {
    throw new Error(organizationError?.message || "Organization not found for invoice");
  }

  const { data: orgSettings, error: orgSettingsError } = await supabase
    .from("organization_settings")
    .select(
      "gst_registered, gst_inclusive, show_bank_transfer_on_invoices, bank_transfer_bsb, bank_transfer_account_number, bank_transfer_account_name"
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (orgSettingsError) {
    throw new Error(`Failed to load organization settings: ${orgSettingsError.message}`);
  }

  const { data: templateConfig, error: templateError } = await supabase
    .from("invoice_template_config")
    .select(
      "billing_address_config, service_address_config, line_item_display, show_logo, show_abn"
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (templateError) {
    throw new Error(`Failed to load invoice template config: ${templateError.message}`);
  }

  const billingEnabled =
    templateConfig?.billing_address_config &&
    typeof templateConfig.billing_address_config === "object" &&
    (templateConfig.billing_address_config as { enabled?: boolean }).enabled === true;

  const serviceConfig = (templateConfig?.service_address_config ?? {
    source: "auto",
    location_fields: ["name", "address", "contact_person", "email", "phone"],
  }) as {
    source?: string;
    location_fields?: string[];
    form_fields?: string[];
  };

  const showLogo = templateConfig?.show_logo !== false;
  const showAbn = templateConfig?.show_abn !== false;

  // Primary location = first invoice_job with a location (shared with InvoiceDocument / APIs)
  const invoiceJobs = Array.isArray(invoice.invoice_job) ? invoice.invoice_job : [];
  const primary = selectPrimaryInvoiceJob(invoiceJobs);
  const primaryLocation = primary.location as InvoiceContentLocation | null;
  const primarySubmission = primary.submission_data;

  let serviceAddressSource = serviceConfig.source ?? "auto";
  if (serviceAddressSource === "auto") {
    serviceAddressSource = primaryLocation?.id ? "location" : "form_fields";
  }

  let serviceAddressLines: string[] = [];
  if (serviceAddressSource === "location" && primaryLocation) {
    serviceAddressLines = formatServiceAddressLines(
      primaryLocation,
      serviceConfig.location_fields ?? ["name", "address", "contact_person", "email", "phone"]
    );
  } else if (serviceAddressSource === "form_fields" && primarySubmission) {
    const fields = serviceConfig.form_fields ?? [];
    for (const fn of fields) {
      const v = primarySubmission[fn];
      if (v != null && String(v).trim() !== "") {
        serviceAddressLines.push(String(v).trim());
      }
    }
  }

  const resolvedBilling = await resolveHierarchyBilling(
    supabase,
    primary.hierarchy_parent_id,
    "display"
  );

  const billingAddressLines =
    billingEnabled && resolvedBilling
      ? formatBillingAddressLines(resolvedBilling.billing_address)
      : [];

  // Line items: prefer invoice_line_item rows; else build from calculation snapshot
  let lineItems: InvoiceContentModel["lineItems"] = [];
  const { data: dbLines, error: lineItemsError } = await supabase
    .from("invoice_line_item")
    .select("description, quantity, unit_price, amount")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  if (lineItemsError) {
    throw new Error(`Failed to load invoice line items: ${lineItemsError.message}`);
  }

  const snap = (invoice.calculation_snapshot ?? null) as {
    gst_registered?: boolean;
    gst_amount?: number;
    subtotal_ex_gst?: number;
    total?: number;
    job_calculations?: Array<{
      base_price?: number;
      line_items?: Array<{
        field_label: string;
        option_value?: string | null;
        quantity: number;
        unit_price: number;
        total: number;
      }> | null;
    }>;
  } | null;

  if (dbLines && dbLines.length > 0) {
    lineItems = dbLines.map(
      (row: {
        description?: string | null;
        quantity?: number | null;
        unit_price?: number | null;
        amount?: number | null;
      }) => ({
        description: String(row.description ?? "—"),
        quantity: finiteMoney(row.quantity, 1),
        unit_price: finiteMoney(row.unit_price, 0),
        amount: finiteMoney(row.amount, 0),
      })
    );
  } else if (snap) {
    const displayConfig =
      (templateConfig?.line_item_display as LineItemDisplayConfig | null) ??
      DEFAULT_LINE_ITEM_DISPLAY;
    for (const row of buildInvoiceDisplayRows(snap.job_calculations ?? [], displayConfig)) {
      lineItems.push({
        description: row.description,
        quantity: finiteMoney(row.quantity, 1),
        unit_price: finiteMoney(row.unit_price, 0),
        amount: finiteMoney(row.amount, 0),
      });
    }
  }

  const currency = String(invoice.currency ?? "AUD");
  const total = finiteMoney(invoice.total ?? snap?.total, 0);
  const totalPaid = finiteMoney(invoice.total_paid, 0);
  const amountDue = Math.max(0, total - totalPaid);
  // Parity with InvoiceDocument — do not show amount due on unpaid (zero paid) invoices.
  const showAmountDue = totalPaid > 0 && totalPaid < total;
  const isPaidInFull = totalPaid > 0 && totalPaid >= total;

  const gstRegistered =
    typeof snap?.gst_registered === "boolean"
      ? snap.gst_registered
      : (orgSettings?.gst_registered ?? false);
  const gstAmount = finiteMoney(snap?.gst_amount, 0);
  const subtotalExGst =
    typeof snap?.subtotal_ex_gst === "number" && Number.isFinite(snap.subtotal_ex_gst)
      ? snap.subtotal_ex_gst
      : Math.max(0, total - gstAmount);
  const showGstBreakdown = gstRegistered && gstAmount > 0;

  const showBankTransfer = !!(
    orgSettings?.show_bank_transfer_on_invoices !== false &&
    orgSettings?.bank_transfer_bsb &&
    orgSettings?.bank_transfer_account_number
  );

  const paymentMethodParts: string[] = [];
  if (showBankTransfer) paymentMethodParts.push("Bank transfer");
  if (organization.stripe_account_id) paymentMethodParts.push("Credit/Debit card");
  const paymentMethodsText =
    paymentMethodParts.length > 0 ? `Payment methods: ${paymentMethodParts.join(", ")}.` : null;

  return {
    invoiceNumber: String(invoice.invoice_number ?? ""),
    documentTitle: resolveInvoiceDocumentTitle({ gstRegistered, currency, total }),
    status: String(invoice.status ?? ""),
    createdAt: String(invoice.created_at ?? ""),
    dueDate: String(invoice.due_date ?? ""),
    currency,
    subtotal: finiteMoney(invoice.subtotal, 0),
    adjustments: finiteMoney(invoice.adjustments, 0),
    total,
    totalPaid,
    amountDue,
    showAmountDue,
    isPaidInFull,
    notes: invoice.notes != null ? String(invoice.notes) : null,
    orgName: organization.name ? String(organization.name) : "Organization",
    orgAbn: showAbn && organization.abn ? String(organization.abn) : null,
    orgLogoUrl: showLogo ? normalizeLogoUrl(organization.logo_url) : null,
    orgBusinessAddress: organization.business_address
      ? String(organization.business_address)
      : null,
    orgContactEmail: organization.primary_contact_email
      ? String(organization.primary_contact_email)
      : null,
    orgContactPhone: organization.primary_contact_phone
      ? String(organization.primary_contact_phone)
      : null,
    gstRegistered,
    showGstBreakdown,
    gstAmount,
    subtotalExGst,
    showBankTransfer,
    bankTransferBsb: orgSettings?.bank_transfer_bsb ? String(orgSettings.bank_transfer_bsb) : null,
    bankTransferAccountNumber: orgSettings?.bank_transfer_account_number
      ? String(orgSettings.bank_transfer_account_number)
      : null,
    bankTransferAccountName: orgSettings?.bank_transfer_account_name
      ? String(orgSettings.bank_transfer_account_name)
      : null,
    paymentMethodsText,
    serviceAddressLines,
    billingAddressLines,
    showBillingAddress: billingEnabled && billingAddressLines.length > 0,
    resolvedBilling,
    lineItems,
  };
}
