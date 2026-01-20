# Dashboard Components

> React component patterns specific to the Next.js dashboard.

---

## Component Organization

```
dashboard/components/
├── ui/                      # Primitives (shadcn/ui)
│   ├── button.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── empty-state.tsx
│   ├── error-state.tsx
│   └── loading-state.tsx
├── form-builder/            # Feature: Form building
├── pricing/                 # Feature: Pricing management
├── invoicing/               # Feature: Invoice management
├── worker-payments/         # Feature: Worker payments
├── settings/                # Feature: Settings
└── [feature]/               # Other features
    ├── feature-list.tsx
    ├── feature-card.tsx
    └── index.ts             # Barrel export
```

---

## Server vs Client Components

### Default to Server Components

Components are Server Components by default in Next.js App Router. Only add `"use client"` when needed.

```typescript
// app/dashboard/workers/page.tsx - Server Component (default)
export default async function WorkersPage() {
  const workers = await fetchWorkers();  // Server-side fetch
  
  return (
    <div>
      <h1>Workers</h1>
      <WorkerList workers={workers} />    {/* Can be Server */}
      <AddWorkerButton />                  {/* Client: has onClick */}
    </div>
  );
}
```

### When to Use Client Components

Add `"use client"` only when the component needs:
- Event handlers (`onClick`, `onChange`, etc.)
- React hooks (`useState`, `useEffect`, etc.)
- Browser APIs (`window`, `localStorage`, etc.)
- Third-party libraries that use hooks

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AddWorkerButton() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Button onClick={() => setIsOpen(true)}>
      Add Worker
    </Button>
  );
}
```

### Client Components at Leaves

Keep Client Components at the "leaves" of the component tree:

```typescript
// ✅ Good: Server Component with Client Component leaves
// app/dashboard/page.tsx (Server)
export default async function DashboardPage() {
  const stats = await fetchStats();
  
  return (
    <div>
      <h1>Dashboard</h1>
      <StatCards stats={stats} />           {/* Server: static display */}
      <InteractiveChart data={stats} />     {/* Client: has interactions */}
    </div>
  );
}

// ❌ Bad: Entire page as Client Component
"use client";
export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  useEffect(() => { fetchStats().then(setStats); }, []);
  // Now entire page and children are client-rendered
}
```

---

## Component Structure

### Standard Component Template

```typescript
"use client";  // Only if needed

// 1. Imports (see universal/imports-and-exports.md)
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useWorkers } from "@/hooks/use-workers";
import type { Worker } from "@clean-log/shared";

// 2. Props interface
interface WorkerCardProps {
  worker: Worker;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

// 3. Component function (named export)
export function WorkerCard({ 
  worker, 
  onEdit, 
  onDelete,
  className,
}: WorkerCardProps) {
  // 4. Hooks (state, context, refs, custom)
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 5. Event handlers
  const handleEdit = useCallback(() => {
    onEdit?.(worker.id);
  }, [onEdit, worker.id]);

  // 6. Effects (if needed)
  // useEffect(() => { ... }, []);

  // 7. Early returns for edge cases
  if (!worker) return null;

  // 8. Render
  return (
    <div className={cn("rounded-lg border p-4", className)}>
      <h3 className="font-medium">{worker.name}</h3>
      <p className="text-muted-foreground">{worker.email}</p>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm" onClick={handleEdit}>
          Edit
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete?.(worker.id)}>
          Delete
        </Button>
      </div>
    </div>
  );
}
```

---

## State Components

### Always Use Dedicated State Components

```typescript
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

export function WorkerList() {
  const { workers, loading, error, refetch } = useWorkers();

  // Loading state
  if (loading) {
    return <LoadingState message="Loading workers..." />;
  }

  // Error state
  if (error) {
    return (
      <ErrorState 
        message={error} 
        onRetry={refetch}
      />
    );
  }

  // Empty state
  if (workers.length === 0) {
    return (
      <EmptyState
        title="No workers"
        description="Add your first worker to get started."
        action={<AddWorkerButton />}
      />
    );
  }

  // Success state
  return (
    <div className="grid gap-4">
      {workers.map((worker) => (
        <WorkerCard key={worker.id} worker={worker} />
      ))}
    </div>
  );
}
```

---

## Props Patterns

### Component Props Interface

```typescript
// Named [ComponentName]Props
interface WorkerCardProps {
  // Required props first
  worker: Worker;
  
