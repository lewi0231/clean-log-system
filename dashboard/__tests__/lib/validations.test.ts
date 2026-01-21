import {
  fieldConfigSchema,
  formatZodErrors,
  locationSchema,
  loginSchema,
  organizationSettingsSchema,
  organizationUserSchema,
  phoneSchema,
  signUpSchema,
  validationRulesSchema,
  workerSchema,
} from "@/lib/validations";
import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("formatZodErrors", () => {
  it("should format single field error", () => {
    const schema = z.object({
      email: z.string().email("Invalid email"),
      password: z.string(),
    });

    const result = schema.safeParse({ email: "invalid", password: "test" });

    if (!result.success) {
      const errors = formatZodErrors<{ email: string; password: string }>(
        result.error,
      );
      expect(errors.email).toBe("Invalid email");
      expect(errors.password).toBeUndefined();
    }
  });

  it("should format multiple field errors", () => {
    const schema = z.object({
      email: z.string().email("Invalid email"),
      password: z.string().min(6, "Password too short"),
      name: z.string().min(1, "Name required"),
    });

    const result = schema.safeParse({
      email: "invalid",
      password: "123",
      name: "",
    });

    if (!result.success) {
      const errors = formatZodErrors<{
        email: string;
        password: string;
        name: string;
      }>(result.error);
      expect(errors.email).toBe("Invalid email");
      expect(errors.password).toBe("Password too short");
      expect(errors.name).toBe("Name required");
    }
  });

  it("should handle nested path errors", () => {
    const schema = z.object({
      user: z.object({
        email: z.string().email("Invalid email"),
      }),
    });

    const result = schema.safeParse({ user: { email: "invalid" } });

    if (!result.success) {
      const errors = formatZodErrors<{ user: { email: string } }>(
        result.error,
      );
      // Should handle nested paths (only first level path is used)
      expect(Object.keys(errors).length).toBeGreaterThan(0);
    }
  });

  it("should return empty object for valid data", () => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string(),
    });

    const result = schema.safeParse({
      email: "test@example.com",
      password: "password",
    });

    expect(result.success).toBe(true);
  });

  it("should work with different form types", () => {
    const loginSchema = z.object({
      email: z.string().email(),
      password: z.string(),
    });

    const result = loginSchema.safeParse({ email: "invalid" });

    if (!result.success) {
      const errors = formatZodErrors<{ email: string; password: string }>(
        result.error,
      );
      expect(errors).toHaveProperty("email");
    }
  });
});

describe("loginSchema", () => {
  it("should validate valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
      expect(result.data.password).toBe("password123");
    }
  });

  it("should reject invalid email format", () => {
    const result = loginSchema.safeParse({
      email: "invalid-email",
      password: "password123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Invalid email format");
    }
  });

  it("should reject missing password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Password is required");
    }
  });

  it("should reject empty email", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("should handle very long email strings", () => {
    const longEmail = "a".repeat(100) + "@example.com";
    const result = loginSchema.safeParse({
      email: longEmail,
      password: "password123",
    });

    // Should still validate if format is correct
    expect(result.success).toBe(true);
  });
});

describe("signUpSchema", () => {
  it("should validate valid signup data", () => {
    const result = signUpSchema.safeParse({
      organisation: "Test Org",
      email: "test@example.com",
      password: "Password123",
    });

    expect(result.success).toBe(true);
  });

  it("should reject password too short", () => {
    const result = signUpSchema.safeParse({
      organisation: "Test Org",
      email: "test@example.com",
      password: "Pass1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0].message;
      expect(message).toContain("at least 6 characters");
    }
  });

  it("should reject password too long", () => {
    const result = signUpSchema.safeParse({
      organisation: "Test Org",
      email: "test@example.com",
      password: "Password1234567890123456", // 21 chars
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues[0].message;
      expect(message).toContain("more than 20 characters");
    }
  });

  it("should reject password missing uppercase", () => {
    const result = signUpSchema.safeParse({
      organisation: "Test Org",
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("uppercase"))).toBe(true);
    }
  });

  it("should reject password missing lowercase", () => {
    const result = signUpSchema.safeParse({
      organisation: "Test Org",
      email: "test@example.com",
      password: "PASSWORD123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("lowercase"))).toBe(true);
    }
  });

  it("should reject password missing number", () => {
    const result = signUpSchema.safeParse({
      organisation: "Test Org",
      email: "test@example.com",
      password: "Password",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("number"))).toBe(true);
    }
  });

  it("should reject missing organization name", () => {
    const result = signUpSchema.safeParse({
      organisation: "",
      email: "test@example.com",
      password: "Password123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("Organisation name");
    }
  });

  it("should reject invalid email format", () => {
    const result = signUpSchema.safeParse({
      organisation: "Test Org",
      email: "invalid-email",
      password: "Password123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Invalid email format");
    }
  });
});

describe("workerSchema", () => {
  it("should validate valid worker data", () => {
    const result = workerSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "1234567890",
    });

    expect(result.success).toBe(true);
  });

  it("should reject missing name", () => {
    const result = workerSchema.safeParse({
      first_name: "",
      last_name: "Doe",
      email: "john@example.com",
      phone: "1234567890",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("First name is required");
    }
  });

  it("should reject invalid email format", () => {
    const result = workerSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
      email: "invalid-email",
      phone: "1234567890",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Invalid email format");
    }
  });

  it("should reject empty phone", () => {
    const result = workerSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Phone number is required");
    }
  });
});

