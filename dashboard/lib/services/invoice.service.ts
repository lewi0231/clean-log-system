import { log } from "@/lib/logger";
import { getInvokeErrorMessage, invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
import type {
  CreateInvoiceRequest,
  InvoiceTemplateConfig,
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

export interface GetInvoiceDetailsResponse {
  success: boolean;
  invoice: InvoiceWithJobs;
  calculation: CalculateInvoiceResponse["calculation"];
  template_config?: InvoiceTemplateConfig | null;
}

export class InvoiceService {
  /**
   * Calculate invoice totals for one or more jobs
   */
  static async calculate(
    request: CalculateInvoiceRequest
  ): Promise<CalculateInvoiceResponse["calculation"]> {
    try {
      log.debug("InvoiceService: Calculating invoice", {
        organizationId: request.organization_id,
        jobCount: request.job_ids.length,
      });

      const data = await invokeEdgeFunction<CalculateInvoiceResponse>(
        "calculate-invoice",
        request as unknown as Record<string, unknown>
      );

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

      const data = await invokeEdgeFunction<CreateInvoiceResponse>(
        "create-invoice",
        request as unknown as Record<string, unknown>
      );

      if (!data || !data.success || !data.invoice) {
        // Check if there's a more specific error message in the response
        const errorMessage = (data as { error?: string })?.error || "Failed to create invoice";
        throw new Error(errorMessage);
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
   * List invoices for an organization with optional filtering and pagination
   */
  static async list(request: ListInvoicesRequest): Promise<{
    invoices: InvoiceWithJobs[];
    pagination?: ListInvoicesResponse["pagination"];
  }> {
    try {
      log.debug("InvoiceService: Listing invoices", {
        organizationId: request.organization_id,
        startDate: request.start_date,
        endDate: request.end_date,
        search: request.search,
        status: request.status,
        page: request.page,
      });

      const data = await invokeEdgeFunction<ListInvoicesResponse>(
        "list-invoices",
        request as unknown as Record<string, unknown>
      );

      if (!data || !data.success || !data.invoices) {
        throw new Error("Failed to list invoices");
      }

      log.info("InvoiceService: Invoices listed successfully", {
        invoiceCount: data.invoices.length,
        totalCount: data.pagination?.total_count,
      });
      return {
        invoices: data.invoices as InvoiceWithJobs[],
        pagination: data.pagination,
      };
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

      const data = await invokeEdgeFunction<GetInvoiceDetailsResponse>("get-invoice-details", {
        invoice_id: invoiceId,
      });

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
        template_config?: InvoiceTemplateConfig | null;
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
    organizationId: string,
    status: "draft" | "pending_review" | "sent" | "paid" | "overdue" | "cancelled",
    options?: { senderDisplayName?: string }
  ): Promise<InvoiceWithJobs> {
    try {
      log.debug("InvoiceService: Updating invoice status", {
        invoiceId,
        organizationId,
        status,
      });

      const body: Record<string, unknown> = {
        invoice_id: invoiceId,
        organization_id: organizationId,
        status,
      };
      if (options?.senderDisplayName?.trim()) {
        body.sender_display_name = options.senderDisplayName.trim();
      }

      const data = await invokeEdgeFunction<{
        success: boolean;
        invoice?: InvoiceWithJobs;
        message?: string;
      }>("update-invoice-status", body);

      if (!data || !data.success || !data.invoice) {
        const keys =
          data && typeof data === "object" ? Object.keys(data as Record<string, unknown>) : [];
        log.error("InvoiceService: update-invoice-status returned invalid payload", {
          invoiceId,
          status,
          hasData: Boolean(data),
          success: data?.success,
          keys,
        });
        throw new Error(
          typeof data?.message === "string" && data.message.length > 0
            ? data.message
            : "Failed to update invoice status (missing invoice in response). Try refreshing the page."
        );
      }

      log.info("InvoiceService: Invoice status updated successfully");
      return data.invoice as InvoiceWithJobs;
    } catch (err) {
      const message = getInvokeErrorMessage(err);
      log.error("InvoiceService: Failed to update invoice status", {
        message,
        name: err instanceof Error ? err.name : typeof err,
      });
      throw err;
    }
  }

  /**
   * Resend an invoice - creates a new payment link and sends the email again
   */
  static async resendInvoice(
    invoiceId: string,
    organizationId: string,
    options?: { senderDisplayName?: string }
  ): Promise<InvoiceWithJobs> {
    try {
      log.debug("InvoiceService: Resending invoice", {
        invoiceId,
        organizationId,
      });

      const body: Record<string, unknown> = {
        invoice_id: invoiceId,
        organization_id: organizationId,
        status: "sent",
        resend: true,
      };
      if (options?.senderDisplayName?.trim()) {
        body.sender_display_name = options.senderDisplayName.trim();
      }

      const data = await invokeEdgeFunction<{
        success: boolean;
        invoice?: InvoiceWithJobs;
        message?: string;
      }>("update-invoice-status", body);

      if (!data || !data.success || !data.invoice) {
        const keys =
          data && typeof data === "object" ? Object.keys(data as Record<string, unknown>) : [];
        log.error("InvoiceService: resend returned invalid payload", {
          invoiceId,
          hasData: Boolean(data),
          success: data?.success,
          keys,
        });
        throw new Error(
          typeof data?.message === "string" && data.message.length > 0
            ? data.message
            : "Failed to resend invoice (missing invoice in response). Try refreshing the page."
        );
      }

      log.info("InvoiceService: Invoice resent successfully");
      return data.invoice as InvoiceWithJobs;
    } catch (err) {
      const message = getInvokeErrorMessage(err);
      log.error("InvoiceService: Failed to resend invoice", {
        message,
        name: err instanceof Error ? err.name : typeof err,
      });
      throw err;
    }
  }

  /**
   * Send a payment reminder for an overdue invoice
   */
  static async sendReminder(
    invoiceId: string,
    organizationId: string
  ): Promise<{
    success: boolean;
    reminder_count: number;
    days_overdue: number;
  }> {
    try {
      log.debug("InvoiceService: Sending invoice reminder", {
        invoiceId,
        organizationId,
      });

      const data = await invokeEdgeFunction<{
        success: boolean;
        reminder_count: number;
        days_overdue: number;
        message?: string;
      }>("send-invoice-reminder", {
        invoice_id: invoiceId,
        organization_id: organizationId,
      });

      if (!data || !data.success) {
        throw new Error(data?.message || "Failed to send reminder");
      }

      log.info("InvoiceService: Reminder sent successfully", {
        reminder_count: data.reminder_count,
        days_overdue: data.days_overdue,
      });

      return {
        success: true,
        reminder_count: data.reminder_count,
        days_overdue: data.days_overdue,
      };
    } catch (err) {
      log.error("InvoiceService: Failed to send invoice reminder", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  /**
   * Generate invoice PDF HTML
   * Returns HTML that can be used for print/PDF generation
   */
  static async generatePdfHtml(
    invoiceId: string,
    organizationId: string
  ): Promise<{ html: string; invoiceNumber: string }> {
    try {
      log.debug("InvoiceService: Generating invoice PDF HTML", {
        invoiceId,
        organizationId,
      });

      const response = await invokeEdgeFunction<{
        success: boolean;
        html: string;
        invoice_number: string;
      }>("generate-invoice-pdf", {
        invoice_id: invoiceId,
        organization_id: organizationId,
      });

      if (!response || !response.success || !response.html) {
        throw new Error("Failed to generate invoice PDF");
      }

      log.info("InvoiceService: PDF HTML generated successfully");

      return {
        html: response.html,
        invoiceNumber: response.invoice_number,
      };
    } catch (err) {
      log.error("InvoiceService: Failed to generate PDF HTML", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }
}
