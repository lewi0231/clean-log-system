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
  "boolean",
]);

export const validationRulesSchema = z
  .object({
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    customMessage: z.string().optional(),
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
  );

export const fieldConfigSchema = z.object({
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
});

export type FieldConfigFormData = z.infer<typeof fieldConfigSchema>;

export const organizationSettingsSchema = z.object({
  use_predefined_locations: z.boolean().default(true),
});

export type OrganizationSettingsFormData = z.infer<
  typeof organizationSettingsSchema
>;
