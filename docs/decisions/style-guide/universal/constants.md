# Constants and Configuration

> Universal patterns for managing constants, magic values, and configuration across all code.

---

## Why Constants Matter

Constants prevent "magic strings" and "magic numbers" from being scattered throughout the codebase:

- **Maintainability:** Change values in one place
- **Type Safety:** TypeScript infers literal types from `as const`
- **Discoverability:** Developers can find all valid values in one location
- **Refactoring:** IDE can track all usages when renaming

---

## Const Objects with Type Derivation

Use `as const` objects with derived TypeScript types.

```typescript
// ✅ Good: Status values as const object
export const InvoiceStatus = {
  DRAFT: "draft",
  SENT: "sent",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
} as const;

// Type derived from const object
export type InvoiceStatus =
  (typeof InvoiceStatus)[keyof typeof InvoiceStatus];
// Result: "draft" | "sent" | "paid" | "overdue" | "cancelled"

// Usage
function updateStatus(status: InvoiceStatus) {
  if (status === InvoiceStatus.PAID) {
    // TypeScript ensures only valid values
  }
}
```

**Benefits:**
- IDE suggests `InvoiceStatus.DRAFT`, `InvoiceStatus.SENT`, etc.
- Type only allows defined values
- Single source of truth for value AND type
- Type automatically updates when constants change

---

## Configuration Defaults with Factory Functions

Combine default values with factory functions for creating config objects.

```typescript
// Individual defaults for flexibility
export const DEFAULT_INVOICE_TITLE = "Tax Invoice" as const;
export const DEFAULT_DUE_DAYS = 14;

export const DEFAULT_SERVICE_ADDRESS_CONFIG = {
  source: "auto",
  location_fields: ["name", "address", "contact_person", "email", "phone"],
  form_fields: [],
} as const;

// Factory function combines defaults with required values
export function getDefaultInvoiceTemplateConfig(
  organizationId: string,
) {
  return {
    organization_id: organizationId,
    invoice_title: DEFAULT_INVOICE_TITLE,
    show_logo: true,
    show_abn: true,
    service_address_config: DEFAULT_SERVICE_ADDRESS_CONFIG,
  };
}
```

**Benefits:**
- Individual defaults can be used separately or together
- Factory function provides type-safe object creation
- Defaults are importable for test assertions
- No repeated default values across codebase

---

## Lookup Maps for Labels and Descriptions

Use typed Record objects for human-readable labels.

```typescript
// Labels for UI display
export const RATING_DIMENSION_LABELS: Record<string, string> = {
  overall: "Overall Satisfaction",
  quality: "Service Quality",
  communication: "Communication",
  value: "Value for Money",
};

// Descriptions for tooltips/help text
export const RATING_DIMENSION_DESCRIPTIONS: Record<string, string> = {
  overall: "Your overall satisfaction with the service",
  quality: "How would you rate the quality of work performed?",
};

// Helper functions for safe access with fallbacks
export function getRatingDimensionLabel(dimension: string): string {
  return RATING_DIMENSION_LABELS[dimension] || dimension;
}
```

**Benefits:**
- Business logic separate from display text
- i18n ready - easy to swap for translation functions
- Safe fallbacks handle missing keys gracefully
- All user-facing text centralized

---

## When to Use Constants Files

| Scenario | Use Constants File? | Example |
|----------|---------------------|---------|
| Status values, types, categories | ✅ Yes | `InvoiceStatus.DRAFT` |
| Default configuration values | ✅ Yes | `DEFAULT_CURRENCY` |
| UI labels and descriptions | ✅ Yes | `RATING_DIMENSION_LABELS` |
| Validation limits (max length, etc.) | ✅ Yes | `MAX_FILE_SIZE` |
| API endpoint paths | ✅ Yes | `API_ENDPOINTS.WORKERS` |
| Environment-specific values | ❌ No - use `.env` | Database URLs, API keys |
| Component-specific magic values | ⚠️ Maybe | Consider if reused elsewhere |
| One-off numeric values | ⚠️ Maybe | Use descriptive variable name at minimum |

---

## Directory Structure

