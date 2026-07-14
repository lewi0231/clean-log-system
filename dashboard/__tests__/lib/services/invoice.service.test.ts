import { InvoiceService } from "@/lib/services/invoice.service";
import { supabase } from "@/lib/supabase";
import { EdgeFunctionError } from "@/lib/supabase/invoke-edge-function";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));
vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("InvoiceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculate", () => {
    it("should calculate invoice successfully", async () => {
      const mockCalculation = {
        total_subtotal: 1000,
        total_adjustments: 0,
        total: 1000,
        total_worker_payment: 500,
        total_margin: 500,
        job_calculations: [
          {
            job_id: "job-1",
            base_price: 1000,
            line_items: [],
            applied_rules: [],
            subtotal: 1000,
            total_adjustments: 0,
            total: 1000,
            worker_payment_total: 500,
            margin: 500,
          },
        ],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          calculation: mockCalculation,
        },
        error: null,
      });

      const result = await InvoiceService.calculate({
        organization_id: "org-1",
        job_ids: ["job-1"],
      });

      expect(result).toEqual(mockCalculation);
      expect(supabase.functions.invoke).toHaveBeenCalledWith("calculate-invoice", {
        body: {
          organization_id: "org-1",
          job_ids: ["job-1"],
        },
      });
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Network error", status: 500 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        InvoiceService.calculate({
          organization_id: "org-1",
          job_ids: ["job-1"],
        })
      ).rejects.toBeInstanceOf(EdgeFunctionError);
      await expect(
        InvoiceService.calculate({
          organization_id: "org-1",
          job_ids: ["job-1"],
        })
      ).rejects.toThrow("Network error");
    });

    it("should throw error when calculation is missing", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await expect(
        InvoiceService.calculate({
          organization_id: "org-1",
          job_ids: ["job-1"],
        })
      ).rejects.toThrow("Failed to calculate invoice");
    });

    it("should throw error when success is false", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: false },
        error: null,
      });

      await expect(
        InvoiceService.calculate({
          organization_id: "org-1",
          job_ids: ["job-1"],
        })
      ).rejects.toThrow("Failed to calculate invoice");
    });
  });

  describe("create", () => {
    it("should create invoice successfully", async () => {
      const mockInvoice = {
        id: "inv-1",
        organization_id: "org-1",
        invoice_number: "INV-001",
        status: "draft",
        total: 1000,
        currency: "AUD",
        jobs: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          invoice: mockInvoice,
        },
        error: null,
      });

      const result = await InvoiceService.create({
        organization_id: "org-1",
        job_ids: ["job-1"],
        due_date: "2024-02-01",
      });

      expect(result).toEqual(mockInvoice);
      expect(supabase.functions.invoke).toHaveBeenCalledWith("create-invoice", {
        body: {
          organization_id: "org-1",
          job_ids: ["job-1"],
          due_date: "2024-02-01",
        },
      });
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Network error", status: 500 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        InvoiceService.create({
          organization_id: "org-1",
          job_ids: ["job-1"],
          due_date: "2024-02-01",
        })
      ).rejects.toBeInstanceOf(EdgeFunctionError);
      await expect(
        InvoiceService.create({
          organization_id: "org-1",
          job_ids: ["job-1"],
          due_date: "2024-02-01",
        })
      ).rejects.toThrow("Network error");
    });

    it("should throw error when invoice is missing", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await expect(
        InvoiceService.create({
          organization_id: "org-1",
          job_ids: ["job-1"],
          due_date: "2024-02-01",
        })
      ).rejects.toThrow("Failed to create invoice");
    });
  });

  describe("list", () => {
    it("should list invoices successfully", async () => {
      const mockInvoices = [
        {
          id: "inv-1",
          organization_id: "org-1",
          invoice_number: "INV-001",
          status: "sent",
          total: 1000,
          currency: "AUD",
          jobs: [],
        },
        {
          id: "inv-2",
          organization_id: "org-1",
          invoice_number: "INV-002",
          status: "paid",
          total: 2000,
          currency: "AUD",
          jobs: [],
        },
      ];

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          invoices: mockInvoices,
        },
        error: null,
      });

      const result = await InvoiceService.list({
        organization_id: "org-1",
      });

      expect(result).toEqual({ invoices: mockInvoices, pagination: undefined });
      expect(supabase.functions.invoke).toHaveBeenCalledWith("list-invoices", {
        body: {
          organization_id: "org-1",
        },
      });
    });

    it("should list invoices with date filters", async () => {
      const mockInvoices: never[] = [];

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          invoices: mockInvoices,
        },
        error: null,
      });

      const result = await InvoiceService.list({
        organization_id: "org-1",
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      });

      expect(result).toEqual({ invoices: mockInvoices, pagination: undefined });
      expect(supabase.functions.invoke).toHaveBeenCalledWith("list-invoices", {
        body: {
          organization_id: "org-1",
          start_date: "2024-01-01",
          end_date: "2024-01-31",
        },
      });
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Network error", status: 500 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        InvoiceService.list({
          organization_id: "org-1",
        })
      ).rejects.toBeInstanceOf(EdgeFunctionError);
      await expect(
        InvoiceService.list({
          organization_id: "org-1",
        })
      ).rejects.toThrow("Network error");
    });

    it("should throw error when invoices are missing", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await expect(
        InvoiceService.list({
          organization_id: "org-1",
        })
      ).rejects.toThrow("Failed to list invoices");
    });
  });

  describe("getInvoiceDetails", () => {
    it("should get invoice details successfully", async () => {
      const mockInvoice = {
        id: "inv-1",
        organization_id: "org-1",
        invoice_number: "INV-001",
        status: "sent",
        total: 1000,
        currency: "AUD",
        jobs: [],
      };

      const mockCalculation = {
        total_subtotal: 1000,
        total_adjustments: 0,
        total: 1000,
        total_worker_payment: 500,
        total_margin: 500,
        job_calculations: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          invoice: mockInvoice,
          calculation: mockCalculation,
        },
        error: null,
      });

      const result = await InvoiceService.getInvoiceDetails("inv-1");

      expect(result).toEqual({
        ...mockInvoice,
        calculation: mockCalculation,
        template_config: undefined,
      });
      expect(supabase.functions.invoke).toHaveBeenCalledWith("get-invoice-details", {
        body: {
          invoice_id: "inv-1",
        },
      });
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Network error", status: 500 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(InvoiceService.getInvoiceDetails("inv-1")).rejects.toBeInstanceOf(
        EdgeFunctionError
      );
      await expect(InvoiceService.getInvoiceDetails("inv-1")).rejects.toThrow("Network error");
    });

    it("should throw error when invoice or calculation is missing", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await expect(InvoiceService.getInvoiceDetails("inv-1")).rejects.toThrow(
        "Failed to get invoice details"
      );
    });
  });

  describe("updateStatus", () => {
    it("should update invoice status successfully", async () => {
      const mockInvoice = {
        id: "inv-1",
        organization_id: "org-1",
        invoice_number: "INV-001",
        status: "sent",
        total: 1000,
        currency: "AUD",
        jobs: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          invoice: mockInvoice,
        },
        error: null,
      });

      const result = await InvoiceService.updateStatus("inv-1", "org-1", "sent");

      expect(result).toEqual(mockInvoice);
      expect(supabase.functions.invoke).toHaveBeenCalledWith("update-invoice-status", {
        body: {
          invoice_id: "inv-1",
          organization_id: "org-1",
          status: "sent",
        },
      });
    });

    it("should pass sender_display_name when provided", async () => {
      const mockInvoice = {
        id: "inv-1",
        organization_id: "org-1",
        invoice_number: "INV-001",
        status: "sent",
        total: 1000,
        currency: "AUD",
        jobs: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          invoice: mockInvoice,
        },
        error: null,
      });

      await InvoiceService.updateStatus("inv-1", "org-1", "sent", {
        senderDisplayName: "Jane Admin",
      });

      expect(supabase.functions.invoke).toHaveBeenCalledWith("update-invoice-status", {
        body: {
          invoice_id: "inv-1",
          organization_id: "org-1",
          status: "sent",
          sender_display_name: "Jane Admin",
        },
      });
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Network error", status: 500 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(InvoiceService.updateStatus("inv-1", "org-1", "paid")).rejects.toBeInstanceOf(
        EdgeFunctionError
      );
      await expect(InvoiceService.updateStatus("inv-1", "org-1", "paid")).rejects.toThrow(
        "Network error"
      );
    });

    it("should throw error when invoice is missing", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await expect(InvoiceService.updateStatus("inv-1", "org-1", "paid")).rejects.toThrow(
        "Failed to update invoice status"
      );
    });
  });

  describe("resendInvoice", () => {
    it("should resend invoice successfully", async () => {
      const mockInvoice = {
        id: "inv-1",
        organization_id: "org-1",
        invoice_number: "INV-001",
        status: "sent",
        total: 1000,
        currency: "AUD",
        jobs: [],
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          invoice: mockInvoice,
        },
        error: null,
      });

      const result = await InvoiceService.resendInvoice("inv-1", "org-1");

      expect(result).toEqual(mockInvoice);
      expect(supabase.functions.invoke).toHaveBeenCalledWith("update-invoice-status", {
        body: {
          invoice_id: "inv-1",
          organization_id: "org-1",
          status: "sent",
          resend: true,
        },
      });
    });

    it("should throw error when Supabase returns error", async () => {
      const mockError = { message: "Network error", status: 500 };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(InvoiceService.resendInvoice("inv-1", "org-1")).rejects.toBeInstanceOf(
        EdgeFunctionError
      );
      await expect(InvoiceService.resendInvoice("inv-1", "org-1")).rejects.toThrow("Network error");
    });

    it("should throw error when invoice is missing", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await expect(InvoiceService.resendInvoice("inv-1", "org-1")).rejects.toThrow(
        "Failed to resend invoice"
      );
    });
  });
});
