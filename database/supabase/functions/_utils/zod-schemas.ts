// deno-lint-ignore-file no-import-prefix
/**
 * Shared Zod validation schemas for Edge Functions
 * Provides reusable validation schemas for common data types
 */

// Use fully qualified URL to avoid import map resolution issues across function boundaries
// This is necessary because _utils files are shared across functions with different deno.json configs
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Inline dependency is intentional for cross-function compatibility
import { z } from "https://esm.sh/zod@3.23.8";

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Email validation schema
 */
export const emailSchema = z.string().email("Invalid email format").toLowerCase().trim();

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
export const currencyCodeSchema = z.enum(["AUD", "USD", "GBP", "EUR", "CAD", "NZD"]);

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
export const pricingTypeSchema = z.enum(["unit", "fixed", "tiered", "percentage", "conditional"]);

/**
 * Pricing context schema
 */
export const pricingContextSchema = z.enum(["customer", "worker"]);

/**
 * Worker payment type schema
 */
export const workerPaymentTypeSchema = z.enum(["same_structure", "percentage", "fixed_rate"]);

/**
 * Role schema
 */
export const roleSchema = z.enum(["admin", "viewer"]);

/**
 * Business mode schema
 */
export const businessModeSchema = z.enum(["service_based", "resource_tracking"]);

/**
 * Invoice status schema
 */
