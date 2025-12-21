import {
  useWorkerPaymentHistory,
  workerPaymentHistoryKey,
} from "@/hooks/use-worker-payment-history";
import type {
  CalculateWorkerPaymentsResponse,
  PaymentRecord,
} from "@/lib/services/worker-payment.service";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/hooks/useOrganization", () => ({
  default: vi.fn(() => ({ organizationId: "org-123" })),
}));

vi.mock("@/hooks/use-jobs", () => ({
  useJobs: vi.fn(() => ({
    jobs: [
      {
        id: "job-1",
        completed_at: "2024-01-15T10:00:00Z",
        workers: [
          { id: "worker-1", name: "John" },
          { id: "worker-2", name: "Jane" },
        ],
      },
      {
        id: "job-2",
        completed_at: "2024-01-16T10:00:00Z",
        workers: [{ id: "worker-1", name: "John" }],
      },
    ],
  })),
}));

vi.mock("@/lib/services/worker-payment.service", async () => {
  const actual = await vi.importActual("@/lib/services/worker-payment.service");
  return {
    ...actual,
    WorkerPaymentService: {
      listPayments: vi.fn(),
      filterByDateRange: (
        actual as typeof import("@/lib/services/worker-payment.service")
      ).WorkerPaymentService.filterByDateRange,
      filterByWorker: (
        actual as typeof import("@/lib/services/worker-payment.service")
      ).WorkerPaymentService.filterByWorker,
    },
  };
});

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

