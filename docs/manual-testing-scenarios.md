# Manual Testing Scenarios

This document outlines three user personas and scenarios for manual testing of the Clean Log System. Each scenario represents a different business model and use case to ensure the platform works effectively across various service-based businesses.

## Scenario 1: Car Yard Detailer (Fixed Locations, Multiple Employees)

### Business Profile

- **Business Type**: Car yard detailing service
- **Business Size**: 6-20 employees/contractors
- **Payment Model**: Per-job (per car detailed)
- **Location Model**: Fixed locations (car yards)
- **User Role**: Business owner/admin

### Key Characteristics

- Multiple workers completing jobs at fixed customer locations
- Workers are paid per car detailed (not hourly)
- Jobs are location-specific (different car yards)
- Invoicing happens per job completion
- Business uses customer locations feature

### Testing Focus Areas

#### Onboarding Flow

1. **Initial Signup & Onboarding**

   - Complete onboarding wizard
   - Set employee count (6-20 range)
   - Select industry type (automotive/detailing)
   - Enable customer locations (fixed sites)
   - Configure worker payment: per job
   - Set invoice frequency (immediate or batch)

2. **Post-Onboarding Setup**
   - Add workers (6-20 employees)
   - Add customer locations (multiple car yards)
   - Configure mobile app forms (car details, services performed, before/after photos)
   - Set up pricing rules:
     - Field-based pricing (e.g., car size, service type)
     - Option pricing (e.g., interior vs exterior packages)
     - Base pricing per location
   - Configure invoice settings
   - Set up payment processing

#### Core Workflow Testing

1. **Job Creation & Completion**

   - Worker logs job via mobile app at car yard location
   - Worker fills in custom form fields (car details, services)
   - Worker submits job completion
   - System generates invoice automatically
   - Invoice sent to customer with payment link

2. **Pricing & Invoicing**

   - Verify pricing calculations based on:
     - Selected services (options)
     - Car size/type (field values)
     - Location-specific pricing
   - Test invoice generation and email delivery
   - Verify payment link functionality

3. **Worker Management**

   - Add/edit/remove workers
   - Assign workers to specific locations
   - View worker job history
   - Track worker ratings over time

4. **Location Management**
   - Add/edit customer locations (car yards)
   - Configure location-specific pricing
   - View jobs by location
   - Location-based reporting

#### Edge Cases

- Multiple workers completing jobs at same location simultaneously
- Jobs with complex pricing (multiple services, location overrides)
- Invoice generation with various field combinations
- Worker payment tracking per job

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
