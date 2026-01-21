# Locations Page Test Coverage Review

## Current Test Coverage

### ✅ Existing Tests

#### 1. **Service Layer Tests** (`locations.service.test.ts`)
- ✅ List workers and locations on success
- ✅ Handle Supabase errors
- ✅ Create location on success
- ✅ Handle creation errors
- ✅ Handle missing location in response
- ✅ Update location on success
- ✅ Handle update errors
- ✅ Delete location on success
- ✅ Handle deletion errors

#### 2. **Hook Tests** (`use-locations.test.tsx`)
- ✅ Fetch locations on mount
- ✅ Handle error state
- ✅ Create location and refetch

#### 3. **Location Hierarchy Service Tests** (`location-hierarchy.service.test.ts`)
- ✅ List hierarchy nodes
- ✅ Create hierarchy node
- ✅ Update hierarchy node
- ✅ Delete hierarchy node

#### 4. **E2E Tests** (`e2e/specs/scenario-1/01-setup-verification.spec.ts`)
- ✅ Display all locations
- ✅ Display specific locations (City Motors, Suburban Auto, Budget Cars)

---

## Missing Test Coverage

### 🔴 Critical Edge Cases (P0)

#### 1. **Locations Page Component Tests** ❌
**File:** `dashboard/__tests__/components/locations/locations-page.test.tsx` (MISSING)

**Missing Tests:**
- ❌ Render locations page with loading state
- ❌ Render locations page with error state
- ❌ Render locations page with empty locations
- ❌ Switch between "Customer Locations" and "Location Hierarchy" tabs
- ❌ Toggle predefined locations setting
- ❌ Open location form dialog
- ❌ Handle location creation success
- ❌ Handle location creation error
- ❌ Handle location update success
- ❌ Handle location update error
- ❌ Handle location deletion success
- ❌ Handle location deletion error
- ❌ Display location settings card
- ❌ Collapse/expand location settings
- ❌ Handle organization loading state
- ❌ Handle organization error state
- ❌ Handle missing organization ID

#### 2. **Location Form Component Tests** ❌
**File:** `dashboard/__tests__/components/locations/location-form.test.tsx` (MISSING)

**Missing Tests:**
- ❌ Render location form in create mode
- ❌ Render location form in edit mode
- ❌ Validate required fields (name, email, address, contact_person)
- ❌ Validate email format
- ❌ Validate fixed price mode requires fixed_customer_price
- ❌ Validate currency format (3-letter ISO code)
- ❌ Validate non-negative numbers for prices
- ❌ Submit form with valid data
- ❌ Handle form submission error
- ❌ Close form on cancel
- ❌ Pre-populate form when editing
- ❌ Display hierarchy parent selector
- ❌ Filter hierarchy nodes by type (only regions)
- ❌ Handle hierarchy parent selection
- ❌ Switch between field_based and fixed_price modes
- ❌ Show/hide fixed price fields based on mode
- ❌ Validate fixed price fields when mode is fixed_price
- ❌ Handle phone number (optional field)
- ❌ Handle active/inactive toggle

#### 3. **Location List Component Tests** ❌
**File:** `dashboard/__tests__/components/locations/location-list.test.tsx` (MISSING)

**Missing Tests:**
- ❌ Render location list with locations
- ❌ Render empty state when no locations
- ❌ Render loading state
- ❌ Render error state
- ❌ Display location details (name, email, address, contact, phone)
- ❌ Display hierarchy parent badge
- ❌ Display "Org default" when no hierarchy parent
- ❌ Display active/inactive status badge
- ❌ Handle edit button click
- ❌ Handle delete button click
- ❌ Handle delete confirmation
- ❌ Handle delete cancellation
- ❌ Display table with correct columns
- ❌ Handle long location names (truncation)
- ❌ Handle missing optional fields (phone, address)

#### 4. **Location Hierarchy Manager Component Tests** ❌
**File:** `dashboard/__tests__/components/locations/location-hierarchy-manager.test.tsx` (MISSING)

**Missing Tests:**
- ❌ Render hierarchy manager with nodes
- ❌ Render empty state when no nodes
- ❌ Render loading state
- ❌ Render error state
- ❌ Display tree structure correctly
- ❌ Expand/collapse tree nodes
- ❌ Create company node
- ❌ Create region node under company
- ❌ Edit node name
- ❌ Delete node
- ❌ Handle delete confirmation
- ❌ Handle delete cancellation
- ❌ Prevent creating region without parent company
- ❌ Display node type badges (Company/Region)
- ❌ Display node icons
- ❌ Show/hide action buttons on hover
- ❌ Handle auto-generate invoice configuration
- ❌ Validate auto-generate form fields
- ❌ Handle auto-generate period selection (daily/weekly/monthly)
- ❌ Handle day of week selection (for weekly)
- ❌ Handle day of month selection (for monthly)
- ❌ Handle time selection
- ❌ Handle grouping selection (location/all)
- ❌ Prevent deleting node with children (if enforced)
- ❌ Handle hierarchy validation errors

#### 5. **Location Hierarchy Hook Tests** ❌
**File:** `dashboard/__tests__/hooks/use-location-hierarchy.test.tsx` (MISSING)

**Missing Tests:**
- ❌ Fetch hierarchy nodes on mount
- ❌ Handle error state
- ❌ Create node and refetch
- ❌ Update node and refetch
- ❌ Delete node and refetch
- ❌ Handle network errors
- ❌ Handle validation errors

