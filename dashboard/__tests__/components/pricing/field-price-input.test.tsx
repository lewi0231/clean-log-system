import { FieldPriceInput } from "@/components/pricing/field-price-input";
import type { FieldConfig } from "@clean-log/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock useOrganizationCurrency
vi.mock("@/hooks/use-organization-currency", () => ({
  useOrganizationCurrency: () => ({
    formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
    currency: "USD" as const,
    locale: "en-US",
    loading: false,
  }),
}));

describe("FieldPriceInput", () => {
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

  const mockOnPriceChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("showBothContexts mode", () => {
    it("should render both customer and worker price inputs", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice="100"
          currentWorkerPrice="50"
          showBothContexts={true}
          pricingContext="customer"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      expect(
        screen.getByLabelText(/customer price per unit/i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/worker payment per unit/i)
      ).toBeInTheDocument();
    });

    it("should call onPriceChange with customer context when customer input changes", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice="100"
          currentWorkerPrice="50"
          showBothContexts={true}
          pricingContext="customer"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      const customerInput = screen.getByLabelText(/customer price per unit/i);
      fireEvent.change(customerInput, { target: { value: "150" } });

      expect(mockOnPriceChange).toHaveBeenCalledWith(
        "field-1",
        "150",
        "customer"
      );
    });

    it("should call onPriceChange with worker context when worker input changes", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice="100"
          currentWorkerPrice="50"
          showBothContexts={true}
          pricingContext="customer"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      const workerInput = screen.getByLabelText(/worker payment per unit/i);
      fireEvent.change(workerInput, { target: { value: "75" } });

      expect(mockOnPriceChange).toHaveBeenCalledWith("field-1", "75", "worker");
    });

    it("should disable inputs when isSaving is true", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice="100"
          currentWorkerPrice="50"
          showBothContexts={true}
          pricingContext="customer"
          isSaving={true}
          onPriceChange={mockOnPriceChange}
        />
      );

      const customerInput = screen.getByLabelText(/customer price per unit/i);
      const workerInput = screen.getByLabelText(/worker payment per unit/i);

      expect(customerInput).toBeDisabled();
      expect(workerInput).toBeDisabled();
    });

    it("should display correct field type description for number field", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice="100"
          currentWorkerPrice="50"
          showBothContexts={true}
          pricingContext="customer"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      expect(
        screen.getByText(/price multiplied by the field value/i)
      ).toBeInTheDocument();
    });

    it("should display correct field type description for boolean field", () => {
      const booleanFieldConfig: FieldConfig = {
        ...mockFieldConfig,
        field_type: "boolean",
      };

      render(
        <FieldPriceInput
          fieldConfig={booleanFieldConfig}
          currentCustomerPrice="100"
          currentWorkerPrice="50"
          showBothContexts={true}
          pricingContext="customer"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      expect(
        screen.getByText(/price applied when field is true/i)
      ).toBeInTheDocument();
    });
  });

  describe("single context mode - customer", () => {
    it("should render single customer price input", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice="100"
          currentWorkerPrice=""
          showBothContexts={false}
          pricingContext="customer"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      expect(screen.getByLabelText(/price per unit/i)).toBeInTheDocument();
      expect(
        screen.queryByLabelText(/worker payment per unit/i)
      ).not.toBeInTheDocument();
    });

    it("should display 'Price per Unit' label for customer context", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice="100"
          currentWorkerPrice=""
          showBothContexts={false}
          pricingContext="customer"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      expect(screen.getByLabelText(/price per unit/i)).toBeInTheDocument();
    });

    it("should use currentCustomerPrice value for customer context", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice="150"
          currentWorkerPrice="50"
          showBothContexts={false}
          pricingContext="customer"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      const input = screen.getByLabelText(
        /price per unit/i
      ) as HTMLInputElement;
      expect(input.value).toBe("150");
    });

    it("should call onPriceChange with customer context", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice="100"
          currentWorkerPrice=""
          showBothContexts={false}
          pricingContext="customer"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      const input = screen.getByLabelText(/price per unit/i);
      fireEvent.change(input, { target: { value: "200" } });

      expect(mockOnPriceChange).toHaveBeenCalledWith(
        "field-1",
        "200",
        "customer"
      );
    });
  });

  describe("single context mode - worker", () => {
    it("should render single worker price input", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice=""
          currentWorkerPrice="50"
          showBothContexts={false}
          pricingContext="worker"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      expect(screen.getByLabelText(/payment per unit/i)).toBeInTheDocument();
    });

    it("should display 'Payment per Unit' label for worker context", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice=""
          currentWorkerPrice="50"
          showBothContexts={false}
          pricingContext="worker"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      expect(screen.getByLabelText(/payment per unit/i)).toBeInTheDocument();
    });

    it("should use currentWorkerPrice value for worker context", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice="100"
          currentWorkerPrice="75"
          showBothContexts={false}
          pricingContext="worker"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      const input = screen.getByLabelText(
        /payment per unit/i
      ) as HTMLInputElement;
      expect(input.value).toBe("75");
    });

    it("should call onPriceChange with worker context", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice=""
          currentWorkerPrice="50"
          showBothContexts={false}
          pricingContext="worker"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      const input = screen.getByLabelText(/payment per unit/i);
      fireEvent.change(input, { target: { value: "80" } });

      expect(mockOnPriceChange).toHaveBeenCalledWith("field-1", "80", "worker");
    });
  });

  describe("zero price handling", () => {
    it("should allow zero as a valid price value", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice="0"
          currentWorkerPrice=""
          showBothContexts={false}
          pricingContext="customer"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      const input = screen.getByLabelText(
        /price per unit/i
      ) as HTMLInputElement;
      expect(input.value).toBe("0");
    });

    it("should handle zero in both contexts", () => {
      render(
        <FieldPriceInput
          fieldConfig={mockFieldConfig}
          currentCustomerPrice="0"
          currentWorkerPrice="0"
          showBothContexts={true}
          pricingContext="customer"
          isSaving={false}
          onPriceChange={mockOnPriceChange}
        />
      );

      const customerInput = screen.getByLabelText(
        /customer price per unit/i
      ) as HTMLInputElement;
      const workerInput = screen.getByLabelText(
        /worker payment per unit/i
      ) as HTMLInputElement;

      expect(customerInput.value).toBe("0");
      expect(workerInput.value).toBe("0");
    });
  });
});
