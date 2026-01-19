# Landing Page User Stories

This directory contains user stories for the RivetUp landing page, based on UX/UI research and analysis of the codebase to understand product features and target audience.

## Overview

RivetUp is a SaaS platform for service-based businesses (tradespeople, car detailers, cleaning services) to manage field workers, jobs, and customer invoicing. The landing page must effectively communicate value, build trust, and convert visitors into trial users.

## Target Audience

- **Primary**: Small business owners (solo operators to 20-30 employees)
- **Industries**: Car detailers, tradespeople (electricians, plumbers, etc.), cleaning services
- **Pain Points**: Manual paperwork, delayed invoicing, difficulty tracking field workers, complex pricing rules

## Research Basis

These user stories are informed by:
- SaaS landing page UX/UI best practices (2026)
- Field service management software landing page analysis
- Codebase analysis of RivetUp features and capabilities
- Target audience understanding from testing scenarios

## User Stories

### Core Sections

1. **[001: Hero Section](./001-landing-page-hero-section.md)**
   - First impression and value proposition
   - Primary CTA placement
   - Trust indicators

2. **[002: Features Section](./002-landing-page-features-section.md)**
   - Core feature showcase
   - Benefit-focused presentation
   - Visual demonstrations

3. **[003: Social Proof Section](./003-landing-page-social-proof.md)**
   - Testimonials from real customers
   - Usage statistics
   - Trust badges

4. **[004: Pricing Section](./004-landing-page-pricing-section.md)**
   - Transparent pricing display
   - Free trial information
   - Pricing FAQs

5. **[005: Mobile App Section](./005-landing-page-mobile-app-section.md)**
   - Mobile app as key differentiator
   - Worker-focused features
   - Real-time sync benefits

6. **[006: FAQ Section](./006-landing-page-faq-section.md)**
   - Common questions and objections
   - Industry-specific FAQs
   - Setup and onboarding questions

7. **[007: Industry-Specific Sections](./007-landing-page-industry-sections.md)**
   - Car detailing use cases
   - Tradesperson use cases
   - Cleaning service use cases

8. **[008: Final CTA Section](./008-landing-page-final-cta.md)**
   - Last conversion opportunity
   - Objection removal
   - Value reinforcement

### Navigation & Structure

9. **[009: Navigation Header](./009-landing-page-navigation-header.md)**
   - Site navigation
   - CTA placement
   - Mobile menu

10. **[010: Footer](./010-landing-page-footer.md)**
    - Important links
    - Legal information
    - Contact details

## Key Design Principles

Based on research, the landing page should follow these principles:

1. **Clarity Over Cleverness**: Direct, benefit-focused messaging
2. **Progressive Disclosure**: Show what users need now, details later
3. **Visual Hierarchy**: Guide the eye to important elements
4. **Trust Building**: Social proof, transparency, security
5. **Mobile-First**: Responsive design for all devices
6. **Conversion-Focused**: Clear CTAs, reduced friction

## Key Features to Highlight

Based on codebase analysis:

- **Mobile Job Management**: Workers complete jobs on mobile app
- **Automated Invoicing**: Invoices generated and sent automatically
- **Flexible Pricing Rules**: Custom pricing (per-unit, location-based, flat-rate)
- **Worker Management**: Track workers, jobs, and payments
- **Customer Locations**: Manage fixed locations (car yards, etc.)
- **Real-Time Sync**: Jobs sync instantly from mobile to dashboard
- **Custom Job Forms**: Tailored forms for each business type

## Target Industries

1. **Car Detailers**
   - Fixed locations (car yards)
   - Service packages
   - Monthly batch invoicing
   - Location-based pricing

2. **Tradespeople**
   - Time tracking
   - Material tracking
   - Job photos
   - Flexible pricing models

3. **Cleaning Services**
   - Recurring jobs
   - Fixed locations
   - Time tracking
   - Batch invoicing

## Success Metrics

Track these metrics to measure landing page effectiveness:

- **Engagement**: Scroll depth, time on page
- **Conversion**: CTA click-through rate, signup rate
- **Trust**: FAQ engagement, social proof interaction
- **Industry Fit**: Which industry sections drive most signups
- **Mobile**: Mobile vs desktop conversion rates

## Implementation Notes

- Use Next.js best practices for front-end implementation
- Ensure all sections are accessible (WCAG 2.1 AA)
- Optimize for performance (Core Web Vitals)
- Implement analytics tracking for all CTAs
- A/B test key elements (headlines, CTAs, pricing display)

## Technical Implementation Details

### Analytics Tracking
- Implement Google Analytics 4 or similar for all user interactions
- Track CTA clicks, form submissions, scroll depth, and time on page
- Set up conversion tracking for signup events
- Monitor user journey through landing page sections
- Track mobile vs desktop conversion rates

### A/B Testing Framework
- Implement A/B testing capability for key elements:
  - Hero headlines and subheadlines
  - CTA button text and placement
  - Pricing display format (single vs multi-tier)
  - Feature section layouts
  - Social proof positioning
- Use tools like Google Optimize, Optimizely, or custom implementation
- Test one element at a time to avoid confounding variables
- Set up statistical significance tracking

### Performance Optimization
- Implement Core Web Vitals monitoring
- Optimize images: WebP format with fallbacks, lazy loading, responsive images
- Code splitting and dynamic imports for below-fold content
- Minimize render-blocking resources
- Implement caching strategies for static assets
- Monitor and optimize Largest Contentful Paint (LCP), First Input Delay (FID), and Cumulative Layout Shift (CLS)

### SEO and Accessibility
- Implement structured data (JSON-LD) for business information
- Optimize meta tags, Open Graph, and Twitter Card tags
- Ensure semantic HTML structure
- Implement proper heading hierarchy (H1, H2, H3)
- Add alt text for all images
- Ensure keyboard navigation and screen reader compatibility
- Test with Lighthouse and accessibility audit tools

## Related Documentation

- [Manual Testing Scenarios](../../manual-testing-scenarios.md) - User personas and use cases
- [Onboarding Flow Proposal](../../onboarding-flow-proposal.md) - Post-signup experience
- [About This Project](../../../.cursor/rules/about-this-project.mdc) - Product overview
