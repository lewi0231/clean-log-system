import ManualPaymentDialog from "@/components/invoicing/manual-payment-dialog";
import { usePayments } from "@/hooks/use-payments";
import { PaymentService } from "@/lib/services/payment.service";
import type { Payment } from "@/lib/types/payment";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/payment.service", () => ({
  PaymentService: {
    createManualPayment: vi.fn(),
  },
}));

vi.mock("@/hooks/use-payments", () => ({
  usePayments: vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query"
  );
  return {
    ...actual,
    useQueryClient: vi.fn(),
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  Wrapper.displayName = "QueryClientWrapper";

  return Wrapper;
}

describe("ManualPaymentDialog", () => {
  const mockRefetch = vi.fn();
  const mockInvalidateQueries = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePayments).mockReturnValue({
      payments: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    vi.mocked(useQueryClient).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as unknown as ReturnType<typeof useQueryClient>);
  });

  it("should render dialog when open", () => {
    render(
      <ManualPaymentDialog
        open={true}
        onOpenChange={vi.fn()}
        invoiceId="invoice-1"
        invoiceTotal={1000.0}
        totalPaid={0}
        currency="AUD"
        organizationId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/record manual payment/i)).toBeInTheDocument();
  });

  it("should not render when closed", () => {
    render(
      <ManualPaymentDialog
        open={false}
        onOpenChange={vi.fn()}
        invoiceId="invoice-1"
        invoiceTotal={1000.0}
        totalPaid={0}
        currency="AUD"
        organizationId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    expect(
      screen.queryByText(/record manual payment/i)
    ).not.toBeInTheDocument();
  });

  it("should display remaining balance", () => {
    render(
      <ManualPaymentDialog
        open={true}
        onOpenChange={vi.fn()}
        invoiceId="invoice-1"
        invoiceTotal={1000.0}
        totalPaid={300.0}
        currency="AUD"
        organizationId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/remaining: A\$700.00/i)).toBeInTheDocument();
  });

  it("should show suggested amount", () => {
    render(
      <ManualPaymentDialog
        open={true}
        onOpenChange={vi.fn()}
        invoiceId="invoice-1"
        invoiceTotal={1000.0}
        totalPaid={0}
        currency="AUD"
        organizationId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/suggested: A\$1,000.00/i)).toBeInTheDocument();
  });

  it("should validate required fields", async () => {
    render(
      <ManualPaymentDialog
        open={true}
        onOpenChange={vi.fn()}
        invoiceId="invoice-1"
        invoiceTotal={1000.0}
        totalPaid={0}
        currency="AUD"
        organizationId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    const submitButton = screen.getByRole("button", {
      name: /record payment/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/please enter a valid amount greater than 0/i)
      ).toBeInTheDocument();
    });
  });

  it("should create manual payment successfully", async () => {
    const onOpenChange = vi.fn();
    const mockPayment: Payment = {
      id: "payment-1",
      organization_id: "org-1",
      invoice_id: "invoice-1",
      amount: 1000.0,
      currency: "AUD",
      payment_method: "bank_transfer_manual",
      stripe_payment_intent_id: null,
      stripe_checkout_session_id: null,
      stripe_customer_id: null,
      stripe_charge_id: null,
      status: "succeeded",
      payment_reference: "TRANS-123",
      payment_date: "2025-01-15",
      received_at: "2025-01-15T10:00:00Z",
      fees: 0,
      net_amount: 1000.0,
      reconciled_at: null,
      reconciled_by: null,
      reconciliation_notes: null,
      created_at: "2025-01-15T10:00:00Z",
      updated_at: "2025-01-15T10:00:00Z",
      metadata: {},
    };

    vi.mocked(PaymentService.createManualPayment).mockResolvedValue(
      mockPayment
    );

    render(
      <ManualPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        invoiceId="invoice-1"
        invoiceTotal={1000.0}
        totalPaid={0}
        currency="AUD"
        organizationId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText(/payment reference/i), {
      target: { value: "TRANS-123" },
    });
    fireEvent.change(screen.getByLabelText(/payment date/i), {
      target: { value: "2025-01-15" },
    });

    const submitButton = screen.getByRole("button", {
      name: /record payment/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(PaymentService.createManualPayment).toHaveBeenCalledWith({
        invoice_id: "invoice-1",
        organization_id: "org-1",
        amount: 1000.0,
        currency: "AUD",
        payment_reference: "TRANS-123",
        payment_date: "2025-01-15",
        notes: undefined,
      });
    });

    expect(mockRefetch).toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should handle errors when creating payment fails", async () => {
    const mockError = new Error("Failed to create payment");

    vi.mocked(PaymentService.createManualPayment).mockRejectedValue(mockError);

    render(
      <ManualPaymentDialog
        open={true}
        onOpenChange={vi.fn()}
        invoiceId="invoice-1"
        invoiceTotal={1000.0}
        totalPaid={0}
        currency="AUD"
        organizationId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText(/payment reference/i), {
      target: { value: "TRANS-123" },
    });
    fireEvent.change(screen.getByLabelText(/payment date/i), {
      target: { value: "2025-01-15" },
    });

    const submitButton = screen.getByRole("button", {
      name: /record payment/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to create payment/i)).toBeInTheDocument();
    });
  });

  it("should reset form when dialog closes", () => {
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <ManualPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        invoiceId="invoice-1"
        invoiceTotal={1000.0}
        totalPaid={0}
        currency="AUD"
        organizationId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "1000" },
    });

    rerender(
      <ManualPaymentDialog
        open={false}
        onOpenChange={onOpenChange}
        invoiceId="invoice-1"
        invoiceTotal={1000.0}
        totalPaid={0}
        currency="AUD"
        organizationId="org-1"
      />
    );

    rerender(
      <ManualPaymentDialog
        open={true}
        onOpenChange={onOpenChange}
        invoiceId="invoice-1"
        invoiceTotal={1000.0}
        totalPaid={0}
        currency="AUD"
        organizationId="org-1"
      />
    );

    expect(screen.getByLabelText(/amount/i)).toHaveValue("");
  });

  it("should disable form when submitting", async () => {
    const mockPayment: Payment = {
      id: "payment-1",
      organization_id: "org-1",
      invoice_id: "invoice-1",
      amount: 1000.0,
      currency: "AUD",
      payment_method: "bank_transfer_manual",
      stripe_payment_intent_id: null,
      stripe_checkout_session_id: null,
      stripe_customer_id: null,
      stripe_charge_id: null,
      status: "succeeded",
      payment_reference: "TRANS-123",
      payment_date: "2025-01-15",
      received_at: "2025-01-15T10:00:00Z",
      fees: 0,
      net_amount: 1000.0,
      reconciled_at: null,
      reconciled_by: null,
      reconciliation_notes: null,
      created_at: "2025-01-15T10:00:00Z",
      updated_at: "2025-01-15T10:00:00Z",
      metadata: {},
    };

    vi.mocked(PaymentService.createManualPayment).mockImplementation(
      () =>
        new Promise<Payment>((resolve) => {
          setTimeout(() => resolve(mockPayment), 100);
        })
    );

    render(
      <ManualPaymentDialog
        open={true}
        onOpenChange={vi.fn()}
        invoiceId="invoice-1"
        invoiceTotal={1000.0}
        totalPaid={0}
        currency="AUD"
        organizationId="org-1"
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText(/payment reference/i), {
      target: { value: "TRANS-123" },
    });
    fireEvent.change(screen.getByLabelText(/payment date/i), {
      target: { value: "2025-01-15" },
    });

    const submitButton = screen.getByRole("button", {
      name: /record payment/i,
    });
    fireEvent.click(submitButton);

    expect(screen.getByText(/recording/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });
});
