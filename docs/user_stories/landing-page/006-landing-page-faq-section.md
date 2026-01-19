# User Story 006: Landing Page FAQ Section

## Overview

An FAQ section addresses common objections and questions, reducing friction in the signup process. It should cover pricing, features, setup, and industry-specific concerns.

## User Story

**As a** potential customer with questions about RivetUp  
**I want to** find answers to common questions quickly  
**So that** I can make an informed decision without having to contact support

## Acceptance Criteria

### 1. FAQ Categories
- **Pricing & Billing** (most common)
- **Features & Functionality**
- **Setup & Onboarding**
- **Industry-Specific Questions**
- **Technical & Security**

### 2. Essential FAQs

#### Pricing & Billing
- "How much does RivetUp cost?"
- "Is there a free trial?"
- "Can I cancel anytime?"
- "Do you offer annual billing discounts?"
- "Are there any hidden fees?"
- "What payment methods do you accept?"

#### Features & Functionality
- "Can I customize job forms for my business?"
- "How does the mobile app work?"
- "Can I set up custom pricing rules?"
- "Does it work offline?"
- "How many workers can I add?"
- "Can I manage multiple locations?"
- "How does automated invoicing work?"

#### Setup & Onboarding
- "How long does setup take?"
- "Do I need technical knowledge to use RivetUp?"
- "Can I import my existing data?"
- "Is training provided?"
- "What happens after I sign up?"

#### Industry-Specific
- "Is RivetUp good for car detailing businesses?"
- "Can I use it for trades like electrical or plumbing?"
- "Does it work for solo operators?"
- "Can I manage recurring jobs?"
- "How does it handle location-based pricing?"

#### Technical & Security
- "Is my data secure?"
- "Where is my data stored?"
- "Can I export my data?"
- "What happens if I cancel?"
- "Do you have an API?"
- "What browsers/devices are supported?"

### 3. FAQ Presentation Format

#### Option A: Accordion Style (Recommended)
- Expandable/collapsible questions
- Clean, scannable list
- Easy to find specific questions
- Mobile-friendly

#### Option B: Tabbed Interface
- Questions grouped by category
- Tabs for each category
- Good for many FAQs
- More organized

#### Option C: Simple List
- All questions visible
- Expandable answers
- Good for small FAQ sets
- Less navigation needed

### 4. Answer Guidelines
- **Concise**: 2-4 sentences per answer
- **Clear**: Direct, jargon-free language
- **Helpful**: Address the underlying concern
- **Actionable**: Include next steps when relevant
- **Honest**: Don't oversell or make false promises

### 5. Search Functionality (If Many FAQs)
- Search bar to find specific questions
- Filters by category
- Highlights search terms in results

### 6. Related Links
- Link to relevant features from answers
- Link to pricing page from pricing FAQs
- Link to signup from relevant answers
- Link to support/contact if question not answered

## Design Principles

1. **Scannable**: Easy to find relevant questions
2. **Accessible**: Keyboard navigation, screen reader friendly
3. **Mobile-Friendly**: Works well on small screens
4. **Helpful**: Answers actually help, not just market
5. **Honest**: Address real concerns, not just objections

## Content Guidelines

### Question Format
- Start with question words: "How", "What", "Can", "Does", "Is"
- Be specific: "How does automated invoicing work?" not "Invoicing?"
- Use natural language: "Can I cancel anytime?" not "Cancellation policy?"

### Answer Format
- Direct answer in first sentence
- Additional context in following sentences
- Include examples when helpful
- Link to more information if needed

### Example FAQ Entry

**Q: How long does setup take?**
A: Most businesses are up and running in 15-30 minutes. You'll add your workers, configure your job forms, and set up pricing rules. Our onboarding wizard guides you through each step. If you need help, our support team is available.

## Technical Requirements

- Accordion functionality (if used) should be accessible
- Smooth expand/collapse animations
- Mobile-optimized touch targets
- Fast page load (don't block render)

## Success Metrics

- FAQ section engagement (scroll depth)
- Most clicked questions (indicates common concerns)
- Time spent in FAQ section
- Conversion rate: FAQ view → Signup
- Support ticket reduction (if FAQ addresses common questions)

## Related User Stories

- [004: Pricing Section](./004-landing-page-pricing-section.md)
- [001: Hero Section](./001-landing-page-hero-section.md)
- [008: Final CTA Section](./008-landing-page-final-cta.md)
