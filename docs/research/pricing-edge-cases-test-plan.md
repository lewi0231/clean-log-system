# Pricing Edge Cases Test Plan

This document outlines comprehensive test cases for all pricing types, contexts, and edge cases to ensure the pricing system works correctly.

## Test Categories

### 1. Field Pricing (Number/Boolean Fields)

#### 1.1 Customer Pricing

- [ ] **Create new customer pricing** for organizational default
- [ ] **Update existing customer pricing** for organizational default
- [ ] **Create customer pricing** with location override
- [ ] **Update customer pricing** with location override
- [ ] **Create customer pricing** with location hierarchy override
- [ ] **Update customer pricing** with location hierarchy override
- [ ] **Delete customer pricing** rule
- [ ] **Verify customer pricing** displays correctly after save
- [ ] **Verify location overrides** section only shows for organizational default
- [ ] **Test expiration dates** for customer pricing

#### 1.2 Worker Pricing

- [ ] **Create new worker pricing** for organizational default
- [ ] **Update existing worker pricing** for organizational default
- [ ] **Create worker pricing** with location override
- [ ] **Update worker pricing** with location override
- [ ] **Create worker pricing** with location hierarchy override
- [ ] **Update worker pricing** with location hierarchy override
- [ ] **Delete worker pricing** rule
- [ ] **Verify worker pricing** displays correctly after save
- [ ] **Verify worker pricing** doesn't include worker_payment fields in request

#### 1.3 Both Contexts (showBothContexts = true)

- [ ] **Save only customer price** (worker price empty) - should work
- [ ] **Save only worker price** (customer price empty) - should work
- [ ] **Save both customer and worker prices** simultaneously
- [ ] **Update customer price** independently when both exist
- [ ] **Update worker price** independently when both exist
- [ ] **Verify both prices** display correctly after save
- [ ] **Verify location overrides** section only shows for organizational default

### 2. Option Pricing (Select/Dropdown Fields)

#### 2.1 Customer Pricing

- [ ] **Create new customer pricing** for a single option (organizational default)
- [ ] **Update existing customer pricing** for a single option
- [ ] **Create customer pricing** for multiple options individually
- [ ] **Update customer pricing** for multiple options individually
- [ ] **Apply bulk price to all options** (organizational default)
- [ ] **Apply bulk price to options without pricing** (organizational default)
- [ ] **Verify all options update** when using "Set All" feature
- [ ] **Create customer pricing** with location override
- [ ] **Update customer pricing** with location override
- [ ] **Create customer pricing** with location hierarchy override
- [ ] **Update customer pricing** with location hierarchy override
- [ ] **Delete customer pricing** for a single option
- [ ] **Verify customer pricing** displays correctly after save
- [ ] **Verify location overrides** section only shows for organizational default
- [ ] **Test expiration dates** for customer pricing

#### 2.2 Worker Pricing

- [ ] **Create new worker pricing** for a single option (organizational default)
- [ ] **Update existing worker pricing** for a single option
- [ ] **Create worker pricing** for multiple options individually
- [ ] **Update worker pricing** for multiple options individually
- [ ] **Apply bulk price to all options** (organizational default)
- [ ] **Apply bulk price to options without pricing** (organizational default)
- [ ] **Verify all options update** when using "Set All" feature
- [ ] **Create worker pricing** with location override
- [ ] **Update worker pricing** with location override
- [ ] **Create worker pricing** with location hierarchy override
- [ ] **Update worker pricing** with location hierarchy override
- [ ] **Delete worker pricing** for a single option
- [ ] **Verify worker pricing** displays correctly after save
- [ ] **Verify worker pricing** doesn't include worker_payment fields in request

#### 2.3 Both Contexts (showBothContexts = true)

