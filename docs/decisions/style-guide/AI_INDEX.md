# Style Guide AI Index

> Structured index of all style guide rules for efficient AI consumption and lookup.

**Purpose:** This index provides a machine-readable catalog of all style guide rules, enabling quick lookup, filtering by scope/tags, and decision-making support.

---

## Rule Catalog

### Universal Rules

#### RULE: typescript-strict-mode
- **Scope:** universal
- **File:** `universal/typescript.md#strict-mode`
- **Tags:** typescript, configuration, compiler
- **Priority:** high
- **Pattern:** `{ "compilerOptions": { "strict": true } }`
- **Applies to:** All TypeScript configurations
- **Rationale:** Catches type errors early, improves IDE autocomplete, prevents runtime bugs

#### RULE: typescript-explicit-return-types
- **Scope:** universal
- **File:** `universal/typescript.md#explicit-return-types`
- **Tags:** typescript, functions, exports
- **Priority:** high
- **Pattern:** `export function name(): ReturnType { }`
- **Anti-pattern:** `export function name() { }`
- **Applies to:** All exported functions
- **Rationale:** Better type safety, clearer API contracts

#### RULE: typescript-infer-local-variables
- **Scope:** universal
- **File:** `universal/typescript.md#let-typescript-infer-local-variables`
- **Tags:** typescript, variables
- **Priority:** medium
- **Pattern:** `const count = 0;` (let TS infer)
- **Anti-pattern:** `const count: number = 0;` (redundant annotation)
- **Applies to:** Local variables

#### RULE: typescript-as-const
- **Scope:** universal
- **File:** `universal/typescript.md#use-as-const-for-literal-types`
- **Tags:** typescript, constants, literal-types
- **Priority:** high
- **Pattern:** `const STATUS = { ACTIVE: "active" } as const;`
- **Anti-pattern:** `const STATUS = { ACTIVE: "active" };` (types widen to string)
- **Applies to:** Constant objects that should preserve literal types

#### RULE: typescript-interfaces-vs-types
- **Scope:** universal
- **File:** `universal/typescript.md#interfaces-vs-types`
- **Tags:** typescript, types, interfaces
- **Priority:** high
- **Pattern:** Use `interface` for object shapes, `type` for unions/computed types
- **Example:** `interface Worker { }` vs `type Status = "active" | "inactive"`
- **Applies to:** Type definitions

#### RULE: typescript-null-vs-undefined
- **Scope:** universal
- **File:** `universal/typescript.md#nullability`
- **Tags:** typescript, nullability, database
- **Priority:** high
- **Pattern:** `null` for database values, `undefined` for optional parameters
- **Example:** `completed_at: string | null` (DB) vs `limit?: number` (optional param)
- **Applies to:** All code

#### RULE: typescript-const-objects-over-enums
- **Scope:** universal
- **File:** `universal/typescript.md#enums-vs-const-objects`
- **Tags:** typescript, constants, enums
- **Priority:** high
- **Pattern:** `export const InvoiceStatus = { DRAFT: "draft" } as const; export type InvoiceStatus = ...`
- **Anti-pattern:** `enum InvoiceStatus { DRAFT = "draft" }`
- **Rationale:** No runtime overhead, better type inference, more flexible

#### RULE: file-naming-kebab-case
- **Scope:** universal
- **File:** `universal/naming-conventions.md#file-naming`
- **Tags:** naming, files, conventions
- **Priority:** high
- **Pattern:** `worker-card.tsx`, `use-workers.ts`, `workers.service.ts`
- **Anti-pattern:** `workerCard.tsx`, `WorkerCard.tsx`, `useWorkers.ts`
- **Applies to:** All files

#### RULE: function-naming-camelCase
- **Scope:** universal
- **File:** `universal/naming-conventions.md#functions-and-methods-camelcase`
- **Tags:** naming, functions
- **Priority:** high
- **Pattern:** `calculateTotal()`, `handleSubmit()`
- **Anti-pattern:** `CalculateTotal()`, `calculate_total()`
- **Applies to:** Functions and methods

#### RULE: component-naming-pascalCase
- **Scope:** universal
- **File:** `universal/naming-conventions.md#react-components-pascalcase`
- **Tags:** naming, components, react
- **Priority:** high
- **Pattern:** `export function WorkerCard() { }`
- **Anti-pattern:** `export function workerCard() { }`
- **Applies to:** React components

#### RULE: hook-naming-camelCase-use-prefix
- **Scope:** universal
- **File:** `universal/naming-conventions.md#react-hooks-camelcase-with-use-prefix`
- **Tags:** naming, hooks, react
- **Priority:** high
- **Pattern:** `export function useWorkers() { }`
- **Anti-pattern:** `export function UseWorkers() { }`, `export function workers() { }`
- **Applies to:** React hooks

#### RULE: constants-naming-screaming-snake-case
- **Scope:** universal
- **File:** `universal/naming-conventions.md#constants-screaming_snake_case`
- **Tags:** naming, constants
- **Priority:** high
- **Pattern:** `const MAX_RETRY_ATTEMPTS = 3;`
- **Anti-pattern:** `const maxRetryAttempts = 3;`
- **Applies to:** Constants

#### RULE: const-objects-pascalCase
- **Scope:** universal
- **File:** `universal/naming-conventions.md#const-objects-pascalcase`
- **Tags:** naming, constants, objects
- **Priority:** high
- **Pattern:** `export const InvoiceStatus = { DRAFT: "draft" } as const;`
- **Anti-pattern:** `export const INVOICE_STATUS = { }` (object name should be PascalCase)
- **Applies to:** Const objects

#### RULE: interface-naming-pascalCase
- **Scope:** universal
- **File:** `universal/naming-conventions.md#interfaces-and-types-pascalcase`
- **Tags:** naming, interfaces, types
- **Priority:** high
- **Pattern:** `interface WorkerCardProps { }`, `type InvoiceStatus = ...`
- **Anti-pattern:** `interface workerCardProps { }`
- **Applies to:** Interfaces and types

#### RULE: props-interface-naming
- **Scope:** universal
- **File:** `universal/naming-conventions.md#interface-naming-conventions`
- **Tags:** naming, interfaces, components
- **Priority:** high
- **Pattern:** `[ComponentName]Props` (e.g., `WorkerCardProps`)
- **Applies to:** Component props interfaces

