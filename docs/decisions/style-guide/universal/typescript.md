# TypeScript Patterns

> Universal TypeScript patterns that apply to all code in this monorepo (dashboard, mobile-app, edge-functions).

---

## Strict Mode

All TypeScript configurations MUST enable strict mode.

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

**Why:** Catches type errors early, improves IDE autocomplete, and prevents runtime bugs.

---

## Type Annotations

### Explicit Return Types for Public APIs

Functions exported from modules SHOULD have explicit return types.

```typescript
// ✅ Good: Explicit return type
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ Good: Explicit interface for complex returns
interface CalculationResult {
  total: number;
  itemCount: number;
}

export function calculateSummary(items: Item[]): CalculationResult {
  return {
    total: items.reduce((sum, item) => sum + item.price, 0),
    itemCount: items.length,
  };
}

// ❌ Avoid: Implicit return type for exported functions
export function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### Let TypeScript Infer Local Variables

```typescript
// ✅ Good: Let TS infer
const count = 0;
const name = "John";
const items = [1, 2, 3];

// ❌ Unnecessary: Redundant annotations
const count: number = 0;
const name: string = "John";
const items: number[] = [1, 2, 3];
```

### Use `as const` for Literal Types

```typescript
// ✅ Good: Literal type preserved
const STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;
// Type: { readonly ACTIVE: "active"; readonly INACTIVE: "inactive" }

// ❌ Bad: Types widen to string
const STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};
// Type: { ACTIVE: string; INACTIVE: string }
```

---

## Interfaces vs Types

### Use Interfaces for Object Shapes

```typescript
// ✅ Preferred: Interface for object shapes
interface Worker {
  id: string;
  name: string;
  email: string;
}

// ✅ Interfaces can be extended
interface WorkerWithRole extends Worker {
  role: "admin" | "worker";
}
```

### Use Types for Unions and Computed Types

```typescript
// ✅ Good: Type for unions
type Status = "active" | "inactive" | "pending";

// ✅ Good: Type for computed/derived types
type WorkerKeys = keyof Worker;
type PartialWorker = Partial<Worker>;

// ✅ Good: Type derived from const
const STATUSES = ["active", "inactive", "pending"] as const;
type Status = (typeof STATUSES)[number];
```

---

## Nullability

### Prefer `null` for Database Values

```typescript
// ✅ Good: null for intentional absence (database pattern)
interface Job {
  completed_at: string | null; // Not completed yet
  deleted_at: string | null;   // Not deleted
}
```

### Prefer `undefined` for Optional Parameters

```typescript
// ✅ Good: undefined for optional parameters
interface Options {
  limit?: number;     // Optional, may not be provided
  offset?: number;
}

function fetchData(options?: Options) {
  const limit = options?.limit ?? 10;
}
```

### Avoid Union of Both

```typescript
// ❌ Avoid: Mixing null and undefined
interface Confusing {
  value: string | null | undefined;
}
```

---

## Generics

### Use Descriptive Generic Names

```typescript
// ✅ Good: Descriptive generic names
function processItems<TItem>(items: TItem[]): TItem[] {
  return items;
}

interface ApiResponse<TData> {
  data: TData;
  error: string | null;
}

// ❌ Avoid: Single-letter generics (except for simple cases)
function process<T, U, V>(a: T, b: U): V {
  // Unclear what T, U, V represent
}
```

### Constrain Generics When Possible

```typescript
// ✅ Good: Constrained generic
function getProperty<TObj, TKey extends keyof TObj>(
  obj: TObj,
  key: TKey
): TObj[TKey] {
  return obj[key];
}

// ✅ Good: Constrained to specific shape
function processEntity<T extends { id: string }>(entity: T): string {
  return entity.id;
}
```

---

## Enums vs Const Objects

### Prefer Const Objects Over Enums

```typescript
// ✅ Preferred: Const object with derived type
export const InvoiceStatus = {
  DRAFT: "draft",
  SENT: "sent",
  PAID: "paid",
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

// Usage
function updateStatus(status: InvoiceStatus) {
  if (status === InvoiceStatus.PAID) {
    // ...
  }
}

// ❌ Avoid: TypeScript enums (runtime overhead, less flexible)
enum InvoiceStatus {
  DRAFT = "draft",
  SENT = "sent",
  PAID = "paid",
}
```

**Why const objects:**
- No runtime overhead (enums generate extra JS code)
- Work better with type inference
- Can be iterated with `Object.values()`
- More predictable behavior

---

## Type Guards

### Use Type Predicates for Custom Guards

```typescript
// ✅ Good: Type predicate
function isWorker(value: unknown): value is Worker {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}

// Usage
if (isWorker(data)) {
  console.log(data.name); // TypeScript knows data is Worker
}
```

### Use `in` Operator for Discriminated Unions

```typescript
interface SuccessResponse {
  success: true;
  data: unknown;
}

interface ErrorResponse {
  success: false;
  error: string;
}

type Response = SuccessResponse | ErrorResponse;

function handleResponse(response: Response) {
  if (response.success) {
    // TypeScript knows: response is SuccessResponse
    console.log(response.data);
  } else {
    // TypeScript knows: response is ErrorResponse
    console.log(response.error);
  }
}
```

---

## Utility Types

### Common Utility Types to Use

```typescript
// Partial - all properties optional
type PartialWorker = Partial<Worker>;

// Required - all properties required
type RequiredWorker = Required<Worker>;

// Pick - select specific properties
type WorkerName = Pick<Worker, "id" | "name">;

// Omit - exclude specific properties
type WorkerWithoutId = Omit<Worker, "id">;

// Record - typed dictionary
type StatusLabels = Record<InvoiceStatus, string>;

// ReturnType - extract function return type
type ServiceResult = ReturnType<typeof WorkersService.list>;

// Parameters - extract function parameters
type ServiceParams = Parameters<typeof WorkersService.list>;
```

---

## Error Handling Types

### Define Error Types Explicitly

```typescript
// ✅ Good: Explicit error type
class EdgeFunctionError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = "EdgeFunctionError";
  }
}

// ✅ Good: Result type pattern
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| `strict: true` | Always enable strict mode |
| Explicit returns | Public functions should have explicit return types |
| `as const` | Use for literal type preservation |
| Interfaces | Use for object shapes |
| Types | Use for unions and computed types |
| `null` vs `undefined` | `null` for DB, `undefined` for optional params |
| Const objects | Prefer over enums |
| Generics | Use descriptive names and constraints |
