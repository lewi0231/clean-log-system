/**
 * P2 Medium Priority Tests: Invoice Template Settings UI Component
 *
 * These tests ensure the UI component works correctly and provides good UX.
 */

import InvoiceTemplateSettings from "@/components/settings/invoice-template-settings";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useInvoiceTemplateConfig } from "@/hooks/use-invoice-template-config";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockFieldConfig } from "../../lib/fixtures";

// Mock the hooks
vi.mock("@/hooks/use-invoice-template-config");
vi.mock("@/hooks/use-field-configs");

const mockUseInvoiceTemplateConfig = vi.mocked(useInvoiceTemplateConfig);
const mockUseFieldConfigs = vi.mocked(useFieldConfigs);

describe("InvoiceTemplateSettings - P2 UI Component Tests", () => {
  const mockUpdateConfig = vi.fn();
  const mockRefetch = vi.fn();
  const mockFieldConfigs = [
    createMockFieldConfig({
      id: "field-1",
      name: "customer_email",
      label: "Customer Email",
      field_type: "email",
    }),
    createMockFieldConfig({
      id: "field-2",
      name: "customer_name",
      label: "Customer Name",
      field_type: "text",
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFieldConfigs.mockReturnValue({
      fieldConfigs: mockFieldConfigs,
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  describe("Loading States", () => {
    it("P2: should show loading state when config is loading", () => {
      mockUseInvoiceTemplateConfig.mockReturnValue({
        config: null,
        loading: true,
        updateConfig: mockUpdateConfig,
        error: null,
        refetch: mockRefetch,
      });

      render(<InvoiceTemplateSettings />);
      expect(
        screen.getByText(/loading invoice template settings/i)
      ).toBeInTheDocument();
    });

    it("P2: should show loading state when field configs are loading", () => {
      mockUseInvoiceTemplateConfig.mockReturnValue({
        config: null,
        loading: false,
        updateConfig: mockUpdateConfig,
        error: null,
        refetch: mockRefetch,
      });
      mockUseFieldConfigs.mockReturnValue({
        fieldConfigs: [],
        loading: true,
        error: null,
        refetch: mockRefetch,
      });

      render(<InvoiceTemplateSettings />);
      expect(
        screen.getByText(/loading invoice template settings/i)
      ).toBeInTheDocument();
    });
  });

  describe("Error States", () => {
    it("P2: should display error message when config fails to load", () => {
      mockUseInvoiceTemplateConfig.mockReturnValue({
        config: null,
        loading: false,
        updateConfig: mockUpdateConfig,
        error: "Failed to load configuration",
        refetch: mockRefetch,
      });

      render(<InvoiceTemplateSettings />);
      expect(
        screen.getByText(/failed to load invoice template settings/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText("Failed to load configuration")
      ).toBeInTheDocument();
    });
  });

  describe("Form Rendering", () => {
    const mockConfig = {
      id: "config-1",
      organization_id: "org-1",
      invoice_title: "Tax Invoice",
      show_logo: true,
      show_abn: true,
      bill_to_fields: [],
      service_address_config: {
        source: "auto" as const,
        location_fields: ["name" as const, "address" as const],
        form_fields: ["address"],
      },
      billing_address_config: {
        enabled: false,
        source: "auto" as const,
      },
      email_recipient_config: {
        location_email_source: "location_email" as const,
        form_field_email: null,
        default_email: null,
      },
      line_item_display: {
        include_option_value: true,
        description_format: "{field_label}: {option_value}",
        show_base_price_separately: true,
      },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    beforeEach(() => {
      mockUseInvoiceTemplateConfig.mockReturnValue({
        config: mockConfig,
        loading: false,
        updateConfig: mockUpdateConfig,
        error: null,
        refetch: mockRefetch,
      });
    });

    it("P2: should render all main sections", () => {
      render(<InvoiceTemplateSettings />);

      expect(screen.getByText(/invoice header settings/i)).toBeInTheDocument();
      expect(
        screen.getByText(/service address configuration/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/email recipient configuration/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/line item display settings/i)
      ).toBeInTheDocument();
    });

    it("P2: should render save button", () => {
      render(<InvoiceTemplateSettings />);
      expect(
        screen.getByRole("button", { name: /save invoice template settings/i })
      ).toBeInTheDocument();
    });

    it("P2: should disable save button when saving", async () => {
      mockUpdateConfig.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<InvoiceTemplateSettings />);
      const saveButton = screen.getByRole("button", {
        name: /save invoice template settings/i,
      });

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      });

      expect(saveButton).toBeDisabled();
    });
  });

  describe("Form Submission", () => {
    const mockConfig = {
      id: "config-1",
      organization_id: "org-1",
      invoice_title: "Tax Invoice",
      show_logo: true,
      show_abn: true,
      bill_to_fields: [],
      service_address_config: {
        source: "auto" as const,
        location_fields: ["name" as const, "address" as const],
        form_fields: ["address"],
      },
      billing_address_config: {
        enabled: false,
        source: "auto" as const,
      },
      email_recipient_config: {
        location_email_source: "location_email" as const,
        form_field_email: null,
        default_email: null,
      },
      line_item_display: {
        include_option_value: true,
        description_format: "{field_label}: {option_value}",
        show_base_price_separately: true,
      },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    beforeEach(() => {
      mockUseInvoiceTemplateConfig.mockReturnValue({
        config: mockConfig,
        loading: false,
        updateConfig: mockUpdateConfig,
        error: null,
        refetch: mockRefetch,
      });
      mockUpdateConfig.mockResolvedValue(undefined);
    });

    it("P2: should call updateConfig when save button is clicked", async () => {
      render(<InvoiceTemplateSettings />);
      const saveButton = screen.getByRole("button", {
        name: /save invoice template settings/i,
      });

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateConfig).toHaveBeenCalledTimes(1);
      });
    });

    it("P2: should pass correct config data to updateConfig", async () => {
      render(<InvoiceTemplateSettings />);
      const saveButton = screen.getByRole("button", {
        name: /save invoice template settings/i,
      });

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            invoice_title: "Tax Invoice",
            show_logo: true,
            show_abn: true,
          })
        );
      });
    });
  });

  describe("Validation Errors", () => {
    const mockConfig = {
      id: "config-1",
      organization_id: "org-1",
      invoice_title: "Tax Invoice",
      show_logo: true,
      show_abn: true,
      bill_to_fields: [],
      service_address_config: {
        source: "auto" as const,
        location_fields: ["name" as const, "address" as const],
        form_fields: ["address"],
      },
      billing_address_config: {
        enabled: false,
        source: "auto" as const,
      },
      email_recipient_config: {
        location_email_source: "location_email" as const,
        form_field_email: null,
        default_email: "invalid-email", // Invalid email
      },
      line_item_display: {
        include_option_value: true,
        description_format: "Missing placeholders", // Missing required placeholders
        show_base_price_separately: true,
      },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    beforeEach(() => {
      mockUseInvoiceTemplateConfig.mockReturnValue({
        config: mockConfig,
        loading: false,
        updateConfig: mockUpdateConfig,
        error: null,
        refetch: mockRefetch,
      });
    });

    it("P2: should display validation errors when save is clicked with invalid data", async () => {
      render(<InvoiceTemplateSettings />);
      const saveButton = screen.getByRole("button", {
        name: /save invoice template settings/i,
      });

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/please fix the following errors/i)
        ).toBeInTheDocument();
      });
    });

    it("P2: should disable save button when validation errors exist", async () => {
      render(<InvoiceTemplateSettings />);
      const saveButton = screen.getByRole("button", {
        name: /save invoice template settings/i,
      });

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });
    });

    it("P2: should show error count in save button area", async () => {
      render(<InvoiceTemplateSettings />);
      const saveButton = screen.getByRole("button", {
        name: /save invoice template settings/i,
      });

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/\d+ error/i)).toBeInTheDocument();
      });
    });
  });

  describe("Success Feedback", () => {
    const mockConfig = {
      id: "config-1",
      organization_id: "org-1",
      invoice_title: "Tax Invoice",
      show_logo: true,
      show_abn: true,
      bill_to_fields: [],
      service_address_config: {
        source: "auto" as const,
        location_fields: ["name" as const, "address" as const],
        form_fields: ["address"],
      },
      billing_address_config: {
        enabled: false,
        source: "auto" as const,
      },
      email_recipient_config: {
        location_email_source: "location_email" as const,
        form_field_email: null,
        default_email: null,
      },
      line_item_display: {
        include_option_value: true,
        description_format: "{field_label}: {option_value}",
        show_base_price_separately: true,
      },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    beforeEach(() => {
      mockUseInvoiceTemplateConfig.mockReturnValue({
        config: mockConfig,
        loading: false,
        updateConfig: mockUpdateConfig,
        error: null,
        refetch: mockRefetch,
      });
      mockUpdateConfig.mockResolvedValue(undefined);
    });

    it("P2: should show success message after successful save", async () => {
      render(<InvoiceTemplateSettings />);
      const saveButton = screen.getByRole("button", {
        name: /save invoice template settings/i,
      });

      fireEvent.click(saveButton);

      await waitFor(
        () => {
          expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });
  });

  describe("Field Interactions", () => {
    const mockConfig = {
      id: "config-1",
      organization_id: "org-1",
      invoice_title: "Tax Invoice",
      show_logo: true,
      show_abn: true,
      bill_to_fields: [],
      service_address_config: {
        source: "auto" as const,
        location_fields: ["name" as const, "address" as const],
        form_fields: ["address"],
      },
      billing_address_config: {
        enabled: false,
        source: "auto" as const,
      },
      email_recipient_config: {
        location_email_source: "location_email" as const,
        form_field_email: null,
        default_email: null,
      },
      line_item_display: {
        include_option_value: true,
        description_format: "{field_label}: {option_value}",
        show_base_price_separately: true,
      },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    beforeEach(() => {
      mockUseInvoiceTemplateConfig.mockReturnValue({
        config: mockConfig,
        loading: false,
        updateConfig: mockUpdateConfig,
        error: null,
        refetch: mockRefetch,
      });
    });

    it("P2: should update invoice title when radio button is selected", async () => {
      render(<InvoiceTemplateSettings />);
      const invoiceRadio = screen.getByLabelText(/^invoice$/i);

      fireEvent.click(invoiceRadio);

      // The value should be updated in state (we can't directly test state, but we can test the UI reflects it)
      expect(invoiceRadio).toBeChecked();
    });

    it("P2: should toggle show logo switch", async () => {
      render(<InvoiceTemplateSettings />);
      const showLogoSwitch = screen.getByLabelText(/show logo/i);

      expect(showLogoSwitch).toBeChecked(); // Initially true

      fireEvent.click(showLogoSwitch);

      expect(showLogoSwitch).not.toBeChecked();
    });
  });
});
