import { BetaFeedbackTrigger } from "@/components/beta-feedback/beta-feedback-trigger";
import { submitBetaFeedback } from "@/lib/services/beta-feedback.service";
import useOrganization from "@/hooks/useOrganization";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard/pricing"),
}));
vi.mock("@/hooks/useOrganization", () => ({ default: vi.fn() }));
vi.mock("@/lib/services/beta-feedback.service", () => ({
  submitBetaFeedback: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUseOrganization = vi.mocked(useOrganization);
const mockSubmitBetaFeedback = vi.mocked(submitBetaFeedback);
const mockToastSuccess = vi.mocked(toast.success);
const mockToastError = vi.mocked(toast.error);

describe("BetaFeedbackTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOrganization.mockReturnValue({
      organizationId: "org-1",
      organizationUserId: "ou-1",
      userRole: "admin",
      loading: false,
      error: undefined,
    } as ReturnType<typeof useOrganization>);
    mockSubmitBetaFeedback.mockResolvedValue({
      success: true,
      id: "pf-1",
      created_at: "2026-01-28T12:00:00Z",
    });
  });

  it("renders Send feedback trigger button", () => {
    render(<BetaFeedbackTrigger />);
    expect(
      screen.getByRole("button", { name: /send feedback/i }),
    ).toBeInTheDocument();
  });

  it("opens sheet when trigger is clicked", async () => {
    render(<BetaFeedbackTrigger />);
    fireEvent.click(
      screen.getByRole("button", { name: /send feedback/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(
      screen.getByPlaceholderText("What's on your mind?"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-labelledby");
  });

  it("calls submitBetaFeedback with org, message, category, and page_path on submit", async () => {
    render(<BetaFeedbackTrigger />);
    fireEvent.click(
      screen.getByRole("button", { name: /send feedback/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog");
    const textarea = within(dialog).getByPlaceholderText("What's on your mind?");
    fireEvent.change(textarea, { target: { value: "Add dark mode" } });

    const submitButton = within(dialog).getByTestId("beta-feedback-submit");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitBetaFeedback).toHaveBeenCalledWith({
        organization_id: "org-1",
        message: "Add dark mode",
        category: "general",
        page_path: "/dashboard/pricing",
      });
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Thanks! Your feedback has been sent.",
    );
  });

  it("shows toast.error when message is empty or whitespace on submit", async () => {
    render(<BetaFeedbackTrigger />);
    fireEvent.click(
      screen.getByRole("button", { name: /send feedback/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog");
    // Use spaces so required attribute passes but our trim check fails
    const textarea = within(dialog).getByPlaceholderText("What's on your mind?");
    fireEvent.change(textarea, { target: { value: "   " } });

    const submitButton = within(dialog).getByTestId("beta-feedback-submit");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Please enter your feedback.");
    });
    expect(mockSubmitBetaFeedback).not.toHaveBeenCalled();
  });

  it("shows toast.error when submitBetaFeedback throws", async () => {
    mockSubmitBetaFeedback.mockRejectedValueOnce(
      new Error("Network error"),
    );

    render(<BetaFeedbackTrigger />);
    fireEvent.click(
      screen.getByRole("button", { name: /send feedback/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const dialog = screen.getByRole("dialog");
    const textarea = within(dialog).getByPlaceholderText("What's on your mind?");
    fireEvent.change(textarea, { target: { value: "Feedback" } });
    fireEvent.click(within(dialog).getByTestId("beta-feedback-submit"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Network error");
    });
  });

  it("displays current page path when pathname is set", async () => {
    render(<BetaFeedbackTrigger />);
    fireEvent.click(
      screen.getByRole("button", { name: /send feedback/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByText(/where:/i)).toBeInTheDocument();
    expect(screen.getByText("/dashboard/pricing")).toBeInTheDocument();
  });
});
