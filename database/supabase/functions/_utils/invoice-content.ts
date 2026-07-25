/**
 * Shared invoice content for HTML PDF + pdf-lib attachments (Bill To / service address).
 * Full GST/bank parity with React InvoiceDocument is out of v1 scope.
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
  status: string;
  createdAt: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  adjustments: number;
  total: number;
  notes: string | null;
  orgName: string;
  orgAbn: string | null;
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

  const { data: organization } = await supabase
    .from("organization")
    .select("name, abn")
    .eq("id", organizationId)
    .single();

  const { data: templateConfig } = await supabase
    .from("invoice_template_config")
    .select("billing_address_config, service_address_config, line_item_display")
    .eq("organization_id", organizationId)
    .maybeSingle();

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
  const { data: dbLines } = await supabase
    .from("invoice_line_item")
    .select("description, quantity, unit_price, amount")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  if (dbLines && dbLines.length > 0) {
    lineItems = dbLines.map((row) => ({
      description: String(row.description ?? "—"),
      quantity: Number(row.quantity ?? 1),
      unit_price: Number(row.unit_price ?? 0),
      amount: Number(row.amount ?? 0),
    }));
  } else if (invoice.calculation_snapshot) {
    const snap = invoice.calculation_snapshot as {
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
    };
    const displayConfig =
      (templateConfig?.line_item_display as LineItemDisplayConfig | null) ??
      DEFAULT_LINE_ITEM_DISPLAY;
    for (const jc of snap.job_calculations ?? []) {
      for (const row of buildInvoiceDisplayRows(jc, displayConfig)) {
        lineItems.push({
          description: row.description,
          quantity: row.quantity ?? 1,
          unit_price: row.unit_price ?? 0,
          amount: row.amount ?? 0,
        });
      }
    }
  }

  return {
    invoiceNumber: String(invoice.invoice_number ?? ""),
    status: String(invoice.status ?? ""),
    createdAt: String(invoice.created_at ?? ""),
    dueDate: String(invoice.due_date ?? ""),
    currency: String(invoice.currency ?? "AUD"),
    subtotal: Number(invoice.subtotal ?? 0),
    adjustments: Number(invoice.adjustments ?? 0),
    total: Number(invoice.total ?? 0),
    notes: invoice.notes != null ? String(invoice.notes) : null,
    orgName: organization?.name ? String(organization.name) : "Organization",
    orgAbn: organization?.abn ? String(organization.abn) : null,
    serviceAddressLines,
    billingAddressLines,
    showBillingAddress: billingEnabled && billingAddressLines.length > 0,
    resolvedBilling,
    lineItems,
  };
}
