# Naming Conventions

> Universal naming conventions that apply to all code in this monorepo.

---

## File Naming

### Use kebab-case for All Files

```
✅ Correct:
worker-card.tsx
use-workers.ts
invoice.service.ts
invoice-constants.ts
create-worker/index.ts

❌ Incorrect:
workerCard.tsx
WorkerCard.tsx
useWorkers.ts
InvoiceService.ts
```

### File Naming by Type

| Type | Pattern | Example |
|------|---------|---------|
| React Component | `kebab-case.tsx` | `worker-card.tsx` |
| React Hook | `use-kebab-case.ts` | `use-workers.ts` |
| Service Class | `kebab-case.service.ts` | `workers.service.ts` |
| Constants | `kebab-case-constants.ts` or `kebab-case.ts` | `invoice-constants.ts` |
| Types | `kebab-case.ts` | `api-types.ts` |
| Utilities | `kebab-case.ts` | `pricing-utils.ts` |
| Test Files | `*.test.{ts,tsx}` | `workers.service.test.ts` |
| Edge Function | `kebab-case/index.ts` | `create-worker/index.ts` |

---

## Directory Naming

### Use kebab-case for Directories

```
✅ Correct:
components/worker-payments/
hooks/
lib/services/
edge-functions/create-worker/

❌ Incorrect:
components/workerPayments/
components/WorkerPayments/
```

### Special Directory Names

| Directory | Purpose |
|-----------|---------|
| `__tests__/` | Test files (double underscore) |
| `__mocks__/` | Mock files for testing |
| `_utils/` | Shared utilities (edge functions, single underscore) |
| `ui/` | UI primitive components |

---

## Code Naming

### Functions and Methods: camelCase

```typescript
// ✅ Correct
function calculateTotal() {}
function handleSubmit() {}
async function fetchWorkers() {}

// ❌ Incorrect
function CalculateTotal() {}
function calculate_total() {}
```

### React Components: PascalCase

```typescript
// ✅ Correct
export function WorkerCard() {}
export function InvoiceList() {}

// ❌ Incorrect
export function workerCard() {}
export function worker_card() {}
```

### React Hooks: camelCase with `use` prefix

```typescript
// ✅ Correct
export function useWorkers() {}
export function useInvoiceDetails() {}

// ❌ Incorrect
export function UseWorkers() {}
export function workers() {}
```

### Constants: SCREAMING_SNAKE_CASE

```typescript
// ✅ Correct
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_PAGE_SIZE = 20;
const API_BASE_URL = "https://api.example.com";

// ❌ Incorrect
const maxRetryAttempts = 3;
const MaxRetryAttempts = 3;
```

### Const Objects: PascalCase with SCREAMING_SNAKE_CASE values

```typescript
// ✅ Correct
export const InvoiceStatus = {
  DRAFT: "draft",
  SENT: "sent",
  PAID: "paid",
} as const;

// ❌ Incorrect
export const INVOICE_STATUS = { ... };  // Object name should be PascalCase
export const invoiceStatus = { ... };   // Object name should be PascalCase
```

### Interfaces and Types: PascalCase

```typescript
// ✅ Correct
interface WorkerCardProps {}
type InvoiceStatus = "draft" | "sent" | "paid";
interface UseWorkersResult {}

// ❌ Incorrect
interface workerCardProps {}
type invoiceStatus = ...;
```

### Interface Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Component Props | `[ComponentName]Props` | `WorkerCardProps` |
| Hook Return | `Use[HookName]Result` | `UseWorkersResult` |
| API Request | `[Action][Entity]Request` | `CreateWorkerRequest` |
| API Response | `[Action][Entity]Response` | `ListWorkersResponse` |
| Service Class | `[Entity]Service` | `WorkersService` |

---

## Event Handlers

### Use `handle` prefix for component handlers

```typescript
// ✅ Correct
function WorkerCard() {
  const handleClick = () => {};
  const handleSubmit = () => {};
  const handleDelete = () => {};
  
  return <button onClick={handleClick}>Click</button>;
}
```

### Use `on` prefix for prop callbacks

```typescript
// ✅ Correct
interface WorkerCardProps {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onClick?: () => void;
}

function WorkerCard({ onEdit, onDelete }: WorkerCardProps) {
  const handleEditClick = () => onEdit(worker.id);
  return <button onClick={handleEditClick}>Edit</button>;
}
```

---

## Boolean Variables

### Use is/has/can/should prefixes

```typescript
// ✅ Correct
const isLoading = true;
const hasError = false;
const canEdit = user.role === "admin";
const shouldRefetch = staleTime > 0;
const isActive = worker.active;

// ❌ Incorrect
const loading = true;
const error = false;
const edit = true;
```

---

## Arrays and Collections

### Use plural nouns

```typescript
// ✅ Correct
const workers: Worker[] = [];
const invoiceIds: string[] = [];
const selectedItems: Item[] = [];

// ❌ Incorrect
const workerList: Worker[] = [];
const workerArray: Worker[] = [];
const invoiceIdList: string[] = [];
```

---

## Async Functions

### Use verb prefixes indicating the action

```typescript
// ✅ Correct
async function fetchWorkers() {}
async function createInvoice() {}
async function updateStatus() {}
async function deleteWorker() {}
async function sendEmail() {}

// For hooks that trigger fetching
function useWorkers() {}      // Implies fetching
function useFetchWorkers() {} // Also acceptable if explicit
```

---

## Service Methods

### Use CRUD-style naming

```typescript
class WorkersService {
  // ✅ Correct naming
  static async list(orgId: string) {}
  static async get(id: string) {}
  static async create(data: CreateWorkerRequest) {}
  static async update(id: string, data: UpdateWorkerRequest) {}
  static async delete(id: string) {}
  
  // ❌ Incorrect
  static async getWorkers() {}     // Redundant - class already named
  static async fetchAll() {}       // Use 'list' for collections
  static async remove() {}         // Use 'delete' for consistency
}
```

---

## Database Fields

### Use snake_case for database columns

```typescript
// ✅ Correct (matches database schema)
interface Worker {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// These come directly from Supabase/PostgreSQL
```

---

## Environment Variables

### Use SCREAMING_SNAKE_CASE with prefixes

```bash
# ✅ Correct
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=...
RESEND_API_KEY=...

# ❌ Incorrect
supabaseUrl=...
StripeSecretKey=...
```

---

## Rules Summary

| Item | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `worker-card.tsx` |
| Directories | kebab-case | `worker-payments/` |
| Functions | camelCase | `calculateTotal()` |
| Components | PascalCase | `WorkerCard` |
| Hooks | camelCase + `use` | `useWorkers()` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY` |
| Const objects | PascalCase | `InvoiceStatus` |
| Interfaces | PascalCase | `WorkerCardProps` |
| Event handlers | `handle` prefix | `handleClick` |
| Prop callbacks | `on` prefix | `onEdit` |
| Booleans | `is/has/can` prefix | `isLoading` |
| Arrays | Plural nouns | `workers` |
| DB fields | snake_case | `created_at` |
| Env vars | SCREAMING_SNAKE_CASE | `API_KEY` |
