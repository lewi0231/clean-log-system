import PaymentHistory from "@/components/invoicing/payment-history";
import { usePayments } from "@/hooks/use-payments";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPayment } from "../../lib/fixtures";

vi.mock("@/hooks/use-payments");

// Helper to create consistent mock return values
function createMockUsePaymentsResult(overrides: {
  payments?: ReturnType<typeof createMockPayment>[];
  loading?: boolean;
  error?: string | null;
  totalPaid?: number;
  remainingBalance?: number;
}) {
  return {
    payments: overrides.payments ?? [],
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    refetch: vi.fn(),
    totalPaid: overrides.totalPaid ?? 0,
    remainingBalance: overrides.remainingBalance ?? 0,
  };
}

describe("PaymentHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display loading state", () => {
    vi.mocked(usePayments).mockReturnValue(
      createMockUsePaymentsResult({ loading: true })
    );

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    // Component shows skeleton loading state with Payment History title
    expect(screen.getByText(/payment history/i)).toBeInTheDocument();
  });

  it("should display error state", () => {
    vi.mocked(usePayments).mockReturnValue(
      createMockUsePaymentsResult({ error: "Failed to load payments" })
    );

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    expect(screen.getByText(/failed to load payment history/i)).toBeInTheDocument();
    expect(screen.getByText(/failed to load payments/i)).toBeInTheDocument();
  });

  it("should display empty state when no payments", () => {
    vi.mocked(usePayments).mockReturnValue(createMockUsePaymentsResult({}));

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    expect(screen.getByText(/no payments recorded yet/i)).toBeInTheDocument();
  });

  it("should display payment history table", () => {
    const mockPayments = [
      createMockPayment({
        id: "payment-1",
        amount: 1000.0,
        status: "succeeded",
        payment_method: "stripe_checkout_card",
        received_at: "2025-01-15T10:00:00Z",
      }),
      createMockPayment({
        id: "payment-2",
        amount: 500.0,
        status: "pending",
        payment_method: "bank_transfer_manual",
        payment_reference: "TRANS-123",
        received_at: "2025-01-16T10:00:00Z",
      }),
    ];

    vi.mocked(usePayments).mockReturnValue(
      createMockUsePaymentsResult({
        payments: mockPayments,
        totalPaid: 1000,
        remainingBalance: 0,
      })
    );

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    expect(screen.getByText(/payment history/i)).toBeInTheDocument();
    // Use getAllByText for amounts since locale may vary and amounts appear in table
    expect(screen.getAllByText(/1,000/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/500/i).length).toBeGreaterThan(0);
    // Check for payment method - component displays "Card"
    expect(screen.getByText(/^card$/i)).toBeInTheDocument();
    expect(screen.getByText(/bank transfer/i)).toBeInTheDocument();
    expect(screen.getByText(/TRANS-123/i)).toBeInTheDocument();
  });

  it("should display payment status badges correctly", () => {
    const mockPayments = [
      createMockPayment({
        id: "payment-1",
        status: "succeeded",
      }),
      createMockPayment({
        id: "payment-2",
        status: "failed",
      }),
      createMockPayment({
        id: "payment-3",
        status: "pending",
      }),
    ];

    vi.mocked(usePayments).mockReturnValue(
      createMockUsePaymentsResult({ payments: mockPayments })
    );

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    expect(screen.getByText(/succeeded/i)).toBeInTheDocument();
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it("should format currency correctly for different currencies", () => {
    const mockPayments = [createMockPayment({ amount: 1000.0 })];

    vi.mocked(usePayments).mockReturnValue(
      createMockUsePaymentsResult({ payments: mockPayments })
    );

    const { rerender } = render(
      <PaymentHistory invoiceId="invoice-1" currency="USD" />
    );

    expect(screen.getByText(/\$1,000.00/i)).toBeInTheDocument();

    rerender(<PaymentHistory invoiceId="invoice-1" currency="GBP" />);
    expect(screen.getByText(/£1,000.00/i)).toBeInTheDocument();
  });

  it("should display fees when present", () => {
    const mockPayments = [
      createMockPayment({
        id: "payment-1",
        amount: 1000.0,
        fees: 30.0,
        net_amount: 970.0,
        status: "succeeded",
      }),
    ];

    vi.mocked(usePayments).mockReturnValue(
      createMockUsePaymentsResult({ payments: mockPayments })
    );

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    // Component shows fees in a negative format: -A$30.00
    // Use a more flexible matching approach
    const feesCell = screen.getByText((content, element) => {
      return element?.tagName === "TD" && content.includes("30.00") && content.includes("-");
    });
    expect(feesCell).toBeInTheDocument();
  });

  it("should display payment reference", () => {
    const mockPayments = [
      createMockPayment({
        id: "payment-1",
        payment_reference: "TRANS-123",
        stripe_payment_intent_id: null,
      }),
    ];

    vi.mocked(usePayments).mockReturnValue(
      createMockUsePaymentsResult({ payments: mockPayments })
    );

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    expect(screen.getByText(/TRANS-123/i)).toBeInTheDocument();
  });
});
