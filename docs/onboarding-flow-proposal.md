# Onboarding Flow Proposal

## Overview

This document outlines the proposed onboarding flow for new users signing up to the Clean Log System dashboard. The goal is to collect essential information during signup to preconfigure their account and guide them through initial setup.

## Research Insights

Based on SaaS onboarding best practices:

- **Time-to-value**: Users should reach their "aha moment" within 3-5 minutes
- **Progressive disclosure**: Break complex setup into manageable steps
- **Contextual guidance**: Show users exactly what to do next
- **Personalization**: Use collected data to preconfigure settings
- **Progress indicators**: Always show where users are in the process

## Onboarding Questions & Preconfiguration Logic

### Step 1: Business Basics

**Questions:**

1. **Industry Type** (Select one)

   - Car Detailing / Vehicle Services
   - Cleaning Services
   - Maintenance Services
   - Other (text input)

2. **Number of Employees/Contractors**
   - None (solo operator)
   - 1-5
   - 6-20
   - 21-50
   - 50+

**Preconfiguration:**

- Industry type helps determine business mode and default templates
- Employee count determines if we show worker management as priority

### Step 2: Business Details

**Questions:**

1. **ABN Number** (Optional, Australian only)

   - Text input with validation

2. **Do you service specific customer locations?** (Yes/No)
   - If Yes: "We'll help you set up locations after onboarding"
   - If No: "You can add locations later if needed"

**Preconfiguration:**

- Store ABN in `organization.abn`
- Set `use_predefined_locations` based on answer
- If locations = Yes, prioritize location setup in guided flow

### Step 3: Worker Payment Setup

**Questions:**

1. **Do you have employees/contractors?** (Yes/No - shown if employee count > 0)
   - If Yes:
     - **How do you pay workers?**
       - By the hour
       - Per job completed
       - Fixed salary
     - **Payment frequency**
       - Weekly
       - Fortnightly
       - Monthly

**Preconfiguration:**

- Configure `organization_settings.worker_payment_cycle_config`:
  ```json
  {
    "payment_frequency": "weekly" | "fortnightly" | "monthly",
    "payment_day_of_week": 4, // Friday default
    "cut_off_time": "17:00:00",
    "require_approval": true,
    "auto_calculate": false
  }
  ```

### Step 4: Invoicing Preferences

**Questions:**

1. **How often do you invoice customers?**

   - Immediately after each job
   - Daily (at end of day)
   - Weekly (select day)
   - Monthly (select day)

2. **Do you want to review invoices before sending?** (Yes/No)

**Preconfiguration:**

- If "Immediately": Set `invoice_send_immediately = true`
- If Daily/Weekly/Monthly: Configure `organization_settings.auto_send_invoices_config`:
  ```json
  {
    "enabled": true,
    "period": "daily" | "weekly" | "monthly",
    "day_of_week": 1, // Optional for weekly
    "day_of_month": 1, // Optional for monthly
    "time": "09:00"
  }
  ```
- Set `invoice_send_immediately` based on review preference

## Guided Setup Flow

After onboarding questions, guide users through setup steps based on their answers:

### Priority Order:

1. **Add Workers** (if employee count > 0)

   - "Let's add your first worker"
   - Direct to `/dashboard/users` with onboarding context
   - Show tooltip/guide on how to add workers

2. **Add Locations** (if "service specific locations" = Yes)

   - "Now let's add your first customer location"
   - Direct to `/dashboard/locations` with onboarding context
   - Show tooltip/guide on how to add locations

3. **Configure Mobile App Forms** (Always)

   - "Customize your mobile app forms"
   - Direct to `/dashboard/mobile-config` with onboarding context
   - Suggest applying template based on industry/business mode
   - Show tooltip/guide on form builder

4. **Payment Setup** (Optional, can be done later)
   - "Connect Stripe for payment processing" (if not done)
   - Direct to `/dashboard/settings` payment tab

### Onboarding Completion Tracking

Add to `organization` table:

- `onboarding_completed_at TIMESTAMPTZ` - tracks when onboarding was completed
- `onboarding_data JSONB` - stores the answers to onboarding questions

**Logic:**

- Show onboarding wizard if `onboarding_completed_at IS NULL`
- After completing onboarding, set `onboarding_completed_at = NOW()`
- Store answers in `onboarding_data` for future reference

## Implementation Plan

### Phase 1: Database Schema

1. Add `onboarding_completed_at` and `onboarding_data` to `organization` table
2. Migration to add columns

### Phase 2: Onboarding Wizard Component

1. Create multi-step wizard component with progress indicator
2. Form validation for each step
3. Save answers as user progresses (draft saving)
4. Final submission saves to organization

### Phase 3: Preconfiguration Logic

1. Edge function or service to apply settings based on answers
2. Update organization settings
3. Apply field config templates if applicable

### Phase 4: Guided Setup Flow

1. Onboarding completion page with next steps
2. Context-aware redirects to setup pages
3. Tooltips/guides on target pages when in onboarding mode
4. Progress checklist component

### Phase 5: Integration

1. Modify signup flow to redirect to onboarding
2. Middleware check for onboarding completion
3. Dashboard redirect logic

## User Experience Flow

```
Signup → Onboarding Wizard (4 steps) → Preconfiguration → Guided Setup → Dashboard
```

### Onboarding Wizard UI

- Progress bar at top showing step X of Y
- Back/Next buttons
- Skip option (with "I'll set this up later" message)
- Save draft functionality
- Mobile responsive

### Guided Setup UI

- Checklist component showing completed/pending steps
- Direct action buttons ("Add First Worker", "Add First Location")
- Contextual help tooltips
- "Skip for now" option for each step

## Benefits

1. **Faster Time-to-Value**: Users have a configured account in minutes
2. **Reduced Friction**: Preconfigured settings mean less manual setup
3. **Better Guidance**: Users know exactly what to do next
4. **Higher Activation**: Guided flow increases completion rates
5. **Data Collection**: Onboarding data helps understand user needs

## Future Enhancements

1. **Industry-specific templates**: Auto-apply field configs based on industry
2. **Bulk import**: If user has many workers/locations, offer CSV import
3. **Onboarding analytics**: Track completion rates and drop-off points
4. **A/B testing**: Test different question orders and flows
5. **Progressive onboarding**: Show additional tips as users use features
