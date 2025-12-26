/**
 * Tests for home page navigation
 *
 * Test Case:
 * - HP-1: Get Started link redirects to signup
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Home from "../../app/page";

describe("Home Page Navigation - HP-1: Get Started Link", () => {
  test("should have 'Get Started' link pointing to /signup", () => {
    render(<Home />);

    const getStartedLink = screen.getByText(/get started/i).closest("a");
    expect(getStartedLink).toBeDefined();
    expect(getStartedLink?.getAttribute("href")).toBe("/signup");
  });

  test("should have 'Start Free Trial' link pointing to /signup", () => {
    render(<Home />);

    const freeTrialLink = screen.getByText(/start free trial/i).closest("a");
    expect(freeTrialLink).toBeDefined();
    expect(freeTrialLink?.getAttribute("href")).toBe("/signup");
  });
});
