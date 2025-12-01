# Contributing Guidelines

This document outlines coding standards, naming conventions, and best practices for the Dashboard project. Follow these guidelines to maintain consistency and code quality.

## Table of Contents

- [Project Structure](#project-structure)
- [Naming Conventions](#naming-conventions)
- [TypeScript Standards](#typescript-standards)
- [Component Patterns](#component-patterns)
- [Testing Standards](#testing-standards)
- [Import & Path Aliases](#import--path-aliases)
- [Styling Guidelines](#styling-guidelines)
- [Next.js App Router Patterns](#nextjs-app-router-patterns)
- [Code Organization](#code-organization)
- [Common Patterns](#common-patterns)

---

## Project Structure

```
dashboard/
├── app/                    # Next.js App Router pages and layouts
│   └── dashboard/         # Dashboard routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components (shared UI primitives)
│   └── [feature]/        # Feature-specific components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions and services
│   ├── services/         # API service classes
│   └── utils.ts          # General utilities
├── __tests__/            # Test files
└── __mocks__/            # Mock implementations for testing
```

---

## Naming Conventions

### Files and Directories

- **Components**: Use `kebab-case.tsx` (e.g., `dashboard-layout.tsx`, `field-config-list.tsx`)
- **Hooks**: Use `kebab-case.ts` with `use` prefix (e.g., `use-field-configs.ts`, `use-organization.ts`)
- **Services**: Use `kebab-case.service.ts` (e.g., `field-configs.service.ts`, `jobs.service.ts`)
- **Utilities**: Use `kebab-case.ts` (e.g., `validation-utils.ts`, `visualization-utils.ts`)
- **Types**: Define in `@clean-log/shared` package, import via workspace
- **Tests**: Match source file name with `.test.tsx` suffix (e.g., `use-field-configs.test.tsx`)

### Variables and Functions

- **Components**: PascalCase (e.g., `DashboardLayout`, `FieldConfigList`)
- **Hooks**: camelCase with `use` prefix (e.g., `useFieldConfigs`, `useOrganization`)
- **Functions**: camelCase (e.g., `fetchFieldConfigs`, `handleSubmit`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT`)
- **Types/Interfaces**: PascalCase (e.g., `FieldConfig`, `UseFieldConfigsResult`)
- **Service Classes**: PascalCase with `Service` suffix (e.g., `FieldConfigsService`, `JobsService`)

### Boolean Variables

- Use prefixes: `is`, `has`, `should`, `can` (e.g., `isLoading`, `hasError`, `shouldShow`, `canEdit`)

---

## TypeScript Standards

### Type Safety

- **Always use TypeScript strict mode** (enabled in `tsconfig.json`)
- **Avoid `any` type** - use `unknown` or proper types
- **Define explicit return types** for functions (especially public APIs)
- **Use interfaces for object shapes**, types for unions/intersections

### Type Definitions

```typescript
// ✅ Good: Explicit interface
interface UseFieldConfigsResult {
  fieldConfigs: FieldConfig[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ✅ Good: Explicit return type
export function useFieldConfigs(): UseFieldConfigsResult {
  // ...
}

// ❌ Bad: Implicit any
function handleChange(v) {
  // ...
}

// ✅ Good: Explicit type
function handleChange(v: string) {
  // ...
}
```

### Type Imports

- Import types from `@clean-log/shared` workspace package:

```typescript
import {
  FieldConfig,
  FieldType,
  FormSectionWithFields,
} from "@clean-log/shared";
```

### Optional vs Nullable

- Use `undefined` for optional values: `field?: string`
- Use `null` for explicit null values: `field: string | null`

---

## Component Patterns

### Client Components

- **Always add `"use client"` directive** at the top of client components
- Use functional components with TypeScript
- Extract reusable logic into custom hooks

```typescript
"use client";

import { useState } from "react";

interface ComponentProps {
  title: string;
  onSubmit: (data: FormData) => void;
}

export default function Component({ title, onSubmit }: ComponentProps) {
  // Component logic
}
```

### Server Components (Default)

- **Default to Server Components** in App Router
- Only use `"use client"` when needed (interactivity, hooks, browser APIs)
- Fetch data directly in Server Components when possible

### Component Organization

```typescript
"use client";

// 1. Imports (grouped)
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useFieldConfigs } from "@/hooks/use-field-configs";

// 2. Types/Interfaces
interface ComponentProps {
  // ...
}

// 3. Component
export default function Component({ ...props }: ComponentProps) {
  // 4. Hooks
  const { data, loading } = useFieldConfigs();
  const [state, setState] = useState();

  // 5. Event handlers
  const handleSubmit = () => {
    // ...
  };

  // 6. Effects
  useEffect(() => {
    // ...
  }, []);

  // 7. Render
  return (
    // JSX
  );
}
```

### Props Interface Naming

- Use `[ComponentName]Props` pattern:

```typescript
interface DashboardLayoutProps {
  children: React.ReactNode;
}
```

---

## Testing Standards

### Test File Organization

- Place test files in `__tests__/` directory matching source structure
- Test file naming: `[source-file].test.tsx` or `[source-file].test.ts`

### Testing Library

- Use **Vitest** as test runner
- Use **@testing-library/react** for component tests
- Use **@testing-library/react-hooks** for hook tests (or `renderHook` from RTL)

### Test Structure

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies at module level
vi.mock("@/lib/services", () => ({
  FieldConfigsService: {
    list: vi.fn(),
  },
}));

describe("useFieldConfigs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch field configs on mount", async () => {
    // Arrange
    const mockData = [createMockFieldConfig()];
    vi.mocked(FieldConfigsService.list).mockResolvedValue(mockData);

    // Act
    const { result } = renderHook(() => useFieldConfigs());

    // Assert
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.fieldConfigs).toEqual(mockData);
  });
});
```

### Test Best Practices

- **Arrange-Act-Assert** pattern
- **One assertion per test** when possible (group related assertions)
- **Mock external dependencies** (services, hooks, APIs)
- **Test user behavior**, not implementation details
- **Use descriptive test names** that explain what is being tested
- **Clean up mocks** in `beforeEach` or `afterEach`

### Mock Utilities

- Use `__tests__/lib/fixtures.ts` for test data factories
- Use `__tests__/lib/mocks.ts` for reusable mock implementations
- Use `__mocks__/` directory for module mocks (e.g., `__mocks__/supabase.ts`)

---

## Import & Path Aliases

### Path Aliases (Configured in `tsconfig.json`)

```typescript
// ✅ Use path aliases
import { Button } from "@/components/ui/button";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { FieldConfigsService } from "@/lib/services";
import { cn } from "@/lib/utils";

// ❌ Avoid relative paths
import { Button } from "../../components/ui/button";
```

### Import Order

1. React and Next.js imports
2. Third-party libraries
3. Internal components (`@/components`)
4. Hooks (`@/hooks`)
5. Services/Utils (`@/lib`)
6. Shared types (`@clean-log/shared`)
7. Types/interfaces from same file or local
8. Styles (if any)

```typescript
// 1. React
import { useState, useEffect } from "react";

// 2. Third-party
import { Package, RotateCcw } from "lucide-react";

// 3. Internal components
import { Button } from "@/components/ui/button";
import { VisualFormBuilder } from "@/components/form-builder";

// 4. Hooks
import { useFieldConfigs } from "@/hooks/use-field-configs";

// 5. Services/Utils
import { FieldConfigsService } from "@/lib/services";
import { log } from "@/lib/logger";

// 6. Shared types
import { FieldConfig, FieldType } from "@clean-log/shared";
```

### Barrel Exports

- Use `index.ts` files for component directories:

```typescript
// components/form-builder/index.ts
export { VisualFormBuilder } from "./visual-form-builder";
export { MobileDevicePreview } from "./mobile-device-preview";
```

---

## Styling Guidelines

### Tailwind CSS

- Use **Tailwind CSS** with utility classes
- Prefer utility classes over custom CSS
- Use `cn()` utility from `@/lib/utils` for conditional classes

```typescript
import { cn } from "@/lib/utils";

<div
  className={cn(
    "base-classes",
    isActive && "active-classes",
    className // Allow className override
  )}
/>;
```

### shadcn/ui Components

- Use **shadcn/ui** components from `@/components/ui`
- Components are installed via CLI and customized as needed
- Style: "new-york" variant (configured in `components.json`)

### Responsive Design

- Use Tailwind responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- Mobile-first approach: base styles for mobile, add desktop variants

```typescript
<div className="p-4 sm:p-6 lg:p-8">
  {/* Mobile: p-4, Tablet: p-6, Desktop: p-8 */}
</div>
```

---

## Next.js App Router Patterns

### Page Components

- Use `page.tsx` for route pages
- Use `layout.tsx` for shared layouts
- Use `loading.tsx` for loading states
- Use `error.tsx` for error boundaries

### Data Fetching

- **Server Components**: Fetch data directly (no `useEffect`)
- **Client Components**: Use hooks for data fetching
- Prefer Server Components when possible for better performance

### Route Organization

```
app/
├── dashboard/
│   ├── layout.tsx          # Dashboard layout wrapper
│   ├── page.tsx            # Dashboard home
│   ├── mobile-config/
│   │   └── page.tsx        # Mobile config route
│   └── settings/
│       └── page.tsx        # Settings route
```

### Client vs Server Components

- **Default to Server Components** (no directive needed)
- Add `"use client"` only when:
  - Using React hooks (`useState`, `useEffect`, etc.)
  - Using browser APIs
  - Event handlers (onClick, onChange, etc.)
  - Using Context API
  - Using third-party libraries that require client-side

---

## Code Organization

### Custom Hooks

- Extract reusable logic into custom hooks
- Prefix with `use` (e.g., `useFieldConfigs`, `useOrganization`)
- Return objects with descriptive property names
- Handle loading and error states

```typescript
interface UseFieldConfigsResult {
  fieldConfigs: FieldConfig[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFieldConfigs(): UseFieldConfigsResult {
  // Hook implementation
}
```

### Service Classes

- Organize API calls in service classes
- One service per domain (e.g., `FieldConfigsService`, `JobsService`)
- Export services from `lib/services/index.ts`
- Methods return typed data, throw errors for failures

```typescript
// lib/services/field-configs.service.ts
export class FieldConfigsService {
  static async list(params: ListParams): Promise<FieldConfig[]> {
    // Implementation
  }

  static async create(data: CreateFieldConfig): Promise<FieldConfig> {
    // Implementation
  }
}
```

### Optimistic Updates

- Use `useOptimistic` hook for optimistic UI updates
- Provide reducer pattern for state updates
- Handle rollback on error

```typescript
type OptimisticAction<T> =
  | { type: "add"; item: T }
  | { type: "update"; item: T }
  | { type: "delete"; id: string };

const [optimisticFields, addOptimisticField] = useOptimistic(
  fieldConfigs,
  (state: FieldConfig[], action: OptimisticAction<FieldConfig>) => {
    // Reducer logic
  }
);
```

---

## Common Patterns

### Error Handling

```typescript
try {
  const result = await service.method();
  // Handle success
} catch (err) {
  const errorMessage =
    err instanceof Error ? err.message : "An unknown error occurred";
  setError(errorMessage);
  log.error("Operation failed", { error: err });
}
```

### Loading States

```typescript
const [loading, setLoading] = useState(true);
const [data, setData] = useState<DataType[]>([]);
const [error, setError] = useState<string | null>(null);

// In component
{
  loading && <LoadingSpinner />;
}
{
  error && <ErrorMessage message={error} />;
}
{
  !loading && !error && <DataDisplay data={data} />;
}
```

### Form Handling

- Use controlled components with `useState`
- Validate on submit, show errors inline
- Use `useTransition` for form submissions to show pending state

```typescript
const [isPending, startTransition] = useTransition();
const [formData, setFormData] = useState<FormData>(initialData);

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  startTransition(async () => {
    await submitForm(formData);
  });
};
```

### Conditional Rendering

```typescript
// ✅ Good: Early returns
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
return <Content data={data} />;

// ✅ Good: Logical AND for simple conditionals
{
  isActive && <ActiveIndicator />;
}

// ✅ Good: Ternary for two options
{
  isLoading ? <Spinner /> : <Content />;
}
```

---

## Type Definitions Reference

### Shared Types Location

- All shared types are in `@clean-log/shared` workspace package
- Import from `@clean-log/shared` (not relative paths)
- Types are defined in `shared/types/` directory

### Common Types

```typescript
// Field configuration
import { FieldConfig, FieldType } from "@clean-log/shared";

// Form sections
import { FormSectionWithFields } from "@clean-log/shared";

// Conditional logic
import { ConditionalLogic, ConditionalOperator } from "@clean-log/shared";

// Validation
import { ValidationRules } from "@clean-log/shared";
```

---

## Quick Reference Checklist

When creating new code, ensure:

- [ ] ✅ File follows naming conventions (kebab-case)
- [ ] ✅ Component uses TypeScript with proper types
- [ ] ✅ Client component has `"use client"` directive
- [ ] ✅ Imports are organized (React → Third-party → Internal)
- [ ] ✅ Uses path aliases (`@/components`, `@/hooks`, etc.)
- [ ] ✅ Shared types imported from `@clean-log/shared`
- [ ] ✅ Error handling implemented
- [ ] ✅ Loading states handled
- [ ] ✅ Uses Tailwind utility classes
- [ ] ✅ Responsive design considered
- [ ] ✅ Test file created (if applicable)
- [ ] ✅ Follows component organization pattern
- [ ] ✅ No `any` types (use proper types or `unknown`)

---

## Additional Resources

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [React Server Components](https://react.dev/reference/rsc/server-components)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Note for AI Assistants**: When generating code for this project, always:

1. Reference this document for naming, structure, and patterns
2. Use the exact import paths shown above
3. Follow the component organization structure
4. Include proper TypeScript types (no `any`)
5. Add `"use client"` only when necessary
6. Use Tailwind utilities, not custom CSS
7. Follow the testing patterns for any new hooks/services
