import PaymentHistory from "@/components/invoicing/payment-history";
import { usePayments } from "@/hooks/use-payments";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPayment } from "../../lib/fixtures";

vi.mock("@/hooks/use-payments");

describe("PaymentHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display loading state", () => {
    vi.mocked(usePayments).mockReturnValue({
      payments: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    expect(screen.getByText(/loading payment history/i)).toBeInTheDocument();
  });

  it("should display error state", () => {
    vi.mocked(usePayments).mockReturnValue({
      payments: [],
      loading: false,
      error: "Failed to load payments",
      refetch: vi.fn(),
    });

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    expect(
      screen.getByText(/error loading payments: failed to load payments/i)
    ).toBeInTheDocument();
  });

  it("should display empty state when no payments", () => {
    vi.mocked(usePayments).mockReturnValue({
      payments: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

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

    vi.mocked(usePayments).mockReturnValue({
      payments: mockPayments,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    expect(screen.getByText(/payment history/i)).toBeInTheDocument();
    expect(screen.getByText(/A\$1,000.00/i)).toBeInTheDocument();
    expect(screen.getByText(/A\$500.00/i)).toBeInTheDocument();
    expect(screen.getByText(/card \(stripe\)/i)).toBeInTheDocument();
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

    vi.mocked(usePayments).mockReturnValue({
      payments: mockPayments,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    expect(screen.getByText(/succeeded/i)).toBeInTheDocument();
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it("should format currency correctly for different currencies", () => {
    const mockPayments = [createMockPayment({ amount: 1000.0 })];

    vi.mocked(usePayments).mockReturnValue({
      payments: mockPayments,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { rerender } = render(
      <PaymentHistory invoiceId="invoice-1" currency="USD" />
    );

    expect(screen.getByText(/\$1,000.00/i)).toBeInTheDocument();

    rerender(<PaymentHistory invoiceId="invoice-1" currency="GBP" />);
    expect(screen.getByText(/£1,000.00/i)).toBeInTheDocument();
  });

  it("should display fees and net amount", () => {
    const mockPayments = [
      createMockPayment({
        id: "payment-1",
        amount: 1000.0,
        fees: 30.0,
        net_amount: 970.0,
      }),
    ];

    vi.mocked(usePayments).mockReturnValue({
      payments: mockPayments,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    expect(screen.getByText(/A\$30.00/i)).toBeInTheDocument();
    expect(screen.getByText(/A\$970.00/i)).toBeInTheDocument();
  });

  it("should display payment reference or last 8 chars of payment intent", () => {
    const mockPayments = [
      createMockPayment({
        id: "payment-1",
        payment_reference: "TRANS-123",
        stripe_payment_intent_id: null,
      }),
      createMockPayment({
        id: "payment-2",
        payment_reference: null,
        stripe_payment_intent_id: "pi_test_12345678",
      }),
    ];

    vi.mocked(usePayments).mockReturnValue({
      payments: mockPayments,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PaymentHistory invoiceId="invoice-1" currency="AUD" />);

    expect(screen.getByText(/TRANS-123/i)).toBeInTheDocument();
    expect(screen.getByText(/12345678/i)).toBeInTheDocument();
  });
});
