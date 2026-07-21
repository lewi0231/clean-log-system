import {
  BULK_PRICING_ALL_YARDS,
  PricingBulkPricingDialog,
} from "@/components/pricing/pricing-bulk-pricing-dialog";
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
    <div data-testid="scope-select" data-value={value}>
      <button type="button" onClick={() => onValueChange(BULK_PRICING_ALL_YARDS)}>
        Select All yards
      </button>
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

describe("PricingBulkPricingDialog", () => {
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

  it("defaults to All yards and enables apply once customer price is valid", async () => {
    render(<PricingBulkPricingDialog {...defaultProps} />);

    expect(screen.getByRole("button", { name: /apply as all yards default/i })).toBeDisabled();
    expect(screen.queryByLabelText(/valid until/i)).not.toBeInTheDocument();

    const customerInput = await screen.findByLabelText(/customer price/i);
    fireEvent.change(customerInput, { target: { value: "12.50" } });

    expect(screen.getByRole("button", { name: /apply as all yards default/i })).toBeEnabled();
  });

  it("rejects invalid customer prices", async () => {
    render(<PricingBulkPricingDialog {...defaultProps} />);

    const customerInput = await screen.findByLabelText(/customer price/i);
    fireEvent.change(customerInput, { target: { value: "not-a-price" } });

    expect(screen.getByRole("button", { name: /apply as all yards default/i })).toBeDisabled();
  });

  it("applies yard override payload for every option", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onOpenChange = vi.fn();

    render(
      <PricingBulkPricingDialog {...defaultProps} onSave={onSave} onOpenChange={onOpenChange} />
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
        { type: "yard", locationId: "loc-1", locationName: "Hillcrest" },
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

  it("applies All yards default without valid-until field", async () => {
    const onSave = vi.fn().mockResolvedValue(true);

    render(<PricingBulkPricingDialog {...defaultProps} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /select all yards/i }));

    fireEvent.change(await screen.findByLabelText(/customer price/i), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText(/worker payment/i), {
      target: { value: "5" },
    });

    expect(screen.queryByLabelText(/valid until/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /apply as all yards default/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        { type: "all-yards" },
        {
          Nissan: { customerPrice: "10", workerPrice: "5" },
          Ford: { customerPrice: "10", workerPrice: "5" },
          Kia: { customerPrice: "10", workerPrice: "5" },
        },
        ""
      );
    });
  });

  it("stays open when save returns false", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    const onOpenChange = vi.fn();

    render(
      <PricingBulkPricingDialog {...defaultProps} onSave={onSave} onOpenChange={onOpenChange} />
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