#### RULE: hook-return-interface-naming
- **Scope:** universal
- **File:** `universal/naming-conventions.md#interface-naming-conventions`
- **Tags:** naming, interfaces, hooks
- **Priority:** high
- **Pattern:** `Use[HookName]Result` (e.g., `UseWorkersResult`)
- **Applies to:** Hook return type interfaces

#### RULE: event-handler-naming-handle-prefix
- **Scope:** universal
- **File:** `universal/naming-conventions.md#event-handlers`
- **Tags:** naming, handlers, events
- **Priority:** high
- **Pattern:** `const handleClick = () => { };`
- **Applies to:** Component event handlers

#### RULE: prop-callback-naming-on-prefix
- **Scope:** universal
- **File:** `universal/naming-conventions.md#event-handlers`
- **Tags:** naming, props, callbacks
- **Priority:** high
- **Pattern:** `onEdit: (id: string) => void;`
- **Applies to:** Prop callbacks

#### RULE: boolean-variable-naming-prefixes
- **Scope:** universal
- **File:** `universal/naming-conventions.md#boolean-variables`
- **Tags:** naming, booleans
- **Priority:** high
- **Pattern:** `isLoading`, `hasError`, `canEdit`, `shouldRefetch`
- **Anti-pattern:** `loading`, `error`, `edit`
- **Applies to:** Boolean variables

#### RULE: array-naming-plural
- **Scope:** universal
- **File:** `universal/naming-conventions.md#arrays-and-collections`
- **Tags:** naming, arrays
- **Priority:** medium
- **Pattern:** `const workers: Worker[] = [];`
- **Anti-pattern:** `const workerList: Worker[] = [];`
- **Applies to:** Arrays and collections

#### RULE: service-method-naming-crud
- **Scope:** universal
- **File:** `universal/naming-conventions.md#service-methods`
- **Tags:** naming, services, methods
- **Priority:** high
- **Pattern:** `list()`, `get()`, `create()`, `update()`, `delete()`
- **Anti-pattern:** `getWorkers()`, `fetchAll()`, `remove()`
- **Applies to:** Service class methods

#### RULE: path-aliases-at-slash
- **Scope:** universal
- **File:** `universal/imports-and-exports.md#path-aliases`
- **Tags:** imports, path-aliases
- **Priority:** high
- **Pattern:** `import { Button } from "@/components/ui/button";`
- **Anti-pattern:** `import { Button } from "../../../components/ui/button";`
- **Applies to:** All internal imports

#### RULE: import-order
- **Scope:** universal
- **File:** `universal/imports-and-exports.md#import-order`
- **Tags:** imports, organization
- **Priority:** medium
- **Pattern:** React → Third-party → Components → Hooks → Services → Types
- **Applies to:** All files

#### RULE: named-exports-only
- **Scope:** universal
- **File:** `universal/imports-and-exports.md#export-patterns`
- **Tags:** exports, modules
- **Priority:** high
- **Pattern:** `export function ComponentName() { }`
- **Anti-pattern:** `export default function Component() { }`
- **Exception:** Next.js pages require default exports
- **Applies to:** All exports (except Next.js pages)

#### RULE: barrel-exports-index-files
- **Scope:** universal
- **File:** `universal/imports-and-exports.md#barrel-exports`
- **Tags:** exports, organization
- **Priority:** medium
- **Pattern:** Use `index.ts` for feature directories and services
- **Applies to:** Feature directories, services, constants

#### RULE: type-only-imports
- **Scope:** universal
- **File:** `universal/imports-and-exports.md#type-only-imports`
- **Tags:** imports, types
- **Priority:** medium
- **Pattern:** `import type { Worker } from "@clean-log/shared";`
- **Applies to:** Type-only imports

#### RULE: no-magic-strings
- **Scope:** universal
- **File:** `universal/constants.md#rule-no-magic-strings-in-business-logic`
- **Tags:** constants, magic-values
- **Priority:** high
- **Pattern:** `if (invoice.status === InvoiceStatus.PAID) { }`
- **Anti-pattern:** `if (invoice.status === "paid") { }`
- **Applies to:** All business logic

#### RULE: no-magic-numbers
- **Scope:** universal
- **File:** `universal/constants.md#rule-no-magic-numbers`
- **Tags:** constants, magic-values
- **Priority:** high
- **Pattern:** `const MAX_RETRY_ATTEMPTS = 3; if (retryCount > MAX_RETRY_ATTEMPTS) { }`
- **Anti-pattern:** `if (retryCount > 3) { }`
- **Applies to:** All numeric values with business meaning

#### RULE: constants-as-const
- **Scope:** universal
- **File:** `universal/constants.md#rule-use-as-const-for-literal-types`
- **Tags:** constants, typescript
- **Priority:** high
- **Pattern:** `export const STATUS = { ACTIVE: "active" } as const;`
- **Anti-pattern:** `export const STATUS = { ACTIVE: "active" };` (types widen)
- **Applies to:** Constant objects

#### RULE: derive-types-from-constants
- **Scope:** universal
- **File:** `universal/constants.md#rule-derive-types-from-constants`
- **Tags:** constants, typescript, types
- **Priority:** high
- **Pattern:** `export type Status = (typeof STATUS)[keyof typeof STATUS];`
- **Anti-pattern:** Manual type definition separate from const
- **Applies to:** Types representing constant values

#### RULE: constants-file-naming
- **Scope:** universal
- **File:** `universal/constants.md#rule-constants-file-naming`
- **Tags:** constants, files, naming
- **Priority:** medium
- **Pattern:** `invoice-constants.ts`, `payment-constants.ts`
- **Anti-pattern:** `CONSTANTS.ts`, `invoiceConstants.ts`
- **Applies to:** Constants files

#### RULE: error-messages-user-friendly
- **Scope:** universal
- **File:** `universal/error-handling.md#user-facing-messages`
- **Tags:** errors, ux, messages
- **Priority:** high
- **Pattern:** `setError("Failed to save changes. Please try again.");`
- **Anti-pattern:** `setError(error.message);` (technical details)
- **Applies to:** User-facing error messages

