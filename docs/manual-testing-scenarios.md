# Manual Testing Scenarios

This document outlines three user personas and scenarios for manual testing of the Clean Log System. Each scenario represents a different business model and use case to ensure the platform works effectively across various service-based businesses.

## Scenario 1: Car Yard Detailer (Fixed Locations, Multiple Employees)

### Business Profile

- **Business Type**: Car yard detailing service
- **Business Name**: Pro Detail Services
- **Business Size**: 6 employees (5 regular + 1 supervisor)
- **Payment Model**: Fortnightly wages
- **Location Model**: Fixed locations (car yards) with hierarchy
- **User Role**: Business owner/admin
- **Currency**: AUD

### Key Characteristics

- Multiple workers completing jobs at fixed customer locations
- Workers are paid fortnightly (not per job or hourly)
- Jobs are location-specific (different car yards)
- Invoicing happens monthly (batch invoicing)
- Business uses customer locations feature
- One supervisor with performance-based rate card bonuses
- Location hierarchy for parent company grouping
- Mutually exclusive field groups (can only fill one type of work per job)

### E2E Test Data Reference

This scenario has automated E2E tests in `e2e/specs/scenario-1/`. The test data is defined in `e2e/data/scenario-1.json`.

### Test Organization Setup

| Setting | Value |
|---------|-------|
| Organization Name | Pro Detail Services |
| Industry | Automotive/Detailing |
| Currency | AUD |
| Invoice Frequency | Monthly |
| Worker Payment Cycle | Fortnightly |
| Auto-send Invoices | No (requires review) |

### Workers (6 Total)

| Name | Email | Phone | Role | Rate Card |
|------|-------|-------|------|-----------|
| Sarah Mitchell | sarah.mitchell@prodetail.test | 0412345001 | Supervisor | Yes |
| Michael Chen | michael.chen@prodetail.test | 0412345002 | Worker | No |
| Emma Johnson | emma.johnson@prodetail.test | 0412345003 | Worker | No |
| David Williams | david.williams@prodetail.test | 0412345004 | Worker | No |
| Lisa Brown | lisa.brown@prodetail.test | 0412345005 | Worker | No |
| James Taylor | james.taylor@prodetail.test | 0412345006 | Worker | No |

### Supervisor Rate Card (Sarah Mitchell)

| Modifier | Type | Value | Description |
|----------|------|-------|-------------|
| Soap Bonus | Unit | $0.50/car | Bonus per car soaped (soaps_by_make field) |
| Shift Percentage | Percentage | 2% | Percentage of total job earnings |

### Location Hierarchy

```
Metro Auto Group (Parent Company)
├── City Motors (CBD, +20% premium)
└── Suburban Auto (Standard pricing)

Budget Cars (Independent, no parent)
```

| Location | Address | Contact | Phone | Hierarchy | Pricing Modifier |
|----------|---------|---------|-------|-----------|------------------|
| City Motors | 123 CBD Street, Sydney NSW 2000 | John Smith | 0291234567 | Metro Auto Group | +20% premium |
| Suburban Auto | 456 Main Road, Parramatta NSW 2150 | Jane Doe | 0298765432 | Metro Auto Group | None |
| Budget Cars | 789 Industrial Ave, Blacktown NSW 2148 | Bob Wilson | 0296543210 | None (independent) | None |

### Field Configurations

| Field Name | Type | Label | Mutual Exclusive Group | Options |
|------------|------|-------|------------------------|---------|
| `soaps_by_make` | grouped_breakdown | Soaps by Car Make | detailing_work | Toyota, Honda, Ford, BMW, Other |
| `wipes_by_make` | grouped_breakdown | Wipes by Car Make | detailing_work | Toyota, Honda, Ford, BMW, Other |
| `tender` | number | Tender Amount | tender_work | Min: 0, Max: 10000 |
| `warehouse` | boolean | Warehouse Duties | warehouse_work | N/A |

**Mutual Exclusivity Rules:**
- `detailing_work` group: soaps_by_make and wipes_by_make can be used together
- `tender_work` group: Only tender field
- `warehouse_work` group: Only warehouse field
- Cannot fill fields from different groups in the same job

### Pricing Rules

| Rule | Scope | Type | Value | Applies To |
|------|-------|------|-------|------------|
| Soap per car | Field | Unit | $5.00/car | soaps_by_make |
| Wipe per car | Field | Unit | $3.00/car | wipes_by_make |
| Tender handling | Field | Fixed | $10.00 | tender (when > 0) |
| Warehouse flat | Field | Fixed | $25.00 | warehouse (when true) |
| City Motors premium | Location | Percentage | +20% | City Motors only |

### Test Jobs & Expected Calculations

#### Job 1: Detailing at City Motors (Regular Worker)

| Field | Location | Worker | Submission Data |
|-------|----------|--------|-----------------|
| soaps_by_make | City Motors | Michael Chen | Toyota: 3, Honda: 2 |

