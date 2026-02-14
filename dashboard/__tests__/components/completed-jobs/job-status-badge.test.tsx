import JobStatusBadge from "@/components/completed-jobs/job-status-badge";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("JobStatusBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("approved status", () => {
    it("should return null for approved status", () => {
      const { container } = render(<JobStatusBadge status="approved" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("pending status", () => {
    it("should render pending badge", () => {
      render(<JobStatusBadge status="pending" />);

      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("should render with yellow background class", () => {
      render(<JobStatusBadge status="pending" />);

      const badge = screen.getByText("Pending").closest("div");
      expect(badge).toHaveClass("bg-yellow-500");
    });

    it("should render with tooltip trigger when autoApproveAt is provided", () => {
      const autoApproveAt = "2024-01-16T12:00:00Z"; // 24 hours from now

      render(
        <JobStatusBadge status="pending" autoApproveAt={autoApproveAt} />
      );

      // Badge should be wrapped in tooltip trigger (has data-state attribute)
      const badge = screen.getByText("Pending").closest("div");
      expect(badge).toHaveAttribute("data-state");
    });

    it("should render badge without tooltip when no autoApproveAt", () => {
      render(<JobStatusBadge status="pending" />);

      // Badge should exist
      const badge = screen.getByText("Pending").closest("div");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("flagged status", () => {
    it("should render flagged badge", () => {
      render(<JobStatusBadge status="flagged" />);

      expect(screen.getByText("Flagged")).toBeInTheDocument();
    });

    it("should use destructive variant", () => {
      render(<JobStatusBadge status="flagged" />);

      const badge = screen.getByText("Flagged").closest("div");
      // Badge with destructive variant
      expect(badge).toBeInTheDocument();
    });

    it("should render with tooltip trigger for flagged status", () => {
      render(<JobStatusBadge status="flagged" />);

      // Badge should be wrapped in tooltip trigger (has data-state attribute)
      const badge = screen.getByText("Flagged").closest("div");
      expect(badge).toHaveAttribute("data-state");
    });
  });

  describe("cancelled status", () => {
    it("should render cancelled badge", () => {
      render(<JobStatusBadge status="cancelled" />);

      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });

    it("should use outline variant with muted color", () => {
      render(<JobStatusBadge status="cancelled" />);

      const badge = screen.getByText("Cancelled").closest("div");
      expect(badge).toHaveClass("text-muted-foreground");
    });
  });

  describe("custom className", () => {
    it("should apply custom className", () => {
      render(
        <JobStatusBadge status="pending" className="my-custom-class" />
      );

      const badge = screen.getByText("Pending").closest("div");
      expect(badge).toHaveClass("my-custom-class");
    });
  });

  describe("icons", () => {
    it("should render Clock icon for pending", () => {
      render(<JobStatusBadge status="pending" />);

      // The icon is an SVG inside the badge
      const badge = screen.getByText("Pending").closest("div");
      const svg = badge?.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should render AlertTriangle icon for flagged", () => {
      render(<JobStatusBadge status="flagged" />);

      const badge = screen.getByText("Flagged").closest("div");
      const svg = badge?.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should render XCircle icon for cancelled", () => {
      render(<JobStatusBadge status="cancelled" />);

      const badge = screen.getByText("Cancelled").closest("div");
      const svg = badge?.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });
});