#### RULE: error-logging-structured
- **Scope:** universal
- **File:** `universal/error-handling.md#logged-messages`
- **Tags:** errors, logging
- **Priority:** high
- **Pattern:** `log.error("WorkersService: Failed", { organizationId, error: err.message });`
- **Applies to:** Error logging

#### RULE: service-error-rethrow
- **Scope:** universal
- **File:** `universal/error-handling.md#service-layer-pattern`
- **Tags:** errors, services
- **Priority:** high
- **Pattern:** Always rethrow in services, let caller handle
- **Applies to:** Service layer

#### RULE: hook-error-reset-state
- **Scope:** universal
- **File:** `universal/error-handling.md#hook-pattern`
- **Tags:** errors, hooks, state
- **Priority:** high
- **Pattern:** Reset error before fetch, reset data on error
- **Applies to:** Hooks

#### RULE: error-handling-finally
- **Scope:** universal
- **File:** `universal/error-handling.md#hook-pattern`
- **Tags:** errors, cleanup
- **Priority:** high
- **Pattern:** Use `finally` for cleanup that must run
- **Applies to:** Try-catch blocks

#### RULE: test-organization-tests-directory
- **Scope:** universal
- **File:** `universal/testing-principles.md#directory-structure`
- **Tags:** testing, organization
- **Priority:** high
- **Pattern:** Tests in `__tests__/` directories mirroring source
- **Applies to:** All test files

#### RULE: test-file-naming
- **Scope:** universal
- **File:** `universal/testing-principles.md#test-file-naming`
- **Tags:** testing, files, naming
- **Priority:** high
- **Pattern:** `*.test.{ts,tsx}`
- **Anti-pattern:** `*.spec.ts`, `test-*.ts`
- **Applies to:** Test files

#### RULE: test-aaa-pattern
- **Scope:** universal
- **File:** `universal/testing-principles.md#aaa-pattern`
- **Tags:** testing, structure
- **Priority:** high
- **Pattern:** Arrange, Act, Assert
- **Applies to:** All tests

#### RULE: test-fixtures-factory-functions
- **Scope:** universal
- **File:** `universal/testing-principles.md#use-factory-functions`
- **Tags:** testing, fixtures
- **Priority:** high
- **Pattern:** `createMockWorker(overrides?: Partial<Worker>)`
- **Anti-pattern:** Inline test data
- **Applies to:** Test data creation

#### RULE: test-mock-at-boundaries
- **Scope:** universal
- **File:** `universal/testing-principles.md#mock-at-boundaries`
- **Tags:** testing, mocking
- **Priority:** high
- **Pattern:** Mock external dependencies, not internal functions
- **Applies to:** Test mocking strategy

#### RULE: test-coverage-targets
- **Scope:** universal
- **File:** `universal/testing-principles.md#coverage-targets`
- **Tags:** testing, coverage
- **Priority:** medium
- **Pattern:** 80% lines/functions/statements, 75% branches; 90%+ for high-risk code
- **Applies to:** All code

### Dashboard Rules

#### RULE: dashboard-server-by-default
- **Scope:** dashboard
- **File:** `dashboard/components.md#default-to-server-components`
- **Tags:** nextjs, components, server-components
- **Priority:** high
- **Pattern:** Default to Server Component, add `"use client"` only when needed
- **Applies to:** Next.js components

#### RULE: dashboard-client-at-leaves
- **Scope:** dashboard
- **File:** `dashboard/components.md#client-components-at-leaves`
- **Tags:** nextjs, components, architecture
- **Priority:** high
- **Pattern:** Keep Client Components at the "leaves" of component tree
- **Applies to:** Next.js component architecture

#### RULE: dashboard-component-structure
- **Scope:** dashboard
- **File:** `dashboard/components.md#standard-component-template`
- **Tags:** components, structure, react
- **Priority:** high
- **Pattern:** Imports → Props interface → Component → Hooks → Handlers → Effects → Early returns → Render
- **Applies to:** React components

#### RULE: dashboard-state-components
- **Scope:** dashboard
- **File:** `dashboard/components.md#always-use-dedicated-state-components`
- **Tags:** components, ux, states
- **Priority:** high
- **Pattern:** Use `LoadingState`, `ErrorState`, `EmptyState` components
- **Applies to:** Component state handling

#### RULE: dashboard-props-forward-className
- **Scope:** dashboard
- **File:** `dashboard/components.md#forwarding-classname`
- **Tags:** components, styling, props
- **Priority:** medium
- **Pattern:** Always accept and forward `className` prop
- **Applies to:** Components

#### RULE: dashboard-component-max-size
- **Scope:** dashboard
- **File:** `dashboard/components.md#maximum-300-lines`
- **Tags:** components, size, refactoring
- **Priority:** medium
- **Pattern:** Max 300 lines, then split into hooks/sub-components
- **Applies to:** Components

#### RULE: dashboard-hook-return-interface
- **Scope:** dashboard
- **File:** `dashboard/hooks.md#return-type-interface`
- **Tags:** hooks, typescript, interfaces
- **Priority:** high
- **Pattern:** All hooks define and return explicit `Use[Name]Result` interface
- **Applies to:** Custom hooks

#### RULE: dashboard-hook-return-shape
- **Scope:** dashboard
- **File:** `dashboard/hooks.md#consistent-return-shape`
- **Tags:** hooks, consistency
- **Priority:** high
- **Pattern:** `{ data, loading, error, refetch }`
- **Applies to:** Data-fetching hooks

#### RULE: dashboard-tanstack-query-keys
- **Scope:** dashboard
- **File:** `dashboard/hooks.md#query-keys`
- **Tags:** hooks, tanstack-query, caching
- **Priority:** high
- **Pattern:** Use hierarchical query keys with factory pattern
- **Applies to:** TanStack Query hooks

#### RULE: dashboard-service-static-methods
- **Scope:** dashboard
- **File:** `dashboard/services.md#standard-service-template`
- **Tags:** services, architecture
- **Priority:** high
- **Pattern:** Services use static methods, no instances
- **Applies to:** Service classes

