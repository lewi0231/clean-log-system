# Bill To Address Configuration - Logical Flow & Recommendations

## Current System Analysis

### Existing Components:

1. **Predefined Locations**: Have structured fields (name, email, address, contact_person, phone)
2. **Dynamic Form Fields**: From `submission_data` - user-configured fields
3. **Location Hierarchy**: Company → Region → Location structure with metadata support
4. **Bill To Configuration**: Currently only supports mapping form field names

### Current Invoice Bill To Logic:

- If `bill_to_fields` configured → Use form fields from `submission_data`
- Otherwise → Fallback to location data

## Three Operational Scenarios

### Scenario 1: Predefined Locations (Regular Service Addresses)

**Use Case**: Service businesses with recurring customers at fixed addresses

- Worker selects predefined location
- Location has complete address/contact info
- **Bill To Source**: Location record fields

### Scenario 2: Dynamic Address Fields (Ad-hoc Jobs)

**Use Case**: Jobs at new/unlisted addresses

- Worker enters address via form fields
- No predefined location selected
- **Bill To Source**: Selected form fields from submission_data

### Scenario 3: Company Billing Override (Corporate Accounts)

**Use Case**: Locations belong to companies that handle billing centrally

- Location is part of a company hierarchy
- Billing address differs from service address
- **Bill To Source**: Company/Organization address (from hierarchy metadata or organization settings)

## Recommended Approach: Multi-Source Bill To Configuration

### Core Principle: **Always Specify Both Service Address & Billing Address (when applicable)**

This approach provides maximum flexibility while handling all edge cases cleanly.

### Configuration Structure

```typescript
interface BillToConfiguration {
  // Service Address Configuration
  service_address: {
    source: "location" | "form_fields" | "none";
    location_fields?: (
      | "name"
      | "email"
      | "address"
      | "contact_person"
      | "phone"
    )[];
    form_fields?: string[]; // Field config names
  };

  // Billing Address Configuration (optional)
  billing_address: {
    enabled: boolean;
    source:
      | "organization"
      | "hierarchy_company"
      | "form_fields"
      | "location_override";
    override_fields?: string[]; // When using form_fields or location_override
  };
}
```

### Logical Flow Priority

```
For each invoice job:
1. SERVICE ADDRESS (Always shown):
   ├─ If job has location_id:
   │  ├─ Use location fields (name, address, contact_person, email, phone)
   │  └─ Configurable which location fields to display
   │
   └─ If job has no location_id (dynamic):
      └─ Use configured form_fields from submission_data

2. BILLING ADDRESS (Optional, shown below service address):
   ├─ If location.hierarchy_parent.type === "company":
   │  ├─ Check hierarchy metadata for billing address
   │  └─ OR use organization-level billing address
   │
   ├─ If configured form_fields for billing:
   │  └─ Use those form fields as billing override
   │
   └─ If none of above:
      └─ Don't show separate billing address section
```

### Display Structure

```
Bill To:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service Address:
123 Main Street
Melbourne VIC 3000
Contact: John Doe
Phone: 0400 000 000

Billing Address: (only if different/configured)
Acme Corp Pty Ltd
456 Corporate Blvd
Sydney NSW 2000
Contact: Accounts Payable
Phone: (02) 9000 0000
```

## Edge Cases & Solutions

### Edge Case 1: Job has location BUT also has address fields in form

**Solution**: Service address uses location (predefined takes precedence). Address fields in form are ignored for service address but can be used for billing override if configured.

### Edge Case 2: Multiple jobs on same invoice with different locations

**Solution**:

- Use first job's location for service address
- OR aggregate if all jobs are at same location
- OR show multiple service addresses if different
- Billing address should be same (company-level) if applicable

### Edge Case 3: Location belongs to company but company has no billing metadata

**Solution**: Fallback chain:

1. Try hierarchy metadata (company/region)
2. Try organization-level billing address settings
3. Don't show billing address section

### Edge Case 4: Location has partial address data (e.g., missing contact_person)

**Solution**: Only display configured fields that have values. Don't show empty fields.

### Edge Case 5: Form fields configured but submission_data doesn't contain those fields

**Solution**: Show what's available, indicate missing fields, or fallback to location if available.

### Edge Case 6: Company billing address changes after invoice creation

**Solution**: Store billing address snapshot in invoice metadata at creation time (invoice is immutable record).

### Edge Case 7: Location is updated after job completion but before invoicing

**Solution**: Use location data from job's completed_at timestamp or store snapshot. Current system appears to use current location state, which is fine for most cases.

## Recommended Implementation: Simplified Three-Mode System

