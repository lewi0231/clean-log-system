# Tally Runner (monorepo) Style Guide

> Coding standards, patterns, and conventions for the Tally Runner (monorepo) monorepo.

## Required Reading

Before undertaking ANY task, you MUST:

1. **Read the project style guides** located in this directory
   - This README (overview and principles)
   - [Quick Reference](./QUICK_REFERENCE.md) for essential rules
   - Platform-specific guides based on your work area

2. **Apply these guides** to all code you write, review, or modify

3. **Flag conflicts** if a task request conflicts with established patterns

---

## Quick Links

| Guide                                   | Description                           | When to Use           |
| --------------------------------------- | ------------------------------------- | --------------------- |
| [Quick Reference](./QUICK_REFERENCE.md) | Single-page summary of critical rules | Daily reference       |
| [Universal](./universal/)               | Patterns for ALL code                 | Always applicable     |
| [Dashboard](./dashboard/)               | Next.js specific patterns             | Dashboard development |
| [Mobile App](./mobile-app/)             | React Native patterns                 | Mobile development    |
| [Edge Functions](./edge-functions/)     | Deno/Supabase patterns                | Backend development   |

---

## Project Structure

This is a monorepo containing:

- `/database` - Supabase edge functions and database schema
- `/dashboard` - Next.js application
- `/mobile-app` - React Native (Expo) application

### Key Reference Files

- **Database Schema**: [`/database/schema.sql`](../../../database/schema.sql) - The current database schema (kept up-to-date)
- **Migrations**: `/database/supabase/migrations/` - Database migration files
- **Edge Functions**: `/database/supabase/functions/` - Supabase edge functions

### Database migrations: do not edit existing files

