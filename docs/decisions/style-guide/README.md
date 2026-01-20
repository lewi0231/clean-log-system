# Clean Log System Style Guide

> Coding standards, patterns, and conventions for the Clean Log System monorepo.

---

## Quick Links

| Guide | Description | When to Use |
|-------|-------------|-------------|
| [Quick Reference](./QUICK_REFERENCE.md) | Single-page summary of critical rules | Daily reference |
| [Universal](./universal/) | Patterns for ALL code | Always applicable |
| [Dashboard](./dashboard/) | Next.js specific patterns | Dashboard development |
| [Mobile App](./mobile-app/) | React Native patterns | Mobile development |
| [Edge Functions](./edge-functions/) | Deno/Supabase patterns | Backend development |

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
│   └── testing-principles.md
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

## Key Principles

### 1. Consistency Over Preference

Follow established patterns even if you prefer a different approach. Consistency makes the codebase easier to navigate and maintain.

### 2. Universal First

Universal patterns take precedence. Platform-specific guides build on top of universal foundations.

### 3. Progressive Disclosure

Each README provides quick reference. Detailed docs are available when needed.

### 4. Examples Over Theory

Real code examples from this codebase, not hypothetical patterns.

---

## Monorepo Stack

| Package | Technology | Style Guide Section |
|---------|------------|---------------------|
| `dashboard/` | Next.js 16, React 19, Tailwind v4 | [Dashboard](./dashboard/) |
| `mobile-app/` | React Native, Expo, NativeWind | [Mobile App](./mobile-app/) |
| `database/` | Supabase Edge Functions, Deno | [Edge Functions](./edge-functions/) |
| `shared/` | TypeScript types | [Universal](./universal/) |

---

## Contributing to This Guide

When adding new patterns:

1. Check if it's universal or platform-specific
2. Add to the appropriate section
3. Include real code examples from the codebase
4. Update the Quick Reference if it's a commonly-used rule
5. Archive superseded patterns, don't delete them

---

## Archive

The [archive/](./archive/) directory contains the original comprehensive phase documents. These are kept for reference but the new modular structure above is the active guide.