Instead of complex configuration, use a simpler mode-based approach:

### Mode 1: "Location-Based" (Default for predefined locations)

- Service Address: From location fields
- Billing Address: Auto-detect if location belongs to company, use hierarchy metadata

### Mode 2: "Field-Based" (For dynamic addresses)

- Service Address: From configured form fields
- Billing Address: Optional, from different form fields or organization settings

### Mode 3: "Hybrid" (Both location + form fields)

- Service Address: Location (if available) OR form fields
- Billing Address: Always check for company billing override first

### Settings UI Structure

```
Invoice Template Settings
├─ Bill To Configuration
│  ├─ Service Address Source: [Location Fields] | [Form Fields] | [Auto]
│  │  ├─ If "Location Fields":
│  │  │  └─ Select which location fields: ☑ Name ☑ Address ☑ Contact ☑ Email ☑ Phone
│  │  ├─ If "Form Fields":
│  │  │  └─ Select form fields to display (current implementation)
│  │  └─ If "Auto":
│  │     └─ Use location if job has location_id, else use form fields
│  │
│  └─ Billing Address: ☑ Show separate billing address
│     ├─ Source: [Auto-detect from Company] | [Organization Settings] | [Form Fields] | [Disabled]
│     └─ If "Form Fields": Select billing address form fields
│
└─ [Other settings...]
```

## My Recommended Approach

**Use a hybrid "Auto-detect with override" system:**

1. **Service Address** (Always shown):

   - If job has `location_id`: Use location fields (configurable which ones)
   - If job has no `location_id`: Use configured form fields from submission_data
   - Priority: Location > Form Fields

2. **Billing Address** (Optional, shown when different):

   - Auto-detect: If location belongs to company (via hierarchy), check:
     - Hierarchy metadata for billing address
     - Organization billing settings
   - Manual override: Admin can configure specific form fields for billing
   - Display: Only show if different from service address OR explicitly configured

3. **Configuration**:
   - Simple toggle: "Show billing address when different from service address"
   - Location field selection: Checkboxes for which location fields to show
   - Form field selection: Current implementation (for dynamic addresses)
   - Billing override: Optional form field selection or organization-level settings

## Database Schema Changes Needed

### 1. Add billing address to organization table (optional):

```sql
ALTER TABLE organization ADD COLUMN billing_address JSONB;
-- Structure: {name, address, contact_person, email, phone}
```

### 2. Add billing metadata to location_hierarchy (for companies):

```sql
-- Already has metadata JSONB field - can store billing info there
-- Example metadata: {"billing_address": {"name": "...", "address": "..."}}
```

### 3. Enhance invoice_template_config:

```sql
ALTER TABLE invoice_template_config ADD COLUMN service_address_config JSONB;
ALTER TABLE invoice_template_config ADD COLUMN billing_address_config JSONB;

-- service_address_config: {
--   "source": "location" | "form_fields" | "auto",
--   "location_fields": ["name", "address", "contact_person", "email", "phone"],
--   "form_fields": ["field_name1", "field_name2"]
-- }

-- billing_address_config: {
--   "enabled": boolean,
--   "source": "auto" | "organization" | "hierarchy" | "form_fields",
--   "form_fields": ["billing_field1", "billing_field2"]
-- }
```

### 4. Store billing address snapshot in invoice (for immutability):

```sql
ALTER TABLE invoice ADD COLUMN billing_address_snapshot JSONB;
-- Snapshot at invoice creation time
```

## Implementation Priority

### Phase 1 (Quick Win):

1. Allow configuration of which location fields to show in Bill To
2. Add simple toggle for "Show billing address"
3. Auto-detect company billing from hierarchy metadata

### Phase 2 (Enhanced):

1. Organization-level billing address settings
2. Form field mapping for billing address
3. Address comparison logic (only show billing if different)

### Phase 3 (Advanced):

1. Multiple service addresses for multi-job invoices
2. Billing address snapshots in invoice records
3. Custom billing address per invoice (manual override)

## Conclusion

**Recommendation: Implement a flexible three-tier system:**

1. **Service Address**: Always shown, from location OR form fields (auto-detect)
2. **Billing Address**: Optional, auto-detected from company hierarchy OR manually configured
3. **Configuration**: Simple mode selection with field-level customization

This approach:

- ✅ Handles all three scenarios elegantly
- ✅ Provides flexibility without overwhelming complexity
- ✅ Has clear fallback chains for edge cases
- ✅ Maintains backward compatibility
- ✅ Allows gradual enhancement

The key insight: **Don't make admins choose between location and fields - make the system smart enough to use both appropriately based on context.**
