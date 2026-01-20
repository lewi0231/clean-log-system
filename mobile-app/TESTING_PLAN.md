# Mobile App Test Coverage Improvement Plan

## Current State
- **Current Coverage**: ~20%
- **Target Coverage**: 80%
- **Existing Tests**: 4 test files
  - `field-renderer.test.tsx`
  - `use-alert-dialog.test.ts`
  - `use-entry-form.test.ts`
  - `utils.test.ts`

## Completed Tests

### Hooks (2/13)
- ✅ `use-auth.test.ts` - Authentication state management
- ✅ `use-current-worker.test.ts` - Worker fetching and filtering

### Need Coverage

#### Hooks (11 remaining)
- [ ] `useOrganization.ts` - Organization context
- [ ] `use-user-role.ts` - Role-based access
- [ ] `use-field-configs.ts` - Field configuration management (HIGH PRIORITY - complex logic)
- [ ] `use-organization-settings.ts` - Organization settings
- [ ] `use-colleagues.ts` - Worker colleague list
- [ ] `use-locations.ts` - Location management
- [ ] `use-color-scheme.ts` - Theme management
- [ ] `use-theme-color.ts` - Color utilities

#### Components (8 remaining)
- [ ] `group-breakdown-field.tsx` - Complex field grouping logic
- [ ] `parallax-scroll-view.tsx` - Animated scroll component
- [ ] `themed-text.tsx` - Themed text component
- [ ] `themed-view.tsx` - Themed view component
- [ ] `haptic-tab.tsx` - Tab with haptic feedback
- [ ] `external-link.tsx` - External link component
- [ ] `hello-wave.tsx` - Animated wave component

#### Utilities
- [ ] `lib/supabase.ts` - Supabase client configuration
- [ ] `lib/validation.ts` - Validation utilities

#### Services
- [ ] API service layer tests
- [ ] Job submission tests
- [ ] Data synchronization tests

## Test Strategy

### Priority 1: High-Complexity Business Logic
1. **use-field-configs.ts** (388 lines)
   - Complex validation rules
   - Field clustering
   - Mutual exclusivity
   - Dynamic field values
   - Required tests: 15-20 test cases

2. **group-breakdown-field.tsx**
   - Grouped field breakdown logic
   - Required tests: 10-12 test cases

### Priority 2: Core Hooks
3. **useOrganization.ts** - 8-10 test cases
4. **use-user-role.ts** - 6-8 test cases
5. **use-locations.ts** - 8-10 test cases

### Priority 3: UI Components
6. Theme components (themed-text, themed-view) - 4-6 test cases each
7. Interactive components (haptic-tab, external-link) - 3-5 test cases each

### Priority 4: Integration Tests
8. Job submission flow - 5-7 test cases
9. Authentication flow - 4-6 test cases
10. Field validation flow - 8-10 test cases

## Testing Patterns

### Hook Testing Pattern
```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("useHookName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default state", () => {
    // Test implementation
  });

  it("should handle success case", async () => {
    // Test implementation
  });

  it("should handle error case", async () => {
    // Test implementation
  });
});
```

### Component Testing Pattern
```typescript
import { render, screen, fireEvent } from "@testing-library/react-native";
import { describe, it, expect, vi } from "vitest";

describe("ComponentName", () => {
  it("should render correctly", () => {
    // Test implementation
  });

  it("should handle user interaction", () => {
    // Test implementation
  });

  it("should display error state", () => {
    // Test implementation
  });
});
```

## Coverage Goals by Area

| Area | Current | Target | Priority |
|------|---------|--------|----------|
| Hooks | 15% | 85% | High |
| Components | 10% | 75% | Medium |
| Utils | 30% | 90% | High |
| Services | 0% | 70% | Medium |
| Integration | 0% | 60% | Low |

## Implementation Status

- [x] Test infrastructure setup (Vitest)
- [x] Testing patterns documented
- [x] Initial hook tests created (2/13)
- [ ] Complete hook test coverage (11 remaining)
- [ ] Complete component test coverage (8 remaining)
- [ ] Integration tests (0/3 suites)
- [ ] Coverage report automation

## Next Steps

1. **Week 1**: Complete high-priority hook tests
   - use-field-configs.ts
   - useOrganization.ts
   - use-user-role.ts

2. **Week 2**: Component testing
   - group-breakdown-field.tsx
   - Theme components
   - Interactive components

3. **Week 3**: Integration & edge cases
   - Job submission flow
   - Authentication flow
   - Error handling

4. **Week 4**: Coverage analysis & gaps
   - Run coverage reports
   - Identify gaps
   - Add missing tests

## Running Tests

```bash
# Run all tests
pnpm --filter @clean-log/mobile-app test

# Run tests in watch mode
pnpm --filter @clean-log/mobile-app test:watch

# Run tests with UI
pnpm --filter @clean-log/mobile-app test:ui

# Run with coverage
pnpm --filter @clean-log/mobile-app test --coverage
```

## Success Criteria

- [ ] 80% line coverage
- [ ] 75% branch coverage
- [ ] 80% function coverage
- [ ] All critical paths tested
- [ ] No flaky tests
- [ ] CI/CD integration
