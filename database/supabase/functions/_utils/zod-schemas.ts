/**
 * Shared Zod validation schemas for Edge Functions
 * Provides reusable validation schemas for common data types
 */

import { z } from "zod";

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .email("Invalid email format")
  .toLowerCase()
  .trim();

/**
 * Non-negative number schema
 */
export const nonNegativeNumberSchema = z
  .number()
  .nonnegative("Value must be non-negative")
  .finite("Value must be finite");

/**
 * Positive number schema
 */
export const positiveNumberSchema = z
  .number()
  .positive("Value must be positive")
  .finite("Value must be finite");

/**
 * Currency code schema (ISO 4217)
 */
export const currencyCodeSchema = z.enum([
  "AUD",
  "USD",
  "GBP",
  "EUR",
  "CAD",
  "NZD",
]);

/**
 * Organization ID schema
 */
export const organizationIdSchema = uuidSchema;

/**
 * Location ID schema (nullable)
 */
export const locationIdSchema = uuidSchema.nullable();

/**
 * Field config ID schema (nullable)
 */
export const fieldConfigIdSchema = uuidSchema.nullable();

/**
 * Pricing scope schema
 */
export const pricingScopeSchema = z.enum(["field", "option", "base", "global"]);

/**
 * Pricing type schema
 */
export const pricingTypeSchema = z.enum([
  "unit",
  "fixed",
  "tiered",
  "percentage",
  "conditional",
]);

/**
 * Pricing context schema
 */
export const pricingContextSchema = z.enum(["customer", "worker"]);

/**
 * Worker payment type schema
 */
export const workerPaymentTypeSchema = z.enum([
  "same_structure",
  "percentage",
  "fixed_rate",
]);

/**
 * Role schema
 */
export const roleSchema = z.enum(["admin", "viewer"]);

/**
 * Business mode schema
 */
export const businessModeSchema = z.enum([
  "service_based",
  "resource_tracking",
]);

/**
 * Invoice status schema
 */
export const invoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
]);

/**
 * Payment status schema
 */
export const paymentStatusSchema = z.enum([
  "pending",
  "processing",
  "succeeded",
  "failed",
  "canceled",
  "refunded",
  "partially_refunded",
  "disputed",
]);

/**
 * Payment method schema
 */
export const paymentMethodSchema = z.enum([
  "stripe_checkout_card",
  "stripe_checkout_bank",
  "stripe_checkout_wallet",
  "bank_transfer_manual",
  "other",
]);

/**
 * ISO 8601 date string schema
 */
export const isoDateStringSchema = z.string().datetime();

/**
 * Percentage schema (0-100)
 */
export const percentageSchema = z
  .number()
  .min(0, "Percentage must be at least 0")
  .max(100, "Percentage must be at most 100");

/**
 * Helper to validate and parse request body with Zod schema
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | {
  success: false;
  error: string;
  issues: z.ZodIssue[];
} {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const issues = result.error.issues;
  const errorMessages = issues
    .map((issue) => {
      const path = issue.path.map(String).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(", ");

  return {
    success: false,
    error: `Validation failed: ${errorMessages}`,
    issues,
  };
}

/**
 * Common validation schemas for edge function requests
 */
export const commonSchemas = {
  uuid: uuidSchema,
  email: emailSchema,
  nonNegativeNumber: nonNegativeNumberSchema,
  positiveNumber: positiveNumberSchema,
  currencyCode: currencyCodeSchema,
  organizationId: organizationIdSchema,
  locationId: locationIdSchema,
  fieldConfigId: fieldConfigIdSchema,
  pricingScope: pricingScopeSchema,
  pricingType: pricingTypeSchema,
  pricingContext: pricingContextSchema,
  workerPaymentType: workerPaymentTypeSchema,
  role: roleSchema,
  businessMode: businessModeSchema,
  invoiceStatus: invoiceStatusSchema,
  paymentStatus: paymentStatusSchema,
  paymentMethod: paymentMethodSchema,
  isoDateString: isoDateStringSchema,
  percentage: percentageSchema,
};

/**
 * Schema for creating a pricing rule
 */
export const createPricingRuleSchema = z.object({
  organization_id: uuidSchema,
  scope: pricingScopeSchema,
  pricing_type: pricingTypeSchema,
  pricing_context: pricingContextSchema.optional(),
  field_config_id: uuidSchema.nullable().optional(),
  option_value: z.string().nullable().optional(),
  applies_to_field_type: z.string().nullable().optional(),
  location_hierarchy_id: uuidSchema.nullable().optional(),
  location_id: uuidSchema.nullable().optional(),
  currency: currencyCodeSchema.optional(),
  base_price: nonNegativeNumberSchema.nullable().optional(),
  percentage_rate: percentageSchema.nullable().optional(),
  minimum_quantity: nonNegativeNumberSchema.optional(),
  maximum_quantity: nonNegativeNumberSchema.optional(),
  tier_definition: z.record(z.any()).nullable().optional(),
  metadata: z.record(z.any()).optional(),
  worker_payment_type: workerPaymentTypeSchema.nullable().optional(),
  worker_payment_value: nonNegativeNumberSchema.nullable().optional(),
  priority: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  effective_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  created_by: uuidSchema.nullable().optional(),
  conditions: z.array(z.object({
    condition_field_config_id: uuidSchema,
    operator: z.string(),
    condition_value: z.union([z.string(), z.number()]),
    action_type: z.string(),
    action_value: z.union([z.string(), z.number()]),
    metadata: z.record(z.any()).optional(),
    priority: z.number().int().min(0).optional(),
  })).optional(),
}).refine(
  (data) => {
    // If scope is "field", field_config_id is required
    if (data.scope === "field" && !data.field_config_id) {
      return false;
    }
    // If scope is "option", both field_config_id and option_value are required
    if (
      data.scope === "option" && (!data.field_config_id || !data.option_value)
    ) {
      return false;
    }
    return true;
  },
  {
    message:
      "field_config_id is required for field scope, and both field_config_id and option_value are required for option scope",
  },
);

/**
 * Schema for updating a pricing rule
 */
export const updatePricingRuleSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema.optional(),
  scope: pricingScopeSchema.optional(),
  pricing_type: pricingTypeSchema.optional(),
  pricing_context: pricingContextSchema.optional(),
  field_config_id: uuidSchema.nullable().optional(),
  option_value: z.string().nullable().optional(),
  applies_to_field_type: z.string().nullable().optional(),
  location_hierarchy_id: uuidSchema.nullable().optional(),
  location_id: uuidSchema.nullable().optional(),
  currency: currencyCodeSchema.optional(),
  base_price: nonNegativeNumberSchema.nullable().optional(),
  percentage_rate: percentageSchema.nullable().optional(),
  minimum_quantity: nonNegativeNumberSchema.optional(),
  maximum_quantity: nonNegativeNumberSchema.optional(),
  tier_definition: z.record(z.any()).nullable().optional(),
  metadata: z.record(z.any()).optional(),
  worker_payment_type: workerPaymentTypeSchema.nullable().optional(),
  worker_payment_value: nonNegativeNumberSchema.nullable().optional(),
  priority: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  effective_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  updated_by: uuidSchema.nullable().optional(),
  conditions: z.array(z.object({
    condition_field_config_id: uuidSchema,
    operator: z.string(),
    condition_value: z.union([z.string(), z.number()]),
    action_type: z.string(),
    action_value: z.union([z.string(), z.number()]),
    metadata: z.record(z.any()).optional(),
    priority: z.number().int().min(0).optional(),
  })).optional(),
});
