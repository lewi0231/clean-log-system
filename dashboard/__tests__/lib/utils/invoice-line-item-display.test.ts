import { DEFAULT_LINE_ITEM_DISPLAY } from "@/lib/constants/invoice-template-defaults";
import {
  formatLineItemDescription,
  shouldShowBasePriceSeparately,
} from "@/lib/utils/invoice-line-item-display";
import { describe, expect, it } from "vitest";

describe("formatLineItemDescription", () => {
  const item = {
    field_label: "Service Type",
    option_value: "Full Detail",
  };

  it("uses description format when include_option_value is true", () => {
    expect(
      formatLineItemDescription(item, {
        include_option_value: true,
        description_format: "{field_label}: {option_value}",
      })
    ).toBe("Service Type: Full Detail");
  });

  it("supports custom description format", () => {
    expect(
      formatLineItemDescription(item, {
        include_option_value: true,
        description_format: "{option_value} ({field_label})",
      })
    ).toBe("Full Detail (Service Type)");
  });

  it("shows field label only when include_option_value is false", () => {
    expect(
      formatLineItemDescription(item, {
        include_option_value: false,
        description_format: "{field_label}: {option_value}",
      })
    ).toBe("Service Type");
  });

  it("shows field label only when option_value is missing", () => {
    expect(
      formatLineItemDescription({ field_label: "Extra Rooms" }, { include_option_value: true })
    ).toBe("Extra Rooms");
  });

  it("defaults to include option values when config is missing", () => {
    expect(formatLineItemDescription(item, null)).toBe("Service Type: Full Detail");
    expect(formatLineItemDescription(item)).toBe(
      DEFAULT_LINE_ITEM_DISPLAY.description_format
        .replaceAll("{field_label}", "Service Type")
        .replaceAll("{option_value}", "Full Detail")
    );
  });
});

describe("shouldShowBasePriceSeparately", () => {
  it("returns true by default when base price is positive", () => {
    expect(shouldShowBasePriceSeparately(50, null)).toBe(true);
    expect(shouldShowBasePriceSeparately(50)).toBe(true);
  });

  it("returns false when toggle is off", () => {
    expect(shouldShowBasePriceSeparately(50, { show_base_price_separately: false })).toBe(false);
  });

  it("returns false when base price is zero or negative", () => {
    expect(shouldShowBasePriceSeparately(0, { show_base_price_separately: true })).toBe(false);
    expect(shouldShowBasePriceSeparately(-1, { show_base_price_separately: true })).toBe(false);
  });
});
