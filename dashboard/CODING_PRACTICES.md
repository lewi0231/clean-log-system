# Dashboard Coding Practices

This document outlines coding practices and standards for the dashboard (Next.js) application.

## Next.js Best Practices

### File Structure

- Use the App Router (`app/` directory)
- Components should be in `components/` directory
- Hooks should be in `hooks/` directory
- Types should be in `lib/types.ts` or `lib/types/` directory
- Utilities should be in `lib/` directory

### Component Patterns

- Use TypeScript for all components
- Prefer server components by default, use `"use client"` only when needed
- Use React Server Components for data fetching when possible

### State Management

- Use React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`)
- Use `useTransition` for optimistic updates and better UX
- Use React Query (`@tanstack/react-query`) for server state management

### Styling

- Use Tailwind CSS classes
- Use `cursor-pointer` class for all clickable elements (buttons, tabs, links)
- Use consistent color scheme with CSS variables
- Follow the styling patterns documented in `STYLING_PRACTICES.md`

### Forms and Validation

- Use Zod for schema validation
- Validate on both client and server side
- Show validation errors inline with clear messaging
- Use optimistic updates for better UX

### Error Handling

- Use proper error boundaries
- Show user-friendly error messages
- Log errors appropriately (use `log` utility from `@/lib/logger`)

## Common Patterns

### Data Fetching

```typescript
const { data, loading, error } = useQuery({
  queryKey: ["key"],
  queryFn: fetchFunction,
});
```

### Optimistic Updates

```typescript
const [isPending, startTransition] = useTransition();

const handleUpdate = () => {
  startTransition(async () => {
    await updateFunction();
    // Optimistic update happens automatically
  });
};
```

### Clickable Elements

Always add `cursor-pointer` class:

```tsx
<Button className="cursor-pointer">Click me</Button>
<TabsTrigger className="cursor-pointer">Tab</TabsTrigger>
```

## GitHub Issue Management

- **Always use `gh issue create` command** to create GitHub issues
- Preferred format: `gh issue create --title "Title" --body-file .github/ISSUE_TEMPLATE/issue-name.md`
- This ensures consistent issue formatting and documentation

### Standard Labels

Use **only** these label options (they match GitHub’s common defaults and avoid CLI failures when a label doesn’t exist):

- `bug`
- `documentation`
- `duplicate`
- `enhancement`
- `good first issue`
- `help wanted`
- `invalid`
- `question`
- `wontfix`

If a label doesn’t exist in the repo yet, **omit `--label`** (don’t guess), or create the label explicitly first.

## Checklist for New Features

- [ ] Used TypeScript with proper types
- [ ] Added `cursor-pointer` to clickable elements
- [ ] Implemented proper error handling
- [ ] Added loading states
- [ ] Used optimistic updates where appropriate
- [ ] Followed styling patterns from `STYLING_PRACTICES.md`
- [ ] Tested responsive design
