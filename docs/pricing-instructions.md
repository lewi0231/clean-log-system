# Pricing Configuration Guide

This guide explains how to use the pricing system to configure how customers are charged for services based on field values from completed jobs.

## Table of Contents

1. [Understanding Pricing Scope](#understanding-pricing-scope)
2. [Setting Up Basic Field Pricing](#setting-up-basic-field-pricing)
3. [Location-Based Price Overrides](#location-based-price-overrides)
4. [Conditional Pricing Rules](#conditional-pricing-rules)
5. [Option & Group Pricing](#option--group-pricing)
6. [Base Pricing Adjustments](#base-pricing-adjustments)
7. [Bulk Editing Prices](#bulk-editing-prices)
8. [Effective Dates & Versioning](#effective-dates--versioning)
9. [Common Workflows](#common-workflows)

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

## Setting Up Basic Field Pricing

Field pricing applies to fields that collect **numbers** or **booleans** (yes/no values).

### Steps

1. Navigate to the **Field Pricing** tab
2. Find the field you want to price (e.g., "Number of Windows", "Has Premium Materials")
3. Enter a price in the input field
4. Click **Save** (for new pricing) or **Update** (to modify existing pricing)

### How It Calculates

- **Number fields**: `Total = price_per_unit × quantity`
  - Example: If "Windows" costs $5.00 per unit and a job has 10 windows, total = $50.00
- **Boolean fields**: `Total = base_price (when field is true)`
  - Example: If "Premium Materials" costs $25.00 and is checked, add $25.00 to the invoice

### Quick Preview

Each field shows a preview calculation:

- Number fields: Shows `10 × $5.00 = $50.00` (using 10 as a sample quantity)
- Boolean fields: Shows `$25.00 when true`

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

## Option & Group Pricing

For fields with **select** or **grouped_breakdown** types, you set prices for each option or group.

### Select Fields (Single Choice)

- Each option gets its own price
- Total = sum of selected option prices
- Example: "Service Type" field with options "Basic ($50)", "Premium ($100)", "Deluxe ($150)"

### Grouped Breakdown Fields (Multiple Groups with Quantities)

- Each group gets a price per unit
- Total = sum of (price_per_group × quantity_per_group)
- Example: "Soaps By Vehicle Make" with groups:
  - Nissan: $7.00 per unit
  - Toyota: $8.00 per unit
  - Hyundai: $6.50 per unit
  - If a job has 5 Nissan and 3 Toyota, total = (5 × $7.00) + (3 × $8.00) = $59.00

### How to Configure

1. Go to the **Group & Option Pricing** tab
2. Find the field you want to price
3. For each option/group:
   - Enter a price
   - Click **Save** or **Update**
4. Location overrides work the same way: select a location in Pricing Scope, then edit the option prices

---

## Base Pricing Adjustments

Base pricing adds fixed amounts or multipliers to the entire invoice, regardless of field values.

### Types of Base Pricing

1. **Fixed Amount**: Add or subtract a fixed dollar amount
   - Example: Add $25.00 to every invoice
2. **Percentage Multiplier**: Multiply the entire invoice by a percentage
   - Example: Multiply by 1.15 (15% increase)
3. **Job Type Adjustments**: Vary the base price based on job type
   - Example: "If Job Type is 'Large Vehicle', multiply base by 1.2x"

### How to Configure

1. Go to the **Base Pricing** tab
2. Choose the adjustment type
3. Enter the amount or percentage
4. Optionally, set a job type condition (select a field and value)
5. Add conditional rules if needed (same as field pricing)
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
2. Go to **Field Pricing** tab
3. Enter prices for each field
4. Save each field

### Workflow 2: Regional Price Variations

1. Set base prices at Organization Default level
2. Select a region in Location Hierarchy
3. Edit prices for fields that need different pricing in that region
4. Repeat for other regions as needed

### Workflow 3: After-Hours Surcharge

1. Ensure you have a "Time of Day" or similar field
2. Go to **Field Pricing** tab
3. Find a field you want to surcharge (e.g., "Base Service")
4. Click **Add rule**
5. Create rule: "If Time of Day equals 'after-hours', add $50"
6. Save the rule

### Workflow 4: Premium Material Multiplier

1. Ensure you have a "Material Type" or similar field
2. Go to **Field Pricing** tab
3. Find the field that uses materials
4. Click **Add rule**
5. Create rule: "If Material Type equals 'premium', multiply by 1.5"
6. Save the rule

### Workflow 5: Scheduled Price Increase

1. Go to **Field Pricing** tab
2. Edit a field's price
3. Set **Effective At** to a future date (e.g., next month)
4. Save
5. The new price will automatically apply starting on that date

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
