import FieldConfigForm from "@/components/settings/field-config-form";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => {
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    );
  }
  Wrapper.displayName = "QueryClientWrapper";

  return Wrapper;
}

describe("FieldConfigForm", () => {
  it("applies yard tracking presets and auto-populates fields", async () => {
    render(
      <FieldConfigForm
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        fieldConfig={null}
      />,
      { wrapper: createWrapper() }
    );

    const presetLabel = screen.getByLabelText("Cars wiped breakdown");
    fireEvent.click(presetLabel);

    await waitFor(() => {
      const nameInput = screen.getByLabelText(
        "Name (Internal)"
      ) as HTMLInputElement;
      const groupInput = screen.getByPlaceholderText(
        "yard_tracking_method"
      ) as HTMLInputElement;
      const clusterInput = screen.getByPlaceholderText(
        "soap_and_wipe_pair"
      ) as HTMLInputElement;
      const optionsInput = screen.getByLabelText(
        "Groups (Comma-separated)"
      ) as HTMLInputElement;

      expect(nameInput.value).toBe("cars_wiped_breakdown");
      expect(groupInput.value).toBe("yard_tracking_method");
      expect(clusterInput.value).toBe("detailed_tracking");
      expect(optionsInput.value).toBe("Sedan, SUV, Truck");
    });

    const customLabel = screen.getByLabelText("Custom configuration");
    fireEvent.click(customLabel);

    await waitFor(() => {
      const groupInput = screen.getByPlaceholderText(
        "yard_tracking_method"
      ) as HTMLInputElement;
      expect(groupInput.value).toBe("");
    });
  });
});
