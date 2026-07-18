import { invokeAuthedFunction } from "@/lib/invoke-authed-function";

export type WorkerTaxInvoiceStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled"
  | "paid";

export type WorkerTaxInvoice = {
  id: string;
  organization_id: string;
  worker_id: string;
  invoice_number: string | null;
  status: WorkerTaxInvoiceStatus;
  subtotal: number;
  total: number;
  currency?: string;
  submitted_at?: string | null;
  created_at: string;
  lines?: Array<{
    id: string;
    job_id: string;
    description: string;
    amount: number;
  }>;
};

export async function listWorkerTaxInvoices(
  organizationId: string,
  accessToken: string
): Promise<{ ok: true; invoices: WorkerTaxInvoice[] } | { ok: false; message: string }> {
  const { data, error } = await invokeAuthedFunction<{
    invoices?: WorkerTaxInvoice[];
    error?: string;
    detail?: string;
  }>("list-worker-tax-invoices", accessToken, {
    body: { organization_id: organizationId },
  });

  if (error) {
    return { ok: false, message: error.message || "Failed to load tax invoices" };
  }
  if (data?.error) {
    return { ok: false, message: data.detail || data.error };
  }
  return { ok: true, invoices: data?.invoices ?? [] };
}

export async function draftWorkerTaxInvoice(
  organizationId: string,
  jobIds: string[],
  accessToken: string
): Promise<{ ok: true; invoice: WorkerTaxInvoice } | { ok: false; message: string }> {
  const { data, error } = await invokeAuthedFunction<{
    invoice?: WorkerTaxInvoice;
    error?: string;
    detail?: string;
  }>("draft-worker-tax-invoice", accessToken, {
    body: { organization_id: organizationId, job_ids: jobIds },
  });

  if (error) {
    return { ok: false, message: error.message || "Failed to create draft" };
  }
  if (data?.error || !data?.invoice) {
    return { ok: false, message: data?.detail || data?.error || "Failed to create draft" };
  }
  return { ok: true, invoice: data.invoice };
}

export async function submitWorkerTaxInvoice(
  organizationId: string,
  invoiceId: string,
  accessToken: string
): Promise<{ ok: true; invoice: WorkerTaxInvoice } | { ok: false; message: string }> {
  const { data, error } = await invokeAuthedFunction<{
    invoice?: WorkerTaxInvoice;
    error?: string;
    detail?: string;
  }>("submit-worker-tax-invoice", accessToken, {
    body: { organization_id: organizationId, invoice_id: invoiceId },
  });

  if (error) {
    return { ok: false, message: error.message || "Failed to submit tax invoice" };
  }
  if (data?.error || !data?.invoice) {
    return { ok: false, message: data?.detail || data?.error || "Failed to submit tax invoice" };
  }
  return { ok: true, invoice: data.invoice };
}

export async function cancelWorkerTaxInvoice(
  organizationId: string,
  invoiceId: string,
  accessToken: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await invokeAuthedFunction<{
    error?: string;
    detail?: string;
  }>("update-worker-tax-invoice-status", accessToken, {
    body: {
      organization_id: organizationId,
      invoice_id: invoiceId,
      action: "cancel",
    },
  });

  if (error) {
    return { ok: false, message: error.message || "Failed to cancel" };
  }
  if (data?.error) {
    return { ok: false, message: data.detail || data.error };
  }
  return { ok: true };
}
