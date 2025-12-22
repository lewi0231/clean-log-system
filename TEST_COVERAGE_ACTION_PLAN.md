# Test Coverage Action Plan

## Quick Summary

- **Current Coverage**: 12% of Supabase functions, ~60% of dashboard services
- **Critical Gap**: 5 critical functions have NO tests
- **Priority**: Add tests for critical functions immediately

---

## Immediate Actions (This Week)

### 1. Add Tests for Critical Functions (P0)

#### `create-job` (566 lines, HIGH RISK)

```typescript
// Priority test cases:
✅ Worker authentication
✅ Location validation (required vs optional)
✅ Colleague validation
✅ Submission data processing
✅ Feedback email sending (should not fail job creation)
✅ Error handling for invalid data
```

#### `update-job` (494 lines, HIGH RISK)

```typescript
// Priority test cases:
✅ Admin-only authorization
✅ Job ownership validation
✅ Submission data updates
✅ Worker assignment changes
✅ Invalid worker_ids handling
```

#### `calculate-invoice` (CRITICAL - Financial)

```typescript
// Priority test cases:
✅ Pricing rule application
✅ Location hierarchy precedence
✅ Multiple jobs aggregation
✅ Zero total calculations
✅ Missing pricing rules
✅ Expired/future pricing rules
```

#### `calculate-worker-payment` (CRITICAL - Financial)

```typescript
// Priority test cases:
✅ Worker payment type calculations
✅ Percentage-based payments
✅ Fixed rate payments
✅ Multiple jobs aggregation
✅ Null worker_payment_value handling
```

#### `update-invoice-status` (CRITICAL - Status Transitions)

```typescript
// Priority test cases:
✅ Status transitions (draft → sent → paid)
✅ Payment link creation
✅ Email sending
✅ Invalid status transitions
✅ Resending already sent invoice
```

---

## Critical Edge Cases to Test (P0)

### Payment & Invoicing

1. ❌ **Duplicate job invoicing** - Prevent invoicing job already on invoice
2. ❌ **Zero total invoice** - Handle $0 invoices correctly
3. ❌ **Email sending failure** - Should not fail invoice creation
4. ❌ **Payment for already paid invoice** - Idempotency
5. ❌ **Payment amount mismatch** - Handle partial/overpayments
6. ❌ **No email recipients** - Error handling

### Job Management

1. ❌ **Concurrent job updates** - Prevent data loss
2. ❌ **Invalid worker assignment** - Cross-organization prevention
3. ❌ **Job deletion with invoices** - Data integrity

### Pricing

1. ❌ **No pricing rules** - Zero total handling
2. ❌ **Expired pricing rules** - Rule selection
3. ❌ **Multiple matching rules** - Priority handling

---

## Missing Service Tests (P0)

Add tests for these services (currently NO tests):

1. ❌ `invoice.service`
2. ❌ `field-configs.service`
3. ❌ `invoice-template.service`
4. ❌ `organization-users.service`
5. ❌ `feedback.service`
6. ❌ `location-hierarchy.service`

---

## Test Coverage Setup (P0)

### Add Coverage Reporting

```typescript
// vitest.config.mts
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      exclude: ["node_modules/", "**/*.test.{ts,tsx}", "**/__tests__/**"],
    },
  },
});
```

### Add Coverage Script

```json
// package.json
{
  "scripts": {
    "test:coverage": "vitest run --coverage",
    "test:coverage:watch": "vitest --coverage"
  }
}
```

---

## Week-by-Week Plan

### Week 1: Critical Functions

- [ ] `create-job` tests
- [ ] `update-job` tests
- [ ] `calculate-invoice` tests

### Week 2: Financial Functions

- [ ] `calculate-worker-payment` tests
- [ ] `update-invoice-status` tests
- [ ] Payment edge cases

### Week 3: Service Tests

- [ ] `invoice.service` tests
- [ ] `field-configs.service` tests
- [ ] `invoice-template.service` tests

### Week 4: Edge Cases

- [ ] Payment edge cases
- [ ] Job management edge cases
- [ ] Pricing edge cases

---

## Test Quality Improvements

### 1. Add Error Handling Tests

- Test all error scenarios
- Verify error messages are clear
- Test error recovery

### 2. Add Authorization Tests

- Test unauthorized access
- Test cross-organization access
- Test role-based permissions

### 3. Add Validation Tests

- Test input validation
- Test boundary conditions
- Test invalid data handling

### 4. Improve Test Organization

- Create shared test utilities
- Separate unit from integration tests
- Add Deno test utilities for edge functions

---

## Success Metrics

### Coverage Goals

- **Critical Functions**: 12% → 100% (Week 2)
- **Services**: 60% → 90% (Week 3)
- **Edge Cases**: 30% → 85% (Week 4)

### Quality Goals

- All critical functions have tests
- All services have tests
- Coverage reporting in place
- CI fails if coverage drops below threshold

---

## Quick Reference: Functions Needing Tests

### Critical (P0) - Test First

1. `create-job` ❌
2. `update-job` ❌
3. `calculate-invoice` ❌
4. `calculate-worker-payment` ❌
5. `update-invoice-status` ❌

### High Priority (P1) - Test Next

6. `create-worker` ❌
7. `update-worker` ❌
8. `delete-worker` ❌
9. `create-location` ❌
10. `update-location` ❌
11. `delete-location` ❌
12. `create-field-config` ❌
13. `update-field-config` ❌
14. `delete-field-config` ❌
15. `create-pricing-rule` ❌
16. `update-pricing-rule` ❌
17. `delete-pricing-rule` ❌

### Medium Priority (P2) - Test Later

- All `list-*` functions (18 functions)
- All `get-*` functions (6 functions)
- Remaining CRUD functions (30+ functions)

---

## Testing Checklist for New Functions

When adding tests for a function, ensure:

- [ ] Happy path tested
- [ ] Error cases tested
- [ ] Authorization tested
- [ ] Validation tested
- [ ] Edge cases tested
- [ ] Integration with other functions tested (if applicable)

---

_See TEST_COVERAGE_REVIEW.md for detailed analysis_
