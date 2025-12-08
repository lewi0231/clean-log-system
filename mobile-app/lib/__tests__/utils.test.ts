import { FieldConfig } from "@clean-log/shared/types/field-config";
import { describe, expect, it } from "vitest";
import { createSchemaFromFieldConfig } from "../utils";

// Helper to create a minimal FieldConfig for testing
function createTestFieldConfig(overrides: Partial<FieldConfig>): FieldConfig {
  return {
    id: "test-id",
    organization_id: "org-id",
    name: "test_field",
    label: "Test Field",
    field_type: "text",
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("createSchemaFromFieldConfig", () => {
  describe("basic field types", () => {
    it("should create a string schema for text fields", () => {
      const configs = [
        createTestFieldConfig({
          name: "name",
          label: "Name",
          field_type: "text",
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);
      const result = schema.safeParse({ name: "John Doe" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("John Doe");
      }
    });

    it("should create a number schema for number fields", () => {
      const configs = [
        createTestFieldConfig({
          name: "age",
          label: "Age",
          field_type: "number",
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);
      const result = schema.safeParse({ age: 25 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.age).toBe(25);
      }
    });

    it("should create a boolean schema for boolean fields", () => {
      const configs = [
        createTestFieldConfig({
          name: "is_active",
          label: "Is Active",
          field_type: "boolean",
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);
      const result = schema.safeParse({ is_active: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_active).toBe(true);
      }
    });

    it("should create an email schema for email fields", () => {
      const configs = [
        createTestFieldConfig({
          name: "email",
          label: "Email",
          field_type: "email",
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);

      // Valid email should pass
      const validResult = schema.safeParse({ email: "test@example.com" });
      expect(validResult.success).toBe(true);

      // Invalid email should fail
      const invalidResult = schema.safeParse({ email: "not-an-email" });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe("required fields", () => {
    it("should make optional fields optional", () => {
      const configs = [
        createTestFieldConfig({
          name: "optional_field",
          label: "Optional Field",
          field_type: "text",
          required: false,
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);
      const result = schema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.optional_field).toBeUndefined();
      }
    });

    it("should require required fields", () => {
      const configs = [
        createTestFieldConfig({
          name: "required_field",
          label: "Required Field",
          field_type: "text",
          required: true,
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);

      // Missing required field should fail
      const missingResult = schema.safeParse({});
      expect(missingResult.success).toBe(false);

      // Present required field should pass
      const presentResult = schema.safeParse({ required_field: "value" });
      expect(presentResult.success).toBe(true);
    });
  });

  describe("string validations", () => {
    it("should enforce minLength", () => {
      const configs = [
        createTestFieldConfig({
          name: "username",
          label: "Username",
          field_type: "text",
          validation_rules: {
            minLength: 5,
          },
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);

      // Too short should fail
      const shortResult = schema.safeParse({ username: "abc" });
      expect(shortResult.success).toBe(false);
      if (!shortResult.success) {
        expect(shortResult.error.issues[0].message).toContain("at least 5");
      }

      // Long enough should pass
      const validResult = schema.safeParse({ username: "abcdef" });
      expect(validResult.success).toBe(true);
    });

    it("should enforce maxLength", () => {
      const configs = [
        createTestFieldConfig({
          name: "title",
          label: "Title",
          field_type: "text",
          validation_rules: {
            maxLength: 10,
          },
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);

      // Too long should fail
      const longResult = schema.safeParse({ title: "This is too long" });
      expect(longResult.success).toBe(false);

      // Short enough should pass
      const validResult = schema.safeParse({ title: "Short" });
      expect(validResult.success).toBe(true);
    });

    it("should enforce pattern/regex", () => {
      const configs = [
        createTestFieldConfig({
          name: "phone",
          label: "Phone",
          field_type: "phone",
          validation_rules: {
            pattern: "^\\d{10}$",
          },
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);

      // Invalid pattern should fail
      const invalidResult = schema.safeParse({ phone: "123-456-7890" });
      expect(invalidResult.success).toBe(false);

      // Valid pattern should pass
      const validResult = schema.safeParse({ phone: "1234567890" });
      expect(validResult.success).toBe(true);
    });

    it("should use custom messages when provided", () => {
      const configs = [
        createTestFieldConfig({
          name: "custom_field",
          label: "Custom Field",
          field_type: "text",
          validation_rules: {
            minLength: 5,
            customMessage: "This is a custom error message",
          },
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);
      const result = schema.safeParse({ custom_field: "abc" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "This is a custom error message",
        );
      }
    });
  });

  describe("number validations", () => {
    it("should enforce min value", () => {
      const configs = [
        createTestFieldConfig({
          name: "age",
          label: "Age",
          field_type: "number",
          validation_rules: {
            min: 18,
          },
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);

      // Below min should fail
      const lowResult = schema.safeParse({ age: 17 });
      expect(lowResult.success).toBe(false);

      // At or above min should pass
      const validResult = schema.safeParse({ age: 18 });
      expect(validResult.success).toBe(true);
    });

    it("should enforce max value", () => {
      const configs = [
        createTestFieldConfig({
          name: "score",
          label: "Score",
          field_type: "number",
          validation_rules: {
            max: 100,
          },
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);

      // Above max should fail
      const highResult = schema.safeParse({ score: 101 });
      expect(highResult.success).toBe(false);

      // At or below max should pass
      const validResult = schema.safeParse({ score: 100 });
      expect(validResult.success).toBe(true);
    });
  });

  describe("select fields", () => {
    it("should validate against enum options", () => {
      const configs = [
        createTestFieldConfig({
          name: "status",
          label: "Status",
          field_type: "select",
          options: ["active", "inactive", "pending"],
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);

      // Valid option should pass
      const validResult = schema.safeParse({ status: "active" });
      expect(validResult.success).toBe(true);

      // Invalid option should fail
      const invalidResult = schema.safeParse({ status: "invalid" });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe("grouped_breakdown fields", () => {
    it("should validate array of breakdown items", () => {
      const configs = [
        createTestFieldConfig({
          name: "breakdown",
          label: "Breakdown",
          field_type: "grouped_breakdown",
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);

      // Valid breakdown should pass
      const validResult = schema.safeParse({
        breakdown: [
          { brand: "Brand A", quantity: 10 },
          { brand: "Brand B", quantity: 5 },
        ],
      });
      expect(validResult.success).toBe(true);

      // Invalid structure should fail
      const invalidResult = schema.safeParse({
        breakdown: [{ brand: "", quantity: 10 }], // Empty brand
      });
      expect(invalidResult.success).toBe(false);
    });

    it("should enforce min_items", () => {
      const configs = [
        createTestFieldConfig({
          name: "breakdown",
          label: "Breakdown",
          field_type: "grouped_breakdown",
          validation_rules: {
            min_items: 2,
          },
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);

      // Too few items should fail
      const fewResult = schema.safeParse({
        breakdown: [{ brand: "Brand A", quantity: 10 }],
      });
      expect(fewResult.success).toBe(false);

      // Enough items should pass
      const validResult = schema.safeParse({
        breakdown: [
          { brand: "Brand A", quantity: 10 },
          { brand: "Brand B", quantity: 5 },
        ],
      });
      expect(validResult.success).toBe(true);
    });

    it("should enforce max_items", () => {
      const configs = [
        createTestFieldConfig({
          name: "breakdown",
          label: "Breakdown",
          field_type: "grouped_breakdown",
          validation_rules: {
            max_items: 2,
          },
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);

      // Too many items should fail
      const manyResult = schema.safeParse({
        breakdown: [
          { brand: "Brand A", quantity: 10 },
          { brand: "Brand B", quantity: 5 },
          { brand: "Brand C", quantity: 3 },
        ],
      });
      expect(manyResult.success).toBe(false);

      // Within limit should pass
      const validResult = schema.safeParse({
        breakdown: [
          { brand: "Brand A", quantity: 10 },
          { brand: "Brand B", quantity: 5 },
        ],
      });
      expect(validResult.success).toBe(true);
    });
  });

  describe("multiple fields", () => {
    it("should handle multiple fields in one schema", () => {
      const configs = [
        createTestFieldConfig({
          name: "name",
          label: "Name",
          field_type: "text",
          required: true,
        }),
        createTestFieldConfig({
          name: "age",
          label: "Age",
          field_type: "number",
          required: false,
        }),
        createTestFieldConfig({
          name: "email",
          label: "Email",
          field_type: "email",
          required: true,
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);

      const result = schema.safeParse({
        name: "John Doe",
        age: 30,
        email: "john@example.com",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("John Doe");
        expect(result.data.age).toBe(30);
        expect(result.data.email).toBe("john@example.com");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle empty field configs array", () => {
      const schema = createSchemaFromFieldConfig([]);
      const result = schema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.keys(result.data)).toHaveLength(0);
      }
    });

    it("should handle fields with no validation rules", () => {
      const configs = [
        createTestFieldConfig({
          name: "simple_field",
          label: "Simple Field",
          field_type: "text",
          validation_rules: null,
        }),
      ];

      const schema = createSchemaFromFieldConfig(configs);
      const result = schema.safeParse({ simple_field: "any value" });

      expect(result.success).toBe(true);
    });
  });
});