#### RULE: dashboard-service-crud-naming
- **Scope:** dashboard
- **File:** `dashboard/services.md#standard-service-template`
- **Tags:** services, naming
- **Priority:** high
- **Pattern:** `list()`, `get()`, `create()`, `update()`, `delete()`
- **Applies to:** Service methods

#### RULE: dashboard-service-logging
- **Scope:** dashboard
- **File:** `dashboard/services.md#always-log-operations`
- **Tags:** services, logging
- **Priority:** high
- **Pattern:** `log.debug()` on start, `log.info()` on success, `log.error()` on failure
- **Applies to:** Service methods

#### RULE: dashboard-service-always-rethrow
- **Scope:** dashboard
- **File:** `dashboard/services.md#always-rethrow-errors`
- **Tags:** services, errors
- **Priority:** high
- **Pattern:** Always rethrow after logging, let caller handle
- **Applies to:** Service error handling

#### RULE: dashboard-styling-semantic-tokens
- **Scope:** dashboard
- **File:** `dashboard/styling.md#semantic-color-tokens`
- **Tags:** styling, tailwind, design-tokens
- **Priority:** high
- **Pattern:** `bg-primary`, `text-primary-foreground`, `bg-muted`
- **Anti-pattern:** `bg-blue-500`, `bg-[#2563EB]`
- **Applies to:** All styling

#### RULE: dashboard-styling-cn-utility
- **Scope:** dashboard
- **File:** `dashboard/styling.md#the-cn-utility`
- **Tags:** styling, tailwind, utilities
- **Priority:** high
- **Pattern:** Always use `cn()` for conditional class merging
- **Applies to:** Conditional styling

#### RULE: dashboard-styling-spacing-scale
- **Scope:** dashboard
- **File:** `dashboard/styling.md#use-the-spacing-scale`
- **Tags:** styling, tailwind, spacing
- **Priority:** medium
- **Pattern:** `p-4`, `mt-6`, `space-y-4`
- **Anti-pattern:** `p-[17px]`, `mt-[23px]`
- **Applies to:** Spacing

#### RULE: dashboard-styling-mobile-first
- **Scope:** dashboard
- **File:** `dashboard/styling.md#mobile-first-approach`
- **Tags:** styling, responsive, tailwind
- **Priority:** high
- **Pattern:** Base styles for mobile, breakpoints for larger: `p-4 md:p-6 lg:p-8`
- **Applies to:** Responsive design

#### RULE: dashboard-styling-interactive-feedback
- **Scope:** dashboard
- **File:** `dashboard/styling.md#interactive-elements`
- **Tags:** styling, ux, interactions
- **Priority:** high
- **Pattern:** Always include cursor and hover states for interactive elements
- **Applies to:** Interactive elements

#### RULE: dashboard-styling-settings-pattern
- **Scope:** dashboard
- **File:** `dashboard/styling.md#settings-sections`
- **Tags:** styling, patterns, components
- **Priority:** medium
- **Pattern:** `<Card className="border-primary/20 bg-primary/5">`
- **Applies to:** Settings/configuration sections

### Mobile App Rules

#### RULE: mobile-native-components
- **Scope:** mobile-app
- **File:** `mobile-app/components.md#use-native-components`
- **Tags:** react-native, components
- **Priority:** high
- **Pattern:** Use `View`, `Text`, `Pressable` from `react-native`
- **Anti-pattern:** Web components (`div`, `span`, `button`)
- **Applies to:** All mobile components

#### RULE: mobile-onPress-not-onClick
- **Scope:** mobile-app
- **File:** `mobile-app/components.md#native-vs-web-components`
- **Tags:** react-native, events
- **Priority:** high
- **Pattern:** `onPress` for touch events
- **Anti-pattern:** `onClick` (web-only)
- **Applies to:** Event handlers

#### RULE: mobile-flatlist-for-lists
- **Scope:** mobile-app
- **File:** `mobile-app/components.md#flatlist-for-large-lists`
- **Tags:** react-native, lists, performance
- **Priority:** medium
- **Pattern:** Use `FlatList` for large lists
- **Applies to:** List rendering

#### RULE: mobile-safe-area-view
- **Scope:** mobile-app
- **File:** `mobile-app/components.md#handle-device-notches`
- **Tags:** react-native, layout, ux
- **Priority:** high
- **Pattern:** Use `SafeAreaView` for screen containers
- **Applies to:** Screen components

#### RULE: mobile-styling-direct-colors
- **Scope:** mobile-app
- **File:** `mobile-app/styling.md#available-colors`
- **Tags:** styling, nativewind, tailwind
- **Priority:** medium
- **Pattern:** Use direct colors like `bg-blue-500`, not semantic tokens
- **Note:** Different from dashboard (uses semantic tokens)
- **Applies to:** Mobile styling

#### RULE: mobile-styling-active-states
- **Scope:** mobile-app
- **File:** `mobile-app/styling.md#pressable-states`
- **Tags:** styling, interactions, nativewind
- **Priority:** medium
- **Pattern:** Use `active:` for press states (not `hover:`)
- **Applies to:** Interactive elements

### Edge Function Rules

#### RULE: edge-function-structure-order
- **Scope:** edge-functions
- **File:** `edge-functions/structure.md#execution-order`
- **Tags:** edge-functions, structure, order
- **Priority:** high
- **Pattern:** CORS → Logger → Validation → Auth → Business Logic → Response
- **Applies to:** All edge functions

#### RULE: edge-function-cors-first
- **Scope:** edge-functions
- **File:** `edge-functions/structure.md#function-template`
- **Tags:** edge-functions, cors, http
- **Priority:** high
- **Pattern:** Handle CORS preflight before any other logic
- **Applies to:** All edge functions

#### RULE: edge-function-per-function-deno-json
- **Scope:** edge-functions
- **File:** `edge-functions/structure.md#per-function-dependencies`
- **Tags:** edge-functions, dependencies, deno
- **Priority:** high
- **Pattern:** Each function has its own `deno.json`
- **Applies to:** Edge function dependencies

#### RULE: edge-function-service-role-client
- **Scope:** edge-functions
- **File:** `edge-functions/structure.md#supabase-client`
- **Tags:** edge-functions, supabase, database
- **Priority:** high
- **Pattern:** Use `createServiceRoleClient()` for database operations
- **Applies to:** Database access

