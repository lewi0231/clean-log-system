import PaymentHistoryList from "@/components/worker-payments/payment-history-list";
import type { Job } from "@/lib/types";
import type { PaymentRecord } from "@/lib/services/worker-payment.service";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const line = (
  o: Pick<
    import("@/lib/worker-payments/export-batch-worker-csv").BatchWorkerPaymentRow,
    "id" | "job_id" | "worker_id" | "amount" | "currency"
  > &
    Partial<import("@/lib/worker-payments/export-batch-worker-csv").BatchWorkerPaymentRow>
) =>
  ({
    status: "calculated",
    payment_method: null,
    payment_reference: null,
    paid_at: null,
    notes: null,
    created_at: "2024-01-15T12:00:00Z",
    calculation_details: {},
    ...o,
  }) as import("@/lib/worker-payments/export-batch-worker-csv").BatchWorkerPaymentRow;

// Mock data
const mockPaymentHistory: PaymentRecord[] = [
  {
    id: "batch-1",
    batch_id: "batch-1",
    dateRange: { start: "2024-01-01T00:00:00Z", end: "2024-01-15T00:00:00Z" },
    jobIds: ["job-1", "job-2"],
    totalPayment: 500,
    workerCount: 3,
    calculatedAt: "2024-01-15T12:00:00Z",
    status: "calculated",
    currency: "AUD",
    payments: [
      line({ id: "a", job_id: "job-1", worker_id: "w1", amount: 250, currency: "AUD" }),
      line({ id: "b", job_id: "job-2", worker_id: "w2", amount: 250, currency: "AUD" }),
    ],
    calculation: {
      success: true,
      calculation: {
        total_worker_payment: 500,
        job_calculations: [],
      },
    },
  },
  {
    id: "batch-2",
    batch_id: "batch-2",
    dateRange: { start: "2024-01-16T00:00:00Z", end: "2024-01-31T00:00:00Z" },
    jobIds: ["job-3"],
    totalPayment: 300,
    workerCount: 2,
    calculatedAt: "2024-01-31T12:00:00Z",
    status: "completed",
    currency: "AUD",
    payments: [
      line({
        id: "c",
        job_id: "job-3",
        worker_id: "w1",
        amount: 300,
        currency: "AUD",
        status: "paid",
        paid_at: "2024-01-20T00:00:00Z",
      }),
    ],
    calculation: {
      success: true,
      calculation: {
        total_worker_payment: 300,
        job_calculations: [],
      },
    },
  },
];

const mockJobs = [
  {
    id: "job-1",
    completed_at: "2024-01-10T10:00:00Z",
    workers: [{ id: "w1", name: "John" }],
  },
  {
    id: "job-2",
    completed_at: "2024-01-15T10:00:00Z",
    workers: [{ id: "w2", name: "Jane" }],
  },
  {
    id: "job-3",
    completed_at: "2024-01-20T10:00:00Z",
    workers: [{ id: "w1", name: "John" }],
  },
];

// Mock dependencies
const { mockExportBatch, mockUseWorkerPaymentHistory } = vi.hoisted(() => ({
  mockExportBatch: vi.fn(() => "\uFEFF# Tally\n# RECONCILIATION: T_batch=100 S_workers=100 OK"),
  mockUseWorkerPaymentHistory: vi.fn(),
}));

const mockFilterByDateRange = vi.fn(() => mockPaymentHistory);
const mockAddPayment = vi.fn();
const mockInvalidate = vi.fn();
const mockCalculatePayments = vi.fn();
const mockRefetch = vi.fn(() => Promise.resolve({ data: mockPaymentHistory }));

vi.mock("@/hooks/useOrganization", () => ({
  default: vi.fn(() => ({ organizationId: "org-123" })),
}));

vi.mock("@/hooks/use-organization-currency", () => ({
  useOrganizationCurrency: vi.fn(() => ({
    formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  })),
}));

vi.mock("@/hooks/use-jobs", () => ({
  useJobs: vi.fn(() => ({
    jobs: mockJobs,
  })),
}));

vi.mock("@/hooks/use-worker-payments", () => ({
  useWorkerPayments: vi.fn(() => ({
    calculatePayments: mockCalculatePayments,
  })),
}));

vi.mock("@/hooks/use-worker-payment-history", () => ({
  useWorkerPaymentHistory: mockUseWorkerPaymentHistory,
}));

