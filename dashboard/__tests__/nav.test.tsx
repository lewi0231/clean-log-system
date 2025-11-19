import Nav from "@/components/nav";
import { render, screen } from "@testing-library/react";

import { beforeEach, expect, test, vi } from "vitest";

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
  default: vi.fn(),
}));

import useAuth from "@/hooks/useAuth";
import { useIsScrollTop } from "@/hooks/useIsScrollTop";

const mockUseIsScrollTop = vi.mocked(useIsScrollTop);
const mockUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  vi.clearAllMocks();

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
