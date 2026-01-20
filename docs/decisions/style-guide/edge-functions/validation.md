# Edge Function Validation

> Zod validation patterns for request validation.

---

## Zod Schema Pattern

### Schema Definition

```typescript
// _utils/zod-schemas.ts
import { z } from "zod";

// Reusable primitives
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const phoneSchema = z.string().min(8).max(20);

// Entity schemas
export const createWorkerSchema = z.object({
  organization_id: uuidSchema,
  name: z.string().min(1, "Name is required"),
  email: emailSchema,
  phone: phoneSchema.optional(),
});

export const updateWorkerSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  active: z.boolean().optional(),
});

export const listWorkersSchema = z.object({
  organization_id: uuidSchema,
  include_inactive: z.boolean().default(false),
  page: z.number().min(1).default(1),
  page_size: z.number().min(1).max(100).default(20),
});
```

---

## Validation Helper

```typescript
// _utils/validation.ts
import { z, ZodSchema, ZodError } from "zod";

interface ValidationSuccess<T> {
  success: true;
  data: T;
}

interface ValidationFailure {
  success: false;
  error: string;
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validate request body against a Zod schema
 */
export function validateRequest<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      return { success: false, error: `Validation failed: ${messages}` };
    }
    return { success: false, error: "Validation failed" };
  }
}
```

### Usage in Function

```typescript
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    
    // Validate request
    const validation = validateRequest(createWorkerSchema, body);
    if (!validation.success) {
      return errorResponse(validation.error, 400);
    }

    // validation.data is now typed as CreateWorkerInput
    const { organization_id, name, email, phone } = validation.data;

    // Continue with validated data...

  } catch (error) {
    return errorResponse(error);
  }
});
```

---

## Common Schema Patterns

### Required vs Optional

```typescript
const schema = z.object({
  // Required field
  name: z.string().min(1),
  
  // Optional field
  phone: z.string().optional(),
  
  // Optional with default
  active: z.boolean().default(true),
  
  // Nullable (can be null)
  deleted_at: z.string().datetime().nullable(),
});
```

### Enums and Unions

```typescript
// Using z.enum
const statusSchema = z.enum(["draft", "sent", "paid", "cancelled"]);

// Using z.union for complex types
const priceSchema = z.union([
  z.number(),
  z.object({ min: z.number(), max: z.number() }),
]);

// Literal types
const typeSchema = z.literal("invoice");
```

### Nested Objects

```typescript
const invoiceSchema = z.object({
  organization_id: uuidSchema,
  job_ids: z.array(uuidSchema).min(1),
  due_date: z.string().datetime(),
  line_items: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unit_price: z.number().nonnegative(),
  })).optional(),
});
```

### Refinements

```typescript
const dateRangeSchema = z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: "End date must be after start date" }
);

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .refine(
    (val) => /[A-Z]/.test(val),
    { message: "Password must contain uppercase letter" }
  )
  .refine(
    (val) => /[0-9]/.test(val),
    { message: "Password must contain a number" }
  );
```

---

## Type Extraction

Extract TypeScript types from Zod schemas:

```typescript
// Schema
export const createWorkerSchema = z.object({
  organization_id: uuidSchema,
  name: z.string().min(1),
  email: emailSchema,
  phone: phoneSchema.optional(),
});

// Extract type
export type CreateWorkerInput = z.infer<typeof createWorkerSchema>;
// Result: { organization_id: string; name: string; email: string; phone?: string }

// Use in function signature
async function createWorker(
  supabase: SupabaseClient,
  input: CreateWorkerInput
): Promise<Worker> {
  // ...
}
```

---

## Error Messages

### Custom Error Messages

```typescript
const schema = z.object({
  name: z.string({
    required_error: "Name is required",
    invalid_type_error: "Name must be a string",
  }).min(1, "Name cannot be empty"),
  
  email: z.string()
    .email("Please enter a valid email address"),
  
  age: z.number()
    .min(18, "Must be at least 18 years old")
    .max(120, "Invalid age"),
});
```

### Formatted Error Response

```typescript
function formatZodError(error: ZodError): string {
  return error.errors
    .map((e) => {
      const path = e.path.length > 0 ? `${e.path.join(".")}: ` : "";
      return `${path}${e.message}`;
    })
    .join("; ");
}

// Result: "name: Name is required; email: Please enter a valid email address"
```

---

## Partial Schemas for Updates

```typescript
// Full schema for create
const workerSchema = z.object({
  organization_id: uuidSchema,
  name: z.string().min(1),
  email: emailSchema,
  phone: phoneSchema.optional(),
});

// Partial schema for update (all fields optional except id)
const updateWorkerSchema = workerSchema
  .partial()
  .extend({
    id: uuidSchema,  // Required for update
  });

// Or manually define
const updateWorkerSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  active: z.boolean().optional(),
});
```

---

## Query Parameter Validation

For GET requests with query parameters:

```typescript
const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  page_size: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sort_by: z.enum(["name", "created_at"]).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

serve(async (req) => {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams);
  
  const validation = validateRequest(querySchema, params);
  if (!validation.success) {
    return errorResponse(validation.error, 400);
  }
  
  const { page, page_size, search, sort_by, sort_order } = validation.data;
  // ...
});
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| Zod for all validation | No manual validation |
| Schema in `_utils/zod-schemas.ts` | Centralized schemas |
| Extract types | Use `z.infer<>` for type safety |
| Custom error messages | User-friendly validation errors |
| Validate early | Before any processing |
| Partial for updates | Make fields optional |