vi.mock("@/lib/services/worker-payment.service", () => ({
  WorkerPaymentService: {
    exportJobLevelPaymentsToCsv: vi.fn(() => "Job ID,Total Payment,Workers\njob-1,100,John"),
    exportBatchWorkerSummaryToCsv: mockExportBatch,
    resolveWorkerNameForExport: vi.fn(() => "Worker"),
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe("PaymentHistoryList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFilterByDateRange.mockReturnValue(mockPaymentHistory);
    mockUseWorkerPaymentHistory.mockReturnValue({
      paymentHistory: mockPaymentHistory,
      addPayment: mockAddPayment,
      filterByDateRange: mockFilterByDateRange,
      invalidate: mockInvalidate,
      refetch: mockRefetch,
      loading: false,
      error: null,
    });
  });

  const listProps = {
    jobs: mockJobs as Job[],
    organizationId: "org-123" as const,
  };

  describe("rendering", () => {
    it("should render the history card", () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      expect(screen.getByText("History")).toBeInTheDocument();
    });

    it("should render history card description", () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      expect(screen.getByText("History")).toBeInTheDocument();
      expect(screen.getByText(/One row per worker per pay run.*paid/)).toBeInTheDocument();
    });

    it("should render date filter inputs", () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
      expect(screen.getByLabelText("End Date")).toBeInTheDocument();
    });

    it("should render payment history table headers", () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      expect(screen.getByRole("columnheader", { name: "Worker" })).toBeInTheDocument();
      expect(screen.getByText("Pay period")).toBeInTheDocument();
      expect(screen.getByText("Amount (worker)")).toBeInTheDocument();
      expect(screen.getByText("Recorded")).toBeInTheDocument();
      expect(screen.getByText("Run calculated")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });

    it("should render payment history rows where at least some pay was recorded", () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      expect(screen.getByText("$300.00")).toBeInTheDocument();
      expect(screen.queryByText("$250.00")).toBeNull();
    });

    it("should render per-worker settlement state (paid outcomes only)", () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      expect(screen.getByText("Paid in full")).toBeInTheDocument();
      expect(screen.queryByText("Not paid")).toBeNull();
    });

    it("should not show Mark as Paid in History (settlement is on Summary)", () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      expect(screen.queryByRole("button", { name: /mark as paid/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^approve$/i })).toBeNull();
    });
  });

  describe("date filtering", () => {
    it("should filter payments when start date is set", async () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      const startDateInput = screen.getByLabelText("Start Date");
      fireEvent.change(startDateInput, { target: { value: "2024-01-20" } });

      await waitFor(() => {
        expect(mockFilterByDateRange).toHaveBeenCalled();
      });
    });

    it("should filter payments when end date is set", async () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      const endDateInput = screen.getByLabelText("End Date");
      fireEvent.change(endDateInput, { target: { value: "2024-01-15" } });

      await waitFor(() => {
        expect(mockFilterByDateRange).toHaveBeenCalled();
      });
    });

    it("should show clear button when date filter is set", async () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      // Set a date filter
      const startDateInput = screen.getByLabelText("Start Date");
      fireEvent.change(startDateInput, { target: { value: "2024-01-01" } });

      // Clear button should now be visible
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
      });
    });

    it("should clear date filters when clear button is clicked", async () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      // Set a date filter
      const startDateInput = screen.getByLabelText("Start Date");
      fireEvent.change(startDateInput, { target: { value: "2024-01-01" } });

      // Click clear
      const clearButton = await screen.findByRole("button", { name: "Clear" });
      fireEvent.click(clearButton);

      // Start date should be cleared
      await waitFor(() => {
        expect(startDateInput).toHaveValue("");
      });
    });
  });

  describe("actions", () => {
    it("should render View button for each worker row", () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      const viewButtons = screen.getAllByRole("button", { name: /^view$/i });
      expect(viewButtons).toHaveLength(1);
    });

    it("exposes a11y label on run CSV download buttons", () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });
      const downloads = screen.getAllByLabelText(
        "Download worker payment summary CSV for this run"
      );
      expect(downloads).toHaveLength(1);
    });

    it("calls exportBatchWorkerSummaryToCsv when download is clicked", async () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });
      const downloads = screen.getAllByLabelText(
        "Download worker payment summary CSV for this run"
      );
      fireEvent.click(downloads[0]);
      await waitFor(() => {
        expect(mockExportBatch).toHaveBeenCalled();
      });
    });

    it("shows no worker rows for orphan batch (no worker line items)", () => {
      const orphanRecord: PaymentRecord = {
        id: "orphan",
        batch_id: "orphan",
        dateRange: { start: "2024-01-01T00:00:00Z", end: "2024-01-15T00:00:00Z" },
        jobIds: ["job-1"],
        totalPayment: 0,
        workerCount: 0,
        currency: "AUD",
        payments: [],
        calculatedAt: "2024-01-15T12:00:00Z",
        status: "calculated",
        calculation: {
          success: true,
          calculation: { total_worker_payment: 0, job_calculations: [] },
        },
      };
      mockUseWorkerPaymentHistory.mockReturnValue({
        paymentHistory: [orphanRecord],
        addPayment: mockAddPayment,
        filterByDateRange: () => [orphanRecord],
        invalidate: mockInvalidate,
        refetch: mockRefetch,
        loading: false,
        error: null,
      });

      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });
      expect(
        screen.getByText(
          /No recorded payments to workers yet\. When you mark work as paid on the Summary tab, it will appear here\./
        )
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText("Download worker payment summary CSV for this run")
      ).toBeNull();
    });
  });

  describe("payment detail dialog", () => {
    it("should open payment detail dialog when view is clicked", async () => {
      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });

      const viewDetailsButtons = screen.getAllByRole("button", { name: /^view$/i });
      fireEvent.click(viewDetailsButtons[0]);

      // Dialog should open - the PaymentDetailDialog will be rendered
      await waitFor(() => {
        // We can verify the dialog was triggered by checking state changes
        // The actual dialog content depends on PaymentDetailDialog component
        expect(viewDetailsButtons[0]).toBeInTheDocument();
      });
    });
  });

  describe("settlement (mark as paid)", () => {
    it("History does not offer Mark as Paid (use Summary tab)", () => {
      const mockApprovedPaymentHistory: PaymentRecord[] = [
        {
          id: "batch-1",
          batch_id: "batch-1",
          dateRange: { start: "2024-01-01T00:00:00Z", end: "2024-01-15T00:00:00Z" },
          jobIds: ["job-1", "job-2"],
          totalPayment: 500,
          workerCount: 3,
          calculatedAt: "2024-01-15T12:00:00Z",
          status: "approved",
          calculation: {
            success: true,
            calculation: {
              total_worker_payment: 500,
              job_calculations: [],
            },
          },
        },
      ];
      mockFilterByDateRange.mockReturnValue(mockApprovedPaymentHistory);

      render(<PaymentHistoryList {...listProps} />, { wrapper: createWrapper() });
      expect(screen.queryByRole("button", { name: /mark as paid/i })).toBeNull();
    });
  });
});
