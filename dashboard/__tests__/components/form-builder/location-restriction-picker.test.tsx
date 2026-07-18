import { LocationRestrictionPicker } from "@/components/form-builder/location-restriction-picker";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("LocationRestrictionPicker", () => {
  const locations = [
    { id: "a", name: "Alpha", active: true },
    { id: "b", name: "Beta", active: true },
    { id: "c", name: "Charlie", active: false },
  ];

  it("shows empty message when no active locations", () => {
    render(
      <LocationRestrictionPicker
        locations={[{ id: "c", name: "Charlie", active: false }]}
        selectedIds={[]}
        onChange={vi.fn()}
        idPrefix="loc"
      />
    );
    expect(screen.getByText(/No locations available/i)).toBeInTheDocument();
  });

  it("selects and deselects all active locations", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <LocationRestrictionPicker
        locations={locations}
        selectedIds={[]}
        onChange={onChange}
        idPrefix="loc"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /select all/i }));
    expect(onChange).toHaveBeenCalledWith(["a", "b"]);

    rerender(
      <LocationRestrictionPicker
        locations={locations}
        selectedIds={["a", "b"]}
        onChange={onChange}
        idPrefix="loc"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /deselect all/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("toggles a single location without duplicating", () => {
    const onChange = vi.fn();
    render(
      <LocationRestrictionPicker
        locations={locations}
        selectedIds={["a"]}
        onChange={onChange}
        idPrefix="loc"
      />
    );

    fireEvent.click(screen.getByLabelText("Alpha"));
    expect(onChange).toHaveBeenCalledWith([]);

    fireEvent.click(screen.getByLabelText("Beta"));
    expect(onChange).toHaveBeenCalledWith(["a", "b"]);
  });
});
