import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import type { WorkerTaxInvoice } from "@/lib/types";

export class WorkerTaxInvoiceService {
  static async list(organizationId: string): Promise<WorkerTaxInvoice[]> {
    const data = await invokeTypedEdge("list-worker-tax-invoices", {
      organization_id: organizationId,
    });
    return data.invoices ?? [];
  }

  static async get(organizationId: string, invoiceId: string): Promise<WorkerTaxInvoice | null> {
    const data = await invokeTypedEdge("get-worker-tax-invoice", {
      organization_id: organizationId,
      invoice_id: invoiceId,
    });
    return data.invoice ?? null;
  }

  static async review(
    organizationId: string,
    invoiceId: string,
    action: "approve" | "reject",
    reviewNotes?: string
  ): Promise<WorkerTaxInvoice | null> {
    const data = await invokeTypedEdge("review-worker-tax-invoice", {
      organization_id: organizationId,
      invoice_id: invoiceId,
      action,
      review_notes: reviewNotes ?? null,
    });
    return data.invoice ?? null;
  }

  static async updateStatus(
    organizationId: string,
    invoiceId: string,
    action: "cancel" | "mark_paid"
  ): Promise<WorkerTaxInvoice | null> {
    const data = await invokeTypedEdge("update-worker-tax-invoice-status", {
      organization_id: organizationId,
      invoice_id: invoiceId,
      action,
    });
    return data.invoice ?? null;
  }

  static async generatePdfHtml(
    organizationId: string,
    invoiceId: string
  ): Promise<{ html: string; invoice_number: string | null }> {
    const data = await invokeTypedEdge("generate-worker-tax-invoice-pdf", {
      organization_id: organizationId,
      invoice_id: invoiceId,
    });
    return {
      html: data.html ?? "",
      invoice_number: data.invoice_number ?? null,
    };
  }
}
