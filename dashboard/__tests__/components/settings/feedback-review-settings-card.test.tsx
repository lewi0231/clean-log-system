/**
 * Focused tests for destination mode + public URL persistence (review findings).
 */

import { FeedbackReviewSettingsCard } from "@/components/settings/feedback-review-settings-card";
import type { OrganizationSettings } from "@/lib/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvokeTypedEdge = vi.fn();

vi.mock("@/lib/supabase/invoke-edge-function", () => ({
  invokeTypedEdge: (...args: unknown[]) => mockInvokeTypedEdge(...args),
}));

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), message: vi.fn(), error: vi.fn() },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const baseSettings: OrganizationSettings = {
  name: "Test Org",
  use_predefined_locations: true,
  business_mode: "service_based",
  abn: null,
  logo_url: null,
  primary_contact_email: null,
  primary_contact_phone: null,
  business_address: null,
  invoice_send_immediately: false,
  feedback_requests_enabled: true,
  feedback_auto_send: false,
  feedback_request_mode: "internal",
  public_review_url: null,
  feedback_email_subject: null,
  feedback_email_body: null,
  feedback_email_reply_to: null,
  feedback_send_delay_hours: 0,
  rating_config: { type: "single", dimensions: ["overall"] },
  stripe_account_id: null,
  payment_provider: null,
  currency: "AUD",
  locale: "en-AU",
  default_exclusive_group_label: null,
  auto_generate_invoices_immediately: false,
  bank_transfer_bsb: null,
  bank_transfer_account_number: null,
  bank_transfer_account_name: null,
  show_bank_transfer_on_invoices: true,
  default_invoice_due_days: 30,
  gst_registered: false,
  gst_inclusive: true,
  gst_rate_percent: 10,
  edit_window_minutes: 180,
  colleague_confirmation_timeout_hours: 24,
  custom_email_domain_enabled: false,
  worker_payment_cycle_config: null,
  workforce_engagement: "employees",
};

describe("FeedbackReviewSettingsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvokeTypedEdge.mockImplementation((_name: string, body: Record<string, unknown>) => {
      const { organization_id: _orgId, ...rest } = body;
      return Promise.resolve({
        settings: {
          ...baseSettings,
          ...rest,
        },
      });
    });
  });

  it("blocks Public mode without a https URL", async () => {
    const onError = vi.fn();
    render(
      <FeedbackReviewSettingsCard
        organizationId="org-1"
        isAdmin
        settings={baseSettings}
        onSettingsPatch={vi.fn()}
        onError={onError}
        onInvalidate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /Public review only/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        "Public review URL required",
        expect.stringContaining("https://")
      );
    });
    expect(mockInvokeTypedEdge).not.toHaveBeenCalled();
  });

  it("persists draft public URL together with mode change", async () => {
    render(
      <FeedbackReviewSettingsCard
        organizationId="org-1"
        isAdmin
        settings={baseSettings}
        onSettingsPatch={vi.fn()}
        onError={vi.fn()}
        onInvalidate={vi.fn()}
      />
    );

    const urlInput = screen.getByLabelText(/Google review link/i);
    fireEvent.change(urlInput, { target: { value: "https://g.page/r/example" } });
    fireEvent.click(screen.getByRole("radio", { name: /Public review only/i }));

    await waitFor(() => {
      expect(mockInvokeTypedEdge).toHaveBeenCalledWith(
        "update-organization-settings",
        expect.objectContaining({
          organization_id: "org-1",
          feedback_request_mode: "public",
          public_review_url: "https://g.page/r/example",
        })
      );
    });
  });

  it("rejects http:// draft when switching to Public", async () => {
    const onError = vi.fn();
    render(
      <FeedbackReviewSettingsCard
        organizationId="org-1"
        isAdmin
        settings={baseSettings}
        onSettingsPatch={vi.fn()}
        onError={onError}
        onInvalidate={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/Google review link/i), {
      target: { value: "http://example.com/review" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /Public review only/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("Invalid URL", expect.stringContaining("https://"));
    });
    expect(mockInvokeTypedEdge).not.toHaveBeenCalled();
  });
});
