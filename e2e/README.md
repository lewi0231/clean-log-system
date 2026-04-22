# E2E Testing

This directory contains end-to-end tests for the Tally Runner (monorepo) dashboard using Playwright.

## Directory Structure

```
e2e/
├── data/
│   └── scenario-1.json          # Test data for Scenario 1 (Car Yard Detailer)
├── helpers/
│   ├── db-seeder.ts             # Database seeding/cleanup utilities
│   ├── test-auth.ts             # Authentication bypass utilities
│   ├── test-utils.ts            # Common test helpers
│   └── types.ts                 # TypeScript type definitions
├── fixtures/
│   └── scenario-1.fixture.ts    # Playwright fixtures for Scenario 1
├── specs/
│   └── scenario-1/              # Scenario 1 test specs
│       ├── 01-setup-verification.spec.ts
│       ├── 04-job-creation.spec.ts
│       ├── 06-invoice-generation.spec.ts
│       └── 07-worker-payment.spec.ts
├── fixtures.ts                  # Legacy fixtures (existing specs)
├── global-setup.ts              # Seeds database before all tests
├── global-teardown.ts           # Cleans database after all tests
├── 01-authentication.spec.ts    # Legacy authentication tests
├── 02-worker-management.spec.ts # Legacy worker tests
├── ...                          # Other legacy specs
└── README.md                    # This file
```

## Test Projects

### Scenario 1: Car Yard Detailer

Comprehensive E2E tests with seeded test data. Tests the full workflow:

- Organization setup with hierarchy
- 6 workers (including 1 supervisor with rate card)
- 3 locations (2 under hierarchy, 1 independent)
- Field configs with mutual exclusivity
- Pricing rules and location modifiers
- Invoice generation and calculations
- Worker payment with supervisor bonuses

### Legacy Tests

Browser-specific tests using simple fixtures (existing specs).

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run only Scenario 1 tests
pnpm test:e2e --project=scenario-1

# Run tests with UI mode (interactive)
pnpm test:e2e:ui

# Run tests in headed mode (see browser)
pnpm test:e2e:headed

# Run specific test file
pnpm test:e2e e2e/specs/scenario-1/01-setup-verification.spec.ts

# Generate test code (record actions)
pnpm test:e2e:codegen
```

## Prerequisites

Before running Scenario 1 tests:

1. **Start local Supabase**:

   ```bash
   cd database && supabase start
   ```

2. **Start dashboard dev server** (automatic via playwright config):

   ```bash
   pnpm dev:dashboard
   ```

3. **Set environment variables** (optional - auto-detected from supabase status):
   ```bash
   export SUPABASE_URL=http://localhost:54321
   export SUPABASE_SERVICE_ROLE_KEY=<your-key>
   ```

## Global Setup/Teardown

Scenario 1 uses global setup and teardown:

- **Global Setup** (`global-setup.ts`):
  1. Seeds database with test organization, workers, locations, pricing rules
  2. Creates admin auth user (bypasses email verification)
  3. Authenticates and saves session state

- **Global Teardown** (`global-teardown.ts`):
  1. Cleans up all seeded test data
  2. Removes auth users
  3. Deletes temporary files

## Test Data

Test data is defined in `e2e/data/scenario-1.json`:

- **Organization**: Pro Detail Services (AUD, monthly invoicing)
- **Workers**: 6 workers (Sarah Mitchell is supervisor with rate card)
- **Locations**: City Motors (+20%), Suburban Auto, Budget Cars
- **Field Configs**: soaps_by_make, wipes_by_make, tender, warehouse
- **Pricing Rules**: Unit pricing, fixed fees, location modifiers
- **Rate Cards**: $0.50/car soap bonus, 2% shift percentage

See `docs/manual-testing-scenarios.md` for detailed test data documentation.

## Fixtures

### Scenario 1 Fixtures (`fixtures/scenario-1.fixture.ts`)

```typescript
import { test, expect, TestData, PageHelpers } from "../../fixtures/scenario-1.fixture";

test("example test", async ({ authenticatedPage, seededIds, scenarioData }) => {
  // authenticatedPage - Page with admin session
  // seededIds - Database IDs for seeded entities
  // scenarioData - Test data from JSON file
});
```

### Helper Functions

- `getLocationId(name)` - Get seeded location ID by name
- `getWorkerId(firstName, lastName)` - Get seeded worker ID
- `getFieldConfigId(name)` - Get seeded field config ID

### Page Helpers

- `PageHelpers.goToWorkers(page)`
- `PageHelpers.goToLocations(page)`
- `PageHelpers.goToCompletedJobs(page)`
- `PageHelpers.goToInvoices(page)`
- `PageHelpers.goToSettings(page)`

## Worker Activation Bypass

For testing, workers are created immediately active (bypassing invitation flow):

```typescript
// Workers are created with:
await supabase.from("worker").insert({ active: true });
await supabase.auth.admin.createUser({ email_confirm: true });
```

This avoids the need for email verification during tests.

## CI/CD Integration

Tests run automatically in CI with:

- Global setup/teardown for database seeding
- Retries on failure (2 attempts)
- JUnit XML reports for integration
- Screenshots and videos on failure
- Chrome browser (Scenario 1)

## Best Practices

1. **Use scenario fixtures**: Leverage typed fixtures for consistency
2. **Verify seeded data**: Setup verification tests run first
3. **Test calculations**: Verify pricing and payment calculations match expected values
4. **Cleanup on failure**: Global teardown handles cleanup even if tests fail
5. **Avoid parallel execution**: Scenario tests run sequentially to maintain data consistency
