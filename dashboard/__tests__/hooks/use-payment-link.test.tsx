import { usePaymentLink } from "@/hooks/use-payment-link";
import { PaymentService } from "@/lib/services/payment.service";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/payment.service", () => ({
  PaymentService: {
    getPaymentLink: vi.fn(),
    createPaymentLink: vi.fn(),
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

describe("usePaymentLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch existing payment link on mount", async () => {
    const mockLink = {
      id: "plink-1",
      url: "https://checkout.stripe.com/test",
      status: "open",
    };

    vi.mocked(PaymentService.getPaymentLink).mockResolvedValue(mockLink);

    const { result } = renderHook(() => usePaymentLink("invoice-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.paymentLink).toEqual(mockLink);
    expect(result.current.error).toBeNull();
    expect(PaymentService.getPaymentLink).toHaveBeenCalledWith("invoice-1");
  });

  it("should not fetch when invoiceId is null", () => {
    const { result } = renderHook(() => usePaymentLink(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.paymentLink).toBeNull();
    expect(PaymentService.getPaymentLink).not.toHaveBeenCalled();
  });

  it("should handle loading state", async () => {
    vi.mocked(PaymentService.getPaymentLink).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: "plink-1",
              url: "https://checkout.stripe.com/test",
              status: "open",
            });
          }, 100);
        })
    );

    const { result } = renderHook(() => usePaymentLink("invoice-1"), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("should handle error state", async () => {
    const mockError = new Error("Failed to fetch payment link");
    vi.mocked(PaymentService.getPaymentLink).mockRejectedValue(mockError);

    const { result } = renderHook(() => usePaymentLink("invoice-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch payment link");
    expect(result.current.paymentLink).toBeNull();
  });

  it("should create payment link successfully", async () => {
    const mockLink = {
      id: "plink-1",
      url: "https://checkout.stripe.com/test",
      status: "open" as const,
      expires_at: "2025-02-15T10:00:00Z",
    };

    vi.mocked(PaymentService.getPaymentLink).mockResolvedValue(null);
    vi.mocked(PaymentService.createPaymentLink).mockResolvedValue(mockLink);

    const { result } = renderHook(() => usePaymentLink("invoice-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const createdLink = await result.current.createPaymentLink(
      "invoice-1",
      "https://example.com/success",
      "https://example.com/cancel"
    );

    expect(createdLink).toEqual(mockLink);
    expect(PaymentService.createPaymentLink).toHaveBeenCalledWith({
      invoice_id: "invoice-1",
      organization_id: "org-1",
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
    });
  });

  it("should throw error when organizationId is missing", async () => {
    mockUseOrganization.mockReturnValueOnce({
      organizationId: undefined as unknown as string,
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => usePaymentLink("invoice-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(result.current.createPaymentLink("invoice-1")).rejects.toThrow(
      "Organization ID is required"
    );
  });

  it("should handle create payment link error", async () => {
    const mockError = new Error("Failed to create payment link");
    vi.mocked(PaymentService.getPaymentLink).mockResolvedValue(null);
    vi.mocked(PaymentService.createPaymentLink).mockRejectedValue(mockError);

    const { result } = renderHook(() => usePaymentLink("invoice-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(result.current.createPaymentLink("invoice-1")).rejects.toThrow(
      "Failed to create payment link"
    );
  });

  it("should refetch payment link", async () => {
    const mockLink = {
      id: "plink-1",
      url: "https://checkout.stripe.com/test",
      status: "open",
    };

    vi.mocked(PaymentService.getPaymentLink).mockResolvedValue(mockLink);

    const { result } = renderHook(() => usePaymentLink("invoice-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.refetch();

    expect(PaymentService.getPaymentLink).toHaveBeenCalledTimes(2);
  });
});
