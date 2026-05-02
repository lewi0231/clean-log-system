import Nav from "@/components/nav";
import { render, screen } from "@testing-library/react";

import { beforeEach, describe, expect, test, vi } from "vitest";

const mockUsePathname = vi.hoisted(() => vi.fn(() => "/"));

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  })),
  usePathname: mockUsePathname,
}));

// Mock supabase entirely
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: { success: true },
        error: null,
      }),
    },
  },
}));

vi.mock("@/hooks/useIsScrollTop", () => ({
  useIsScrollTop: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";
import { useIsScrollTop } from "@/hooks/useIsScrollTop";

const mockUseIsScrollTop = vi.mocked(useIsScrollTop);
const mockUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  vi.clearAllMocks();

  mockUsePathname.mockReturnValue("/");
  mockUseIsScrollTop.mockReturnValue({ isTop: true });
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
  });
});

test("Displays Log in and Sign up button's when no auth", () => {
  // Arrange
  mockUseIsScrollTop.mockReturnValue({ isTop: true });
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
  });

  // Act
  render(<Nav />);

  // Assert
  expect(screen.getByText("Create account")).toBeDefined();
  expect(screen.getByText("Log in")).toBeDefined();
});

describe("Home marketing links", () => {
  test("shows section links when pathname is home", () => {
    mockUsePathname.mockReturnValue("/");
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(<Nav />);

    const opts = { hidden: true } as const;
    expect(screen.getByRole("link", { name: "Features", ...opts })).toHaveAttribute(
      "href",
      "#features"
    );
    expect(screen.getByRole("link", { name: "Pricing", ...opts })).toHaveAttribute(
      "href",
      "#pricing"
    );
    expect(screen.getByRole("link", { name: "Industries", ...opts })).toHaveAttribute(
      "href",
      "#industries"
    );
    expect(screen.getByRole("link", { name: "About", ...opts })).toHaveAttribute("href", "/about");
  });

  test("hides section links when not on home", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(<Nav />);

    expect(screen.queryByRole("link", { name: "Features" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Pricing" })).toBeNull();
  });
});
