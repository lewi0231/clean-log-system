/**
 * Tests for ratings settings (Settings → Features tab)
 *
 * Ensures that changing "Send Feedback Requests Immediately" and "Rating
 * Configuration" triggers update-organization-settings with the correct
 * payloads. Ratings settings live under the Features tab.
 */

import SettingsPage from "@/app/dashboard/settings/page";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import useOrganization from "@/hooks/useOrganization";
import { getRatingConfigPreset } from "@/lib/constants/rating-config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvoke = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "tab" ? "features" : null),
  }),
}));

vi.mock("next/link", () => {
  function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  }
  MockLink.displayName = "MockLink";
  return { default: MockLink };
});

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock("@/hooks/useOrganization", () => ({ default: vi.fn() }));
vi.mock("@/hooks/use-field-configs", () => ({ useFieldConfigs: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/app/query-provider", () => ({
  organizationSettingsKey: (id: string) => ["organization-settings", id],
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    isSendInvoicesImmediatelyEnabled: () => false,
  };
});

vi.mock("@/components/settings/invoice-template-settings", () => ({
  default: () => <div data-testid="invoice-template-settings" />,
}));

const defaultSettings = {
  name: "Test Org",
  feedback_email_send_immediately: false,
  rating_config: { type: "single" as const, dimensions: ["overall"] as const },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("Ratings settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOrganization).mockReturnValue({
      organizationId: "org-1",
      organizationUserId: "ou-1",
      userRole: "admin",
      loading: false,
      error: undefined,
    });
    vi.mocked(useFieldConfigs).mockReturnValue({
      fieldConfigs: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockInvoke.mockImplementation((name: string) => {
      if (name === "get-organization-settings") {
        return Promise.resolve({
          data: {
            settings: {
              ...defaultSettings,
              use_predefined_locations: true,
              business_mode: "service_based",
              abn: null,
              logo_url: null,
              primary_contact_email: null,
              primary_contact_phone: null,
              business_address: null,
              invoice_send_immediately: false,
              auto_generate_invoices_immediately: false,
              bank_transfer_bsb: null,
              bank_transfer_account_number: null,
              bank_transfer_account_name: null,
              show_bank_transfer_on_invoices: true,
              default_invoice_due_days: 30,
              gst_registered: false,
              gst_inclusive: true,
              gst_rate_percent: 10,
              stripe_account_id: null,
              payment_provider: null,
              currency: "AUD",
              locale: "en-AU",
              default_exclusive_group_label: null,
            },
          },
        });
      }
      return Promise.resolve({});
    });
  });

  describe("rating config preset and payload", () => {
    it("should use correct preset for three_dimensions", () => {
      const preset = getRatingConfigPreset("three_dimensions");
      expect(preset.type).toBe("three_dimensions");
      expect(preset.dimensions).toEqual(["quality", "communication", "value"]);
    });

    it("should use correct preset for rater", () => {
      const preset = getRatingConfigPreset("rater");
      expect(preset.type).toBe("rater");
      expect(preset.dimensions).toEqual([
        "reliability",
        "assurance",
        "tangibles",
        "empathy",
        "responsiveness",
      ]);
    });
  });

  async function openFeaturesTab() {
    const featuresTab = screen.getByRole("tab", { name: /features/i });
    fireEvent.click(featuresTab);
    await waitFor(() => {
      expect(screen.getByText("Send Feedback Requests Immediately")).toBeInTheDocument();
    });
  }

  describe("Settings page Features tab (ratings settings)", () => {
    it("should show Feedback & Rating settings when Features tab is selected", async () => {
      render(<SettingsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: /features/i })).toBeInTheDocument();
      });
      await openFeaturesTab();

      expect(screen.getByText("Send Feedback Requests Immediately")).toBeInTheDocument();
      expect(screen.getByText("Rating Configuration")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /Single Overall Rating/i })).toBeInTheDocument();
    });

    it("should call update-organization-settings when toggling Send Feedback Requests Immediately", async () => {
      render(<SettingsPage />, { wrapper: createWrapper() });
      await waitFor(() =>
        expect(screen.getByRole("tab", { name: /features/i })).toBeInTheDocument()
      );
      await openFeaturesTab();

      const switchControl = screen.getByRole("switch", {
        name: /Send Feedback Requests Immediately/i,
      });
      fireEvent.click(switchControl);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          "update-organization-settings",
          expect.objectContaining({
            body: expect.objectContaining({
              organization_id: "org-1",
              feedback_email_send_immediately: true,
            }),
          })
        );
      });
    });

    it("should call update-organization-settings with rating_config when selecting Three Dimensions", async () => {
      render(<SettingsPage />, { wrapper: createWrapper() });
      await waitFor(() =>
        expect(screen.getByRole("tab", { name: /features/i })).toBeInTheDocument()
      );
      await openFeaturesTab();

      const threeDimensionsRadio = screen.getByRole("radio", {
        name: /Three Dimensions/i,
      });
      fireEvent.click(threeDimensionsRadio);

      await waitFor(() => {
        const ratingCalls = mockInvoke.mock.calls.filter(
          (call: unknown[]) =>
            call[0] === "update-organization-settings" &&
            (call[1] as { body?: { rating_config?: unknown } })?.body?.rating_config
        );
        expect(ratingCalls.length).toBeGreaterThanOrEqual(1);
        const lastRatingCall = ratingCalls[ratingCalls.length - 1] as [
          string,
          { body: { organization_id: string; rating_config: unknown } },
        ];
        expect(lastRatingCall[1].body).toMatchObject({
          organization_id: "org-1",
          rating_config: {
            type: "three_dimensions",
            dimensions: ["quality", "communication", "value"],
          },
        });
      });
    });

    it("should call update-organization-settings with rating_config when selecting Full RATER Framework", async () => {
      render(<SettingsPage />, { wrapper: createWrapper() });
      await waitFor(() =>
        expect(screen.getByRole("tab", { name: /features/i })).toBeInTheDocument()
      );
      await openFeaturesTab();

      const raterRadio = screen.getByRole("radio", {
        name: /Full RATER Framework/i,
      });
      fireEvent.click(raterRadio);

      await waitFor(() => {
        const ratingCalls = mockInvoke.mock.calls.filter(
          (call: unknown[]) =>
            call[0] === "update-organization-settings" &&
            (call[1] as { body?: { rating_config?: unknown } })?.body?.rating_config
        );
        expect(ratingCalls.length).toBeGreaterThanOrEqual(1);
        const lastRatingCall = ratingCalls[ratingCalls.length - 1] as [
          string,
          { body: { organization_id: string; rating_config: unknown } },
        ];
        expect(lastRatingCall[1].body).toMatchObject({
          organization_id: "org-1",
          rating_config: {
            type: "rater",
            dimensions: ["reliability", "assurance", "tangibles", "empathy", "responsiveness"],
          },
        });
      });
    });
  });
});
