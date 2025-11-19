import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import SignUp from "../app/signup/page";

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

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("SignUp page renders correctly", () => {
  render(<SignUp />);
  expect(screen.getByText("Create an account")).toBeDefined();
});
