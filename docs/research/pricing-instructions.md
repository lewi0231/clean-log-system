# Pricing Configuration Guide

This guide explains how to use the pricing system to configure how customers are charged for services based on field values from completed jobs.

## Table of Contents

1. [Understanding Pricing Scope](#understanding-pricing-scope)
2. [Number Field Pricing](#number-field-pricing)
3. [Boolean Field Pricing](#boolean-field-pricing)
4. [Select Field Pricing](#select-field-pricing)
5. [Group Field Pricing](#group-field-pricing)
6. [Base Pricing Adjustments](#base-pricing-adjustments)
7. [Location-Based Price Overrides](#location-based-price-overrides)
8. [Conditional Pricing Rules](#conditional-pricing-rules)
9. [Bulk Editing Prices](#bulk-editing-prices)
10. [Effective Dates & Versioning](#effective-dates--versioning)
11. [Common Workflows](#common-workflows)

---

## Understanding Pricing Scope

The **Pricing Scope** selector at the top of the pricing page controls which pricing rules you're viewing and editing.

### Location Hierarchy

- **Organization Default**: Shows pricing rules that apply to all locations (the default/base pricing)
- **Specific Location Nodes**: Select a region, site, or other location node to view/edit pricing specific to that location
  - When you select a location, you'll see:
    - Pricing rules that apply specifically to that location
    - The base pricing from the organization default (for reference)
  - Location-specific rules override the organization default for that location

**Note**: Location hierarchy nodes must be created in your organization settings before they appear here. If you don't see any locations, you'll need to set up your location hierarchy first.

### Effective As Of Date

- **Purpose**: View pricing rules as they were (or will be) effective on a specific date
- **Behavior**: This is a **view-only filter** - it changes what you see but does not affect when new rules take effect
- **Use Cases**:
  - **Today's date (default)**: See current active pricing
  - **Future date**: Preview how pricing will look when new rules take effect
  - **Past date**: Review historical pricing for invoices created on that date
- **How it works**: Only shows pricing rules where:
  - `effective_at` is on or before the selected date
  - `expires_at` is null (never expires) OR after the selected date
- **Important**: When you set an "Effective As Of" date and make changes:
  - You are viewing pricing as it was/will be on that date
  - **Any changes you save will create new rules effective immediately (today)**
  - To schedule future changes, you need to use the advanced pricing editor to set rule-level effective dates

**Note**: A banner will appear at the top of the pricing page when you select an effective date to remind you that changes are saved with immediate effect.

---

## Number Field Pricing

Number field pricing applies to fields that collect **numerical values** (quantities, counts, measurements).

### Steps

1. Navigate to the **Number** tab in pricing
2. Find the field you want to price (e.g., "Number of Windows", "Panel Count")
3. Enter a per-unit price in the input field
4. Click **Save** (for new pricing) or **Update** (to modify existing pricing)

### How It Calculates

`Total = price_per_unit × quantity`

- Example: If "Windows" costs $5.00 per unit and a job has 10 windows, total = $50.00
- Example: If "Panels" costs $2.00 per unit and a job has 25 panels, total = $50.00

### Quick Preview

Each field shows a preview calculation using 10 as a sample quantity:

- Shows `10 × $5.00 = $50.00`

---

## Boolean Field Pricing

Boolean field pricing applies to fields that collect **yes/no values** (checkboxes, toggles).

### Steps

1. Navigate to the **Boolean** tab in pricing
2. Find the field you want to price (e.g., "Premium Materials", "Rush Service")
3. Enter a fixed price in the input field
4. Click **Save** (for new pricing) or **Update** (to modify existing pricing)

### How It Calculates

`Total = fixed_price (when field is checked/true)`

- Example: If "Premium Materials" costs $25.00 and is checked, add $25.00 to the invoice
- Example: If "Rush Service" costs $50.00 and is checked, add $50.00 to the invoice

### Quick Preview

Each field shows a preview: `$25.00 when true`

---

## Select Field Pricing

Select field pricing applies to **dropdown/select fields** where users choose one option.

### Steps

1. Navigate to the **Select** tab in pricing
2. Find the select field you want to price (e.g., "Service Type", "Package Level")
3. For each option, enter a price
4. Click **Save** for each option

### How It Calculates

`Total = price of selected option`

- Example: "Service Type" field with options:
  - Basic Detail = $100
  - Premium Detail = $200
  - Deluxe Detail = $350
- If worker selects "Premium Detail", add $200 to the invoice

### Multi-Select Fields

For select fields with "Allow multiple selections" enabled:

- Each selected option's price is added to the total
- Example: If "Add-ons" has Clay Bar ($30) and Paint Sealant ($50) selected, add $80 to invoice

---

## Group Field Pricing

Group field pricing applies to **grouped breakdown fields** where users enter quantities for multiple categories.

### Steps

1. Navigate to the **Group** tab in pricing
2. Find the grouped breakdown field (e.g., "Vehicles by Make", "Items by Type")
3. For each group/category, enter a per-unit price
4. Click **Save** for each group

### How It Calculates

`Total = sum of (price_per_group × quantity_per_group)`

- Example: "Soaps By Vehicle Make" with groups:
  - Nissan: $7.00 per unit
  - Toyota: $8.00 per unit
  - Hyundai: $6.50 per unit
- If a job has 5 Nissan and 3 Toyota: (5 × $7.00) + (3 × $8.00) = $59.00

---

## Location-Based Price Overrides

Location overrides let you set different prices for the same field at different locations without duplicating the field configuration.

### How to Add Location Overrides

1. **Set a base price first**: Enter a default price for the field at the Organization Default level
2. **Select a location**: Use the **Location Hierarchy** dropdown in the Pricing Scope section to select a specific location node
3. **Edit the price**: The same field will appear, but now you're editing the location-specific override
4. **Save**: The override will apply to that location, while other locations use the base price

### How It Works

- **Base price** (Organization Default): Applies to all locations unless overridden
- **Location override**: Only applies to the selected location and its child locations (if any)
- **Inheritance**: Child locations inherit from parent locations unless they have their own override

### Viewing Location Overrides

In the **Field Pricing** and **Group & Option Pricing** tabs, each field shows a **Location overrides** section that displays:

- How many location-specific overrides exist for that field/option
- A table showing:
  - Which locations or regions have overrides
  - The price for each override
  - The effective period (when the override is/was active)
  - Visual indicators for future or expired overrides
- **Delete button**: You can remove individual overrides by clicking the trash icon

**Managing Overrides**:

- **View all versions**: Toggle "Show historical & future pricing" to see all override versions, including expired and future-dated ones
- **Default view**: Only shows currently active overrides (effective today)
- **Create overrides**: Select a location in the **Pricing Scope** selector, then edit the price
- **Delete overrides**: Click the trash icon next to any override in the overrides table
- **Temporal information**: Each override shows its effective date range, helping you understand when different prices apply

---

## Conditional Pricing Rules

Conditional rules let you adjust prices based on other field values. For example: "If the job is after-hours, add $50" or "If the surface is premium, multiply the price by 1.5x".

### How to Add Conditional Rules

1. In the **Field Pricing** tab, find the field you want to add a rule to
2. Click the **Add rule** button (with the sparkles icon) next to the Save/Update button
3. Fill in the rule builder:
   - **If field**: Select which field to check (e.g., "Time of Day", "Surface Type")
   - **Operator**: Choose how to compare (equals, greater than, contains, etc.)
   - **Value**: Enter the value to check against (e.g., "after-hours", "premium")
   - **Then**: Choose the action (add, subtract, multiply, divide, or set to)
   - **Amount**: Enter the adjustment amount
4. Click **Add rule**

### Example Rules

- **After-hours surcharge**: "If Time of Day equals 'after-hours', add $50"
- **Premium multiplier**: "If Surface Type equals 'premium', multiply by 1.5"
- **Weather discount**: "If Weather equals 'rainy', subtract $10"

### Viewing Conditional Rules

Each field shows its conditional rules as chips below the price input. The chips display the rule in plain language:

- `IF Time of Day equals after-hours → add 50`

### Where Conditional Rules Appear

- **Field Pricing**: Each field can have conditional rules that adjust its price
- **Base Pricing**: Base pricing adjustments can also have conditional rules (e.g., "If job type is large vehicle, multiply base by 1.2x")

---

## Invoice Adjustments (Base Pricing)

Invoice adjustments modify the total invoice amount. There are two types:

### 1. Universal Adjustment

Applies the same adjustment to **every invoice**, regardless of service type.

**Use cases:**

- **Call-out fee**: Add $25 to every invoice for travel/diagnostic
- **Profit margin**: Multiply every invoice by 1.15 (15% markup)
- **Fuel surcharge**: Add $10 to cover fuel costs

### 2. Service-Based Adjustment

Varies the adjustment based on a **select field** (e.g., Service Type, Package Level).

**Use cases:**

- **Tiered pricing**: Basic Detail adds $50, Premium Detail adds $100, Deluxe Detail adds $150
- **Service multipliers**: Standard service × 1.0, Rush service × 1.5, Emergency × 2.0
- **Package upgrades**: Bronze = +$0, Silver = +$50, Gold = +$100

### How to Configure

1. Go to the **Base** tab in pricing
2. Toggle between **Universal Adjustment** and **Service-Based Adjustment**
3. For Universal: Enter the amount or multiplier
4. For Service-Based: Select the service type field, then set amounts for each option
5. Add conditional rules if needed (e.g., "If after-hours, add $50")
6. Click **Save** or **Update**

---

## Bulk Editing Prices

Use bulk editing to apply the same price change to multiple fields at once.

### How to Use Bulk Editor

1. Click the **Bulk edit field prices** button (top right of the quick setup cards)
2. Select which fields to update (checkboxes)
3. Choose the action:
   - **Set to**: Set all selected fields to the same price
   - **Add**: Add an amount to all selected fields
   - **Multiply by**: Multiply all selected fields by a factor
4. Enter the value
5. Click **Apply Changes**

**Note**: Bulk edits apply to the current location scope. If you want to bulk edit for a specific location, select that location in Pricing Scope first.

---

## Effective Dates & Versioning

Pricing rules can have effective dates to support price changes over time. This allows you to:

- Schedule future price changes
- Maintain historical pricing for accurate invoice calculations
- Create temporary promotional pricing

### Understanding Effective Dates

There are **two different uses** of effective dates in the pricing system:

1. **"Effective As Of" Date (View Filter)**

   - Located in the **Pricing Scope** selector at the top of the page
   - **Purpose**: View pricing as it was/will be on a specific date
   - **Behavior**: Read-only filter - does not affect when new rules take effect
   - **Use case**: Review historical pricing or preview future pricing

2. **Rule-Level Effective Dates (Pricing Rule Properties)**
   - Set in the advanced pricing editor
   - **Purpose**: Control when a specific pricing rule becomes active
   - **Behavior**: The rule only applies during its effective period
   - **Use case**: Schedule price increases, create promotional periods

### Viewing Override History

Each location override shows:

- **Effective period**: "From: [date]" and "Until: [date or 'No end date']"
- **Status badges**:
  - "Future" badge for rules that haven't started yet
  - "Expired" badge for rules that have ended
  - Normal display for currently active rules
- **Toggle**: Use "Show historical & future pricing" to see all versions, not just active ones

### Setting Effective Dates on Rules

When creating or updating a pricing rule in the advanced editor, you can set:

- **Effective At**: When the rule starts applying (defaults to today)
- **Expires At**: When the rule stops applying (optional, leave empty for no expiration)

### How It Works

- **Historical Invoices**: When an invoice is created, the system uses pricing rules effective on that date
- **Future Pricing**: You can create rules with future effective dates to schedule price changes
- **Viewing Historical Pricing**: Use the "Effective As Of" date selector to see how pricing looked on a specific date
- **Multiple Versions**: You can have multiple pricing rules for the same location/field with different effective dates

### Best Practices

- Set `effective_at` when you want a rule to start applying in the future
- Set `expires_at` when you want a temporary price (e.g., promotional pricing)
- Leave `expires_at` empty for permanent pricing rules
- Use the "Show historical & future pricing" toggle to review all pricing versions when needed
- Delete expired overrides to keep your pricing list clean

---

## Common Workflows

### Workflow 1: Simple Setup (Most Locations Same Price)

1. Leave Location Hierarchy as "Organization Default"
2. Go through each pricing tab (Number, Boolean, Select, Group)
3. Enter prices for each field
4. Save each field

### Workflow 2: Regional Price Variations

1. Set base prices at Organization Default level
2. Select a region in Location Hierarchy
3. Edit prices for fields that need different pricing in that region
4. Repeat for other regions as needed

### Workflow 3: After-Hours Surcharge

1. Ensure you have a "Time of Day" or similar field
2. Go to **Base** tab in pricing
3. Click **Add rule**
4. Create rule: "If Time of Day equals 'after-hours', add $50"
5. Save the rule

### Workflow 4: Premium Material Multiplier

1. Ensure you have a "Material Type" or similar field
2. Go to **Base** tab in pricing
3. Click **Add rule**
4. Create rule: "If Material Type equals 'premium', multiply by 1.5"
5. Save the rule

### Workflow 5: Scheduled Price Increase

1. Go to the appropriate pricing tab (Number, Boolean, Select, or Group)
2. Edit a field's price
3. Set **Effective At** to a future date (e.g., next month)
4. Save
5. The new price will automatically apply starting on that date

### Workflow 6: Car Detailing Packages

1. Create a "Service Package" select field in Mobile Config with options like "Basic", "Premium", "Deluxe"
2. Go to **Select** tab in pricing
3. Set prices for each package:
   - Basic Detail = $100
   - Premium Detail = $200
   - Deluxe Detail = $350
4. These prices combine with other pricing (add-ons, per-unit charges, etc.)

---

## Troubleshooting

### "Failed to list pricing rules" Error

This usually happens when:

1. **Invalid effective date**: The date format might be incorrect, or there are no rules effective on that date
   - **Fix**: Leave the "Effective As Of" date empty to see current pricing
2. **Database connection issue**: Check your Supabase connection
   - **Fix**: Refresh the page or check your network connection

### Location Overrides Not Showing

- Make sure you've selected a location in the Pricing Scope selector
- Ensure location hierarchy nodes exist in your organization
- Check that you've actually created overrides (they don't appear until you save a price for that location)
- If you have historical/future overrides, toggle "Show historical & future pricing" to see them
- The current scope's pricing won't appear as an override (it's shown as the main price)

### Conditional Rules Not Applying

- Verify the field you're checking exists and has the expected values
- Check that the operator and value match exactly (case-sensitive for text)
- Ensure the rule is saved and active

### Prices Not Calculating Correctly

- Check that field values in jobs match the pricing rule conditions
- Verify location assignments on jobs match your location hierarchy
- Review the invoice calculation logs for detailed error messages

---

## Additional Resources

- See `docs/pricing-ux-research.md` for design patterns and inspiration from other platforms
- Check the database schema in `database/supabase/migrations/` for technical details
- Review the pricing calculation logic in `database/supabase/functions/calculate-invoice/`

## Pricing Tab Summary

| Tab         | Field Type          | Calculation                    | Example                                             |
| ----------- | ------------------- | ------------------------------ | --------------------------------------------------- |
| **Number**  | `number`            | price × quantity               | $5 × 10 windows = $50                               |
| **Boolean** | `boolean`           | fixed price when true          | Premium Materials = $25                             |
| **Select**  | `select`            | price of selected option       | Premium Detail = $200                               |
| **Group**   | `grouped_breakdown` | sum of (price × qty per group) | 5 Nissan × $7 + 3 Toyota × $8 = $59                 |
| **Base**    | N/A                 | Universal or service-based     | +$25 call-out fee, or Premium tier × 1.2 multiplier |
