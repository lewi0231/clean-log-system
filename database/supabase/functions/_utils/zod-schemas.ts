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