- [ ] **Save only customer price** for a single option (worker price empty)
- [ ] **Save only worker price** for a single option (customer price empty)
- [ ] **Save both customer and worker prices** for a single option
- [ ] **Update customer price** independently for a single option
- [ ] **Update worker price** independently for a single option
- [ ] **Apply bulk customer price to all** (worker prices remain unchanged)
- [ ] **Apply bulk worker price to all** (customer prices remain unchanged)
- [ ] **Apply bulk prices to all** (both customer and worker)
- [ ] **Verify all options update** correctly when using bulk operations
- [ ] **Verify both prices** display correctly after save
- [ ] **Verify location overrides** section only shows for organizational default

### 3. Base Pricing

#### 3.1 Customer Pricing

- [ ] **Create new customer base pricing** (organizational default)
- [ ] **Update existing customer base pricing** (organizational default)
- [ ] **Create customer base pricing** with location override
- [ ] **Update customer base pricing** with location override
- [ ] **Create customer base pricing** with location hierarchy override
- [ ] **Update customer base pricing** with location hierarchy override
- [ ] **Delete customer base pricing** rule
- [ ] **Verify customer base pricing** displays correctly after save
- [ ] **Verify location overrides** section only shows for organizational default

#### 3.2 Worker Pricing

- [ ] **Create new worker base pricing** (organizational default)
- [ ] **Update existing worker base pricing** (organizational default)
- [ ] **Create worker base pricing** with location override
- [ ] **Update worker base pricing** with location override
- [ ] **Create worker base pricing** with location hierarchy override
- [ ] **Update worker base pricing** with location hierarchy override
- [ ] **Delete worker base pricing** rule
- [ ] **Verify worker base pricing** displays correctly after save
- [ ] **Verify worker pricing** doesn't include worker_payment fields in request

#### 3.3 Both Contexts (showBothContexts = true)

- [ ] **Save only customer base price** (worker price empty)
- [ ] **Save only worker base price** (customer price empty)
- [ ] **Save both customer and worker base prices** simultaneously
- [ ] **Update customer base price** independently when both exist
- [ ] **Update worker base price** independently when both exist
- [ ] **Verify both prices** display correctly after save
- [ ] **Verify location overrides** section only shows for organizational default

### 4. Location Scoping

#### 4.1 Organizational Default

- [ ] **Verify location overrides section** is displayed
- [ ] **Create pricing** at organizational default level
- [ ] **Update pricing** at organizational default level
- [ ] **Verify pricing** applies to all locations without overrides

#### 4.2 Location Override

- [ ] **Verify location overrides section** is NOT displayed
- [ ] **Create pricing** for a specific location
- [ ] **Update pricing** for a specific location
- [ ] **Verify pricing** only applies to that location
- [ ] **Verify pricing** doesn't affect organizational default

#### 4.3 Location Hierarchy Override

- [ ] **Verify location overrides section** is NOT displayed
- [ ] **Create pricing** for a location hierarchy
- [ ] **Update pricing** for a location hierarchy
- [ ] **Verify pricing** applies to all locations in hierarchy
- [ ] **Verify pricing** doesn't affect organizational default

### 5. Data Consistency

#### 5.1 Pricing Context Separation

- [ ] **Verify customer pricing rules** have `pricing_context = "customer"`
- [ ] **Verify worker pricing rules** have `pricing_context = "worker"`
- [ ] **Verify customer pricing** doesn't interfere with worker pricing
- [ ] **Verify worker pricing** doesn't interfere with customer pricing
- [ ] **Verify existing rule lookup** filters by pricing_context correctly

#### 5.2 Worker Payment Fields

- [ ] **Verify customer pricing rules** can have `worker_payment_type` and `worker_payment_value`
- [ ] **Verify worker pricing rules** do NOT have `worker_payment_type` or `worker_payment_value` in request
- [ ] **Verify worker pricing rules** use `base_price` for worker payment value
- [ ] **Verify customer pricing** displays `worker_payment_value` correctly
- [ ] **Verify worker pricing** displays `base_price` correctly

#### 5.3 Refetch Behavior

- [ ] **Verify single save** triggers refetch and UI updates
- [ ] **Verify bulk save** triggers single refetch after all saves complete
- [ ] **Verify pricing map** updates correctly after refetch
- [ ] **Verify no race conditions** when saving multiple items
- [ ] **Verify UI reflects** latest data after save

