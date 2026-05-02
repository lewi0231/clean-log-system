import PaymentLinkButton from "@/components/invoicing/payment-link-button";
import { usePaymentLink } from "@/hooks/use-payment-link";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-payment-link");
vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, "open", {
  writable: true,
  value: mockWindowOpen,
});

describe("PaymentLinkButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowOpen.mockClear();
  });

  it("should render create button when no payment link exists", () => {
    vi.mocked(usePaymentLink).mockReturnValue({
      paymentLink: null,
      loading: false,
      error: null,
      createPaymentLink: vi.fn(),
      refetch: vi.fn(),
    });

    render(<PaymentLinkButton invoiceId="invoice-1" />);

    expect(screen.getByRole("button", { name: /create payment link/i })).toBeInTheDocument();
  });

  it("should render open button when payment link exists and is open", () => {
    vi.mocked(usePaymentLink).mockReturnValue({
      paymentLink: {
        id: "plink-1",
        url: "https://checkout.stripe.com/test",
        status: "open",
      },
      loading: false,
      error: null,
      createPaymentLink: vi.fn(),
      refetch: vi.fn(),
    });

    render(<PaymentLinkButton invoiceId="invoice-1" />);

    expect(screen.getByRole("button", { name: /open payment link/i })).toBeInTheDocument();
  });

  it("should show loading state when creating payment link", () => {
    vi.mocked(usePaymentLink).mockReturnValue({
      paymentLink: null,
      loading: true,
      error: null,
      createPaymentLink: vi.fn(),
      refetch: vi.fn(),
    });

    render(<PaymentLinkButton invoiceId="invoice-1" />);

    expect(screen.getByText(/creating/i)).toBeInTheDocument();
  });

  it("should create and open payment link when button clicked", async () => {
    const mockCreatePaymentLink = vi.fn().mockResolvedValue({
      id: "plink-1",
      url: "https://checkout.stripe.com/test",
      status: "open",
    });

    vi.mocked(usePaymentLink).mockReturnValue({
      paymentLink: null,
      loading: false,
      error: null,
      createPaymentLink: mockCreatePaymentLink,
      refetch: vi.fn(),
    });

    // Mock window.location.origin
    Object.defineProperty(window, "location", {
      writable: true,
      value: { origin: "http://localhost:3000" },
    });

    render(<PaymentLinkButton invoiceId="invoice-1" />);

    const button = screen.getByRole("button", { name: /create payment link/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockCreatePaymentLink).toHaveBeenCalledWith(
        "invoice-1",
        "http://localhost:3000/dashboard/invoicing?payment=success",
        "http://localhost:3000/dashboard/invoicing?payment=cancelled"
      );
    });

    expect(mockWindowOpen).toHaveBeenCalledWith(
      "https://checkout.stripe.com/test",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("should open existing payment link when clicked", () => {
    vi.mocked(usePaymentLink).mockReturnValue({
      paymentLink: {
        id: "plink-1",
        url: "https://checkout.stripe.com/test",
        status: "open",
      },
      loading: false,
      error: null,
      createPaymentLink: vi.fn(),
      refetch: vi.fn(),
    });

    render(<PaymentLinkButton invoiceId="invoice-1" />);

    const button = screen.getByRole("button", { name: /open payment link/i });
    fireEvent.click(button);

    expect(mockWindowOpen).toHaveBeenCalledWith(
      "https://checkout.stripe.com/test",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("should call onLinkCreated callback when link is created", async () => {
    const onLinkCreated = vi.fn();
    const mockCreatePaymentLinkFn = vi.fn().mockResolvedValue({
      id: "plink-1",
      url: "https://checkout.stripe.com/test",
      status: "open",
    });

    vi.mocked(usePaymentLink).mockReturnValue({
      paymentLink: null,
      loading: false,
      error: null,
      createPaymentLink: mockCreatePaymentLinkFn,
      refetch: vi.fn(),
    });

    Object.defineProperty(window, "location", {
      writable: true,
      value: { origin: "http://localhost:3000" },
    });

    render(<PaymentLinkButton invoiceId="invoice-1" onLinkCreated={onLinkCreated} />);

    const button = screen.getByRole("button", { name: /create payment link/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(onLinkCreated).toHaveBeenCalledWith("https://checkout.stripe.com/test");
    });
  });

  it("should handle errors when creating payment link fails", async () => {
    const mockError = new Error("Failed to create link");
    const mockCreatePaymentLinkFn = vi.fn().mockRejectedValue(mockError);

    vi.mocked(usePaymentLink).mockReturnValue({
      paymentLink: null,
      loading: false,
      error: null,
      createPaymentLink: mockCreatePaymentLinkFn,
      refetch: vi.fn(),
    });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    Object.defineProperty(window, "location", {
      writable: true,
      value: { origin: "http://localhost:3000" },
    });

    render(<PaymentLinkButton invoiceId="invoice-1" />);

    const button = screen.getByRole("button", { name: /create payment link/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to create payment link")
      );
    });

    alertSpy.mockRestore();
  });

  it("should be disabled when disabled prop is true", () => {
    vi.mocked(usePaymentLink).mockReturnValue({
      paymentLink: null,
      loading: false,
      error: null,
      createPaymentLink: vi.fn(),
      refetch: vi.fn(),
    });

    render(<PaymentLinkButton invoiceId="invoice-1" disabled />);

    expect(screen.getByRole("button", { name: /create payment link/i })).toBeDisabled();
  });

  it("should be disabled when loading", () => {
    vi.mocked(usePaymentLink).mockReturnValue({
      paymentLink: null,
      loading: true,
      error: null,
      createPaymentLink: vi.fn(),
      refetch: vi.fn(),
    });

    render(<PaymentLinkButton invoiceId="invoice-1" />);

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
