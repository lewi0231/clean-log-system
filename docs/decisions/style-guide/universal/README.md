# Universal Patterns

> Code-agnostic patterns that apply to **all** code in this monorepo, regardless of platform (dashboard, mobile-app, edge-functions).

---

## Documents

| Document | Description |
|----------|-------------|
| [TypeScript](./typescript.md) | Strict mode, types, generics, enums vs const objects |
| [Naming Conventions](./naming-conventions.md) | Files, functions, variables, interfaces |
| [Imports & Exports](./imports-and-exports.md) | Path aliases, import order, barrel exports |
| [Constants](./constants.md) | Magic values, `as const`, configuration |
| [Error Handling](./error-handling.md) | Try-catch, error types, logging |
| [Testing Principles](./testing-principles.md) | AAA pattern, fixtures, mocking, coverage |

---

## Quick Reference

### File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Component | `kebab-case.tsx` | `worker-card.tsx` |
| Hook | `use-kebab-case.ts` | `use-workers.ts` |
| Service | `kebab-case.service.ts` | `workers.service.ts` |
| Constants | `kebab-case.ts` | `invoice-constants.ts` |
| Test | `*.test.{ts,tsx}` | `workers.service.test.ts` |

### Import Order

```typescript
// 1. React/Framework
import { useState } from "react";

// 2. Third-party
import { z } from "zod";

// 3. Internal components
import { Button } from "@/components/ui/button";

// 4. Hooks
import { useWorkers } from "@/hooks/use-workers";

// 5. Services/Utils
import { WorkersService } from "@/lib/services";

// 6. Types
import type { Worker } from "@clean-log/shared";
```

### Constants Pattern

```typescript
export const InvoiceStatus = {
  DRAFT: "draft",
  SENT: "sent",
  PAID: "paid",
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];
```

### Error Handling

```typescript
try {
  setLoading(true);
  setError(null);
  const data = await Service.fetch();
  setData(data);
} catch (err) {
  setError(err instanceof Error ? err.message : "An error occurred");
  setData(null);
} finally {
  setLoading(false);
}
```

### Test Structure

```typescript
it("should do something", async () => {
  // Arrange
  const mockData = createMockData();
  vi.mocked(api.fetch).mockResolvedValue(mockData);

  // Act
  const result = await service.getData();

  // Assert
  expect(result).toEqual(mockData);
});
```
