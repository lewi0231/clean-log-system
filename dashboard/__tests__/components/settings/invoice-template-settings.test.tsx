/**
 * P2 Medium Priority Tests: Invoice Template Settings UI Component
 *
 * These tests ensure the UI component works correctly and provides good UX.
 * The component uses auto-save: changes trigger immediate saves (no save button).
 */

import InvoiceTemplateSettings from "@/components/settings/invoice-template-settings";
import { useInvoiceTemplateConfig } from "@/hooks/use-invoice-template-config";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import useOrganization from "@/hooks/useOrganization";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockFieldConfig } from "../../lib/fixtures";

// Mock the hooks (field configs are passed from page; hook not used in component)
vi.mock("@/hooks/use-invoice-template-config");
vi.mock("@/hooks/use-locations");
vi.mock("@/hooks/use-organization-settings");
vi.mock("@/hooks/useOrganization");

const mockUseInvoiceTemplateConfig = vi.mocked(useInvoiceTemplateConfig);
const mockUseLocations = vi.mocked(useLocations);
const mockUseOrganizationSettings = vi.mocked(useOrganizationSettings);
const mockUseOrganization = vi.mocked(useOrganization);

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
    mockUseLocations.mockReturnValue({
      locations: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
      createLocation: vi.fn(),
      updateLocation: vi.fn(),
      deleteLocation: vi.fn(),
    });
    mockUseOrganizationSettings.mockReturnValue({
      settings: null,
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
    mockUseOrganization.mockReturnValue({
      organizationId: "org-1",
      organizationUserId: "ou-1",
      userRole: "admin",
      loading: false,
      error: undefined,
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

      render(<InvoiceTemplateSettings fieldConfigs={[]} fieldConfigsLoading={false} />);
      expect(screen.getByText(/loading invoice template settings/i)).toBeInTheDocument();
    });

    it("P2: should show loading state when field configs are loading", () => {
      mockUseInvoiceTemplateConfig.mockReturnValue({
        config: null,
        loading: false,
        updateConfig: mockUpdateConfig,
        error: null,
        refetch: mockRefetch,
      });

      render(<InvoiceTemplateSettings fieldConfigs={[]} fieldConfigsLoading={true} />);
      expect(screen.getByText(/loading invoice template settings/i)).toBeInTheDocument();
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

      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      expect(screen.getByText(/failed to load invoice template settings/i)).toBeInTheDocument();
      expect(screen.getByText("Failed to load configuration")).toBeInTheDocument();
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
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );

      expect(screen.getByText(/service address configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/email recipient configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/line item display settings/i)).toBeInTheDocument();
    });

    it("P2: should render preview button", () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      expect(screen.getByRole("button", { name: /preview invoice header/i })).toBeInTheDocument();
    });

    it("P2: should not have a manual save button (auto-save pattern)", () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      expect(
        screen.queryByRole("button", { name: /save invoice template settings/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Auto-Save Behavior", () => {
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

    it("P2: should auto-save when toggling include option values", async () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      const includeOptionSwitch = screen.getByLabelText(/include option values/i);

      fireEvent.click(includeOptionSwitch);

      await waitFor(() => {
        expect(mockUpdateConfig).toHaveBeenCalledTimes(1);
      });
    });

    it("P2: should auto-save when toggling show base price separately", async () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      const showBasePriceSwitch = screen.getByLabelText(/show base price separately/i);

      fireEvent.click(showBasePriceSwitch);

      await waitFor(() => {
        expect(mockUpdateConfig).toHaveBeenCalledTimes(1);
      });
    });

    it("P2: should auto-save when toggling billing address enabled", async () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      const billingSwitch = screen.getByLabelText(/show billing address/i);

      fireEvent.click(billingSwitch);

      await waitFor(() => {
        expect(mockUpdateConfig).toHaveBeenCalledTimes(1);
      });
    });

    it("P2: should pass correct config data to updateConfig on toggle", async () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      const includeOptionSwitch = screen.getByLabelText(/include option values/i);

      // Initial state is checked (include_option_value: true), so clicking turns it off
      fireEvent.click(includeOptionSwitch);

      await waitFor(() => {
        expect(mockUpdateConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            invoice_title: "Tax Invoice",
            show_logo: true,
            show_abn: true,
            line_item_display: expect.objectContaining({
              include_option_value: false,
            }),
          })
        );
      });
    });

    it("P2: should debounce description format input and save on blur", async () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      const descriptionInput = screen.getByPlaceholderText("{field_label}: {option_value}");

      // Type something
      fireEvent.change(descriptionInput, {
        target: { value: "{field_label} - {option_value}" },
      });

      // Should not have saved yet (debounced)
      expect(mockUpdateConfig).not.toHaveBeenCalled();

      // Blur to trigger immediate save
      fireEvent.blur(descriptionInput);

      await waitFor(() => {
        expect(mockUpdateConfig).toHaveBeenCalledTimes(1);
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

    it("P2: should display validation error when entering invalid description format", async () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      const descriptionInput = screen.getByPlaceholderText("{field_label}: {option_value}");

      // Enter invalid format (missing placeholders)
      fireEvent.change(descriptionInput, {
        target: { value: "Missing placeholders" },
      });
      fireEvent.blur(descriptionInput);

      await waitFor(() => {
        expect(screen.getByText(/please fix the following errors/i)).toBeInTheDocument();
      });
    });

    it("P2: should not call updateConfig when validation fails", async () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      const descriptionInput = screen.getByPlaceholderText("{field_label}: {option_value}");

      // Enter invalid format (missing placeholders)
      fireEvent.change(descriptionInput, {
        target: { value: "Missing placeholders" },
      });
      fireEvent.blur(descriptionInput);

      await waitFor(() => {
        expect(screen.getByText(/please fix the following errors/i)).toBeInTheDocument();
      });

      // updateConfig should NOT have been called due to validation failure
      expect(mockUpdateConfig).not.toHaveBeenCalled();
    });

    it("P2: should clear validation error when user fixes the input", async () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      const descriptionInput = screen.getByPlaceholderText("{field_label}: {option_value}");

      // Enter invalid format
      fireEvent.change(descriptionInput, {
        target: { value: "Missing placeholders" },
      });
      fireEvent.blur(descriptionInput);

      await waitFor(() => {
        expect(screen.getByText(/please fix the following errors/i)).toBeInTheDocument();
      });

      // Fix the input
      fireEvent.change(descriptionInput, {
        target: { value: "{field_label}: {option_value}" },
      });

      // Error should clear when typing (before save)
      await waitFor(() => {
        expect(screen.queryByText(/please fix the following errors/i)).not.toBeInTheDocument();
      });
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

    it("P2: should toggle include option value switch", () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      const includeOptionSwitch = screen.getByLabelText(/include option values/i);

      expect(includeOptionSwitch).toBeChecked();

      fireEvent.click(includeOptionSwitch);

      expect(includeOptionSwitch).not.toBeChecked();
    });

    it("P2: should hide description format input when include option values is off", () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      const includeOptionSwitch = screen.getByLabelText(/include option values/i);

      // Initially visible
      expect(screen.getByPlaceholderText("{field_label}: {option_value}")).toBeInTheDocument();

      // Toggle off
      fireEvent.click(includeOptionSwitch);

      // Should be hidden
      expect(
        screen.queryByPlaceholderText("{field_label}: {option_value}")
      ).not.toBeInTheDocument();
    });
  });

  describe("Preview Dialog", () => {
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

    it("P2: should open preview dialog when preview button is clicked", async () => {
      render(
        <InvoiceTemplateSettings fieldConfigs={mockFieldConfigs} fieldConfigsLoading={false} />
      );
      const previewButton = screen.getByRole("button", {
        name: /preview invoice header/i,
      });

      fireEvent.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText(/invoice header preview/i)).toBeInTheDocument();
      });
    });
  });
});
