# E2E Testing

This directory contains end-to-end tests for the Clean Log System dashboard using Playwright.

## Test Structure

- `fixtures.ts` - Test fixtures and utilities for authenticated sessions
- `01-authentication.spec.ts` - User authentication flow
- `02-worker-management.spec.ts` - Worker creation and management
- `03-job-management.spec.ts` - Job lifecycle and viewing
- `04-invoice-management.spec.ts` - Invoice generation and viewing
- `05-settings-configuration.spec.ts` - Organization settings and configuration

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests with UI mode (interactive)
pnpm test:e2e:ui

# Run tests in headed mode (see browser)
pnpm test:e2e:headed

# Generate test code (record actions)
pnpm test:e2e:codegen
```

## Environment Variables

Create a `.env.test` file with the following variables:

```env
# Test user credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
TEST_ORG_ID=your-org-id

# Base URL (defaults to http://localhost:3000)
E2E_BASE_URL=http://localhost:3000
```

## Test Strategy

These tests cover **5 critical user journeys**:

1. **Authentication**: Sign in, sign out, error handling
2. **Worker Management**: Create workers, view details
3. **Job Management**: View jobs, filter by status
4. **Invoice Management**: Create invoices, view details
5. **Settings**: Organization settings, field configs, pricing

## Test Data

Tests use the `data-testid` attributes for reliable element selection. Ensure your components include these attributes:

```tsx
// Example component with test IDs
<div data-testid="dashboard">
  <button data-testid="create-worker-button">Create Worker</button>
</div>
```

## CI/CD Integration

Tests run automatically in CI with:
- Retries on failure (2 attempts)
- JUnit XML reports for integration
- Screenshots and videos on failure
- All major browsers (Chrome, Firefox, Safari)

## Best Practices

1. **Keep tests focused**: Each test should verify one user journey
2. **Use fixtures**: Reuse authenticated sessions and test utilities
3. **Avoid hardcoded waits**: Use `waitForSelector` instead of `waitForTimeout`
4. **Clean test data**: Tests should be idempotent and not affect each other
5. **Test critical paths only**: E2E tests are expensive, focus on core flows