describe("useWorkerPaymentHistory", () => {
  const mockPayments: PaymentRecord[] = [
    {
      id: "batch-1",
      batch_id: "batch-1",
      dateRange: { start: "2024-01-01", end: "2024-01-15" },
      jobIds: ["job-1"],
      totalPayment: 200,
      workerCount: 2,
      calculatedAt: "2024-01-15T12:00:00Z",
      status: "calculated",
      calculation: {
        success: true,
        calculation: {
          total_worker_payment: 200,
          job_calculations: [],
        },
      },
    },
    {
      id: "batch-2",
      batch_id: "batch-2",
      dateRange: { start: "2024-01-16", end: "2024-01-31" },
      jobIds: ["job-2"],
      totalPayment: 150,
      workerCount: 1,
      calculatedAt: "2024-01-31T12:00:00Z",
      status: "paid",
      calculation: {
        success: true,
        calculation: {
          total_worker_payment: 150,
          job_calculations: [],
        },
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(WorkerPaymentService.listPayments).mockResolvedValue({
      payments: mockPayments,
      total: 2,
      hasMore: false,
    });
  });

  describe("workerPaymentHistoryKey", () => {
    it("should generate correct query key with organization ID", () => {
      const key = workerPaymentHistoryKey("org-123");
      expect(key).toEqual(["worker-payment-history", "org-123"]);
    });

    it("should generate correct query key with null organization ID", () => {
      const key = workerPaymentHistoryKey(null);
      expect(key).toEqual(["worker-payment-history", null]);
    });
  });

  describe("hook initialization", () => {
    it("should fetch payment history from database on mount", async () => {
      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(WorkerPaymentService.listPayments).toHaveBeenCalledWith("org-123");
      expect(result.current.paymentHistory).toHaveLength(2);
    });

    it("should return loading state while fetching", () => {
      vi.mocked(WorkerPaymentService.listPayments).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);
    });

    it("should handle fetch error", async () => {
      vi.mocked(WorkerPaymentService.listPayments).mockRejectedValue(
        new Error("Network error")
      );

      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Network error");
    });

    it("should return empty array when no payments exist", async () => {
      vi.mocked(WorkerPaymentService.listPayments).mockResolvedValue({
        payments: [],
        total: 0,
        hasMore: false,
      });

      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.paymentHistory).toEqual([]);
    });
  });

  describe("addPayment", () => {
    it("should add payment optimistically to history", async () => {
      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newCalculation: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 300,
          job_calculations: [
            {
              job_id: "job-1",
              line_items: [],
              applied_rules: [],
              subtotal: 300,
              total_adjustments: 0,
              total_worker_payment: 300,
            },
          ],
        },
      };

      act(() => {
        result.current.addPayment(newCalculation, ["job-1"], "batch-new");
      });

      // Check optimistic update - wait for React Query to apply the cache update
      await waitFor(() => {
        const firstPayment = result.current.paymentHistory.find(
          (p) => p.id === "batch-new"
        );
        expect(firstPayment).toBeDefined();
        expect(firstPayment?.totalPayment).toBe(300);
        expect(firstPayment?.status).toBe("calculated");
      });
    });

    it("should calculate correct date range from jobs", async () => {
      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newCalculation: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 300,
          job_calculations: [],
        },
      };

      act(() => {
        result.current.addPayment(
          newCalculation,
          ["job-1", "job-2"],
          "batch-test"
        );
      });

      // Wait for React Query to apply the cache update
      await waitFor(() => {
        const newPayment = result.current.paymentHistory.find(
          (p) => p.id === "batch-test"
        );
        expect(newPayment).toBeDefined();
        // Dates from mocked jobs: job-1 is 2024-01-15, job-2 is 2024-01-16
        expect(newPayment?.dateRange.start).toContain("2024-01-15");
        expect(newPayment?.dateRange.end).toContain("2024-01-16");
      });
    });

    it("should calculate correct worker count from jobs", async () => {
      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const newCalculation: CalculateWorkerPaymentsResponse = {
        success: true,
        calculation: {
          total_worker_payment: 300,
          job_calculations: [],
        },
      };

      act(() => {
        // job-1 has worker-1 and worker-2, job-2 has worker-1
        // Unique workers: worker-1, worker-2 = 2
        result.current.addPayment(
          newCalculation,
          ["job-1", "job-2"],
          "batch-test"
        );
      });

      // Wait for React Query to apply the cache update
      await waitFor(() => {
        const newPayment = result.current.paymentHistory.find(
          (p) => p.id === "batch-test"
        );
        expect(newPayment).toBeDefined();
        expect(newPayment?.workerCount).toBe(2); // worker-1 appears in both, worker-2 in job-1 only
      });
    });
  });

  describe("filterByDateRange", () => {
    it("should filter payments by date range", async () => {
      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const filtered = result.current.filterByDateRange(
        "2024-01-01",
        "2024-01-15"
      );

      // Should only include batch-1 which is within Jan 1-15
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("batch-1");
    });

    it("should return all payments when no date range specified", async () => {
      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const filtered = result.current.filterByDateRange();
      expect(filtered).toHaveLength(2);
    });
  });

  describe("filterByWorker", () => {
    it("should filter payments by worker ID", async () => {
      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // worker-1 is in both job-1 and job-2
      const filtered = result.current.filterByWorker("worker-1");
      expect(filtered).toHaveLength(2);
    });

    it("should filter payments for worker in single job", async () => {
      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // worker-2 is only in job-1 which is in batch-1
      const filtered = result.current.filterByWorker("worker-2");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("batch-1");
    });

    it("should return empty array for worker with no payments", async () => {
      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const filtered = result.current.filterByWorker("worker-999");
      expect(filtered).toHaveLength(0);
    });
  });

  describe("invalidate", () => {
    it("should trigger refetch when invalidate is called", async () => {
      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(WorkerPaymentService.listPayments).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.invalidate();
      });

      await waitFor(() => {
        expect(WorkerPaymentService.listPayments).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("refetch", () => {
    it("should refetch data when refetch is called", async () => {
      const { result } = renderHook(() => useWorkerPaymentHistory(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(WorkerPaymentService.listPayments).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refetch();
      });

      expect(WorkerPaymentService.listPayments).toHaveBeenCalledTimes(2);
    });
  });
});