#### RULE: edge-function-zod-validation
- **Scope:** edge-functions
- **File:** `edge-functions/validation.md#zod-schema-pattern`
- **Tags:** edge-functions, validation, zod
- **Priority:** high
- **Pattern:** Always use Zod for request validation
- **Applies to:** Request validation

#### RULE: edge-function-validate-early
- **Scope:** edge-functions
- **File:** `edge-functions/validation.md#usage-in-function`
- **Tags:** edge-functions, validation
- **Priority:** high
- **Pattern:** Validate request body before any processing
- **Applies to:** Request handling

#### RULE: edge-function-auth-org-membership
- **Scope:** edge-functions
- **File:** `edge-functions/auth.md#auth-utility`
- **Tags:** edge-functions, auth, security
- **Priority:** high
- **Pattern:** Always verify organization membership for org-scoped operations
- **Applies to:** Protected functions

#### RULE: edge-function-response-format
- **Scope:** edge-functions
- **File:** `edge-functions/structure.md#response-format`
- **Tags:** edge-functions, responses, api
- **Priority:** high
- **Pattern:** `{ success: true, data }` or `{ success: false, error }`
- **Applies to:** All responses

#### RULE: edge-function-naming-kebab-case
- **Scope:** edge-functions
- **File:** `edge-functions/structure.md#function-naming`
- **Tags:** edge-functions, naming
- **Priority:** high
- **Pattern:** `create-worker/`, `list-workers/`
- **Applies to:** Function directory names

---

## Decision-Making Approaches

### When Multiple Valid Approaches Exist

When you cannot provide a single, clear recommendation (i.e., multiple valid approaches exist or the best path is uncertain), use **tree of thought reasoning** to systematically explore options.

#### Process

1. **Identify all valid approaches** - Don't limit to the first solution that comes to mind
2. **Evaluate each option** against the triple criteria:
   - **Technical**: Scalability, efficiency, maintainability
   - **UX**: Usability, accessibility, task completion
   - **Business**: Value delivery, adoption potential
3. **Present options with analysis** - Show pros/cons for each approach
4. **Provide a recommendation** - Based on your analysis, explain why
5. **Show your reasoning** - Enable informed decision-making with full context

#### When to Use Tree of Thought

- Multiple valid approaches exist and trade-offs need evaluation
- The style guide doesn't cover the specific scenario
- Research reveals conflicting best practices
- Technical constraints create competing priorities
- UX considerations suggest different approaches

#### Example Structure

```markdown
## Approach Analysis

### Option 1: [Name]
- **Pros:** [benefits]
- **Cons:** [drawbacks]
- **Best for:** [when this makes sense]
- **Technical impact:** [scalability/efficiency notes]
- **UX impact:** [usability/accessibility notes]

### Option 2: [Name]
- **Pros:** [benefits]
- **Cons:** [drawbacks]
- **Best for:** [when this makes sense]
- **Technical impact:** [scalability/efficiency notes]
- **UX impact:** [usability/accessibility notes]

### Recommendation
Based on [criteria], I recommend **Option X** because [reasoning].
```

**Reference:** See Principle #8 in `README.md` for full details.

---

## Decision Lookup Table

### Component Decisions

| Question | Answer | Rule ID | File |
|----------|--------|---------|------|
| Should I use Server or Client Component? | Default to Server, add `"use client"` only when needed | `dashboard-server-by-default` | `dashboard/components.md` |
| Where should Client Components be placed? | At the "leaves" of the component tree | `dashboard-client-at-leaves` | `dashboard/components.md` |
| How should I structure a component? | Imports → Props → Component → Hooks → Handlers → Effects → Early returns → Render | `dashboard-component-structure` | `dashboard/components.md` |
| What should I use for loading/error/empty states? | Dedicated state components: `LoadingState`, `ErrorState`, `EmptyState` | `dashboard-state-components` | `dashboard/components.md` |
| Should I accept className prop? | Yes, always accept and forward `className` | `dashboard-props-forward-className` | `dashboard/components.md` |
| When should I split a component? | When it exceeds 300 lines | `dashboard-component-max-size` | `dashboard/components.md` |
| Should I use View or div in mobile? | Use `View` (native component) | `mobile-native-components` | `mobile-app/components.md` |
| Should I use onClick or onPress in mobile? | Use `onPress` (not `onClick`) | `mobile-onPress-not-onClick` | `mobile-app/components.md` |

### TypeScript Decisions

| Question | Answer | Rule ID | File |
|----------|--------|---------|------|
| Should I enable strict mode? | Yes, always | `typescript-strict-mode` | `universal/typescript.md` |
| Should exported functions have return types? | Yes, explicit return types for all exported functions | `typescript-explicit-return-types` | `universal/typescript.md` |
| Should local variables have type annotations? | No, let TypeScript infer | `typescript-infer-local-variables` | `universal/typescript.md` |
| Should I use `as const`? | Yes, for constant objects to preserve literal types | `typescript-as-const` | `universal/typescript.md` |
| Interface or type? | Interface for object shapes, type for unions/computed | `typescript-interfaces-vs-types` | `universal/typescript.md` |
| null or undefined? | `null` for database values, `undefined` for optional params | `typescript-null-vs-undefined` | `universal/typescript.md` |
| Enum or const object? | Const object with derived type (prefer over enums) | `typescript-const-objects-over-enums` | `universal/typescript.md` |

### Naming Decisions

