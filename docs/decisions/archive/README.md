# Archive

> Original comprehensive phase documents from the initial style guide creation.

These documents contain detailed analysis and are kept for reference. The active style guide has been restructured into the modular format in the parent directories.

---

## Documents

| Document | Description |
|----------|-------------|
| [Phase 1](./phase-1-organizational-structure-analysis.md) | Monorepo structure, organizational patterns |
| [Phase 2](./phase-2-component-and-code-patterns.md) | React components, hooks, state management |
| [Phase 3](./phase-3-styling-and-ui-patterns.md) | Tailwind, shadcn/ui, theming |
| [Phase 4](./phase-4-api-and-data-flow-patterns.md) | API patterns, data flow, services |
| [Phase 5](./phase-5-testing-patterns.md) | Testing setup, patterns, coverage |
| [Prompt Guide](./prompt-guide.md) | AI assistant context guide |

---

## When to Use

These documents may be useful when:
- You need detailed background on why certain patterns were chosen
- You want to see the full analysis that led to specific rules
- You're researching a pattern not covered in the new modular docs
- You need historical context for a decision

---

## Current Structure

The active style guide is now organized as:

```
style-guide/
├── universal/         # Code-agnostic patterns
├── dashboard/         # Next.js patterns  
├── mobile-app/        # React Native patterns
├── edge-functions/    # Supabase/Deno patterns
└── archive/           # These original docs
```
