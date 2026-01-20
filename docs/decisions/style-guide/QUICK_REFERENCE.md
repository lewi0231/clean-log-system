# Clean Log System - Style Guide Quick Reference

> Single-page summary of the most critical patterns and rules.  
> For detailed explanations, see the phase-specific documents.

---

## Imports & Exports

```typescript
// ✅ Use path aliases
import { Button } from "@/components/ui/button";
import { useWorkers } from "@/hooks/use-workers";
import { WorkersService } from "@/lib/services";
import { Worker } from "@clean-log/shared";

// ❌ Avoid relative paths
import { Button } from "../../../components/ui/button";

// ✅ Named exports only (no default exports)
export function ComponentName() { }
export function useHookName() { }
export class ServiceName { }

// ❌ No default exports
export default function Component() { }
```

---

## Components

```typescript
// File naming: kebab-case.tsx
// components/workers/worker-card.tsx

// Props interface naming: [ComponentName]Props
interface WorkerCardProps {
  worker: Worker;
  onEdit?: (id: string) => void;
}

// Export pattern: named function export
export function WorkerCard({ worker, onEdit }: WorkerCardProps) {
  // 1. Hooks first
  const [state, setState] = useState();
  
  // 2. Event handlers
  const handleClick = () => { };
  
  // 3. Effects
  useEffect(() => { }, []);
  
  // 4. Early returns for loading/error
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  
  // 5. Render
  return <div>...</div>;
}

// Max component size: 300 lines (then split)
```

---

## Hooks

```typescript
// File naming: use-kebab-case.ts
// hooks/use-workers.ts

// Return type interface
interface UseWorkersResult {
  workers: Worker[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Always return: { data, loading, error, refetch }
export function useWorkers(): UseWorkersResult {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    try {
      setLoading(true);
      setError(null);  // Reset error
      const data = await WorkersService.list(orgId);
      setWorkers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setWorkers([]);  // Reset data on error
    } finally {
      setLoading(false);  // Always in finally
    }
  };

  useEffect(() => { fetch(); }, [orgId]);

  return { workers, loading, error, refetch: fetch };
}
```

---

## Services

```typescript
// File naming: kebab-case.service.ts
// lib/services/workers.service.ts

export class WorkersService {
  // Static methods only
  static async list(orgId: string): Promise<Worker[]> {
    try {
      log.debug("WorkersService: Fetching workers", { orgId });

      const { data, error } = await supabase.functions.invoke(
        "list-workers",
        { body: { organization_id: orgId } }
      );

      if (error) throw error;
      if (!data?.success) throw new Error("Failed to fetch");

      log.info("WorkersService: Success", { count: data.workers.length });
      return data.workers;
    } catch (err) {
      log.error("WorkersService: Failed", { error: err });
      throw err;  // Always rethrow
    }
  }
}
```

---

## Edge Functions

```typescript
// Standard structure (always follow this order)
import { serve } from "server";
import { handleCors, jsonResponse, errorResponse } from "../_utils/http.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
import { createLogger } from "../_utils/logger.ts";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { validateRequest, schema } from "../_utils/zod-schemas.ts";

serve(async (req) => {
  // 1. CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // 2. Logger
  const logger = createLogger(req, { functionName: "function-name" });

  try {
    // 3. Validate with Zod (not legacy validateRequiredFields)
    const body = await req.json();
    const validation = validateRequest(schema, body);
    if (!validation.success) {
      return errorResponse(validation.error, 400);
    }

    // 4. Auth
    const supabase = createServiceRoleClient();
    const membership = await verifyOrganizationMembershipFromRequest(
      req, body.organization_id, supabase, body
    );
    if (!membership) {
      return errorResponse("Unauthorized", 403);
    }

    // 5. Business logic
    const result = await doSomething(validation.data);

    // 6. Response
    return jsonResponse({ success: true, data: result });

  } catch (error) {
    logger.error("Request failed", error);
    return errorResponse(error);
  }
});
```

---

## Styling

```typescript
// ✅ Use semantic color tokens
<div className="bg-primary text-primary-foreground">
<div className="bg-destructive text-destructive-foreground">
<div className="bg-muted text-muted-foreground">

// ❌ Don't use direct colors
<div className="bg-blue-500 text-white">
<div className="bg-[#2563EB]">

// ✅ Use cn() for class merging
import { cn } from "@/lib/utils";
<div className={cn("base-class", isActive && "active", className)}>

// ✅ Use spacing scale
<div className="space-y-4 p-6 gap-2">

// ❌ Avoid arbitrary values
<div className="gap-[17px] p-[23px]">

// Settings sections pattern
<Card className="border-primary/20 bg-primary/5">

// Clickable elements need cursor
<div onClick={fn} className="cursor-pointer hover:bg-muted/50">
```

---

## Testing

```typescript
// Use fixtures for test data
const worker = createMockWorker();
const workerWithEmail = createMockWorker({ email: "test@example.com" });

// AAA Pattern: Arrange, Act, Assert
it("should return workers on success", async () => {
  // Arrange
  const mockWorkers = [createMockWorker()];
  vi.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { success: true, workers: mockWorkers },
    error: null,
  });

  // Act
  const result = await WorkersService.list("org-1");

  // Assert
  expect(result).toEqual(mockWorkers);
});

// Hook testing with wrapper
const { result } = renderHook(() => useWorkers(), {
  wrapper: createQueryClientWrapper(),
});
await waitFor(() => expect(result.current.loading).toBe(false));
```