export const invoiceStatusSchema = z.enum([
  "draft",
  "pending_review",
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
  data: unknown
):
  | { success: true; data: T }
  | {
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
    .map((issue: z.ZodIssue) => {
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
export const createPricingRuleSchema = z
  .object({
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
    conditions: z
      .array(
        z.object({
          condition_field_config_id: uuidSchema,
          operator: z.string(),
          condition_value: z.union([z.string(), z.number()]),
          action_type: z.string(),
          action_value: z.union([z.string(), z.number()]),
          metadata: z.record(z.any()).optional(),
          priority: z.number().int().min(0).optional(),
        })
      )
      .optional(),
  })
  .refine(
    (data) => {
      // If scope is "field", field_config_id is required
      if (data.scope === "field" && !data.field_config_id) {
        return false;
      }
      // If scope is "option", both field_config_id and option_value are required
      if (data.scope === "option" && (!data.field_config_id || !data.option_value)) {
        return false;
      }
      return true;
    },
    {
      message:
        "field_config_id is required for field scope, and both field_config_id and option_value are required for option scope",
    }
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
  conditions: z
    .array(
      z.object({
        condition_field_config_id: uuidSchema,
        operator: z.string(),
        condition_value: z.union([z.string(), z.number()]),
        action_type: z.string(),
        action_value: z.union([z.string(), z.number()]),
        metadata: z.record(z.any()).optional(),
        priority: z.number().int().min(0).optional(),
      })
    )
    .optional(),
});

/**
 * Schema for creating a payment link
 */
export const createPaymentLinkSchema = z.object({
  invoice_id: uuidSchema,
  organization_id: uuidSchema,
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

/**
 * Schema for creating an invoice
 */
export const createInvoiceSchema = z.object({
  organization_id: uuidSchema,
  job_ids: z.array(uuidSchema).min(1, "At least one job ID is required"),
  due_date: z.string().datetime("Invalid due date format"),
  notes: z.string().nullable().optional(),
  email: emailSchema.optional(), // Optional email for organization membership verification
});

/**
 * Schema for updating invoice status
 */
export const updateInvoiceStatusSchema = z.object({
  invoice_id: uuidSchema,
  organization_id: uuidSchema,
  status: z.enum(["draft", "pending_review", "sent", "paid", "overdue", "cancelled"]),
  resend: z.boolean().optional(),
  /** Display name of the user sending the invoice (shown in email sign-off) */
  sender_display_name: z.string().max(200).optional(),
});

/**
 * Schema for calculating invoice
 */
export const calculateInvoiceSchema = z.object({
  organization_id: uuidSchema,
  job_ids: z.array(uuidSchema).min(1, "At least one job ID is required"),
});

/**
 * Schema for listing jobs (optionally include test data)
 */
export const listJobsSchema = z.object({
  organization_id: uuidSchema,
  include_tests: z.boolean().optional(),
  worker_id: uuidSchema.optional(),
  mine: z.boolean().optional(),
});

/**
 * Schema for listing invoices (optionally include test data)
 */
export const listInvoicesSchema = z.object({
  organization_id: uuidSchema,
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  include_tests: z.boolean().optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  page: z.number().int().min(1).optional(),
  page_size: z.number().int().min(1).max(100).optional(),
});

/** Body for `list-form-sections` (secured org scope). */
export const listFormSectionsBodySchema = z.object({
  organization_id: uuidSchema,
});

/**
 * Schema for getting invoice details
 */
export const getInvoiceDetailsSchema = z.object({
  invoice_id: uuidSchema,
});

/**
 * Schema for deleting test data (job and/or invoice)
 */
export const deleteTestDataSchema = z
  .object({
    organization_id: uuidSchema,
    job_id: uuidSchema.optional(),
    invoice_id: uuidSchema.optional(),
  })
  .refine((data) => Boolean(data.job_id || data.invoice_id), {
    message: "Either job_id or invoice_id is required",
  });

/**
 * Worker rate card modifier type schema
 * - per_unit: Bonus per unit of output (e.g., $0.50/car)
 * - flat: Fixed bonus per job (e.g., $20/job)
 * - multiplier: Percentage boost to time-share (e.g., 1.2 = 20% more)
 * - team_percentage: Percentage of other team members' earnings (e.g., 10% of team wages)
 * - split_weight: Relative share of the worker payment pool (used with hours × weight)
 */
export const modifierTypeSchema = z.enum([
  "per_unit",
  "flat",
  "multiplier",
  "team_percentage",
  "split_weight",
]);

/**
 * Schema for listing worker rate cards
 */
export const listRateCardsSchema = z.object({
  action: z.literal("list"),
  organization_id: uuidSchema,
});

/**
 * Schema for creating a worker rate card
 */
export const createRateCardSchema = z.object({
  action: z.literal("create"),
  organization_id: uuidSchema,
  worker_id: uuidSchema,
  modifier_type: modifierTypeSchema,
  modifier_value: positiveNumberSchema,
  currency: currencyCodeSchema.optional(),
  effective_from: z.string().date().optional(),
  effective_to: z.string().date().nullable().optional(),
  role_title: z.string().min(1).nullable().optional(),
  notes: z.string().nullable().optional(),
  field_config_ids: z.array(uuidSchema).optional(),
});

/**
 * Schema for updating a worker rate card
 */
export const updateRateCardSchema = z.object({
  action: z.literal("update"),
  organization_id: uuidSchema,
  id: uuidSchema,
  modifier_type: modifierTypeSchema.optional(),
  modifier_value: positiveNumberSchema.optional(),
  effective_from: z.string().date().optional(),
  effective_to: z.string().date().nullable().optional(),
  role_title: z.string().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  field_config_ids: z.array(uuidSchema).optional(),
});

/**
 * Schema for deactivating a worker rate card
 */
export const deactivateRateCardSchema = z.object({
  action: z.literal("deactivate"),
  organization_id: uuidSchema,
  id: uuidSchema,
});

/**
 * Schema for deleting a worker rate card
 */
export const deleteRateCardSchema = z.object({
  action: z.literal("delete"),
  organization_id: uuidSchema,
  id: uuidSchema,
});

/**
 * Discriminated union schema for all rate card operations
 */
export const rateCardRequestSchema = z.discriminatedUnion("action", [
  listRateCardsSchema,
  createRateCardSchema,
  updateRateCardSchema,
  deactivateRateCardSchema,
  deleteRateCardSchema,
]);
