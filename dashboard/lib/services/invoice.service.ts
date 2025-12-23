import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type {
  CreateInvoiceRequest,
  InvoiceWithJobs,
  ListInvoicesRequest,
} from "@/lib/types";

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
}

export interface GetInvoiceDetailsRequest {
  invoice_id: string;
}

export interface GetInvoiceDetailsResponse {
  success: boolean;
  invoice: InvoiceWithJobs;
  calculation: CalculateInvoiceResponse["calculation"];
}

export class InvoiceService {
  /**
   * Calculate invoice totals for one or more jobs
   */
  static async calculate(
    request: CalculateInvoiceRequest,
  ): Promise<CalculateInvoiceResponse["calculation"]> {
    try {
      log.debug("InvoiceService: Calculating invoice", {
        organizationId: request.organization_id,
        jobCount: request.job_ids.length,
      });

      const { data, error } = await supabase.functions.invoke(
        "calculate-invoice",
        {
          body: request,
        },
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success || !data.calculation) {
        throw new Error("Failed to calculate invoice");
      }

      log.info("InvoiceService: Invoice calculated successfully");
      return data.calculation;
    } catch (err) {
      log.error("InvoiceService: Failed to calculate invoice", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Create an invoice from one or more jobs
   */
  static async create(request: CreateInvoiceRequest): Promise<InvoiceWithJobs> {
    try {
      log.debug("InvoiceService: Creating invoice", {
        organizationId: request.organization_id,
        jobCount: request.job_ids.length,
      });

      const { data, error } = await supabase.functions.invoke(
        "create-invoice",
        {
          body: request,
        },
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success || !data.invoice) {
        throw new Error("Failed to create invoice");
      }

      log.info("InvoiceService: Invoice created successfully");
      return data.invoice as InvoiceWithJobs;
    } catch (err) {
      log.error("InvoiceService: Failed to create invoice", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * List invoices for an organization with optional date filtering
   */
  static async list(request: ListInvoicesRequest): Promise<InvoiceWithJobs[]> {
    try {
      log.debug("InvoiceService: Listing invoices", {
        organizationId: request.organization_id,
        startDate: request.start_date,
        endDate: request.end_date,
      });

      const { data, error } = await supabase.functions.invoke("list-invoices", {
        body: request,
      });

      if (error) {
        throw error;
      }

      if (!data || !data.success || !data.invoices) {
        throw new Error("Failed to list invoices");
      }

      log.info("InvoiceService: Invoices listed successfully", {
        invoiceCount: data.invoices.length,
      });
      return data.invoices as InvoiceWithJobs[];
    } catch (err) {
      log.error("InvoiceService: Failed to list invoices", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Get detailed invoice information including line items and calculations
   */
  static async getInvoiceDetails(invoiceId: string): Promise<
    GetInvoiceDetailsResponse["invoice"] & {
      calculation: GetInvoiceDetailsResponse["calculation"];
    }
  > {
    try {
      log.debug("InvoiceService: Getting invoice details", {
        invoiceId,
      });

      const { data, error } = await supabase.functions.invoke(
        "get-invoice-details",
        {
          body: {
            invoice_id: invoiceId,
          },
        },
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success || !data.invoice || !data.calculation) {
        throw new Error("Failed to get invoice details");
      }

      log.info("InvoiceService: Invoice details retrieved successfully");
      return {
        ...data.invoice,
        calculation: data.calculation,
        template_config: data.template_config,
      } as InvoiceWithJobs & {
        calculation: CalculateInvoiceResponse["calculation"];
        template_config: Record<string, unknown> | null; // Will be properly typed later
      };
    } catch (err) {
      log.error("InvoiceService: Failed to get invoice details", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Update invoice status
   */
  static async updateStatus(
    invoiceId: string,
    status:
      | "draft"
      | "pending_review"
      | "sent"
      | "paid"
      | "overdue"
      | "cancelled",
  ): Promise<InvoiceWithJobs> {
    try {
      log.debug("InvoiceService: Updating invoice status", {
        invoiceId,
        status,
      });

      const { data, error } = await supabase.functions.invoke(
        "update-invoice-status",
        {
          body: {
            invoice_id: invoiceId,
            status: status,
          },
        },
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success || !data.invoice) {
        throw new Error("Failed to update invoice status");
      }

      log.info("InvoiceService: Invoice status updated successfully");
      return data.invoice as InvoiceWithJobs;
    } catch (err) {
      log.error("InvoiceService: Failed to update invoice status", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Resend an invoice - creates a new payment link and sends the email again
   */
  static async resendInvoice(invoiceId: string): Promise<InvoiceWithJobs> {
    try {
      log.debug("InvoiceService: Resending invoice", {
        invoiceId,
      });

      const { data, error } = await supabase.functions.invoke(
        "update-invoice-status",
        {
          body: {
            invoice_id: invoiceId,
            status: "sent",
            resend: true, // Flag to force resend with new payment link
          },
        },
      );

      if (error) {
        throw error;
      }

      if (!data || !data.success || !data.invoice) {
        throw new Error("Failed to resend invoice");
      }

      log.info("InvoiceService: Invoice resent successfully");
      return data.invoice as InvoiceWithJobs;
    } catch (err) {
      log.error("InvoiceService: Failed to resend invoice", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
