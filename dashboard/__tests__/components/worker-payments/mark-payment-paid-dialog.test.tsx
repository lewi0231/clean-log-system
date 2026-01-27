import MarkPaymentPaidDialog from "@/components/worker-payments/mark-payment-paid-dialog";
import { WorkerPaymentService } from "@/lib/services/worker-payment.service";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/hooks/useOrganization", () => ({
  default: vi.fn(() => ({ organizationId: "org-123" })),
}));

vi.mock("@/lib/services/worker-payment.service", () => ({
  WorkerPaymentService: {
    updatePaymentStatus: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
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

describe("MarkPaymentPaidDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    batchId: "batch-123",
    onSuccess: vi.fn(),
    organizationId: "org-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(WorkerPaymentService.updatePaymentStatus).mockResolvedValue({
      success: true,
    });
  });

  describe("rendering", () => {
    it("should render dialog when open is true", () => {
      render(<MarkPaymentPaidDialog {...defaultProps} />);

      expect(screen.getByText("Mark Payment as Paid")).toBeInTheDocument();
      expect(
        screen.getByText(/Record payment details after processing/)
      ).toBeInTheDocument();
    });

    it("should not render dialog when open is false", () => {
      render(<MarkPaymentPaidDialog {...defaultProps} open={false} />);

      expect(
        screen.queryByText("Mark Payment as Paid")
      ).not.toBeInTheDocument();
    });

    it("should render payment method dropdown", () => {
      render(<MarkPaymentPaidDialog {...defaultProps} />);

      expect(screen.getByText("Payment Method")).toBeInTheDocument();
    });

    it("should render payment reference input", () => {
      render(<MarkPaymentPaidDialog {...defaultProps} />);

      expect(screen.getByText("Payment Reference")).toBeInTheDocument();
    });

    it("should render notes textarea", () => {
      render(<MarkPaymentPaidDialog {...defaultProps} />);

      expect(screen.getByText("Notes")).toBeInTheDocument();
    });

    it("should render cancel and submit buttons", () => {
      render(<MarkPaymentPaidDialog {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: "Cancel" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Mark as Paid" })
      ).toBeInTheDocument();
    });
  });

  describe("form validation", () => {
    it("should show error when payment method is not selected", async () => {
      const { toast } = await import("sonner");
      render(<MarkPaymentPaidDialog {...defaultProps} />);

      const submitButton = screen.getByRole("button", { name: "Mark as Paid" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Please select a payment method"
        );
      });
      expect(WorkerPaymentService.updatePaymentStatus).not.toHaveBeenCalled();
    });
  });

  describe("cancel behavior", () => {
    it("should call onOpenChange with false when cancel is clicked", () => {
      render(<MarkPaymentPaidDialog {...defaultProps} />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