| Question | Answer | Rule ID | File |
|----------|--------|---------|------|
| How should I name files? | kebab-case: `worker-card.tsx`, `use-workers.ts` | `file-naming-kebab-case` | `universal/naming-conventions.md` |
| How should I name functions? | camelCase: `calculateTotal()` | `function-naming-camelCase` | `universal/naming-conventions.md` |
| How should I name components? | PascalCase: `WorkerCard` | `component-naming-pascalCase` | `universal/naming-conventions.md` |
| How should I name hooks? | camelCase with `use` prefix: `useWorkers()` | `hook-naming-camelCase-use-prefix` | `universal/naming-conventions.md` |
| How should I name constants? | SCREAMING_SNAKE_CASE: `MAX_RETRY_ATTEMPTS` | `constants-naming-screaming-snake-case` | `universal/naming-conventions.md` |
| How should I name props interfaces? | `[ComponentName]Props`: `WorkerCardProps` | `props-interface-naming` | `universal/naming-conventions.md` |
| How should I name hook return types? | `Use[HookName]Result`: `UseWorkersResult` | `hook-return-interface-naming` | `universal/naming-conventions.md` |
| How should I name event handlers? | `handle` prefix: `handleClick` | `event-handler-naming-handle-prefix` | `universal/naming-conventions.md` |
| How should I name prop callbacks? | `on` prefix: `onEdit` | `prop-callback-naming-on-prefix` | `universal/naming-conventions.md` |
| How should I name boolean variables? | `is/has/can/should` prefix: `isLoading`, `hasError` | `boolean-variable-naming-prefixes` | `universal/naming-conventions.md` |
| How should I name arrays? | Plural nouns: `workers`, not `workerList` | `array-naming-plural` | `universal/naming-conventions.md` |
| How should I name service methods? | CRUD: `list()`, `get()`, `create()`, `update()`, `delete()` | `service-method-naming-crud` | `universal/naming-conventions.md` |

### Import/Export Decisions

| Question | Answer | Rule ID | File |
|----------|--------|---------|------|
| Should I use path aliases? | Yes, use `@/` for all internal imports | `path-aliases-at-slash` | `universal/imports-and-exports.md` |
| What order should imports be in? | React → Third-party → Components → Hooks → Services → Types | `import-order` | `universal/imports-and-exports.md` |
| Should I use named or default exports? | Named exports only (except Next.js pages) | `named-exports-only` | `universal/imports-and-exports.md` |
| Should I use barrel exports? | Yes, use `index.ts` for feature directories and services | `barrel-exports-index-files` | `universal/imports-and-exports.md` |
| Should I use `import type`? | Yes, for type-only imports | `type-only-imports` | `universal/imports-and-exports.md` |

### Constants Decisions

| Question | Answer | Rule ID | File |
|----------|--------|---------|------|
| Can I use string literals in comparisons? | No, use named constants | `no-magic-strings` | `universal/constants.md` |
| Can I use numeric literals? | No, use named constants for business-meaningful numbers | `no-magic-numbers` | `universal/constants.md` |
| Should constants use `as const`? | Yes, to preserve literal types | `constants-as-const` | `universal/constants.md` |
| Should I derive types from constants? | Yes, don't duplicate type definitions | `derive-types-from-constants` | `universal/constants.md` |
| How should I name constants files? | kebab-case: `invoice-constants.ts` | `constants-file-naming` | `universal/constants.md` |

### Error Handling Decisions

| Question | Answer | Rule ID | File |
|----------|--------|---------|------|
| How should I format user-facing errors? | Clear, actionable, non-technical messages | `error-messages-user-friendly` | `universal/error-handling.md` |
| How should I log errors? | Structured logging with context | `error-logging-structured` | `universal/error-handling.md` |
| Should services rethrow errors? | Yes, always rethrow after logging | `service-error-rethrow` | `universal/error-handling.md` |
| Should hooks reset state on error? | Yes, reset error before fetch, reset data on error | `hook-error-reset-state` | `universal/error-handling.md` |
| Should I use finally? | Yes, for cleanup that must run | `error-handling-finally` | `universal/error-handling.md` |

### Styling Decisions

| Question | Answer | Rule ID | File |
|----------|--------|---------|------|
| Should I use semantic tokens or direct colors? | Semantic tokens in dashboard (`bg-primary`), direct colors in mobile (`bg-blue-500`) | `dashboard-styling-semantic-tokens`, `mobile-styling-direct-colors` | `dashboard/styling.md`, `mobile-app/styling.md` |
| Should I use `cn()` utility? | Yes, always for conditional class merging | `dashboard-styling-cn-utility` | `dashboard/styling.md` |
| Can I use arbitrary spacing values? | No, use Tailwind spacing scale | `dashboard-styling-spacing-scale` | `dashboard/styling.md` |
| Should I use mobile-first? | Yes, base styles for mobile, breakpoints for larger | `dashboard-styling-mobile-first` | `dashboard/styling.md` |
| Should interactive elements have hover states? | Yes, always include cursor and hover states | `dashboard-styling-interactive-feedback` | `dashboard/styling.md` |
| Should I use hover or active in mobile? | Use `active:` for press states (not `hover:`) | `mobile-styling-active-states` | `mobile-app/styling.md` |

### Service Decisions

| Question | Answer | Rule ID | File |
|----------|--------|---------|------|
| Should services use static methods? | Yes, static methods only, no instances | `dashboard-service-static-methods` | `dashboard/services.md` |
| How should I name service methods? | CRUD: `list()`, `get()`, `create()`, `update()`, `delete()` | `dashboard-service-crud-naming` | `dashboard/services.md` |
| Should services log operations? | Yes, debug on start, info on success, error on failure | `dashboard-service-logging` | `dashboard/services.md` |
| Should services rethrow errors? | Yes, always rethrow after logging | `dashboard-service-always-rethrow` | `dashboard/services.md` |

### Hook Decisions

| Question | Answer | Rule ID | File |
|----------|--------|---------|------|
| Should hooks define return interfaces? | Yes, all hooks define `Use[Name]Result` interface | `dashboard-hook-return-interface` | `dashboard/hooks.md` |
| What should hooks return? | `{ data, loading, error, refetch }` for data-fetching hooks | `dashboard-hook-return-shape` | `dashboard/hooks.md` |
| How should I structure TanStack Query keys? | Hierarchical keys with factory pattern | `dashboard-tanstack-query-keys` | `dashboard/hooks.md` |

### Edge Function Decisions