**Expected Invoice:**
- Soap subtotal: 5 cars × $5.00 = **$25.00**
- Location modifier (CBD +20%): **$5.00**
- **Invoice Total: $30.00**

#### Job 2: Detailing at Suburban Auto (Supervisor)

| Field | Location | Worker | Submission Data |
|-------|----------|--------|-----------------|
| soaps_by_make | Suburban Auto | Sarah Mitchell | Ford: 4 |
| wipes_by_make | Suburban Auto | Sarah Mitchell | BMW: 2 |

**Expected Invoice:**
- Soap subtotal: 4 cars × $5.00 = **$20.00**
- Wipe subtotal: 2 cars × $3.00 = **$6.00**
- **Invoice Total: $26.00**

**Expected Worker Payment (Supervisor):**
- Base payment: $26.00
- Soap bonus: 4 cars × $0.50 = **$2.00**
- Shift percentage: 2% × $26.00 = **$0.52**
- **Worker Payment Total: $28.52**

#### Job 3: Tender at Budget Cars (Regular Worker)

| Field | Location | Worker | Submission Data |
|-------|----------|--------|-----------------|
| tender | Budget Cars | Emma Johnson | 500 |

**Expected Invoice:**
- Tender flat fee: **$10.00**
- **Invoice Total: $10.00**

#### Job 4: Warehouse at City Motors (Regular Worker)

| Field | Location | Worker | Submission Data |
|-------|----------|--------|-----------------|
| warehouse | City Motors | David Williams | true |

**Expected Invoice:**
- Warehouse subtotal: **$25.00**
- Location modifier (CBD +20%): **$5.00**
- **Invoice Total: $30.00**

### Testing Focus Areas

#### Onboarding Flow

1. **Initial Signup & Onboarding**

   - Complete onboarding wizard
   - Set employee count (6)
   - Select industry type (automotive/detailing)
   - Enable customer locations (fixed sites)
   - Configure worker payment: fortnightly
   - Set invoice frequency: monthly

2. **Post-Onboarding Setup**
   - Add 6 workers (include 1 supervisor: Sarah Mitchell)
   - Create location hierarchy (Metro Auto Group)
   - Add 3 customer locations (2 under hierarchy, 1 independent)
   - Configure mobile app forms with 4 fields (see Field Configurations)
   - Set up pricing rules (see Pricing Rules)
   - Configure supervisor rate card with bonuses
   - Configure invoice settings
   - Set up payment processing

#### Core Workflow Testing

1. **Job Creation & Completion**

   - Create job via dashboard "Create Job" feature
   - Select location from dropdown
   - Select worker(s) from dropdown
   - Fill in field values based on mutual exclusivity rules
   - Submit job completion
   - Verify job appears in completed jobs list

2. **Pricing & Invoicing**

   - Verify pricing calculations match expected values above
   - Verify location premium (+20%) applies to City Motors jobs
   - Test invoice generation
   - Verify line items show correct breakdown
   - Verify currency is AUD

3. **Worker Management & Payments**

   - Verify all 6 workers are listed as active
   - Verify supervisor has rate card configured
   - Verify worker payment calculations include bonuses for supervisor
   - Process fortnightly worker payments

4. **Location Management**
   - Verify hierarchy structure (Metro Auto Group parent)
   - Verify location-specific pricing (City Motors +20%)
   - View jobs by location
   - Location-based reporting

#### Edge Cases

- Multiple workers completing jobs at same location simultaneously
- Jobs with complex pricing (multiple services, location overrides)
- Invoice generation with various field combinations
- Worker payment tracking per job
- Supervisor bonus calculations with multiple jobs
- Mutual exclusivity enforcement (cannot select fields from different groups)

---

## Scenario 2: Independent Car Detailer (Sole Trader, No Fixed Locations)

### Business Profile

- **Business Type**: Independent mobile car detailing service
- **Business Size**: Sole trader (1 person)
- **Payment Model**: Per job
- **Location Model**: No fixed locations (mobile service)
- **User Role**: Business owner who also uses mobile app

### Key Characteristics

- Single operator (owner works in the field)
- Mobile service (travels to customer locations)
- No employees or contractors
- Owner uses both dashboard and mobile app
- Needs to preview invoices before sending to customers
- No fixed customer locations

### Testing Focus Areas

#### Onboarding Flow

1. **Initial Signup & Onboarding**

   - Complete onboarding wizard
   - Set employee count: 0 or "none"
   - Select industry type (automotive/detailing)
   - Disable customer locations (mobile service)
   - Configure worker payment: N/A (sole trader)
   - Set invoice frequency (review before sending)

2. **Post-Onboarding Setup**
   - Skip worker setup (no employees)
   - Skip location setup (no fixed locations)
   - Configure mobile app forms (service details, customer info)
   - Set up pricing rules:
     - Field-based pricing (service type, vehicle size)
     - Base pricing (standard rates)
   - Configure invoice settings (manual review)
   - Set up payment processing

