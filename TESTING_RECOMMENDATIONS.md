# High Priority Tests for Invoicing System

## Overview

This document outlines the critical tests needed for the invoicing system, prioritized by risk and business impact.

## Test Priority Levels

- **P0 (Critical)**: Must have before production - prevents data loss or security issues
- **P1 (High)**: Should have before production - prevents major bugs
- **P2 (Medium)**: Nice to have - improves confidence and maintainability

## P0 - Critical Tests

### 1. Email Recipient Resolution Tests

**Why Critical:** Incorrect email addresses mean invoices don't reach customers, causing payment delays.

**Test Cases:**

```typescript
describe("getInvoiceEmailRecipient", () => {
  describe("Jobs with locations", () => {
    it(
      "P0: should use hierarchy billing email when location_email_source is hierarchy_billing_email and hierarchy has billing email"
    );
    it(
      "P0: should fallback to location.email when hierarchy billing email not available"
    );
    it(
      "P0: should use location.email when location_email_source is location_email"
    );
    it("P0: should use default_email when location email is missing");
    it("P0: should return null when no email source available and no default");
  });

  describe("Jobs without locations", () => {
    it(
      "P0: should extract email from form field when form_field_email is configured"
    );
    it("P0: should use field config name to lookup submission_data value");
    it("P0: should validate email format (contains @ and .)");
    it("P0: should fallback to default_email when form field email invalid");
    it("P0: should return null when no email available");
  });

  describe("Edge cases", () => {
    it("P0: should handle null submission_data gracefully");
    it("P0: should handle missing field config in map");
    it("P0: should handle empty string emails");
    it("P0: should trim whitespace from emails");
  });
});
```

**Implementation Location:** `database/supabase/functions/_utils/__tests__/invoice-email.test.ts`

### 2. Auto-Send Configuration Validation Tests

**Why Critical:** Incorrect scheduling could send invoices at wrong times or not at all.

**Test Cases:**

```typescript
describe("shouldRunAutoSend", () => {
  describe("Daily schedule", () => {
    it("P0: should return true at configured time");
    it("P0: should return false at different time");
    it("P0: should use default 09:00 when time not specified");
  });

  describe("Weekly schedule", () => {
    it("P0: should return true on correct day of week at configured time");
    it("P0: should return false on wrong day of week");
    it("P0: should handle Sunday (0) correctly");
    it("P0: should handle Saturday (6) correctly");
  });

  describe("Monthly schedule", () => {
    it("P0: should return true on correct day of month at configured time");
    it("P0: should return false on wrong day of month");
    it("P0: should handle month-end correctly (day 31 in months with 30 days)");
  });

  describe("Disabled config", () => {
    it("P0: should return false when enabled is false");
    it("P0: should return false when config is null");
  });
});
```

**Implementation Location:** `database/supabase/functions/__tests__/auto-send-invoices.test.ts`

### 3. Invoice Status Transition Tests

**Why Critical:** Wrong status transitions could cause invoices to be sent prematurely or not at all.

**Test Cases:**

```typescript
describe("Invoice creation status", () => {
  it(
    'P0: should create as "sent" when invoice_send_immediately is true and no hierarchy auto-send'
  );
  it('P0: should create as "draft" when invoice_send_immediately is false');
  it(
    'P0: should create as "draft" when hierarchy auto-send is enabled (overrides immediate)'
  );
  it(
    'P0: should create as "draft" when invoice_send_immediately is true but hierarchy auto-send exists'
  );
});
```

**Implementation Location:** `database/supabase/functions/__tests__/create-invoice.test.ts`

### 4. Auto-Send Precedence Tests

**Why Critical:** Incorrect precedence could send invoices multiple times or not send them at all.

**Test Cases:**

```typescript
describe("Auto-send precedence", () => {
  it(
    "P0: hierarchy auto-send should take precedence over organization auto-send"
  );
  it(
    "P0: should not send invoice twice if covered by both hierarchy and org auto-send"
  );
  it(
    "P0: should only send invoices for locations under hierarchy nodes with auto-send"
  );
  it(
    "P0: organization auto-send should only process invoices not covered by hierarchy"
  );
});
```

**Implementation Location:** `database/supabase/functions/__tests__/auto-send-invoices.test.ts`

## P1 - High Priority Tests

### 5. Invoice Template Config Defaults Tests

**Why High Priority:** Missing defaults could cause runtime errors or incorrect invoice rendering.

**Test Cases:**

```typescript
describe("Invoice template config defaults", () => {
  it("P1: should create default config when none exists");
  it("P1: should use correct default values for all fields");
  it(
    "P1: should migrate legacy bill_to_fields to service_address_config.form_fields"
  );
  it("P1: should preserve existing config values on partial update");
});
```

**Implementation Location:** `database/supabase/functions/__tests__/get-invoice-template-config.test.ts`

### 6. Service Address Config Tests

**Why High Priority:** Incorrect address display could confuse customers or cause delivery issues.

**Test Cases:**

```typescript
describe("Service address configuration", () => {
  describe("Source: auto", () => {
    it("P1: should use location fields when location exists");
    it("P1: should use form fields when location does not exist");
    it("P1: should prefer location over form fields when both available");
  });

  describe("Source: location", () => {
    it("P1: should only use location fields");
    it("P1: should display selected location fields in correct order");
  });

  describe("Source: form_fields", () => {
    it("P1: should only use form fields");
    it("P1: should map field config names to submission_data correctly");
  });

  describe("Location field selection", () => {
    it("P1: should only display selected location fields");
    it("P1: should handle empty location_fields array");
  });
});
```

