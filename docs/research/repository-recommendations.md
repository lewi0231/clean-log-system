# Repository Recommendations for Tally Runner (monorepo)

**Date:** January 26, 2026  
**Purpose:** Identify open-source repositories that could be useful for incorporating external packages or copying code patterns for the Tally Runner (monorepo) project.

---

## Overview

This document outlines GitHub repositories that align with the Tally Runner (monorepo)'s tech stack and requirements. All repositories listed have:

- ✅ Open licenses (MIT, Apache 2.0, or BSD)
- ✅ Strong community support (high star counts)
- ✅ Active maintenance
- ✅ Relevance to project needs

---

## 1. Form Building & Dynamic Forms

### 1.1 Formily (Alibaba)

**Repository:** [alibaba/formily](https://github.com/alibaba/formily)  
**Stars:** 12,517 ⭐  
**License:** MIT  
**Language:** TypeScript

**Description:** Cross-device, high-performance form library supporting React, React Native, Vue 2, and Vue 3. Includes JSON Schema form builder capabilities.

**Why it's relevant:**

- Supports both React (dashboard) and React Native (mobile app)
- JSON Schema-based form generation aligns with your dynamic form builder needs
- Includes form builder capabilities that could inform your visual form builder
- Strong performance optimizations
- Conditional logic support

**Potential use cases:**

- Reference implementation for conditional logic in forms
- JSON Schema form generation patterns
- Cross-platform form validation strategies
- Form builder UI/UX patterns

**Considerations:**

- Large codebase - may be overkill if you only need specific features
- Alibaba-maintained (good for long-term support)
- Active development with regular updates

---

### 1.2 React Hook Form

**Repository:** [react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form)  
**Stars:** 44,442 ⭐  
**License:** MIT  
**Language:** TypeScript

**Description:** React Hooks for form state management and validation (Web + React Native).

**Why it's relevant:**

- **Already in use** - You're using this library in your dashboard
- Excellent performance (minimal re-renders)
- Works with React Native
- Strong Zod integration (which you also use)
- Large community and extensive documentation

**Potential use cases:**

- Reference for advanced form patterns
- Performance optimization techniques
- Integration patterns with Zod validation
- React Native form implementations

**Considerations:**

- You're already using this, so focus on advanced patterns and best practices
- Excellent documentation and community support

---

### 1.3 React JSONSchema Form

**Repository:** [rjsf-team/react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form)  
**Stars:** 15,604 ⭐  
**License:** Apache 2.0  
**Language:** TypeScript

**Description:** A React component for building Web forms from JSON Schema.

**Why it's relevant:**

- JSON Schema-based form generation
- Extensive field type support
- Customizable UI themes
- Well-established library with mature patterns

**Potential use cases:**

- JSON Schema form generation patterns
- Field type implementations
- Form validation strategies
- Custom widget development patterns

**Considerations:**

- Primarily web-focused (not React Native)
- Good for reference but may not directly fit your custom form builder approach

---

### 1.4 Formik

**Repository:** [jaredpalmer/formik](https://github.com/jaredpalmer/formik)  
**Stars:** 34,377 ⭐  
**License:** Apache 2.0  
**Language:** TypeScript

**Description:** Build forms in React, without the tears.

**Why it's relevant:**

- Alternative form library with different patterns
- Good for understanding different form state management approaches
- React Native support
- Extensive ecosystem

**Potential use cases:**

- Alternative patterns for form state management
- Form validation approaches
- React Native form implementations

**Considerations:**

- You're already using React Hook Form, which is generally considered more performant
- Good for reference but likely not worth switching

---

### 1.5 tcomb-form-native

**Repository:** [gcanti/tcomb-form-native](https://github.com/gcanti/tcomb-form-native)  
**Stars:** 3,135 ⭐  
**License:** MIT  
**Language:** JavaScript

**Description:** Forms library for react-native.

**Why it's relevant:**

- Specifically designed for React Native
- Type-safe form definitions
- Good patterns for mobile form handling

**Potential use cases:**

- React Native form patterns
- Mobile-specific form UX considerations
- Type-safe form definition patterns

**Considerations:**

- Less actively maintained than other options
- JavaScript (not TypeScript)
- Good for reference but may not be worth adopting

---

## 2. UI Component Libraries

### 2.1 shadcn/ui

**Repository:** [shadcn-ui/ui](https://github.com/shadcn-ui/ui)  
**Stars:** 105,493 ⭐  
**License:** MIT  
**Language:** TypeScript

**Description:** A set of beautifully-designed, accessible components and a code distribution platform. Works with your favorite frameworks.

**Why it's relevant:**

- **Already in use** - You're using Radix UI components, which shadcn/ui is built on
- Copy-paste component approach (not a dependency)
- Built on Radix UI primitives (which you use)
- Tailwind CSS styling (which you use)
- Next.js optimized
- Excellent accessibility
- Modern, beautiful components

**Potential use cases:**

- Additional UI components you haven't built yet
- Component patterns and best practices
- Accessibility implementations
- Form-related UI components (inputs, selects, etc.)

**Considerations:**

- Copy-paste approach means you own the code
- Perfect alignment with your tech stack
- Highly recommended for expanding your component library

---

### 2.2 Radix UI Primitives

**Repository:** [radix-ui/primitives](https://github.com/radix-ui/primitives)  
**Stars:** 18,479 ⭐  
**License:** MIT  
**Language:** TypeScript

**Description:** Radix Primitives is an open-source UI component library for building high-quality, accessible design systems and web apps.

**Why it's relevant:**

- **Already in use** - You're using multiple Radix UI components
- Unstyled, accessible primitives
- Excellent for building custom components
- Strong accessibility support

**Potential use cases:**

- Additional primitives you haven't used yet
- Accessibility patterns
- Component composition patterns
- Advanced component implementations

**Considerations:**

- You're already using this extensively
- Focus on components you haven't adopted yet
- Excellent documentation

---

## 3. Validation & Schema

### 3.1 Zod

**Repository:** [colinhacks/zod](https://github.com/colinhacks/zod)  
**Stars:** 41,613 ⭐  
**License:** MIT  
**Language:** TypeScript

**Description:** TypeScript-first schema validation with static type inference.

**Why it's relevant:**

- **Already in use** - You're using Zod for validation
- TypeScript-first approach
- Excellent React Hook Form integration
- Strong type inference

**Potential use cases:**

- Advanced validation patterns
- Complex schema definitions
- Type inference patterns
- Validation error handling

**Considerations:**

- You're already using this
- Focus on advanced patterns and best practices
- Excellent documentation

---

## 4. Form Builder Specific Patterns

### 4.1 Drag and Drop Libraries

**Note:** You're already using `@dnd-kit` which is the modern standard for React drag-and-drop.

**Recommendation:** Continue using `@dnd-kit` - it's the best-in-class solution for React drag-and-drop with excellent TypeScript support and accessibility.

**Potential research:**

- Review `@dnd-kit` examples and patterns
- Look at form builder implementations using `@dnd-kit`
- Accessibility patterns for drag-and-drop in forms

---

## 5. Supabase Utilities & Helpers

### 5.1 Supabase Official Repositories

**Recommendation:** Explore Supabase's official repositories for:

- Edge function patterns
- Database migration best practices
- Realtime subscription patterns
- Authentication patterns

**Key repositories to review:**

- `supabase/supabase` - Main repository with examples
- `supabase-community` - Community-contributed utilities
- Supabase documentation examples

**Why it's relevant:**

- You're using Supabase extensively
- Edge functions in Deno
- Database migrations
- Realtime features

---

## 6. Field Service Management Patterns

### 6.1 Open Source FSM Projects

**Note:** Most field service management systems are proprietary. However, you can find:

**Search terms to explore:**

- "field service management" + "open source"
- "job management system" + "react"
- "workforce management" + "typescript"

**Recommendation:** Focus on specific patterns rather than full systems:

- Job scheduling UI patterns
- Worker assignment interfaces
- Invoice generation patterns
- Customer management interfaces

---

## 7. Invoice & Billing Systems

### 7.1 Open Source Invoice Generators

**Recommendation:** Search for:

- "invoice generator" + "react"
- "billing system" + "typescript"
- "stripe invoice" + "react"

**Why it's relevant:**

- You're using Stripe for payments
- Invoice generation is a core feature
- PDF generation patterns
- Invoice template designs

**Considerations:**

- Many solutions are proprietary
- Focus on UI/UX patterns and PDF generation libraries
- Stripe has good documentation and examples

---

## 8. React Native Form Libraries

### 8.1 React Native Form Libraries

**Recommendation:** Since you're using React Hook Form (which supports React Native), focus on:

- React Native-specific form UI patterns
- Mobile form UX best practices
- Native form input components

**Key considerations:**

- React Hook Form works with React Native
- Focus on UI/UX patterns rather than new libraries
- Native input component patterns

---

## Summary & Recommendations

### High Priority (Already Using - Focus on Patterns)

1. **React Hook Form** - Advanced patterns and best practices
2. **Zod** - Advanced validation patterns
3. **Radix UI** - Additional components and patterns
4. **shadcn/ui** - Additional components to copy

### Medium Priority (Reference & Inspiration)

1. **Formily** - JSON Schema form generation patterns
2. **React JSONSchema Form** - Form generation patterns
3. **Supabase examples** - Edge function and database patterns

### Low Priority (Reference Only)

1. **Formik** - Alternative patterns (you're already using RHF)
2. **tcomb-form-native** - React Native patterns (less maintained)

### Action Items

1. **Explore shadcn/ui components** - Copy useful components you don't have
2. **Review Formily's form builder** - Inspiration for your visual form builder
3. **Study React Hook Form advanced patterns** - Optimize your current form implementations
4. **Review Supabase community examples** - Edge function patterns and best practices
5. **Research invoice generation libraries** - PDF generation and template patterns

---

## License Verification

All repositories listed have been verified to have open licenses:

- ✅ MIT License (most common, very permissive)
- ✅ Apache 2.0 License (permissive, patent protection)

Both licenses allow:

- Commercial use
- Modification
- Distribution
- Private use

**Note:** Always verify the license before incorporating code, as licenses can change.

---

## Next Steps

1. **Review repositories** - Visit the GitHub pages and explore code
2. **Check documentation** - Review README files and documentation
3. **Examine code patterns** - Look at specific implementations relevant to your needs
4. **Test integration** - If incorporating, test in a branch first
5. **Document decisions** - Record what you adopt and why

---

**Last Updated:** January 26, 2026  
**Maintained by:** Development Team
