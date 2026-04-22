# User Story 004: Landing Page Pricing Section

## Overview

Pricing transparency builds trust and reduces friction in the signup process. The pricing section should clearly communicate pricing options, highlight value, and make it easy for potential customers to choose the right plan.

## User Story

**As a** small business owner evaluating Tally Runner  
**I want to** see clear, transparent pricing information  
**So that** I can understand the cost and determine if Tally Runner fits my budget before signing up

## Acceptance Criteria

### 1. Pricing Transparency

- All pricing clearly displayed (no "Contact us for pricing")
- Currency clearly indicated (AUD for Australian market)
- Billing frequency options (monthly/annual) if applicable
- No hidden fees or surprises

### 2. Pricing Structure Options

#### Option A: Single Tier (Recommended for MVP)

- One clear price point
- Simple, no decision paralysis
- "All features included"
- Free trial period (14-30 days)

#### Option B: Multiple Tiers

- 2-3 tiers maximum (avoid too many choices)
- Clear differentiation between tiers
- Recommended tier highlighted
- Feature comparison table

### 3. Pricing Display Format

**Single Tier Example:**

```
$79/month per business
All features included
14-day free trial
No credit card required
```

**Multi-Tier Example:**

- Starter: $39/month (solo operators)
- Professional: $79/month (small teams) [RECOMMENDED]
- Business: $149/month (larger teams)

### 4. Value Proposition

- What's included at each tier
- Clear feature list
- "Most popular" badge on recommended tier
- Comparison table for multi-tier

### 5. Free Trial Information

- Prominent "14-day free trial" messaging
- "No credit card required" if applicable
- Clear explanation of what happens after trial
- Easy cancellation policy

### 6. Pricing Details

- Per-business pricing (not per-user, based on codebase)
- What counts as a "business" (one organization)
- Additional costs (if any): payment processing fees, etc.
- Annual vs monthly billing (if applicable)

### 7. FAQ Section (Pricing-Related)

- "Can I change plans later?"
- "What happens after the free trial?"
- "Are there setup fees?"
- "Do you offer discounts for annual billing?"
- "What payment methods do you accept?"

### 8. CTA Buttons

- "Start Free Trial" button on each tier
- Consistent, prominent CTAs
- Link to signup page
- Optional: "Contact Sales" for enterprise inquiries

## Design Principles (Based on Research)

1. **Transparency**: Show pricing upfront (builds trust)
2. **Simplicity**: Avoid too many options (reduces decision paralysis)
3. **Visual Hierarchy**: Recommended tier stands out
4. **Scannable**: Easy to compare options
5. **Trust**: Clear cancellation policy, no hidden fees

## Content Guidelines

### Pricing Copy

- Use benefit-focused language: "Everything you need to manage your service business"
- Address common concerns: "Cancel anytime", "No long-term contracts"
- Highlight value: "Save 10+ hours per week on admin"

### Feature Comparison (If Multi-Tier)

- Core features in all tiers
- Advanced features in higher tiers
- Clear, scannable table
- Mobile-responsive (horizontal scroll on mobile if needed)

## Pricing Strategy Considerations

Based on codebase analysis:

- Target: Small businesses (solo to 20-30 employees)
- Pricing should be accessible to small businesses
- Consider: Per-business pricing (not per-user)
- Free trial essential for trust-building

## Technical Requirements

- Pricing calculator (if applicable)
- Clear pricing data structure for easy updates
- Mobile-responsive pricing cards
- Accessible: Screen reader friendly, keyboard navigation

## Success Metrics

- Scroll depth to pricing section
- Time spent in pricing section
- CTA click-through rate from pricing section
- Conversion rate: Pricing view → Signup
- Most popular tier selection

## Related User Stories

- [001: Hero Section](./001-landing-page-hero-section.md)
- [003: Social Proof Section](./003-landing-page-social-proof.md)
- [006: FAQ Section](./006-landing-page-faq-section.md)
