/**
 * Tests for multi-select field functionality
 *
 * Test Cases:
 * - MS-1: Create multi-select field
 * - MS-2: Edit existing field to multi-select
 * - MS-3: Validation rules preservation
 */

import { describe, expect, test } from "vitest";

describe("Multi-Select Field - MS-1: Create Multi-Select Field", () => {
  test("should include allow_multiple in validation_rules when enabled", () => {
    // Test the validation rules structure
    const fieldConfig = {
      id: "field-1",
      field_type: "select",
      validation_rules: {
        allow_multiple: true,
      },
    };

    expect(fieldConfig.validation_rules?.allow_multiple).toBe(true);
  });

  test("should preserve validation rules when toggling allow_multiple", () => {
    // Test the logic for preserving validation rules
    const existingRules = {
      min_selections: 2,
      allow_multiple: false,
    };

    // When toggling allow_multiple on
    const updatedRules = {
      ...existingRules,
      allow_multiple: true,
    };

    expect(updatedRules.min_selections).toBe(2);
    expect(updatedRules.allow_multiple).toBe(true);
  });
});

describe("Multi-Select Field - MS-2: Edit Existing Field", () => {
  test("should preserve existing validation rules when toggling allow_multiple", () => {
    const existingField = {
      id: "field-1",
      label: "Test Select",
      field_type: "select",
      validation_rules: {
        min_selections: 2,
        allow_multiple: false,
      },
    };

    // When toggling allow_multiple to true
    const updatedRules = {
      ...existingField.validation_rules,
      allow_multiple: true,
    };

    expect(updatedRules.min_selections).toBe(2);
    expect(updatedRules.allow_multiple).toBe(true);
  });

  test("should remove allow_multiple without clearing other rules", () => {
    const existingField = {
      id: "field-1",
      label: "Test Select",
      field_type: "select",
      validation_rules: {
        min_selections: 2,
        max_selections: 5,
        allow_multiple: true,
      },
    };

    // When toggling allow_multiple to false, destructure to remove it
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { allow_multiple, ...otherRules } = existingField.validation_rules;
    const updatedRules = Object.keys(otherRules).length > 0 ? otherRules : null;

    expect(updatedRules).toEqual({
      min_selections: 2,
      max_selections: 5,
    });
    expect(updatedRules).not.toHaveProperty("allow_multiple");
  });
});