| Question | Answer | Rule ID | File |
|----------|--------|---------|------|
| What order should edge function code be in? | CORS → Logger → Validation → Auth → Business Logic → Response | `edge-function-structure-order` | `edge-functions/structure.md` |
| Should I handle CORS first? | Yes, CORS must be handled before any other logic | `edge-function-cors-first` | `edge-functions/structure.md` |
| Should each function have its own deno.json? | Yes, per-function dependencies | `edge-function-per-function-deno-json` | `edge-functions/structure.md` |
| Should I use service role client? | Yes, for database operations | `edge-function-service-role-client` | `edge-functions/structure.md` |
| Should I use Zod for validation? | Yes, always use Zod for request validation | `edge-function-zod-validation` | `edge-functions/validation.md` |
| When should I validate? | Before any processing, validate early | `edge-function-validate-early` | `edge-functions/validation.md` |
| Should I verify organization membership? | Yes, always for org-scoped operations | `edge-function-auth-org-membership` | `edge-functions/auth.md` |
| What format should responses be? | `{ success: true, data }` or `{ success: false, error }` | `edge-function-response-format` | `edge-functions/structure.md` |
| How should I name functions? | kebab-case: `create-worker/`, `list-workers/` | `edge-function-naming-kebab-case` | `edge-functions/structure.md` |

### Testing Decisions

| Question | Answer | Rule ID | File |
|----------|--------|---------|------|
| Where should tests be located? | In `__tests__/` directories mirroring source | `test-organization-tests-directory` | `universal/testing-principles.md` |
| How should I name test files? | `*.test.{ts,tsx}` | `test-file-naming` | `universal/testing-principles.md` |
| How should I structure tests? | AAA pattern: Arrange, Act, Assert | `test-aaa-pattern` | `universal/testing-principles.md` |
| Should I use fixtures? | Yes, factory functions for test data | `test-fixtures-factory-functions` | `universal/testing-principles.md` |
| Where should I mock? | At boundaries (external deps), not internal functions | `test-mock-at-boundaries` | `universal/testing-principles.md` |
| What coverage should I target? | 80% lines/functions/statements, 75% branches; 90%+ for high-risk | `test-coverage-targets` | `universal/testing-principles.md` |

---

## Cross-Reference Map

### By Topic

#### TypeScript
- `typescript-strict-mode`
- `typescript-explicit-return-types`
- `typescript-infer-local-variables`
- `typescript-as-const`
- `typescript-interfaces-vs-types`
- `typescript-null-vs-undefined`
- `typescript-const-objects-over-enums`
- `constants-as-const`
- `derive-types-from-constants`

#### Naming Conventions
- `file-naming-kebab-case`
- `function-naming-camelCase`
- `component-naming-pascalCase`
- `hook-naming-camelCase-use-prefix`
- `constants-naming-screaming-snake-case`
- `const-objects-pascalCase`
- `interface-naming-pascalCase`
- `props-interface-naming`
- `hook-return-interface-naming`
- `event-handler-naming-handle-prefix`
- `prop-callback-naming-on-prefix`
- `boolean-variable-naming-prefixes`
- `array-naming-plural`
- `service-method-naming-crud`
- `edge-function-naming-kebab-case`

#### Imports & Exports
- `path-aliases-at-slash`
- `import-order`
- `named-exports-only`
- `barrel-exports-index-files`
- `type-only-imports`

#### Constants & Magic Values
- `no-magic-strings`
- `no-magic-numbers`
- `constants-as-const`
- `derive-types-from-constants`
- `constants-file-naming`
- `typescript-as-const`

#### Error Handling
- `error-messages-user-friendly`
- `error-logging-structured`
- `service-error-rethrow`
- `hook-error-reset-state`
- `error-handling-finally`
- `dashboard-service-always-rethrow`

#### Testing
- `test-organization-tests-directory`
- `test-file-naming`
- `test-aaa-pattern`
- `test-fixtures-factory-functions`
- `test-mock-at-boundaries`
- `test-coverage-targets`

#### Components (Dashboard)
- `dashboard-server-by-default`
- `dashboard-client-at-leaves`
- `dashboard-component-structure`
- `dashboard-state-components`
- `dashboard-props-forward-className`
- `dashboard-component-max-size`

#### Components (Mobile)
- `mobile-native-components`
- `mobile-onPress-not-onClick`
- `mobile-flatlist-for-lists`
- `mobile-safe-area-view`

#### Hooks
- `dashboard-hook-return-interface`
- `dashboard-hook-return-shape`
- `dashboard-tanstack-query-keys`

#### Services
- `dashboard-service-static-methods`
- `dashboard-service-crud-naming`
- `dashboard-service-logging`
- `dashboard-service-always-rethrow`

#### Styling (Dashboard)
- `dashboard-styling-semantic-tokens`
- `dashboard-styling-cn-utility`
- `dashboard-styling-spacing-scale`
- `dashboard-styling-mobile-first`
- `dashboard-styling-interactive-feedback`
- `dashboard-styling-settings-pattern`

#### Styling (Mobile)
- `mobile-styling-direct-colors`
- `mobile-styling-active-states`

#### Edge Functions
- `edge-function-structure-order`
- `edge-function-cors-first`
- `edge-function-per-function-deno-json`
- `edge-function-service-role-client`
- `edge-function-zod-validation`
- `edge-function-validate-early`
- `edge-function-auth-org-membership`
- `edge-function-response-format`
- `edge-function-naming-kebab-case`

### By Scope

#### Universal (Applies to All)
- All TypeScript rules
- All naming convention rules
- All import/export rules
- All constants rules
- All error handling rules
- All testing rules

#### Dashboard Only
- All dashboard component rules
- All dashboard hook rules
- All dashboard service rules
- All dashboard styling rules
- All dashboard testing rules

#### Mobile App Only
- All mobile component rules
- All mobile hook rules
- All mobile styling rules

#### Edge Functions Only
- All edge function structure rules
- All edge function validation rules
- All edge function auth rules
- All edge function testing rules

### By Priority

