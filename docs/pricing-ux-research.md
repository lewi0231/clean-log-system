# Pricing UX Research Summary

This document captures actionable UX patterns gathered from public references to inform the upgraded pricing dashboard.

## Stripe – Products & Prices Overview

Source: https://stripe.com/pricing

- **Progressive disclosure:** Stripe separates “Standard” vs. “Custom” pricing, then layers detailed sections (Payments, Billing, Radar, etc.) using accordions and anchor navigation. This keeps the hero simple while surfacing depth on demand.
- **Contextual callouts:** Each pricing block highlights key levers (volume discounts, country-specific rates, IC+ pricing) with inline badges and tooltips that clarify when advanced options apply.
- **Inline preview math:** Payment method rows show base fee plus stacked modifiers (e.g., +1.5% for international, +1% for FX). This additive layout communicates how overrides compose the final charge without extra clicks.

Implications: mimic Stripe’s tiered disclosure by showing a simple default price row per field, then expose modifiers (location override, conditional multiplier) as stacked chips that summarize the additive math.

## Square – Service Charge Configuration

Source: https://squareup.com/help/us/en/article/7625-get-started-with-service-charges

- **Guided workflow:** The “Create service charge” flow walks through naming, choosing fixed vs. percentage, selecting locations, and attaching taxes. Each step is a discrete form section, reducing cognitive load.
- **Location targeting:** During creation, Square explicitly asks which locations the charge applies to and lets merchants auto-apply charges to specific fulfillment types (pickup, delivery). Overrides live side-by-side with the base charge instead of buried in another screen.
- **Visibility guarantees:** Square emphasizes that service charges appear as line items everywhere (POS, invoices, reports) and provides reporting filters dedicated to these charges. That transparency reassures users before they commit changes.

Implications: our “Location overrides” matrix should live in the same editor view, with toggleable auto-apply options per location hierarchy node. Save confirmation should reiterate where the rule will appear (jobs, invoices, exports).

## Airtable – Field Type & Formula Patterns

Source: https://support.airtable.com/docs/field-types-overview

- **Field-centric mental model:** Airtable lists every field type with descriptions, reinforcing that formulas, rollups, and lookups are extensions of base fields. This is similar to pricing metadata tied to `field_config` entries.
- **Inline documentation tables:** The grid (Field name, Data type, Description, Support article) doubles as navigation and education. Users can quickly jump to deeper docs for complex field types.
- **Formula flexibility:** Airtable’s formula/rollup fields demonstrate how conditional logic can be attached to any field in-place, often through modal editors with syntax help.

Implications: in our dashboard, each field tile can offer a “Pricing metadata” drawer containing documentation snippets and quick links (e.g., “How tiered pricing works”), plus inline formula builders for conditional pricing similar to Airtable’s modal editor.

## Key Takeaways for Our Dashboard

1. **Progressive disclosure:** Default to a simple price input, then reveal advanced controls (location overrides, conditional rules, tier definitions) via collapsible sections or chips, mirroring Stripe’s additive modifiers.
2. **Inline override context:** Show override matrices and conditional chips in the same panel where the base price is edited (Square pattern) so users see hierarchy effects instantly.
3. **Educate in-context:** Include microcopy/tooltips referencing best practices and documentation (Airtable-style) to explain complex rule types without forcing users to leave the editor.
4. **Real-time previews:** Provide stacked summary chips (“Base $12 + Region West +15% + Night shift $3”) and sample calculation cards so users can verify outcomes before saving.