### 6. Error Handling

#### 6.1 Validation Errors

- [ ] **Test saving** with invalid price (negative number)
- [ ] **Test saving** with non-numeric price
- [ ] **Test saving** with missing required fields
- [ ] **Verify error messages** are displayed to user
- [ ] **Verify error messages** are logged to console

#### 6.2 Network Errors

- [ ] **Test saving** when network is unavailable
- [ ] **Test saving** when edge function returns error
- [ ] **Verify error handling** doesn't break UI state
- [ ] **Verify error messages** are user-friendly

### 7. UI/UX

#### 7.1 Equation Display

- [ ] **Verify equation text** is user-friendly for Option Pricing
- [ ] **Verify equation** shows correct formula: "Total = Sum of (price for each option × quantity for that option)"

#### 7.2 Save Button States

- [ ] **Verify save button** is enabled when at least one valid price is provided (showBothContexts)
- [ ] **Verify save button** is disabled when no valid prices are provided
- [ ] **Verify save button** shows loading state during save
- [ ] **Verify save button** is disabled during save operation

#### 7.3 Bulk Operations

- [ ] **Verify "Set All"** updates all options correctly
- [ ] **Verify "Set All"** only updates options without pricing (when applicable)
- [ ] **Verify bulk operations** show loading state
- [ ] **Verify bulk operations** handle errors gracefully

### 8. Edge Cases

#### 8.1 Concurrent Updates

- [ ] **Test saving** the same pricing rule from multiple tabs
- [ ] **Test saving** different pricing rules simultaneously
- [ ] **Verify last write wins** or proper conflict resolution

#### 8.2 Expiration Dates

- [ ] **Test creating** pricing with expiration date
- [ ] **Test updating** pricing with expiration date
- [ ] **Test creating** pricing without expiration date
- [ ] **Verify expired pricing** is handled correctly

#### 8.3 Missing Data

- [ ] **Test loading** pricing when no rules exist
- [ ] **Test saving** when field config has no options
- [ ] **Test saving** when organization ID is missing
- [ ] **Verify graceful handling** of missing data

#### 8.4 Data Transformation

- [ ] **Verify customer pricing** transforms correctly from database to UI
- [ ] **Verify worker pricing** transforms correctly from database to UI
- [ ] **Verify pricing map** is built correctly from pricing rules
- [ ] **Verify location scoping** is applied correctly in pricing map

## Test Execution Notes

1. **Test Environment**: Use a test organization with multiple locations and location hierarchies
2. **Test Data**: Create field configs with different field types (number, boolean, select)
3. **Test Scenarios**: Test each scenario in isolation and in combination
4. **Verification**: After each save, verify:
   - Database contains correct data
   - UI displays correct data
   - No console errors
   - No network errors
   - Pricing map is updated correctly

## Known Issues to Verify Fixed

1. ✅ **Worker pricing saves** - Fixed: Worker pricing now saves correctly without worker_payment fields
2. ✅ **Location overrides display** - Fixed: Only shows for organizational default
3. ✅ **Equation text** - Fixed: More user-friendly text
4. ✅ **Customer pricing updates** - Fixed: Added pricingContext to useEffect dependencies
5. ✅ **Bulk customer pricing updates** - Fixed: Race condition resolved with skipRefetch

## Priority Test Cases

### P0 (Critical - Must Test First)

1. Customer pricing updates for organizational default (Option Pricing)
2. Worker pricing updates for organizational default (Option Pricing)
3. Bulk "Set All" updates all options correctly (Option Pricing)
4. Individual option updates work correctly (Option Pricing)

### P1 (High Priority)

1. Location override pricing updates
2. Both contexts (showBothContexts) pricing updates
3. Field pricing updates
4. Base pricing updates

### P2 (Medium Priority)

1. Expiration date handling
2. Error handling
3. UI/UX improvements
4. Edge cases
