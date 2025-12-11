import { usePayments } from "@/hooks/use-payments";
import { PaymentService } from "@/lib/services/payment.service";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPayment } from "../lib/fixtures";

vi.mock("@/lib/services/payment.service", () => ({
  PaymentService: {
    list: vi.fn(),
  },
}));

const mockUseOrganization = vi.hoisted(() =>
  vi.fn(() => ({
    organizationId: "org-1",
    loading: false,
    error: null,
  }))
);

vi.mock("@/hooks/useOrganization", () => ({
  default: mockUseOrganization,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  Wrapper.displayName = "QueryClientWrapper";

  return Wrapper;
}

describe("usePayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch payments for organization on mount", async () => {
    const mockPayments = [
      createMockPayment(),
      createMockPayment({ id: "payment-2", amount: 500.0 }),
    ];

    vi.mocked(PaymentService.list).mockResolvedValue(mockPayments);

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.payments).toEqual(mockPayments);
    expect(result.current.error).toBeNull();
    expect(PaymentService.list).toHaveBeenCalledWith({
      organization_id: "org-1",
      invoice_id: undefined,
    });
  });

  it("should filter payments by invoice_id", async () => {
    const mockPayments = [createMockPayment()];

    vi.mocked(PaymentService.list).mockResolvedValue(mockPayments);

    const { result } = renderHook(() => usePayments("invoice-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.payments).toEqual(mockPayments);
    expect(PaymentService.list).toHaveBeenCalledWith({
      organization_id: "org-1",
      invoice_id: "invoice-1",
    });
  });

  it("should handle loading state", async () => {
    vi.mocked(PaymentService.list).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve([]);
          }, 100);
        })
    );

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should handle error state", async () => {
    const mockError = new Error("Failed to fetch payments");
    vi.mocked(PaymentService.list).mockRejectedValue(mockError);

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch payments");
    expect(result.current.payments).toEqual([]);
  });

  it("should handle empty payments array", async () => {
    vi.mocked(PaymentService.list).mockResolvedValue([]);

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.payments).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("should not fetch when organizationId is null", () => {
    mockUseOrganization.mockReturnValueOnce({
      organizationId: undefined as unknown as string,
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(),
    });

    expect(result.current.payments).toEqual([]);
    expect(PaymentService.list).not.toHaveBeenCalled();
  });

  it("should refetch payments", async () => {
    vi.mocked(PaymentService.list).mockResolvedValue([]);

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.refetch();

    expect(PaymentService.list).toHaveBeenCalledTimes(2);
  });

  it("should handle null invoiceId", async () => {
    vi.mocked(PaymentService.list).mockResolvedValue([]);

    const { result } = renderHook(() => usePayments(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(PaymentService.list).toHaveBeenCalledWith({
      organization_id: "org-1",
      invoice_id: undefined,
    });
  });
});