#### Core Workflow Testing

1. **Owner as Mobile User**

   - Owner logs into mobile app
   - Creates job at customer location (address entry)
   - Fills in service details via mobile form
   - Completes job
   - **CRITICAL**: Preview invoice in mobile app before sending
   - Send invoice to customer after review
   - Track own job history and earnings

2. **Dashboard Management**

   - View all jobs from dashboard
   - Edit job details if needed
   - Manage pricing rules
   - Review invoice history
   - Track business metrics

3. **Invoice Preview Feature** (To Be Implemented)
   - Preview invoice in mobile app before sending
   - Edit invoice details if needed
   - Approve and send invoice
   - Track invoice status

#### Edge Cases

- Owner working at multiple customer locations in one day
- Invoice preview and editing workflow
- Mobile app usage by admin/owner
- No location restrictions (all fields available everywhere)

#### Known Gap

**GitHub Issue**: Mobile app invoice preview for admin users

- Admin/owner users need ability to preview invoices in mobile app before sending
- Currently, invoices are auto-generated and sent
- Need to add preview/approval step for sole traders who use mobile app

---

## Scenario 3: Commercial Cleaning Service (Multiple Locations, Hourly Workers)

### Business Profile

- **Business Type**: Commercial cleaning service
- **Business Size**: 10-30 employees
- **Payment Model**: Hourly wages
- **Location Model**: Fixed locations (office buildings, retail stores)
- **User Role**: Business owner/admin

### Key Characteristics

- Multiple workers cleaning commercial properties
- Workers paid hourly (not per job)
- Fixed customer locations (office buildings, stores)
- Regular/recurring jobs
- Different cleaning services (deep clean, maintenance, window cleaning)
- Location-specific requirements and pricing

### Testing Focus Areas

#### Onboarding Flow

1. **Initial Signup & Onboarding**

   - Complete onboarding wizard
   - Set employee count (10-30 range)
   - Select industry type (cleaning services)
   - Enable customer locations (fixed sites)
   - Configure worker payment: hourly
   - Set invoice frequency (weekly/monthly batch)

2. **Post-Onboarding Setup**
   - Add workers (cleaning staff)
   - Add customer locations (office buildings, retail stores)
   - Configure mobile app forms:
     - Cleaning type (deep clean, maintenance, windows)
     - Areas cleaned (rooms, floors, bathrooms)
     - Time spent per area
     - Supplies used
     - Before/after photos
   - Set up pricing rules:
     - Hourly rates per worker
     - Service-type pricing (deep clean vs maintenance)
     - Location-based pricing (premium locations)
   - Configure invoice settings (batch invoicing)
   - Set up payment processing

#### Core Workflow Testing

1. **Job Creation & Completion**

   - Worker logs job at commercial location
   - Worker records time spent per area
   - Worker selects cleaning services performed
   - Worker submits job with time tracking
   - System calculates invoice based on:
     - Hours worked
     - Service types
     - Location pricing

2. **Time Tracking & Worker Payment**

   - Verify hourly time tracking
   - Calculate worker wages based on hours
   - Track hours per location
   - Generate worker payment reports

3. **Recurring Jobs**

   - Set up recurring cleaning schedules
   - Track regular maintenance jobs
   - Invoice recurring customers

4. **Location-Specific Requirements**
   - Different cleaning requirements per location
   - Location-specific pricing
   - Restricted fields per location (if applicable)

#### Edge Cases

- Multiple workers at same location simultaneously
- Overtime calculations
- Recurring job scheduling
- Batch invoicing for multiple jobs
- Worker time tracking accuracy

---

## Testing Checklist Template

For each scenario, test the following:

### Setup Phase

- [ ] Complete onboarding wizard
- [ ] Configure business settings
- [ ] Add workers (if applicable)
- [ ] Add locations (if applicable)
- [ ] Configure mobile app forms
- [ ] Set up pricing rules
- [ ] Configure invoice settings
- [ ] Set up payment processing

### Daily Operations

- [ ] Create job via mobile app
- [ ] Fill in all form fields
- [ ] Complete job submission
- [ ] Verify invoice generation
- [ ] Check invoice accuracy
- [ ] Send invoice to customer
- [ ] Track job in dashboard

### Management Tasks

- [ ] View job history
- [ ] Edit job details
- [ ] Manage workers
- [ ] Manage locations
- [ ] Update pricing
- [ ] Review invoices
- [ ] Track worker performance

### Edge Cases & Error Handling

- [ ] Test with missing data
- [ ] Test with invalid inputs
- [ ] Test concurrent operations
- [ ] Test location restrictions
- [ ] Test pricing edge cases
- [ ] Test invoice calculations

---

## Notes

- Each scenario should be tested with a fresh account to simulate real user experience
- Document any issues, confusion points, or missing features during testing
- Pay attention to user flow and ease of use
- Test both mobile app and dashboard functionality
- Verify data consistency between mobile and dashboard
