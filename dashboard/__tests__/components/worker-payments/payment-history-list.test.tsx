import PaymentHistoryList from "@/components/worker-payments/payment-history-list";
import type { PaymentRecord } from "@/lib/services/worker-payment.service";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    status: "paid",
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
const mockFilterByDateRange = vi.fn(() => mockPaymentHistory);
const mockAddPayment = vi.fn();
const mockInvalidate = vi.fn();
const mockCalculatePayments = vi.fn();

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
  useWorkerPaymentHistory: vi.fn(() => ({
    paymentHistory: mockPaymentHistory,
    addPayment: mockAddPayment,
    filterByDateRange: mockFilterByDateRange,
    invalidate: mockInvalidate,
    loading: false,
    error: null,
  })),
}));

vi.mock("@/lib/services/worker-payment.service", () => ({
  WorkerPaymentService: {
    exportPaymentsToCSV: vi.fn(
      () => "Job ID,Total Payment,Workers\njob-1,100,John"
    ),
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
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe("PaymentHistoryList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFilterByDateRange.mockReturnValue(mockPaymentHistory);
  });

  describe("rendering", () => {
    it("should render the calculate payments button", () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      expect(
        screen.getByRole("button", { name: /calculate payments/i })
      ).toBeInTheDocument();
    });

    it("should render payment history card", () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      expect(screen.getByText("Payment History")).toBeInTheDocument();
      expect(
        screen.getByText(/View calculated worker payments by date range/)
      ).toBeInTheDocument();
    });

    it("should render date filter inputs", () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
      expect(screen.getByLabelText("End Date")).toBeInTheDocument();
    });

    it("should render payment history table headers", () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      expect(screen.getByText("Date Range")).toBeInTheDocument();
      expect(screen.getByText("Jobs")).toBeInTheDocument();
      expect(screen.getByText("Workers")).toBeInTheDocument();
      expect(screen.getByText("Total Payment")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });

    it("should render payment history rows", () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      // Check payment row data
      expect(screen.getByText("$500.00")).toBeInTheDocument();
      expect(screen.getByText("$300.00")).toBeInTheDocument();
    });

    it("should render status badges", () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      // Find status badges within table body (not header "Calculated" column)
      const badges = screen.getAllByText(/^(Calculated|Paid)$/);
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });

    it("should show Mark as Paid button for calculated payments", () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      const markPaidButtons = screen.getAllByRole("button", {
        name: /mark as paid/i,
      });
      // Only one payment is in "calculated" status
      expect(markPaidButtons).toHaveLength(1);
    });
  });

  describe("date filtering", () => {
    it("should filter payments when start date is set", async () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      const startDateInput = screen.getByLabelText("Start Date");
      fireEvent.change(startDateInput, { target: { value: "2024-01-20" } });

      await waitFor(() => {
        expect(mockFilterByDateRange).toHaveBeenCalled();
      });
    });

    it("should filter payments when end date is set", async () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      const endDateInput = screen.getByLabelText("End Date");
      fireEvent.change(endDateInput, { target: { value: "2024-01-15" } });

      await waitFor(() => {
        expect(mockFilterByDateRange).toHaveBeenCalled();
      });
    });

    it("should show clear button when date filter is set", async () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      // Set a date filter
      const startDateInput = screen.getByLabelText("Start Date");
      fireEvent.change(startDateInput, { target: { value: "2024-01-01" } });

      // Clear button should now be visible
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Clear" })
        ).toBeInTheDocument();
      });
    });

    it("should clear date filters when clear button is clicked", async () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

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
    it("should render View Details button for each payment", () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      const viewDetailsButtons = screen.getAllByRole("button", {
        name: /view details/i,
      });
      expect(viewDetailsButtons).toHaveLength(2);
    });
  });

  describe("calculate payments dialog", () => {
    it("should open calculate payment dialog when button is clicked", async () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      const calculateButton = screen.getByRole("button", {
        name: /calculate payments/i,
      });
      fireEvent.click(calculateButton);

      // Dialog should open
      await waitFor(() => {
        expect(
          screen.getByText("Calculate Worker Payments")
        ).toBeInTheDocument();
      });
    });
  });

  describe("mark as paid dialog", () => {
    it("should open mark as paid dialog when button is clicked", async () => {
      render(<PaymentHistoryList />, { wrapper: createWrapper() });

      const markPaidButton = screen.getByRole("button", {
        name: /mark as paid/i,
      });
      fireEvent.click(markPaidButton);

      // Dialog should open
      await waitFor(() => {
        expect(screen.getByText("Mark Payment as Paid")).toBeInTheDocument();
      });
    });
  });
});
