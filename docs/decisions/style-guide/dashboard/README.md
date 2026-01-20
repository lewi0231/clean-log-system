# Dashboard Style Guide

> Next.js 16 specific patterns for the dashboard application.

**Tech Stack:**
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4 (CSS-first configuration)
- shadcn/ui components
- TanStack Query (React Query)
- Supabase (via Edge Functions)

---

## Documents

| Document | Description |
|----------|-------------|
| [Components](./components.md) | React components, Server vs Client, composition |
| [Hooks](./hooks.md) | Custom hooks, TanStack Query patterns |
| [Services](./services.md) | Service layer, Edge Function integration |
| [Styling](./styling.md) | Tailwind v4, shadcn/ui, design tokens |
| [Testing](./testing.md) | Vitest, React Testing Library |

---

## Quick Reference

### Component Structure

```typescript
"use client";  // Only if needed

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWorkers } from "@/hooks/use-workers";
import type { Worker } from "@clean-log/shared";

interface WorkerCardProps {
  worker: Worker;
  onEdit?: (id: string) => void;
}

export function WorkerCard({ worker, onEdit }: WorkerCardProps) {
  // 1. Hooks
  const [isEditing, setIsEditing] = useState(false);

  // 2. Event handlers
  const handleEdit = () => onEdit?.(worker.id);

  // 3. Early returns
  if (!worker) return null;

  // 4. Render
  return (
    <div className="rounded-lg border p-4">
      <h3>{worker.name}</h3>
      <Button onClick={handleEdit}>Edit</Button>
    </div>
  );
}
```

### Hook Structure

```typescript
interface UseWorkersResult {
  workers: Worker[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWorkers(): UseWorkersResult {
  const { organizationId } = useOrganization();

  const query = useQuery({
    queryKey: ["workers", organizationId],
    queryFn: () => WorkersService.list(organizationId),
    enabled: !!organizationId,
  });

  return {
    workers: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: async () => { await query.refetch(); },
  };
}
```

### Service Structure

```typescript
export class WorkersService {
  static async list(organizationId: string): Promise<Worker[]> {
    try {
      log.debug("WorkersService: Fetching", { organizationId });

      const data = await invokeEdgeFunction<ListWorkersResponse>(
        "list-workers",
        { organization_id: organizationId }
      );

      log.info("WorkersService: Success", { count: data.workers.length });
      return data.workers;
    } catch (err) {
      log.error("WorkersService: Failed", { error: err });
      throw err;
    }
  }
}
```

### Styling Pattern

```typescript
// Use semantic color tokens
<div className="bg-primary text-primary-foreground">
<div className="bg-muted text-muted-foreground">

// Use cn() for conditional classes
import { cn } from "@/lib/utils";
<div className={cn("p-4", isActive && "bg-primary/10")}>

// Settings sections pattern
<Card className="border-primary/20 bg-primary/5">
```

---

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Server vs Client | Default to Server | Better performance, use Client only when needed |
| State management | TanStack Query | Server state caching, auto-refetch |
| Styling | Tailwind v4 + shadcn | CSS-first config, accessible components |
| Forms | React Hook Form + Zod | Type-safe validation |
| API calls | Service layer | Consistent error handling, logging |
