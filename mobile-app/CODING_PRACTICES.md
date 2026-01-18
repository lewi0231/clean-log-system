# Mobile App Coding Practices

This document outlines coding practices and standards for the mobile app (React Native/Expo).

## React Native / Expo Best Practices

### File Structure

- Use Expo Router for navigation (`app/` directory)
- Components should be in `components/` directory
- Hooks should be in `hooks/` directory
- Types should be in `types/` directory or use shared types from `@clean-log/shared`

### Component Patterns

- Use TypeScript for all components
- Use functional components with hooks
- Use NativeWind (Tailwind for React Native) for styling

### State Management

- Use React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`)
- Use custom hooks for reusable logic
- Handle loading and error states properly

### Styling

- Use NativeWind classes (Tailwind CSS syntax)
- Use `className` prop for styling
- Follow consistent spacing and color patterns
- Use SafeAreaView for proper screen boundaries

### Field Rendering

- Use `FieldRendererNativeBase` component for standard field types (this is the main field renderer)
- Note: Despite the "NativeBase" name, this component does NOT use NativeBase library - it's a legacy name
- The separate `field-renderer.tsx` exists only for test compatibility
- Check `fieldConfig.validation_rules.allow_multiple` for select fields
- For multi-select fields, display badges similar to colleagues selection
- Handle both single and multiple value types correctly
- Address fields use `AddressAutocomplete` component with Geoapify API integration

### Navigation

- Use `expo-router` for navigation
- Use `router.replace()` for login/logout flows
- Use `router.push()` for navigation within app
- Default to home screen (`/(tabs)`) after login, not directly to entry form

## Common Patterns

### Multi-Select Fields

When `fieldConfig.validation_rules?.allow_multiple === true`:

- Store value as `string[]` (array of selected option values)
- Display selected options as badges with remove buttons
- Update placeholder text: "Add another option" after first selection
- Use similar pattern to colleagues selection

### Field Value Handling

```typescript
// Single select: string
value: string | undefined

// Multi-select: string[]
value: string[] | undefined

// Check allow_multiple
const isMultiSelect = config.validation_rules?.allow_multiple === true;
```

### Error Handling

- Show validation errors inline
- Use Alert dialogs for critical errors
- Provide clear, actionable error messages

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

## Address Field Handling

### Best Practices

- **Use separate fields** for address components (Street, City, State, Postcode) for better mobile UX
- **Concatenate on submission**: Store as single string in `submission_data` for backend compatibility
- **One field per line**: Mobile forms should use single-column layout
- **Field order**: Street Address → City → State → Postcode (Australia-specific)

### Implementation Pattern

```typescript
// Display: Separate fields for better UX
<TextInput placeholder="Street Address" />
<TextInput placeholder="City" />
<TextInput placeholder="State" />
<TextInput placeholder="Postcode" />

// Submission: Concatenate into single string
const fullAddress = `${street}, ${city} ${state} ${postcode}`.trim();
submissionData[config.name] = fullAddress;
```

## Keyboard Scroll Behavior for Dynamic Fields

Field configs are dynamic (set by admin in dashboard). When implementing fields with sub-inputs (e.g., address with Street/City/State/Postcode), ensure keyboard scrolling works correctly:

### Pattern for Compound Fields

```typescript
// 1. FieldRendererNativeBase accepts onFocus with optional subFieldYOffset
onFocus?: (opts?: { subFieldYOffset?: number }) => void;

// 2. For compound fields, use measureLayout to get accurate sub-field position
const measureSubFieldOffset = (
  inputRef: React.RefObject<TextInput | null>,
  callback: (offset: number) => void
) => {
  if (inputRef.current && containerRef.current) {
    inputRef.current.measureLayout(
      containerRef.current as any,
      (_x, y) => callback(y),
      () => callback(0)
    );
  } else {
    callback(0);
  }
};

// 3. On focus, measure and report the offset
onFocus={() => {
  measureSubFieldOffset(inputRef, (offset) => {
    onFocus?.({ subFieldYOffset: offset });
  });
}}

// 4. Parent scrolls to: fieldY + subFieldYOffset - offset
scrollViewRef.current.scrollTo({
  y: Math.max(0, fieldY + subFieldYOffset - 160),
  animated: true,
});
```

### Key Points

- **Don't use `onLayout` for nested fields** - it gives position relative to immediate parent, not the field container
- **Use `measureLayout`** - gives accurate position relative to a specified ancestor
- **Simple fields**: Just call `onFocus?.()` without offset
- **Compound fields**: Measure and pass `subFieldYOffset` so parent can scroll to exact input

## Checklist for New Features

- [ ] Used TypeScript with proper types
- [ ] Handled loading and error states
- [ ] Used SafeAreaView for proper boundaries
- [ ] Checked for multi-select fields and handled appropriately
- [ ] Tested on both iOS and Android
- [ ] Added proper accessibility labels
- [ ] Handled keyboard avoidance where needed
