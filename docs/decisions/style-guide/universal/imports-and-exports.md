# Imports and Exports

> Universal import/export patterns that apply to all code in this monorepo.

---

## Path Aliases

### Use `@/` for Internal Imports

All applications use `@/` as the path alias for internal imports.

```typescript
// ✅ Good: Clean, refactor-safe imports
import { Button } from "@/components/ui/button";
import { useWorkers } from "@/hooks/use-workers";
import { WorkersService } from "@/lib/services";

// ❌ Bad: Fragile relative imports
import { Button } from "../../../components/ui/button";
import { useWorkers } from "../../hooks/use-workers";
```

### Use Package Names for Shared Code

```typescript
// ✅ Good: Import from shared package
import { Worker, Job, Invoice } from "@clean-log/shared";

// ❌ Bad: Relative path to shared
import { Worker } from "../../../shared/types";
```

---

## Import Order

Organize imports in this order, with blank lines between groups:

```typescript
// 1. React/Framework imports
import { useState, useEffect, useCallback } from "react";

// 2. Third-party libraries
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";

// 3. Internal components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WorkerCard } from "@/components/workers/worker-card";

// 4. Hooks
import { useWorkers } from "@/hooks/use-workers";
import useOrganization from "@/hooks/useOrganization";

// 5. Services and utilities
import { WorkersService } from "@/lib/services";
import { formatCurrency } from "@/lib/utils";

// 6. Shared package types
import type { Worker, Job } from "@clean-log/shared";

// 7. Local types (same directory)
import type { WorkerCardProps } from "./types";
```

---

## Export Patterns

### Use Named Exports (Not Default Exports)

```typescript
// ✅ Good: Named exports
export function WorkerCard() { }
export function useWorkers() { }
export class WorkersService { }

// ❌ Bad: Default exports
export default function WorkerCard() { }
export default useWorkers;
```

**Why named exports:**
- Better IDE autocomplete and refactoring
- Consistent naming across imports
- Easier to track usage
- No naming confusion at import site

### Exception: Next.js Pages

Next.js requires default exports for pages:

```typescript
// app/dashboard/page.tsx - default export required by Next.js
export default function DashboardPage() {
  return <div>Dashboard</div>;
}
```

---

## Barrel Exports

### Use Index Files for Feature Directories

```typescript
// components/form-builder/index.ts
export { VisualFormBuilder } from "./visual-form-builder";
export { FieldConfigDialog } from "./field-config-dialog";
export { SectionEditor } from "./section-editor";

// Usage
import { VisualFormBuilder, FieldConfigDialog } from "@/components/form-builder";
```

### Use Index Files for Services

```typescript
// lib/services/index.ts
export { FeedbackService } from "./feedback.service";
export { FieldConfigsService } from "./field-configs.service";
export { InvoiceService } from "./invoice.service";
export { JobsService } from "./jobs.service";
export { WorkersService } from "./workers.service";

// Usage - single clean import
import { WorkersService, JobsService, InvoiceService } from "@/lib/services";
```

### Use Index Files for Constants

```typescript
// lib/constants/index.ts
export * from "./invoice-constants";
export * from "./payment-constants";
export * from "./validation-limits";

// Usage
import { InvoiceStatus, PaymentMethod, MAX_FILE_SIZE } from "@/lib/constants";
```

---

## Type-Only Imports

### Use `type` Keyword for Type-Only Imports

```typescript
// ✅ Good: Explicit type import
import type { Worker, Job } from "@clean-log/shared";
import type { WorkerCardProps } from "./types";

// Also good: Mixed import with type keyword
import { WorkersService, type Worker } from "@/lib/services";

// ❌ Avoid: Importing types without type keyword (works but less clear)
import { Worker, Job } from "@clean-log/shared";
```

**Why:**
- Makes intent clear (type vs runtime value)
- Can be stripped by bundlers more efficiently
- Prevents accidental runtime usage of type-only imports

---

## Re-exports

### Prefer Direct Exports Over Re-exports

```typescript
// ✅ Good: Direct export in index
export { WorkerCard } from "./worker-card";

// ❌ Avoid: Import then re-export
import { WorkerCard } from "./worker-card";
export { WorkerCard };
```

### Use `export *` Sparingly

```typescript
// ✅ Good: Explicit exports (preferred for components)
export { Button } from "./button";
export { Card } from "./card";
export { Dialog } from "./dialog";

// ⚠️ Use cautiously: Wildcard exports (acceptable for constants/types)
export * from "./invoice-constants";

// ❌ Avoid: Wildcard exports for components (harder to tree-shake)
export * from "./button";
export * from "./card";
```

---

## Dynamic Imports

### Use Dynamic Imports for Code Splitting

```typescript
// ✅ Good: Lazy load heavy components
const HeavyChart = dynamic(() => import("@/components/visualizations/heavy-chart"), {
  loading: () => <Skeleton className="h-64 w-full" />,
});

// ✅ Good: Lazy load features
const AdminPanel = lazy(() => import("@/components/admin/admin-panel"));
```

---

## Circular Dependencies

### Avoid Circular Imports

```typescript
// ❌ Bad: Circular dependency
// file-a.ts
import { funcB } from "./file-b";
export const funcA = () => funcB();

// file-b.ts
import { funcA } from "./file-a";  // Circular!
export const funcB = () => funcA();

// ✅ Good: Extract shared code to third file
// shared.ts
export const sharedFunc = () => {};

// file-a.ts
import { sharedFunc } from "./shared";

// file-b.ts
import { sharedFunc } from "./shared";
```

---

## Import Aliases for Long Paths

### Use Module Aliases, Not Import Aliases

```typescript
// ✅ Good: Use path alias
import { WorkerCard } from "@/components/workers/worker-card";

// ❌ Bad: Import alias (confusing)
import { WorkerCard as WC } from "@/components/workers/worker-card";
```

### Exception: Disambiguating Same-Named Imports

```typescript
// ✅ Acceptable: When names conflict
import { Button as ShadcnButton } from "@/components/ui/button";
import { Button as NativeButton } from "react-native";
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| Path aliases | Use `@/` for internal imports |
| Import order | React → Third-party → Components → Hooks → Services → Types |
| Named exports | Always use named exports (except Next.js pages) |
| Barrel exports | Use `index.ts` for feature directories and services |
| Type imports | Use `import type` for type-only imports |
| Re-exports | Prefer `export { X } from` over import-then-export |
| Dynamic imports | Use for code splitting heavy components |
| Circular deps | Extract shared code to avoid cycles |
