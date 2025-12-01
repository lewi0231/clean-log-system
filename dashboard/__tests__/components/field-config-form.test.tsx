import FieldConfigForm from "@/components/settings/field-config-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("FieldConfigForm", () => {
  it("applies yard tracking presets and auto-populates fields", async () => {
    render(
      <FieldConfigForm
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        fieldConfig={null}
      />
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
