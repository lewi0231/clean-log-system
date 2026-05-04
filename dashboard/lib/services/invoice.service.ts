import { log } from "@/lib/logger";
import {
  getInvokeErrorMessage,
  invokeEdgeFunction,
  invokeTypedEdge,
} from "@/lib/supabase/invoke-edge-function";
import type {
  CreateInvoiceRequest,
  InvoiceTemplateConfig,
  InvoiceWithJobs,
  ListInvoicesRequest,
} from "@/lib/types";
import type {
  CalculateInvoiceRequest,
  CalculateInvoiceResponse,
  GetInvoiceDetailsResponse,
  ListInvoicesResponse,
} from "@/lib/types/invoice-edge";

export type {
  CalculateInvoiceRequest,
  CalculateInvoiceResponse,
  CreateInvoiceResponse,
  GetInvoiceDetailsRequest,
  GetInvoiceDetailsResponse,
  ListInvoicesResponse,
} from "@/lib/types/invoice-edge";

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

      const data = await invokeTypedEdge("calculate-invoice", request);

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

      const data = await invokeTypedEdge("create-invoice", request);

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

      const data = await invokeTypedEdge("list-invoices", request);

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

      const data = await invokeTypedEdge("get-invoice-details", {
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