#### High Priority (Critical)
- `typescript-strict-mode`
- `typescript-explicit-return-types`
- `typescript-as-const`
- `typescript-interfaces-vs-types`
- `typescript-null-vs-undefined`
- `typescript-const-objects-over-enums`
- `file-naming-kebab-case`
- `function-naming-camelCase`
- `component-naming-pascalCase`
- `hook-naming-camelCase-use-prefix`
- `constants-naming-screaming-snake-case`
- `const-objects-pascalCase`
- `interface-naming-pascalCase`
- `path-aliases-at-slash`
- `named-exports-only`
- `no-magic-strings`
- `no-magic-numbers`
- `constants-as-const`
- `derive-types-from-constants`
- `error-messages-user-friendly`
- `error-logging-structured`
- `service-error-rethrow`
- `hook-error-reset-state`
- `error-handling-finally`
- `test-organization-tests-directory`
- `test-file-naming`
- `test-aaa-pattern`
- `test-fixtures-factory-functions`
- `test-mock-at-boundaries`
- `dashboard-server-by-default`
- `dashboard-client-at-leaves`
- `dashboard-component-structure`
- `dashboard-state-components`
- `dashboard-hook-return-interface`
- `dashboard-hook-return-shape`
- `dashboard-tanstack-query-keys`
- `dashboard-service-static-methods`
- `dashboard-service-crud-naming`
- `dashboard-service-logging`
- `dashboard-service-always-rethrow`
- `dashboard-styling-semantic-tokens`
- `dashboard-styling-cn-utility`
- `dashboard-styling-mobile-first`
- `dashboard-styling-interactive-feedback`
- `mobile-native-components`
- `mobile-onPress-not-onClick`
- `mobile-safe-area-view`
- `edge-function-structure-order`
- `edge-function-cors-first`
- `edge-function-per-function-deno-json`
- `edge-function-service-role-client`
- `edge-function-zod-validation`
- `edge-function-validate-early`
- `edge-function-auth-org-membership`
- `edge-function-response-format`
- `edge-function-naming-kebab-case`

#### Medium Priority (Important)
- `typescript-infer-local-variables`
- `array-naming-plural`
- `import-order`
- `barrel-exports-index-files`
- `type-only-imports`
- `constants-file-naming`
- `test-coverage-targets`
- `dashboard-props-forward-className`
- `dashboard-component-max-size`
- `dashboard-styling-spacing-scale`
- `dashboard-styling-settings-pattern`
- `mobile-flatlist-for-lists`
- `mobile-styling-direct-colors`
- `mobile-styling-active-states`

---

## Quick Reference by Common Tasks

### Creating a New Component
1. Use kebab-case file name: `worker-card.tsx`
2. Default to Server Component (Next.js), add `"use client"` only if needed
3. Use PascalCase component name: `export function WorkerCard() { }`
4. Define props interface: `interface WorkerCardProps { }`
5. Structure: Imports → Props → Component → Hooks → Handlers → Effects → Early returns → Render
6. Use state components for loading/error/empty: `LoadingState`, `ErrorState`, `EmptyState`
7. Always accept and forward `className` prop
8. Keep under 300 lines, split if larger

**Rules:** `file-naming-kebab-case`, `component-naming-pascalCase`, `dashboard-server-by-default`, `dashboard-component-structure`, `dashboard-state-components`, `dashboard-props-forward-className`, `dashboard-component-max-size`

### Creating a New Hook
1. Use kebab-case file name: `use-workers.ts`
2. Use camelCase with `use` prefix: `export function useWorkers() { }`
3. Define return interface: `interface UseWorkersResult { }`
4. Return consistent shape: `{ data, loading, error, refetch }`
5. Use TanStack Query with hierarchical query keys
6. Use named exports only

**Rules:** `file-naming-kebab-case`, `hook-naming-camelCase-use-prefix`, `dashboard-hook-return-interface`, `dashboard-hook-return-shape`, `dashboard-tanstack-query-keys`, `named-exports-only`

### Creating a New Service
1. Use kebab-case file name: `workers.service.ts`
2. Use static methods only, no instances
3. Use CRUD naming: `list()`, `get()`, `create()`, `update()`, `delete()`
4. Log operations: `log.debug()` on start, `log.info()` on success, `log.error()` on failure
5. Always rethrow errors after logging
6. Export from barrel file: `lib/services/index.ts`

**Rules:** `file-naming-kebab-case`, `dashboard-service-static-methods`, `dashboard-service-crud-naming`, `dashboard-service-logging`, `dashboard-service-always-rethrow`, `barrel-exports-index-files`

### Creating a New Edge Function
1. Use kebab-case directory name: `create-worker/`
2. Follow execution order: CORS → Logger → Validation → Auth → Business Logic → Response
3. Handle CORS first, before any other logic
4. Each function has its own `deno.json` for dependencies
5. Use `createServiceRoleClient()` for database operations
6. Validate with Zod before any processing
7. Verify organization membership for org-scoped operations
8. Return format: `{ success: true, data }` or `{ success: false, error }`

**Rules:** `edge-function-naming-kebab-case`, `edge-function-structure-order`, `edge-function-cors-first`, `edge-function-per-function-deno-json`, `edge-function-service-role-client`, `edge-function-zod-validation`, `edge-function-validate-early`, `edge-function-auth-org-membership`, `edge-function-response-format`

### Styling a Component
1. Use semantic tokens in dashboard: `bg-primary`, `text-primary-foreground`
2. Use direct colors in mobile: `bg-blue-500`
3. Always use `cn()` for conditional class merging
4. Use Tailwind spacing scale: `p-4`, `mt-6`, not arbitrary values
5. Use mobile-first: base styles for mobile, breakpoints for larger
6. Always include cursor and hover states for interactive elements
7. Use `active:` for press states in mobile (not `hover:`)

**Rules:** `dashboard-styling-semantic-tokens`, `mobile-styling-direct-colors`, `dashboard-styling-cn-utility`, `dashboard-styling-spacing-scale`, `dashboard-styling-mobile-first`, `dashboard-styling-interactive-feedback`, `mobile-styling-active-states`

### Defining Constants
1. No magic strings or numbers in business logic
2. Use `as const` for constant objects to preserve literal types
3. Derive types from constants, don't duplicate
4. Use SCREAMING_SNAKE_CASE for constants: `MAX_RETRY_ATTEMPTS`
5. Use PascalCase for const objects: `InvoiceStatus`
6. Name files kebab-case: `invoice-constants.ts`
7. Co-locate related constants in same file

**Rules:** `no-magic-strings`, `no-magic-numbers`, `constants-as-const`, `derive-types-from-constants`, `constants-naming-screaming-snake-case`, `const-objects-pascalCase`, `constants-file-naming`

---

*Last updated: January 26, 2026*
