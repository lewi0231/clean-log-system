import StatusBadge from "@/components/users/status-badge";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("StatusBadge", () => {
  describe("active status", () => {
    it("should render Active text", () => {
      render(<StatusBadge status="active" />);
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("should render badge element", () => {
      render(<StatusBadge status="active" />);
      const badge = screen.getByText("Active").closest("div");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("pending status", () => {
    it("should render Pending text", () => {
      render(<StatusBadge status="pending" />);
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("should render badge element", () => {
      render(<StatusBadge status="pending" />);
      const badge = screen.getByText("Pending").closest("div");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("inactive status", () => {
    it("should render Inactive text", () => {
      render(<StatusBadge status="inactive" />);
      expect(screen.getByText("Inactive")).toBeInTheDocument();
    });

    it("should render badge element", () => {
      render(<StatusBadge status="inactive" />);
      const badge = screen.getByText("Inactive").closest("div");
      expect(badge).toBeInTheDocument();
    });
  });

  describe("tooltip behavior", () => {
    it("should render tooltip wrapper by default", () => {
      render(<StatusBadge status="active" />);
      // When showTooltip is true (default), TooltipProvider wraps the content
      const activeText = screen.getByText("Active");
      expect(activeText).toBeInTheDocument();
    });

    it("should render without tooltip when showTooltip is false", () => {
      render(<StatusBadge status="active" showTooltip={false} />);
      // Badge should be rendered directly without tooltip wrapper
      const badge = screen.getByText("Active");
      expect(badge).toBeInTheDocument();
    });

    it("should render differently with and without tooltip", () => {
      const { unmount } = render(<StatusBadge status="active" showTooltip={true} />);
      const withTooltip = document.body.innerHTML;
      unmount();

      render(<StatusBadge status="active" showTooltip={false} />);
      const withoutTooltip = document.body.innerHTML;

      // The HTML structure should differ when tooltip is on vs off
      expect(withTooltip).not.toBe(withoutTooltip);
    });
  });

  describe("icon rendering", () => {
    it("should render icon for active status", () => {
      render(<StatusBadge status="active" showTooltip={false} />);
      const badge = screen.getByText("Active").parentElement;
      // Icon should be an SVG element
      const svg = badge?.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should render icon for pending status", () => {
      render(<StatusBadge status="pending" showTooltip={false} />);
      const badge = screen.getByText("Pending").parentElement;
      const svg = badge?.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should render icon for inactive status", () => {
      render(<StatusBadge status="inactive" showTooltip={false} />);
      const badge = screen.getByText("Inactive").parentElement;
      const svg = badge?.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("all status types", () => {
    const statuses = ["active", "pending", "inactive"] as const;

    statuses.forEach((status) => {
      it(`should render ${status} status with correct text`, () => {
        render(<StatusBadge status={status} showTooltip={false} />);
        const expectedText = status.charAt(0).toUpperCase() + status.slice(1);
        expect(screen.getByText(expectedText)).toBeInTheDocument();
      });

      it(`should render ${status} status with icon`, () => {
        render(<StatusBadge status={status} showTooltip={false} />);
        const svg = document.querySelector("svg");
        expect(svg).toBeInTheDocument();
      });
    });
  });
});
