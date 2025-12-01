import { z } from "zod";

export const workerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(1, "Phone number is required"),
});

export type WorkerFormData = z.infer<typeof workerSchema>;

export const locationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  address: z.string().min(1, "Address is required"),
  contact_person: z.string().min(1, "Contact person is required"),
  phone: z.string().optional(),
});

export type LocationFormData = z.infer<typeof locationSchema>;

export const fieldTypeSchema = z.enum([
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
]);

export const validationRulesSchema = z
  .object({
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    customMessage: z.string().optional(),
    min_items: z.number().int().min(0).optional(),
    max_items: z.number().int().min(1).optional(),
    allow_zero_quantities: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.minLength !== undefined && data.maxLength !== undefined) {
        return data.minLength <= data.maxLength;
      }
      return true;
    },
    {
      message: "Min length must be less than or equal to max length",
      path: ["minLength"],
    }
  )
  .refine(
    (data) => {
      if (data.min !== undefined && data.max !== undefined) {
        return data.min <= data.max;
      }
      return true;
    },
    {
      message: "Min value must be less than or equal to max value",
      path: ["min"],
    }
  )
  .refine(
    (data) => {
      if (data.min_items !== undefined && data.max_items !== undefined) {
        return data.min_items <= data.max_items;
      }
      return true;
    },
    {
      message: "Min items must be less than or equal to max items",
      path: ["min_items"],
    }
  );

export const fieldConfigSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .regex(
        /^[a-z0-9_]+$/,
        "Name must contain only lowercase letters, numbers, and underscores"
      ),
    label: z.string().min(1, "Label is required"),
    field_type: fieldTypeSchema,
    description: z.string().nullable(),
    required: z.boolean().default(false),
    order_position: z.number().int().min(0).optional(),
    validation_rules: validationRulesSchema.nullable(),
    options: z.array(z.string().min(1)).nullable(),
    mutually_exclusive_group: z.string().min(1).nullable().optional(),
    group_cluster: z.string().min(1).nullable().optional(),
  })
  .refine(
    (data) => {
      if (
        data.field_type === "select" ||
        data.field_type === "grouped_breakdown"
      ) {
        return data.options !== null && data.options.length > 0;
      }
      return true;
    },
    {
      message:
        "Options are required for select and grouped_breakdown field types",
      path: ["options"],
    }
  )
  .refine(
    (data) => {
      // If group_cluster is set, mutually_exclusive_group must also be set
      if (data.group_cluster && !data.mutually_exclusive_group) {
        return false;
      }
      return true;
    },
    {
      message: "Group cluster requires a mutually exclusive group to be set",
      path: ["group_cluster"],
    }
  );

export type FieldConfigFormData = z.infer<typeof fieldConfigSchema>;

export const organizationSettingsSchema = z.object({
  use_predefined_locations: z.boolean().default(true),
  business_mode: z
    .enum(["service_based", "resource_tracking"])
    .default("service_based"),
});

export type OrganizationSettingsFormData = z.infer<
  typeof organizationSettingsSchema
>;

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
  organisation: z.string().min(1, "Organisation name is required"),
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(20, "Password cannot be more than 20 characters")
    .refine(
      (password) => /[A-Z]/.test(password),
      "Password must contain at least one uppercase letter"
    )
    .refine(
      (password) => /[a-z]/.test(password),
      "Password must contain at least one lowercase letter"
    )
    .refine(
      (password) => /[0-9]/.test(password),
      "Password must contain at least one number"
    ),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;

/**
 * Convert Zod validation errors to a field errors object
 */
export function formatZodErrors<T extends Record<string, unknown>>(
  error: z.ZodError
): Partial<Record<keyof T, string>> {
  const fieldErrors: Partial<Record<keyof T, string>> = {};

  error.issues.forEach((issue) => {
    const path = issue.path[0] as keyof T;
    if (path) {
      fieldErrors[path] = issue.message;
    }
  });

  return fieldErrors;
}