**Implementation Location:** `dashboard/__tests__/components/settings/invoice-template-settings.test.tsx`

### 7. Billing Address Config Tests

**Why High Priority:** Missing or incorrect billing addresses could cause payment issues.

**Test Cases:**

```typescript
describe("Billing address configuration", () => {
  it("P1: should not display billing address when disabled");
  it("P1: should display billing address when enabled");
  it("P1: should auto-detect from hierarchy when source is auto");
  it("P1: should use hierarchy metadata when source is hierarchy");
  it("P1: should fallback gracefully when hierarchy billing address missing");
});
```

**Implementation Location:** `dashboard/__tests__/components/settings/invoice-template-settings.test.tsx`

### 8. Form Field Email Mapping Tests

**Why High Priority:** Incorrect mapping means emails won't be found in submission data.

**Test Cases:**

```typescript
describe("Form field email mapping", () => {
  it("P1: should map field config ID to field config name correctly");
  it("P1: should lookup email in submission_data using field config name");
  it("P1: should handle field config not found in map");
  it("P1: should handle field config name not in submission_data");
  it("P1: should handle non-string email values in submission_data");
});
```

**Implementation Location:** `database/supabase/functions/__tests__/auto-send-invoices.test.ts`

### 9. Invoice Template Config Validation Tests

**Why High Priority:** Invalid config could cause invoice rendering to fail.

**Test Cases:**

```typescript
describe("Invoice template config validation", () => {
  it("P1: should reject invalid invoice_title (empty string)");
  it("P1: should reject invalid service_address_config.source");
  it("P1: should reject invalid location_fields values");
  it("P1: should reject invalid billing_address_config.source");
  it("P1: should reject invalid email_recipient_config.location_email_source");
  it("P1: should reject invalid email format in default_email");
  it("P1: should accept null for optional fields");
});
```

**Implementation Location:** `database/supabase/functions/__tests__/update-invoice-template-config.test.ts`

## P2 - Medium Priority Tests

### 10. UI Component Tests

**Test Cases:**

```typescript
describe("InvoiceTemplateSettings component", () => {
  it("P2: should load and display current config");
  it("P2: should update local state when config changes");
  it("P2: should show loading state while fetching");
  it("P2: should show error state on fetch failure");
  it("P2: should disable save button while saving");
  it("P2: should show success message after save");
  it("P2: should allow adding form fields to service address");
  it("P2: should allow removing form fields from service address");
  it("P2: should filter available fields correctly");
});
```

**Implementation Location:** `dashboard/__tests__/components/settings/invoice-template-settings.test.tsx`

### 11. Integration Tests

**Test Cases:**

```typescript
describe("Invoice creation to auto-send flow", () => {
  it("P2: should create draft invoice when hierarchy auto-send enabled");
  it("P2: should send invoice at scheduled time");
  it("P2: should determine correct email recipients");
  it("P2: should update invoice status to sent");
  it("P2: should handle multiple jobs with different locations");
  it("P2: should deduplicate email recipients for multiple jobs");
});
```

**Implementation Location:** `database/supabase/functions/__tests__/integration/invoice-flow.test.ts`

### 12. Edge Case Tests

**Test Cases:**

```typescript
describe("Edge cases", () => {
  it("P2: should handle organization with no invoice template config");
  it("P2: should handle location with no hierarchy parent");
  it("P2: should handle job with no location and no submission_data");
  it("P2: should handle timezone differences in auto-send scheduling");
  it("P2: should handle concurrent invoice creation");
  it("P2: should handle very large invoice numbers");
});
```

## Test Implementation Strategy

### Phase 1: Critical Path (Week 1)

1. Email recipient resolution tests (P0)
2. Auto-send configuration validation (P0)
3. Invoice status transitions (P0)

### Phase 2: Core Functionality (Week 2)

4. Auto-send precedence tests (P0)
5. Invoice template config defaults (P1)
6. Service address config tests (P1)

### Phase 3: Validation & Edge Cases (Week 3)

7. Billing address config tests (P1)
8. Form field email mapping (P1)
9. Config validation tests (P1)

### Phase 4: UI & Integration (Week 4)

10. UI component tests (P2)
11. Integration tests (P2)
12. Edge case tests (P2)

## Test Data Setup

Create test fixtures for:

```typescript
// test-fixtures/invoice-email.ts
export const mockJobWithLocation = {
  location_id: "loc-1",
  location: {
    id: "loc-1",
    email: "location@example.com",
    hierarchy_parent_id: "hier-1",
  },
  submission_data: {},
};

export const mockJobWithoutLocation = {
  location_id: null,
  location: null,
  submission_data: {
    customer_email: "customer@example.com",
  },
};

export const mockHierarchyWithBilling = {
  id: "hier-1",
  metadata: {
    billing_address: {
      email: "billing@company.com",
    },
  },
};

// ... more fixtures
```

## Test Coverage Goals

- **P0 tests**: 100% coverage
- **P1 tests**: 90% coverage
- **P2 tests**: 80% coverage
- **Overall**: Minimum 85% coverage for invoicing code

## Running Tests

```bash
# Run all invoicing tests
npm test -- invoicing

# Run only P0 tests
npm test -- invoicing --grep "P0"

# Run with coverage
npm test -- invoicing --coverage
```

## Continuous Integration

Add to CI pipeline:

1. Run all P0 tests on every commit
2. Run full test suite on PR
3. Block merge if P0 tests fail
4. Generate coverage report