---

## Quick Decisions

| Situation | Decision |
|-----------|----------|
| Server or Client Component? | Default to Server, add `"use client"` only when needed |
| Service or Server Action? | Service for mobile+dashboard shared, Server Action for dashboard-only |
| useState or useReducer? | useState for simple, useReducer for related state + multiple actions |
| Zod or legacy validation? | Always Zod |
| null or undefined? | null for database, undefined for JS optional |
| Test colocated or centralized? | Colocated in `__tests__/` directories |

---

## Running Tests

```bash
# Unit tests (default - no external dependencies)
pnpm test                    # Run unit tests
pnpm test -- --watch         # Watch mode
pnpm test:coverage           # With coverage report

# Integration tests (requires local Supabase)
cd database && supabase start  # Start Supabase first
pnpm test:integration          # Run integration tests
pnpm test:integration:with-webhook  # With Stripe webhook

# E2E tests (Playwright)
pnpm test:e2e               # Run E2E tests
pnpm test:e2e:ui            # Interactive UI mode
```

**Note:** `pnpm test` excludes integration tests by default. Integration tests require a running local Supabase instance.

---

## Coverage Targets

| Metric | Target |
|--------|--------|
| Lines | 80% |
| Functions | 80% |
| Branches | 75% |
| Statements | 80% |

**High-risk code (90%+):** payments, pricing, invoices, auth

---

## File Naming Summary

| Type | Pattern | Example |
|------|---------|---------|
| Component | `kebab-case.tsx` | `worker-card.tsx` |
| Hook | `use-kebab-case.ts` | `use-workers.ts` |
| Service | `kebab-case.service.ts` | `workers.service.ts` |
| Test | `*.test.{ts,tsx}` | `workers.service.test.ts` |
| Edge Function | `kebab-case/index.ts` | `create-worker/index.ts` |

---

## Import Order

```typescript
// 1. React
import { useState, useEffect } from "react";

// 2. Third-party
import { Package } from "lucide-react";

// 3. Internal components
import { Button } from "@/components/ui/button";

// 4. Hooks
import { useWorkers } from "@/hooks/use-workers";

// 5. Services/Utils
import { WorkersService } from "@/lib/services";

// 6. Shared types
import { Worker } from "@clean-log/shared";

// 7. Local types
import type { LocalType } from "./types";
```

---

## State Components

```typescript
// Always use dedicated state components
if (loading) return <LoadingState message="Loading workers..." />;
if (error) return <ErrorState message={error} onRetry={refetch} />;
if (data.length === 0) return <EmptyState title="No workers" />;
```

---

## Responsive Design (Mobile-First)

```typescript
// ✅ Mobile-first: base styles for mobile, breakpoints for larger
<div className="p-4 md:p-6 lg:p-8">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// Test at: 375px, 768px, 1024px, 1440px
```

---

## Error Messages

```typescript
// ✅ User-friendly
setError("Failed to save changes. Please try again.");

// ❌ Technical
setError(error.message);  // "NetworkError: fetch failed at line 42"
```

---

## Database Migrations

### Key Rules

1. **NEVER modify existing migrations** - They may have already been applied to production
2. **Always create new migrations** for schema changes
3. **Use sequential timestamps** in format `YYYYMMDDHHMMSS_description.sql`
4. **Test migrations locally** before committing

### Creating a New Migration

```bash
# File naming pattern
database/supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql

# Example: Adding a new column
database/supabase/migrations/20260120143000_add_team_percentage_modifier.sql
```

### Migration File Structure

```sql
-- -*- mode: sql; sql-product: postgres -*-
-- Brief description of what this migration does

-- Step 1: Description
ALTER TABLE table_name ...;

-- Step 2: Description  
CREATE INDEX ...;

-- Step 3: Update comments
COMMENT ON COLUMN table_name.column_name IS 'Description';
```

### Common Patterns

```sql
-- Adding a new enum value to a CHECK constraint
ALTER TABLE worker_rate_card 
  DROP CONSTRAINT IF EXISTS worker_rate_card_modifier_type_check;

ALTER TABLE worker_rate_card 
  ADD CONSTRAINT worker_rate_card_modifier_type_check 
  CHECK (modifier_type IN ('existing', 'values', 'new_value'));

-- Adding a new column
ALTER TABLE table_name 
  ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value;

-- Adding a new table with RLS
CREATE TABLE new_table (...);
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage new_table" ON new_table
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
```

### Running Migrations

```bash
# Local development - run from database directory
cd database
supabase db reset  # Resets and runs all migrations

# Or run specific migration
supabase migration up

# Production - migrations run automatically on deploy
# Or use Supabase dashboard to run manually
```

### What NOT to Do

```sql
-- ❌ NEVER modify an existing migration file
-- ❌ NEVER change the order of migrations
-- ❌ NEVER delete a migration that's been applied
-- ❌ NEVER use migration names that sort incorrectly (use YYYYMMDDHHMMSS)
```

---

*Last updated: January 20, 2026*