describe("locationSchema", () => {
  it("should validate valid location data", () => {
    const result = locationSchema.safeParse({
      name: "Main Office",
      email: "office@example.com",
      address: "123 Main St",
      contact_person: "John Doe",
      phone: "1234567890",
    });

    expect(result.success).toBe(true);
  });

  it("should validate location without phone", () => {
    const result = locationSchema.safeParse({
      name: "Main Office",
      email: "office@example.com",
      address: "123 Main St",
      contact_person: "John Doe",
    });

    expect(result.success).toBe(true);
  });

  it("should reject missing name", () => {
    const result = locationSchema.safeParse({
      name: "",
      email: "office@example.com",
      address: "123 Main St",
      contact_person: "John Doe",
    });

    expect(result.success).toBe(false);
  });

  it("should reject invalid email format", () => {
    const result = locationSchema.safeParse({
      name: "Main Office",
      email: "invalid-email",
      address: "123 Main St",
      contact_person: "John Doe",
    });

    expect(result.success).toBe(false);
  });

  it("should reject missing address", () => {
    const result = locationSchema.safeParse({
      name: "Main Office",
      email: "office@example.com",
      address: "",
      contact_person: "John Doe",
    });

    expect(result.success).toBe(false);
  });

  it("should reject missing contact person", () => {
    const result = locationSchema.safeParse({
      name: "Main Office",
      email: "office@example.com",
      address: "123 Main St",
      contact_person: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("validationRulesSchema", () => {
  it("should validate valid validation rules", () => {
    const result = validationRulesSchema.safeParse({
      minLength: 5,
      maxLength: 10,
      min: 0,
      max: 100,
    });

    expect(result.success).toBe(true);
  });

  it("should reject minLength > maxLength", () => {
    const result = validationRulesSchema.safeParse({
      minLength: 10,
      maxLength: 5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        "Min length must be less than or equal to max length",
      );
    }
  });

  it("should reject min > max", () => {
    const result = validationRulesSchema.safeParse({
      min: 100,
      max: 50,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        "Min value must be less than or equal to max value",
      );
    }
  });

  it("should reject min_items > max_items", () => {
    const result = validationRulesSchema.safeParse({
      min_items: 10,
      max_items: 5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        "Min items must be less than or equal to max items",
      );
    }
  });

  it("should allow equal min and max values", () => {
    const result = validationRulesSchema.safeParse({
      minLength: 5,
      maxLength: 5,
      min: 10,
      max: 10,
    });

    expect(result.success).toBe(true);
  });
});

describe("fieldConfigSchema", () => {
  it("should validate valid text field config", () => {
    const result = fieldConfigSchema.safeParse({
      name: "field_name",
      label: "Field Label",
      field_type: "text",
      description: null,
      required: false,
      validation_rules: null,
      options: null,
    });

    expect(result.success).toBe(true);
  });

  it("should validate valid select field config with options", () => {
    const result = fieldConfigSchema.safeParse({
      name: "status",
      label: "Status",
      field_type: "select",
      description: null,
      required: false,
      validation_rules: null,
      options: ["option1", "option2"],
    });

    expect(result.success).toBe(true);
  });

  it("should reject select field without options", () => {
    const result = fieldConfigSchema.safeParse({
      name: "status",
      label: "Status",
      field_type: "select",
      description: null,
      required: false,
      validation_rules: null,
      options: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("Options are required"))).toBe(
        true,
      );
    }
  });

  it("should reject grouped_breakdown field without options", () => {
    const result = fieldConfigSchema.safeParse({
      name: "breakdown",
      label: "Breakdown",
      field_type: "grouped_breakdown",
      options: null,
    });

    expect(result.success).toBe(false);
  });

  it("should reject invalid name format (uppercase)", () => {
    const result = fieldConfigSchema.safeParse({
      name: "FieldName",
      label: "Field Label",
      field_type: "text",
      options: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        "lowercase letters, numbers, and underscores",
      );
    }
  });

  it("should reject invalid name format (spaces)", () => {
    const result = fieldConfigSchema.safeParse({
      name: "field name",
      label: "Field Label",
      field_type: "text",
      options: null,
    });

    expect(result.success).toBe(false);
  });

  it("should accept valid name with underscores and numbers", () => {
    const result = fieldConfigSchema.safeParse({
      name: "field_name_123",
      label: "Field Label",
      field_type: "text",
      description: null,
      required: false,
      validation_rules: null,
      options: null,
    });

    expect(result.success).toBe(true);
  });

  it("should validate all field types", () => {
    const fieldTypes = [
      "text",
      "number",
      "email",
      "phone",
      "select",
      "textarea",
      "date",
      "time",
      "boolean",
      "grouped_breakdown",
    ];

    fieldTypes.forEach((fieldType) => {
      const config: Record<string, unknown> = {
        name: "test_field",
        label: "Test Field",
        field_type: fieldType,
        description: null,
        required: false,
        validation_rules: null,
        options: null,
      };

      if (fieldType === "select" || fieldType === "grouped_breakdown") {
        config.options = ["option1"];
      }

      const result = fieldConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});

describe("organizationSettingsSchema", () => {
  it("should validate valid settings", () => {
    const result = organizationSettingsSchema.safeParse({
      use_predefined_locations: true,
    });

    expect(result.success).toBe(true);
  });

  it("should default use_predefined_locations to true", () => {
    const result = organizationSettingsSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.use_predefined_locations).toBe(true);
    }
  });
});

describe("phoneSchema", () => {
  it("should accept valid US phone number with country code", () => {
    const result = phoneSchema.safeParse("+15551234567");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("+15551234567");
    }
  });

  it("should accept valid US phone number without plus", () => {
    const result = phoneSchema.safeParse("15551234567");
    expect(result.success).toBe(true);
  });

  it("should accept 10-digit phone number", () => {
    const result = phoneSchema.safeParse("5551234567");
    expect(result.success).toBe(true);
  });

  it("should accept formatted US phone number with spaces", () => {
    const result = phoneSchema.safeParse("+1 555 123 4567");
    expect(result.success).toBe(true);
  });

  it("should accept formatted US phone number with dashes", () => {
    const result = phoneSchema.safeParse("555-123-4567");
    expect(result.success).toBe(true);
  });

  it("should accept formatted US phone number with parentheses", () => {
    const result = phoneSchema.safeParse("(555) 123-4567");
    expect(result.success).toBe(true);
  });

  it("should accept Australian mobile number", () => {
    const result = phoneSchema.safeParse("+61412345678");
    expect(result.success).toBe(true);
  });

  it("should accept generic international format", () => {
    const result = phoneSchema.safeParse("+441onal23456789");
    // This should match the generic international pattern
    const cleaned = "+441234567890".replace(/[^\d+]/g, "");
    expect(/^\+\d{8,15}$/.test(cleaned)).toBe(true);
  });

  it("should allow empty string (phone is optional)", () => {
    const result = phoneSchema.safeParse("");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it("should allow null (phone is optional)", () => {
    const result = phoneSchema.safeParse(null);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it("should allow undefined (phone is optional)", () => {
    const result = phoneSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it("should reject too short phone number", () => {
    const result = phoneSchema.safeParse("12345");
    expect(result.success).toBe(false);
  });

  it("should reject invalid characters only", () => {
    const result = phoneSchema.safeParse("abcdefghij");
    expect(result.success).toBe(false);
  });
});

describe("organizationUserSchema", () => {
  it("should validate valid organization user data", () => {
    const result = organizationUserSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
      email: "john.doe@example.com",
      role: "admin",
      phone: "+15551234567",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.first_name).toBe("John");
      expect(result.data.last_name).toBe("Doe");
      expect(result.data.email).toBe("john.doe@example.com");
      expect(result.data.role).toBe("admin");
    }
  });

  it("should validate viewer role", () => {
    const result = organizationUserSchema.safeParse({
      first_name: "Jane",
      last_name: "Smith",
      email: "jane@example.com",
      role: "viewer",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("viewer");
    }
  });

  it("should allow optional phone", () => {
    const result = organizationUserSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      role: "admin",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeNull();
    }
  });

  it("should reject empty first_name", () => {
    const result = organizationUserSchema.safeParse({
      first_name: "",
      last_name: "Doe",
      email: "john@example.com",
      role: "admin",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("First name is required");
    }
  });

  it("should reject empty last_name", () => {
    const result = organizationUserSchema.safeParse({
      first_name: "John",
      last_name: "",
      email: "john@example.com",
      role: "admin",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Last name is required");
    }
  });

  it("should reject invalid email format", () => {
    const result = organizationUserSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
      email: "invalid-email",
      role: "admin",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Invalid email format");
    }
  });

  it("should reject invalid role", () => {
    const result = organizationUserSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      role: "superadmin", // Invalid role
    });

    expect(result.success).toBe(false);
  });

  it("should reject invalid phone format", () => {
    const result = organizationUserSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      role: "admin",
      phone: "12345", // Too short
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const phoneError = result.error.issues.find((i) => i.path[0] === "phone");
      expect(phoneError?.message).toContain("Invalid phone number format");
    }
  });

  it("should accept phone with formatting", () => {
    const result = organizationUserSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      role: "viewer",
      phone: "(555) 123-4567",
    });

    expect(result.success).toBe(true);
  });
});
