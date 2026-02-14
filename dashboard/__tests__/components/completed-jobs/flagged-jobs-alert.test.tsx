import FlaggedJobsAlert from "@/components/completed-jobs/flagged-jobs-alert";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockFlaggedJob, createMockJob, createMockPendingJob } from "../../lib/fixtures";
import type { Job } from "@/lib/types";

describe("FlaggedJobsAlert", () => {
  const mockOnResolve = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnResolve.mockResolvedValue(undefined);
  });

  describe("rendering", () => {
    it("should render nothing when no flagged jobs", () => {
      const jobs = [
        createMockJob({ id: "job-1" }),
        createMockPendingJob({ id: "job-2" }),
      ];

      const { container } = render(
        <FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should render alert when there is one flagged job", () => {
      const jobs = [
        createMockJob({ id: "job-1" }),
        createMockFlaggedJob({ id: "job-2" }),
      ];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      expect(screen.getByText("Attention Required")).toBeInTheDocument();
      expect(
        screen.getByText("1 job has been flagged by a worker and requires your review.")
      ).toBeInTheDocument();
    });

    it("should render plural message for multiple flagged jobs", () => {
      const jobs = [
        createMockFlaggedJob({ id: "job-1" }),
        createMockFlaggedJob({ id: "job-2" }),
        createMockFlaggedJob({ id: "job-3" }),
      ];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      expect(
        screen.getByText(
          "3 jobs have been flagged by workers and require your review."
        )
      ).toBeInTheDocument();
    });

    it("should display location name for flagged job", () => {
      const jobs = [
        createMockFlaggedJob({
          id: "job-1",
          location: {
            id: "loc-1",
            name: "Test Location",
            email: "test@example.com",
            address: null,
            contact_person: null,
            phone: null,
          },
        }),
      ];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      expect(screen.getByText("Test Location")).toBeInTheDocument();
    });

    it("should display 'Unknown Location' when location is null", () => {
      const jobs = [
        createMockFlaggedJob({
          id: "job-1",
          location: null,
        }),
      ];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      expect(screen.getByText("Unknown Location")).toBeInTheDocument();
    });

    it("should display flag details", () => {
      const jobs = [
        createMockFlaggedJob({
          id: "job-1",
          workers: [
            {
              id: "worker-1",
              name: "John Doe",
              email: "john@example.com",
              phone: null,
              confirmation_status: "confirmed",
              confirmed_at: "2024-01-15T10:00:00Z",
              flagged_at: null,
              flag_reason: null,
            },
            {
              id: "worker-2",
              name: "Jane Smith",
              email: "jane@example.com",
              phone: null,
              confirmation_status: "flagged",
              confirmed_at: null,
              flagged_at: "2024-01-15T11:00:00Z",
              flag_reason: "I was not present at this job",
            },
          ],
        }),
      ];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      expect(screen.getByText("Flagged by:")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.getByText("Reason:")).toBeInTheDocument();
      // Find the paragraph element that contains the reason text
      const reasonParagraph = document.querySelector('p.text-foreground');
      expect(reasonParagraph).toBeInTheDocument();
      expect(reasonParagraph?.textContent).toContain("I was not present at this job");
    });

    it("should display worker badges with correct statuses", () => {
      const jobs = [
        createMockFlaggedJob({
          id: "job-1",
          workers: [
            {
              id: "worker-1",
              name: "John Doe",
              email: "john@example.com",
              phone: null,
              confirmation_status: "confirmed",
              confirmed_at: "2024-01-15T10:00:00Z",
              flagged_at: null,
              flag_reason: null,
            },
            {
              id: "worker-2",
              name: "Jane Smith",
              email: "jane@example.com",
              phone: null,
              confirmation_status: "flagged",
              confirmed_at: null,
              flagged_at: "2024-01-15T11:00:00Z",
              flag_reason: "Not present",
            },
            {
              id: "worker-3",
              name: "Bob Wilson",
              email: "bob@example.com",
              phone: null,
              confirmation_status: "pending",
              confirmed_at: null,
              flagged_at: null,
              flag_reason: null,
            },
          ],
        }),
      ];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith (flagged)")).toBeInTheDocument();
      expect(screen.getByText("Bob Wilson (pending)")).toBeInTheDocument();
    });

    it("should display Approve and Cancel buttons", () => {
      const jobs = [createMockFlaggedJob({ id: "job-1" })];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      expect(
        screen.getByRole("button", { name: /approve job/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel job/i })
      ).toBeInTheDocument();
    });
  });

  describe("resolve actions", () => {
    it("should open confirm dialog when clicking Approve", async () => {
      const jobs = [createMockFlaggedJob({ id: "job-1" })];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      fireEvent.click(screen.getByRole("button", { name: /approve job/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "This will approve the job despite the flag. The job will be finalized and included in payment calculations."
        )
      ).toBeInTheDocument();
    });

    it("should open confirm dialog when clicking Cancel", async () => {
      const jobs = [createMockFlaggedJob({ id: "job-1" })];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      fireEvent.click(screen.getByRole("button", { name: /cancel job/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "This will cancel the job. It will not be included in payment calculations or invoices."
        )
      ).toBeInTheDocument();
    });

    it("should call onResolve with approve action", async () => {
      const jobs = [createMockFlaggedJob({ id: "job-flagged-test" })];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      // Open approve dialog
      fireEvent.click(screen.getByRole("button", { name: /approve job/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Confirm approve
      const dialog = screen.getByRole("dialog");
      const confirmButton = within(dialog).getByRole("button", {
        name: /approve job/i,
      });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnResolve).toHaveBeenCalledWith(
          "job-flagged-test",
          "approve",
          undefined
        );
      });
    });

    it("should call onResolve with cancel action", async () => {
      const jobs = [createMockFlaggedJob({ id: "job-flagged-test" })];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      // Open cancel dialog
      fireEvent.click(screen.getByRole("button", { name: /cancel job/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Confirm cancel (destructive button variant)
      const dialog = screen.getByRole("dialog");
      const confirmButton = within(dialog).getByRole("button", {
        name: /cancel job$/i,
      });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnResolve).toHaveBeenCalledWith(
          "job-flagged-test",
          "cancel",
          undefined
        );
      });
    });

    it("should include admin notes when provided", async () => {
      const jobs = [createMockFlaggedJob({ id: "job-flagged-test" })];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      // Open approve dialog
      fireEvent.click(screen.getByRole("button", { name: /approve job/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Add admin notes
      const dialog = screen.getByRole("dialog");
      const textarea = within(dialog).getByPlaceholderText(
        /add any notes about this resolution/i
      );
      fireEvent.change(textarea, {
        target: { value: "Verified with worker by phone" },
      });

      // Confirm approve
      const confirmButton = within(dialog).getByRole("button", {
        name: /approve job/i,
      });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnResolve).toHaveBeenCalledWith(
          "job-flagged-test",
          "approve",
          "Verified with worker by phone"
        );
      });
    });

    it("should close dialog without action when Cancel is clicked", async () => {
      const jobs = [createMockFlaggedJob({ id: "job-flagged-test" })];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      // Open approve dialog
      fireEvent.click(screen.getByRole("button", { name: /approve job/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Click cancel button in dialog
      const dialog = screen.getByRole("dialog");
      const cancelButton = within(dialog).getByRole("button", {
        name: /^cancel$/i,
      });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      expect(mockOnResolve).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    it("should disable buttons when isResolving is true", () => {
      const jobs = [createMockFlaggedJob({ id: "job-1" })];

      render(
        <FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} isResolving />
      );

      expect(
        screen.getByRole("button", { name: /approve job/i })
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /cancel job/i })
      ).toBeDisabled();
    });

    it("should show Processing... text in dialog when isResolving", async () => {
      const jobs = [createMockFlaggedJob({ id: "job-1" })];

      const { rerender } = render(
        <FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />
      );

      // Open dialog
      fireEvent.click(screen.getByRole("button", { name: /approve job/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Re-render with isResolving=true
      rerender(
        <FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} isResolving />
      );

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Processing...")).toBeInTheDocument();
    });
  });

  describe("multiple flagged jobs", () => {
    it("should render multiple flagged job cards", () => {
      const jobs = [
        createMockFlaggedJob({
          id: "job-1",
          location: {
            id: "loc-1",
            name: "Location A",
            email: "a@example.com",
            address: null,
            contact_person: null,
            phone: null,
          },
        }),
        createMockFlaggedJob({
          id: "job-2",
          location: {
            id: "loc-2",
            name: "Location B",
            email: "b@example.com",
            address: null,
            contact_person: null,
            phone: null,
          },
        }),
      ];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      expect(screen.getByText("Location A")).toBeInTheDocument();
      expect(screen.getByText("Location B")).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: /approve job/i })
      ).toHaveLength(2);
      expect(
        screen.getAllByRole("button", { name: /cancel job/i })
      ).toHaveLength(2);
    });

    it("should only show flagged jobs, not pending or approved", () => {
      const jobs: Job[] = [
        createMockJob({
          id: "job-approved",
          location: {
            id: "loc-1",
            name: "Approved Location",
            email: "a@example.com",
            address: null,
            contact_person: null,
            phone: null,
          },
        }),
        createMockPendingJob({
          id: "job-pending",
          location: {
            id: "loc-2",
            name: "Pending Location",
            email: "p@example.com",
            address: null,
            contact_person: null,
            phone: null,
          },
        }),
        createMockFlaggedJob({
          id: "job-flagged",
          location: {
            id: "loc-3",
            name: "Flagged Location",
            email: "f@example.com",
            address: null,
            contact_person: null,
            phone: null,
          },
        }),
      ];

      render(<FlaggedJobsAlert jobs={jobs} onResolve={mockOnResolve} />);

      expect(screen.getByText("Flagged Location")).toBeInTheDocument();
      expect(screen.queryByText("Approved Location")).not.toBeInTheDocument();
      expect(screen.queryByText("Pending Location")).not.toBeInTheDocument();
    });
  });
});
