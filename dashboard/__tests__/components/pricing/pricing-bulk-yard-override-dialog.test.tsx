import { PricingBulkYardOverrideDialog } from "@/components/pricing/pricing-bulk-yard-override-dialog";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange: (value: string) => void;
    value: string;
  }) => (
    <div data-testid="yard-select" data-value={value}>
      <button type="button" onClick={() => onValueChange("loc-1")}>
        Select Hillcrest
      </button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

describe("PricingBulkYardOverrideDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    fieldLabel: "Vehicles Soaped",
    options: ["Nissan", "Ford", "Kia"],
    availableLocations: [{ id: "loc-1", name: "Hillcrest" }],
    hasWorkers: true,
    showBothContexts: true,
    saving: false,
    onSave: vi.fn().mockResolvedValue(true),
  };

  it("disables apply until yard and valid customer price are provided", async () => {
    render(<PricingBulkYardOverrideDialog {...defaultProps} />);

    expect(screen.getByRole("button", { name: /apply override/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /select hillcrest/i }));

    const customerInput = await screen.findByLabelText(/customer price/i);
    fireEvent.change(customerInput, { target: { value: "12.50" } });

    expect(screen.getByRole("button", { name: /apply to hillcrest/i })).toBeEnabled();
  });

  it("rejects invalid customer prices", async () => {
    render(<PricingBulkYardOverrideDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /select hillcrest/i }));

    const customerInput = await screen.findByLabelText(/customer price/i);
    fireEvent.change(customerInput, { target: { value: "not-a-price" } });

    expect(screen.getByRole("button", { name: /apply to hillcrest/i })).toBeDisabled();
  });

  it("applies the same price payload for every option", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onOpenChange = vi.fn();

    render(
      <PricingBulkYardOverrideDialog
        {...defaultProps}
        onSave={onSave}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select hillcrest/i }));

    fireEvent.change(await screen.findByLabelText(/customer price/i), {
      target: { value: "15" },
    });
    fireEvent.change(screen.getByLabelText(/worker payment/i), {
      target: { value: "8" },
    });

    fireEvent.click(screen.getByRole("button", { name: /apply to hillcrest/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        "loc-1",
        "Hillcrest",
        {
          Nissan: { customerPrice: "15", workerPrice: "8" },
          Ford: { customerPrice: "15", workerPrice: "8" },
          Kia: { customerPrice: "15", workerPrice: "8" },
        },
        ""
      );
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open when save returns false", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    const onOpenChange = vi.fn();

    render(
      <PricingBulkYardOverrideDialog
        {...defaultProps}
        onSave={onSave}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select hillcrest/i }));
    fireEvent.change(await screen.findByLabelText(/customer price/i), {
      target: { value: "15" },
    });
    fireEvent.click(screen.getByRole("button", { name: /apply to hillcrest/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: /apply to hillcrest/i })).toBeInTheDocument();
  });
});
