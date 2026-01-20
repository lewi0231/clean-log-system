/**
 * Tests for home page navigation
 *
 * Test Case:
 * - HP-1: Start Free Trial link redirects to signup
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Home from "../../app/page";

describe("Home Page Navigation - HP-1: Start Free Trial Link", () => {
  test("should have 'Start Free Trial' links pointing to /signup", () => {
    render(<Home />);

    // There are multiple 'Start Free Trial' links on the page (hero, nav, pricing, etc.)
    const freeTrialLinks = screen.getAllByText(/start free trial/i);
    expect(freeTrialLinks.length).toBeGreaterThan(0);

    // Verify all Start Free Trial links point to /signup
    freeTrialLinks.forEach((link) => {
      const anchor = link.closest("a");
      expect(anchor).toBeDefined();
      expect(anchor?.getAttribute("href")).toBe("/signup");
    });
  });

  test("should have navigation header with signup link", () => {
    render(<Home />);

    // Check the navigation header specifically has a Start Free Trial link
    const navLinks = screen.getAllByRole("link", { name: /start free trial/i });
    expect(navLinks.length).toBeGreaterThan(0);
    expect(navLinks[0].getAttribute("href")).toBe("/signup");
  });
});