```
lib/constants/
├── index.ts                    # Barrel export for all constants
├── invoice-constants.ts        # Invoice-related constants
├── payment-constants.ts        # Payment status, methods
├── validation-limits.ts        # Max lengths, sizes, counts
└── [domain]-constants.ts       # Other domain-specific constants
```

### Barrel Export Pattern

```typescript
// lib/constants/index.ts
export * from "./invoice-constants";
export * from "./payment-constants";
export * from "./validation-limits";

// Usage
import { InvoiceStatus, PaymentMethod, MAX_FILE_SIZE } from "@/lib/constants";
```

---

## Rules

### RULE: No Magic Strings in Business Logic

String literals used for comparison or status checks MUST be defined as constants.

```typescript
// ❌ Bad: Magic string
if (invoice.status === "paid") { }

// ✅ Good: Named constant
import { InvoiceStatus } from "@/lib/constants";
if (invoice.status === InvoiceStatus.PAID) { }
```

### RULE: No Magic Numbers

Numeric values with business meaning MUST be named constants.

```typescript
// ❌ Bad: Magic numbers
if (retryCount > 3) { }
const timeout = 5000;
const maxSize = 10485760;

// ✅ Good: Named constants with context
const MAX_RETRY_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

if (retryCount > MAX_RETRY_ATTEMPTS) { }
```

### RULE: Use `as const` for Literal Types

Constant objects MUST use `as const` assertion for type inference.

```typescript
// ❌ Bad: Types inferred as string
export const STATUS = {
  ACTIVE: "active",    // type: string
  INACTIVE: "inactive" // type: string
};

// ✅ Good: Types inferred as literals
export const STATUS = {
  ACTIVE: "active",    // type: "active"
  INACTIVE: "inactive" // type: "inactive"
} as const;
```

### RULE: Derive Types from Constants

Types representing constant values SHOULD be derived from the const object, not defined separately.

```typescript
// ❌ Bad: Type defined separately (can drift)
export const STATUS = { ACTIVE: "active", INACTIVE: "inactive" } as const;
export type Status = "active" | "inactive"; // Manual duplication

// ✅ Good: Type derived from const
export const STATUS = { ACTIVE: "active", INACTIVE: "inactive" } as const;
export type Status = (typeof STATUS)[keyof typeof STATUS]; // Auto-derived
```

### RULE: Constants File Naming

Constants files MUST use kebab-case and describe their domain.

```
✅ Correct:
lib/constants/invoice-constants.ts
lib/constants/payment-status.ts
lib/constants/validation-limits.ts

❌ Incorrect:
lib/constants/CONSTANTS.ts
lib/constants/invoiceConstants.ts
lib/constants/misc.ts
```

### RULE: Co-locate Related Constants

Related constants SHOULD be in the same file for discoverability.

```typescript
// ✅ Good: Related constants together in invoice-constants.ts
export const InvoiceStatus = { ... } as const;
export type InvoiceStatus = ...;

export const InvoiceTitleOptions = { ... } as const;
export type InvoiceTitleOption = ...;

export const DEFAULT_DUE_DAYS = 14;
export const MAX_LINE_ITEMS = 100;
```

---

## Sharing Constants Between Frontend and Backend

When constants are used in both frontend and backend:

**Option 1: Mirror Files (Current Approach)**
```
dashboard/lib/constants/invoice-template-defaults.ts
database/supabase/functions/_utils/invoice-template-defaults.ts
```

**Option 2: Shared Package (Preferred When Possible)**
```
shared/constants/invoice-template-defaults.ts
→ Import in both dashboard and edge functions
```

**Note:** Edge functions using Deno have import constraints. Evaluate if sharing via the `shared` package is feasible for your use case.

---

## Rules Summary

| Rule | Description |
|------|-------------|
| No magic strings | Use named constants for status checks |
| No magic numbers | Name all business-meaningful numbers |
| Use `as const` | Preserve literal types |
| Derive types | Don't duplicate type definitions |
| kebab-case files | `invoice-constants.ts` |
| Co-locate | Related constants in same file |
| Barrel exports | Use `index.ts` for clean imports |