**Never modify a migration file that has already been applied** (locally or in any environment). Applied migrations are immutable; changing them breaks reproducibility and can cause apply failures or schema drift. Always add a **new** migration for any schema or behaviour change. See [Quick Reference — Database Migrations](./QUICK_REFERENCE.md#database-migrations) for naming, structure, and patterns.

---

## Structure

```
style-guide/
├── README.md              ← You are here
├── QUICK_REFERENCE.md     # One-page cheat sheet
│
├── universal/             # Code-agnostic patterns
│   ├── README.md
│   ├── typescript.md      # Types, generics, strict mode
│   ├── naming-conventions.md
│   ├── imports-and-exports.md
│   ├── constants.md       # Magic values, as const
│   ├── error-handling.md
│   ├── testing-principles.md
│   └── github-workflow.md  # GitHub CLI for issues and PRs
│
├── dashboard/             # Next.js dashboard
│   ├── README.md
│   ├── components.md      # Server/Client, composition
│   ├── hooks.md           # TanStack Query patterns
│   ├── services.md        # Edge Function integration
│   ├── styling.md         # Tailwind v4, shadcn
│   └── testing.md         # Vitest, RTL
│
├── mobile-app/            # React Native / Expo
│   ├── README.md
│   ├── components.md      # Native components
│   ├── hooks.md           # Mobile hooks
│   └── styling.md         # NativeWind, Tailwind v3
│
├── edge-functions/        # Supabase Edge Functions
│   ├── README.md
│   ├── structure.md       # Function template
│   ├── validation.md      # Zod patterns
│   ├── auth.md            # Organization membership
│   └── testing.md         # Deno tests
│
└── archive/               # Original phase documents
    ├── phase-1-*.md
    ├── phase-2-*.md
    └── ...
```

---

## How to Use This Guide

### New to the Project?

1. Read the [Quick Reference](./QUICK_REFERENCE.md) for essential rules
2. Review [Universal](./universal/) patterns that apply everywhere
3. Dive into platform-specific guides based on your work area

### Working on Dashboard?

1. Start with [Dashboard README](./dashboard/README.md)
2. Reference specific docs as needed (components, hooks, services, styling, testing)
3. Universal patterns always apply

### Working on Mobile App?

1. Start with [Mobile App README](./mobile-app/README.md)
2. Note differences from dashboard (Tailwind v3 vs v4, native components)
3. Universal patterns always apply

### Working on Edge Functions?

1. Start with [Edge Functions README](./edge-functions/README.md)
2. Follow the standard function structure template
3. Universal patterns always apply

---

## Before Starting Any Task

**Complete this comprehensive checklist:**

**Technical Preparation:**

- [ ] I have read the relevant style guide sections
- [ ] I understand the established patterns for this area
- [ ] If uncertain, I have researched best practices via research tools
- [ ] My approach aligns with project consistency principles
- [ ] I can provide concrete examples of my recommendations

**UX Research & Validation:**

- [ ] I understand the target user personas and their workflows
- [ ] I have considered accessibility requirements (WCAG guidelines)
- [ ] I can articulate how this serves user needs and business goals
- [ ] I have evaluated potential UX impact on adoption and retention
- [ ] For UI/UX changes, I have reviewed existing user feedback and analytics

**Evaluation Framework:**

- [ ] Technical: Assessed scalability and efficiency implications
- [ ] UX: Evaluated usability, accessibility, and task completion impact
- [ ] Business: Considered value delivery and adoption potential

---

## Key Principles

### 1. Research-First Approach

- **Never guess** when best practices are unclear
- **Use research tools** (Tavily, web search) to research industry standards before making recommendations
- **Continue researching** until you're confident in the optimal approach
- **Document your sources** in comments or discussion

### 2. Value Human Time Above All

- Invest YOUR time in research rather than asking for decisions
- Autonomous, well-researched solutions save more human time than quick questions
- If you're uncertain, do the research - that's what you're here for
- Only escalate decisions that require business context or preferences

### 3. Triple Evaluation Criteria

Evaluate all decisions on three dimensions:

**Technical Excellence:**

- **Scalability**: How well does this support growth (features, developers, complexity)?
- **Efficiency**: Impact on build times, developer experience, maintenance burden

**User Experience (UX):**

- **Usability**: How intuitive and easy to use for target users?
- **Accessibility**: How well does it serve users with diverse abilities and needs?
- **Task Completion**: How effectively does it help users accomplish their goals?

**Business Impact:**

- **Value Delivery**: How well does this meet user needs and business objectives?
- **Adoption Potential**: How likely are users to embrace and continue using this feature?

### 4. Consistency Is Paramount

- Follow established patterns from the style guides
- If no pattern exists, research and propose one
- Never introduce one-off solutions without justification
- When extending patterns, maintain the existing style
- Universal patterns take precedence. Platform-specific guides build on top of universal foundations.

### 5. Concrete Examples Required

When proposing solutions or changes:

- Provide specific file paths
- Show ❌ what NOT to do (anti-pattern)
- Show ✅ what TO do (recommended approach)
- Explain WHY in terms of scalability and efficiency
- Real code examples from this codebase, not hypothetical patterns

### 6. Progressive Disclosure

Each README provides quick reference. Detailed docs are available when needed.

### 7. No Unsolicited Reports or Summaries

- **Do the work, don't report on it** - Complete tasks without creating summaries unless explicitly requested
- **No task completion reports** - Don't create documents describing what you did
- **No "next steps" sections** - Just complete the task and move on
- **Exception**: Create documentation when it's part of the actual deliverable (e.g., API docs, migration notes for team reference)
- **If I want a summary, I'll ask for it** - Trust that I'm reviewing your changes directly

### 8. Tree of Thought for Ambiguous Decisions

When you cannot provide a single, clear recommendation (i.e., multiple valid approaches exist or the best path is uncertain):

- **Use tree of thought reasoning** to systematically explore options
- **Evaluate each branch** against the triple criteria (Technical, UX, Business)
- **Present multiple options** with pros/cons for each approach
- **Provide a recommendation** based on your analysis, explaining why
- **Show your reasoning** so the decision can be made with full context

**When to use tree of thought:**

- Multiple valid approaches exist and trade-offs need evaluation
- The style guide doesn't cover the specific scenario
- Research reveals conflicting best practices
- Technical constraints create competing priorities
- UX considerations suggest different approaches

**Example structure:**

```
## Approach Analysis

### Option 1: [Name]
- Pros: [benefits]
- Cons: [drawbacks]
- Best for: [when this makes sense]

### Option 2: [Name]
- Pros: [benefits]
- Cons: [drawbacks]
- Best for: [when this makes sense]

### Recommendation
Based on [criteria], I recommend Option X because [reasoning].
```

This ensures decisions are made with full context rather than guessing or asking for clarification prematurely.

---

## UX Evaluation Methods

When evaluating user-facing features, use these systematic approaches:

### 1. Heuristic Evaluation

- Apply Nielsen's 10 usability heuristics
- Review against accessibility guidelines (WCAG 2.1 AA)
- Consider cognitive load and information architecture

### 2. Cognitive Walkthrough

- Simulate user thought processes for key workflows
- Identify potential confusion points or decision blocks
- Validate that UI cues match user expectations

### 3. Analytics Review

- Examine existing user behavior data
- Identify pain points in current workflows
- Measure task completion rates and abandonment points

### Key UX Metrics to Track:

- **Task Success Rate**: Percentage of users completing workflows successfully
- **Time-on-Task**: Average time to complete critical user journeys
- **Error Rate**: Frequency of user errors and recovery success
- **Search vs Navigation**: How users find information (indicates IA effectiveness)

---

## UX Anti-Patterns to Avoid

**❌ Technical-first development**: Building features without user validation
**✅ User-centered design**: Research user needs before technical implementation

**❌ Accessibility as afterthought**: Adding accessibility fixes post-development
**✅ Inclusive design**: Building accessibility into the core design process

**❌ Complex workflows**: Multi-step processes that confuse users
**✅ Streamlined experiences**: Reducing cognitive load and steps to completion

**❌ Feature bloat**: Adding capabilities users don't need or want
**✅ Focused value**: Delivering exactly what users need to accomplish their goals

---

## Monorepo Stack

| Package       | Technology                        | Style Guide Section                 |
| ------------- | --------------------------------- | ----------------------------------- |
| `dashboard/`  | Next.js 16, React 19, Tailwind v4 | [Dashboard](./dashboard/)           |
| `mobile-app/` | React Native, Expo, NativeWind    | [Mobile App](./mobile-app/)         |
| `database/`   | Supabase Edge Functions, Deno     | [Edge Functions](./edge-functions/) |
| `shared/`     | TypeScript types                  | [Universal](./universal/)           |

---

## Contributing to This Guide

When adding new patterns:

1. Check if it's universal or platform-specific
2. Add to the appropriate section
3. Include real code examples from the codebase
4. Update the Quick Reference if it's a commonly-used rule
5. Archive superseded patterns, don't delete them

## When Style Guides Don't Cover Your Task

If you encounter a scenario not covered by existing guides:

1. **Research** industry best practices using research tools (include UX research)
2. **Use tree of thought** (see Principle #8) if multiple valid approaches exist
3. **Evaluate** options against all three criteria: technical, UX, and business impact
4. **Propose** a pattern with examples (❌ vs ✅) showing UX implications
5. **Document** your reasoning and sources, including user research insights
6. **Suggest** this be added to the style guide for future consistency

**Note:** When multiple approaches are valid, don't ask "which should I use?" - instead, use tree of thought to analyze options and provide a recommendation with reasoning.

---