  // Optional callbacks with 'on' prefix
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  
  // Optional UI props last
  className?: string;
  showActions?: boolean;
}
```

### Prop Callbacks

```typescript
// Use 'on' prefix for prop callbacks
interface Props {
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onClick?: () => void;
}

// Use 'handle' prefix for internal handlers
function WorkerCard({ onEdit }: Props) {
  const handleEditClick = () => {
    // Internal logic before calling prop
    onEdit(worker.id);
  };

  return <Button onClick={handleEditClick}>Edit</Button>;
}
```

### Forwarding className

Always accept and forward `className` for styling flexibility:

```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("rounded-lg border p-4", className)}>
      {children}
    </div>
  );
}

// Usage
<Card className="bg-primary/5">
  Content
</Card>
```

---

## Composition Patterns

### Compound Components

For complex UI with multiple related parts:

```typescript
// components/data-table/index.tsx
export function DataTable({ children }: { children: React.ReactNode }) {
  return <table className="w-full">{children}</table>;
}

DataTable.Header = function Header({ children }: { children: React.ReactNode }) {
  return <thead className="border-b">{children}</thead>;
};

DataTable.Body = function Body({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
};

DataTable.Row = function Row({ children }: { children: React.ReactNode }) {
  return <tr className="border-b">{children}</tr>;
};

// Usage
<DataTable>
  <DataTable.Header>
    <DataTable.Row>
      <th>Name</th>
      <th>Email</th>
    </DataTable.Row>
  </DataTable.Header>
  <DataTable.Body>
    {workers.map(worker => (
      <DataTable.Row key={worker.id}>
        <td>{worker.name}</td>
        <td>{worker.email}</td>
      </DataTable.Row>
    ))}
  </DataTable.Body>
</DataTable>
```

### Render Props

For flexible rendering control:

```typescript
interface WorkerListProps {
  renderItem?: (worker: Worker) => React.ReactNode;
}

export function WorkerList({ renderItem }: WorkerListProps) {
  const { workers } = useWorkers();

  return (
    <div>
      {workers.map(worker => (
        renderItem ? renderItem(worker) : <WorkerCard key={worker.id} worker={worker} />
      ))}
    </div>
  );
}

// Usage
<WorkerList 
  renderItem={(worker) => (
    <CustomWorkerCard worker={worker} showStats />
  )}
/>
```

---

## Component Size

### Maximum 300 Lines

Components over 300 lines should be split:

1. **Extract custom hooks** for complex logic
2. **Split into sub-components** for distinct UI sections
3. **Use composition patterns** for flexibility
4. **Move constants** to separate files

```typescript
// ❌ Bad: 500-line component
export function ComplexForm() {
  // 50 lines of state
  // 100 lines of handlers
  // 50 lines of effects
  // 300 lines of JSX
}

// ✅ Good: Split into focused pieces
export function ComplexForm() {
  const formState = useComplexFormState();  // Custom hook
  
  return (
    <FormProvider value={formState}>
      <FormHeader />
      <FormFields />
      <FormActions />
    </FormProvider>
  );
}
```

---

## Barrel Exports

Create `index.ts` for feature directories:

```typescript
// components/form-builder/index.ts
export { VisualFormBuilder } from "./visual-form-builder";
export { FieldConfigDialog } from "./field-config-dialog";
export { SectionEditor } from "./section-editor";

// Usage
import { VisualFormBuilder, FieldConfigDialog } from "@/components/form-builder";
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| Server by default | Only add `"use client"` when needed |
| Client at leaves | Keep interactive components at tree leaves |
| Named exports | No default exports (except pages) |
| Props interface | Named `[ComponentName]Props` |
| State components | Use LoadingState, ErrorState, EmptyState |
| Forward className | Always accept for styling flexibility |
| Max 300 lines | Split large components |
| Barrel exports | `index.ts` for feature directories |
