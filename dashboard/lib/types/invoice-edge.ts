/**
 * Invoice-related Edge Function JSON shapes (dashboard ↔ Supabase).
 * Keeps `invoice.service.ts` free of import cycles with `edge-contracts.ts`.
 */

import type { InvoiceTemplateConfig, InvoiceWithJobs } from "@/lib/types";

export interface CalculateInvoiceRequest {
  organization_id: string;
  job_ids: string[];
}

export interface CalculateInvoiceResponse {
  success: boolean;
  calculation: {
    total_subtotal: number;
    total_adjustments: number;
    total: number;
    total_worker_payment: number;
    total_margin: number;
    /** GST fields from calculate-invoice (Australian tax). */
    gst_registered?: boolean;
    gst_inclusive?: boolean;
    gst_amount?: number;
    subtotal_ex_gst?: number;
    currency?: string;
    job_calculations: Array<{
      job_id: string;
      base_price: number;
      line_items: Array<{
        field_config_id: string;
        field_name: string;
        field_label: string;
        option_value?: string;
        quantity: number;
        unit_price: number;
        total: number;
      }>;
      applied_rules: Array<{
        pricing_rule_id: string;
        scope: string;
        pricing_type: string;
        field_config_id: string | null;
        option_value: string | null;
        location_hierarchy_id: string | null;
        location_id: string | null;
        amount: number;
        worker_payment: number;
        metadata: Record<string, unknown>;
        snapshot_data?: Record<string, unknown>;
        line_item_key?: string;
      }>;
      subtotal: number;
      total_adjustments: number;
      total: number;
      worker_payment_total: number;
      margin: number;
    }>;
  };
}

export interface CreateInvoiceResponse {
  success: boolean;
  invoice: InvoiceWithJobs;
}

export interface ListInvoicesResponse {
  success: boolean;
  invoices: InvoiceWithJobs[];
  pagination?: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

export interface GetInvoiceDetailsRequest {
  invoice_id: string;
}

export interface ResolvedHierarchyBillingPayload {
  hierarchy_node_id: string;
  hierarchy_node_type: "company" | "region";
  hierarchy_node_name: string;
  billing_address: {
    name?: string | null;
    contact_person?: string | null;
    email?: string | null;
    phone?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postcode?: string | null;
    country?: string | null;
    address?: string | null;
  };
}

export interface GetInvoiceDetailsResponse {
  success: boolean;
  invoice: InvoiceWithJobs;
  calculation: CalculateInvoiceResponse["calculation"];
  template_config?: InvoiceTemplateConfig | null;
  hierarchy_metadata?: Record<
    string,
    {
      id: string;
      type: string;
      name: string;
      parent_id?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  >;
  resolved_billing?: ResolvedHierarchyBillingPayload | null;
}