---

### 🟡 Important Edge Cases (P1)

#### 6. **Validation Edge Cases** ❌

**Location Form Validation:**
- ❌ Empty name field
- ❌ Invalid email format
- ❌ Empty address field
- ❌ Empty contact_person field
- ❌ Invalid UUID for hierarchy_parent_id
- ❌ Negative fixed_customer_price
- ❌ Negative fixed_worker_payment
- ❌ Invalid currency code (not 3 letters)
- ❌ Currency code in lowercase
- ❌ Fixed price mode without fixed_customer_price
- ❌ Very long name (>255 chars)
- ❌ Very long email (>255 chars)
- ❌ Very long address (>1000 chars)
- ❌ Phone number with special characters
- ❌ Phone number too long

**Location Hierarchy Validation:**
- ❌ Create region without parent company
- ❌ Create company with parent (should fail)
- ❌ Create region with region as parent (should fail)
- ❌ Create node with invalid type
- ❌ Create node with empty name
- ❌ Create node with very long name
- ❌ Update node to invalid parent
- ❌ Delete node that has locations assigned
- ❌ Delete node that has children

#### 7. **Data Edge Cases** ❌

**Locations:**
- ❌ Location with null address
- ❌ Location with null contact_person
- ❌ Location with null phone
- ❌ Location with null hierarchy_parent_id
- ❌ Location with inactive status
- ❌ Location with fixed_price mode
- ❌ Location with field_based mode
- ❌ Location assigned to region
- ❌ Location assigned to company (should this be allowed?)
- ❌ Multiple locations with same name (same org)
- ❌ Multiple locations with same email (same org)

**Location Hierarchy:**
- ❌ Deep hierarchy (3+ levels - should this be prevented?)
- ❌ Multiple companies
- ❌ Multiple regions under one company
- ❌ Node with circular reference (should be prevented)
- ❌ Node with metadata containing auto-generate config
- ❌ Node with invalid metadata structure

#### 8. **Integration Edge Cases** ❌

**Location and Hierarchy:**
- ❌ Assign location to non-existent hierarchy node
- ❌ Assign location to hierarchy node from different org
- ❌ Delete hierarchy node that has locations assigned
- ❌ Update location hierarchy_parent_id to invalid node
- ❌ Update location hierarchy_parent_id to node from different org

**Settings:**
- ❌ Toggle predefined locations setting
- ❌ Handle settings API error
- ❌ Handle missing settings data

---

### 🟢 Nice-to-Have Edge Cases (P2)

#### 9. **UI/UX Edge Cases** ❌

- ❌ Responsive design (mobile, tablet, desktop)
- ❌ Keyboard navigation
- ❌ Screen reader accessibility
- ❌ Focus management in dialogs
- ❌ Loading states during async operations
- ❌ Error message display
- ❌ Success message display
- ❌ Form validation error messages
- ❌ Tooltip display
- ❌ Collapsible sections
- ❌ Tab switching animation
- ❌ Tour functionality (if applicable)

#### 10. **Performance Edge Cases** ❌

- ❌ Large number of locations (100+)
- ❌ Large hierarchy tree (50+ nodes)
- ❌ Slow network (timeout handling)
- ❌ Concurrent operations (create while updating)

---

## Test Implementation Priority

### Phase 1: Critical Component Tests (Week 1)
1. Location Form Component Tests
2. Location List Component Tests
3. Location Hierarchy Manager Component Tests
4. Locations Page Component Tests

### Phase 2: Hook and Integration Tests (Week 2)
5. Location Hierarchy Hook Tests
6. Integration tests for location creation flow
7. Integration tests for hierarchy management flow

### Phase 3: Edge Cases and Validation (Week 3)
8. Validation edge cases
9. Data edge cases
10. Integration edge cases

### Phase 4: UI/UX and Performance (Week 4)
11. UI/UX edge cases
12. Performance edge cases

---

## Test File Structure

```
dashboard/__tests__/
├── components/
│   └── locations/
│       ├── locations-page.test.tsx          ❌ MISSING
│       ├── location-form.test.tsx           ❌ MISSING
│       ├── location-list.test.tsx           ❌ MISSING
│       └── location-hierarchy-manager.test.tsx  ❌ MISSING
├── hooks/
│   └── use-location-hierarchy.test.tsx      ❌ MISSING
└── integration/
    └── locations-flow.test.tsx              ❌ MISSING (optional)
```

---

## Recommendations

1. **Start with component tests** - These are the most visible and user-facing
2. **Use React Testing Library** - Follow existing patterns in the codebase
3. **Mock services** - Use existing service mocks from other tests
4. **Test user interactions** - Focus on what users can do, not implementation details
5. **Cover error states** - Ensure all error paths are tested
6. **Test validation** - Ensure form validation works correctly
7. **Test edge cases** - Cover boundary conditions and invalid inputs

---

## Notes

- The Locations page has two main tabs: "Customer Locations" and "Location Hierarchy"
- Location form supports both create and edit modes
- Location hierarchy supports companies and regions (regions must have company parents)
- Fixed price mode requires fixed_customer_price
- Auto-generate invoice configuration is available on hierarchy nodes
- Tour functionality exists but may need separate testing
