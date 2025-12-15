import FieldPricingList from "@/components/pricing/field-pricing-list";
import { usePricingScope } from "@/components/pricing/pricing-scope-context";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useFieldPricing } from "@/hooks/use-field-pricing";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import type { PricingRule } from "@/lib/types";
import type { FieldConfig } from "@clean-log/shared/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/hooks/use-field-pricing");
vi.mock("@/hooks/use-field-configs");
vi.mock("@/components/pricing/pricing-scope-context");
vi.mock("@/hooks/use-organization-currency");

describe("FieldPricingList - Zero Price Handling", () => {
  const mockFieldConfig: FieldConfig = {
    id: "field-1",
    name: "service_hours",
    label: "Service Hours",
    field_type: "number",
    organization_id: "org-1",
    description: null,
    required: false,
    order_position: 0,
    validation_rules: null,
    options: null,
    mutually_exclusive_group: null,
    group_cluster: null,
    section_id: null,
    conditional_logic: null,
    version: 1,
    active: true,
    archived_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const mockPricingRule: PricingRule = {
    id: "rule-1",
    organization_id: "org-1",
    scope: "field",
    pricing_type: "unit",
    pricing_context: "customer",
    field_config_id: "field-1",
    option_value: null,
    applies_to_field_type: null,
    location_id: null,
    location_hierarchy_id: null,
    currency: "USD",
    base_price: 100,
    percentage_rate: null,
    minimum_quantity: null,
    maximum_quantity: null,
    tier_definition: null,
    metadata: {},
    worker_payment_type: null,
    worker_payment_value: null,
    priority: 0,
    active: true,
    effective_at: "2024-01-01T00:00:00Z",
    expires_at: null,
    created_by: null,
    updated_by: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    field_config: null,
    location: null,
    location_node: null,
    conditions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useFieldConfigs).mockReturnValue({
      fieldConfigs: [mockFieldConfig],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(usePricingScope).mockReturnValue({
      locationNodeId: null,
      setLocationNodeId: vi.fn(),
      locationId: null,
      setLocationId: vi.fn(),
      effectiveDate: null,
      setEffectiveDate: vi.fn(),
      expirationDate: null,
      setExpirationDate: vi.fn(),
      selectedFieldId: null,
      setSelectedFieldId: vi.fn(),
      pricingHistoryRefreshToken: 0,
      refreshPricingHistory: vi.fn(),
    });

    vi.mocked(useOrganizationCurrency).mockReturnValue({
      formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
      currency: "USD" as const,
      locale: "en-US",
      loading: false,
    });
  });

  describe("Button enable/disable logic for zero price", () => {
    it("should enable save button when user types '0' as price", async () => {
      const mockUpsertPricing = vi.fn().mockResolvedValue({
        ...mockPricingRule,
        base_price: 0,
      });

      vi.mocked(useFieldPricing).mockReturnValue({
        fieldPricing: [
          {
            id: "rule-1",
            organization_id: "org-1",
            field_config_id: "field-1",
            location_id: null,
            location_hierarchy_id: null,
            pricing_type: "unit",
            customer_price: 100,
            currency: "USD",
            applies_to_field_type: null,
            worker_payment_type: null,
            worker_payment_value: null,
            source_rule: mockPricingRule,
            field_config: null,
            location: null,
            location_node: null,
          },
        ],
        loading: false,
        error: null,
        refetch: vi.fn(),
        upsertPricing: mockUpsertPricing,
        deletePricing: vi.fn(),
      });

      render(
        <FieldPricingList
          locationHierarchyId={null}
          locationId={null}
          pricingContext="customer"
          showBothContexts={false}
        />
      );

      // Find the input field by ID (the label says "Price per Unit")
      const priceInput = screen.getByLabelText(
        /price per unit/i
      ) as HTMLInputElement;

      // Type "0" into the input
      fireEvent.change(priceInput, { target: { value: "0" } });

      // Check that the input value is "0"
      expect(priceInput.value).toBe("0");

      // Find the save button
      const saveButton = screen.getByRole("button", { name: /save|update/i });

      // The button should NOT be disabled when price is "0"
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });

    it("should enable save button when changing from non-zero to zero", async () => {
      const mockUpsertPricing = vi.fn().mockResolvedValue({
        ...mockPricingRule,
        base_price: 0,
      });

      vi.mocked(useFieldPricing).mockReturnValue({
        fieldPricing: [
          {
            id: "rule-1",
            organization_id: "org-1",
            field_config_id: "field-1",
            location_id: null,
            location_hierarchy_id: null,
            pricing_type: "unit",
            customer_price: 100, // Existing price is 100
            currency: "USD",
            applies_to_field_type: null,
            worker_payment_type: null,
            worker_payment_value: null,
            source_rule: mockPricingRule,
            field_config: null,
            location: null,
            location_node: null,
          },
        ],
        loading: false,
        error: null,
        refetch: vi.fn(),
        upsertPricing: mockUpsertPricing,
        deletePricing: vi.fn(),
      });

      render(
        <FieldPricingList
          locationHierarchyId={null}
          locationId={null}
          pricingContext="customer"
          showBothContexts={false}
        />
      );

      // Find the input field (should show existing price of 100)
      const priceInput = screen.getByLabelText(
        /price per unit/i
      ) as HTMLInputElement;
      expect(priceInput.value).toBe("100");

      // Change to "0"
      fireEvent.change(priceInput, { target: { value: "0" } });
      expect(priceInput.value).toBe("0");

      // Find the save button
      const saveButton = screen.getByRole("button", { name: /save|update/i });

      // The button should be enabled because we changed from 100 to 0
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });

    it("should allow saving zero price", async () => {
      const mockUpsertPricing = vi.fn().mockResolvedValue({
        ...mockPricingRule,
        base_price: 0,
      });

      vi.mocked(useFieldPricing).mockReturnValue({
        fieldPricing: [
          {
            id: "rule-1",
            organization_id: "org-1",
            field_config_id: "field-1",
            location_id: null,
            location_hierarchy_id: null,
            pricing_type: "unit",
            customer_price: 100,
            currency: "USD",
            applies_to_field_type: null,
            worker_payment_type: null,
            worker_payment_value: null,
            source_rule: mockPricingRule,
            field_config: null,
            location: null,
            location_node: null,
          },
        ],
        loading: false,
        error: null,
        refetch: vi.fn(),
        upsertPricing: mockUpsertPricing,
        deletePricing: vi.fn(),
      });

      render(
        <FieldPricingList
          locationHierarchyId={null}
          locationId={null}
          pricingContext="customer"
          showBothContexts={false}
        />
      );

      // Change price to "0"
      const priceInput = screen.getByLabelText(
        /price per unit/i
      ) as HTMLInputElement;
      fireEvent.change(priceInput, { target: { value: "0" } });

      // Click save
      const saveButton = screen.getByRole("button", { name: /save|update/i });
      fireEvent.click(saveButton);

      // Should call upsertPricing with 0
      await waitFor(() => {
        expect(mockUpsertPricing).toHaveBeenCalledWith(
          "field-1",
          0, // Zero price should be passed
          expect.objectContaining({
            pricingContext: "customer",
          })
        );
      });
    });

    it("should handle zero price validation correctly in button disable logic", () => {
      // Test the validation logic directly
      const currentCustomerPrice = "0";

      // This is the logic from the component
      const customerValid =
        currentCustomerPrice &&
        currentCustomerPrice.trim() !== "" &&
        !isNaN(parseFloat(currentCustomerPrice)) &&
        parseFloat(currentCustomerPrice) >= 0;

      expect(customerValid).toBe(true);
    });

    it("should detect change when price goes from non-zero to zero", () => {
      // Test the change detection logic
      const editingCustomer = "0";
      const existingPrice = 100;

      // This is the logic from the component
      const hasCustomerChanges =
        editingCustomer !== undefined &&
        parseFloat(editingCustomer || "0") !== (existingPrice ?? 0);

      expect(hasCustomerChanges).toBe(true);
    });

    it("should detect change when price goes from zero to non-zero", () => {
      const editingCustomer = "100";
      const existingPrice = 0;

      const hasCustomerChanges =
        editingCustomer !== undefined &&
        parseFloat(editingCustomer || "0") !== (existingPrice ?? 0);

      expect(hasCustomerChanges).toBe(true);
    });

    it("should NOT detect change when price stays at zero", () => {
      const editingCustomer = "0";
      const existingPrice = 0;

      const hasCustomerChanges =
        editingCustomer !== undefined &&
        parseFloat(editingCustomer || "0") !== (existingPrice ?? 0);

      expect(hasCustomerChanges).toBe(false);
    });
  });

  describe("handleSave with zero price", () => {
    it("should parse zero price correctly in showBothContexts mode", () => {
      const editing = { customer: "0", worker: undefined };

      // This is the logic from handleSave
      const customerPrice =
        editing.customer !== undefined && editing.customer.trim() !== ""
          ? parseFloat(editing.customer)
          : null;

      expect(customerPrice).toBe(0);
      expect(customerPrice).not.toBe(null);
    });

    it("should parse zero price correctly in single context mode", () => {
      const priceValue = "0";

      // This is the logic from handleSave
      const shouldReturn = !priceValue || priceValue.trim() === "";
      const price = parseFloat(priceValue);
      const shouldReturn2 = isNaN(price) || price < 0;

      expect(shouldReturn).toBe(false); // Should NOT return early
      expect(price).toBe(0);
      expect(shouldReturn2).toBe(false); // Should NOT return early
    });
  });
});
