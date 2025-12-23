# Styling Practices

This document outlines the styling conventions and practices used throughout the dashboard application. Refer to this document when implementing new features or updating existing components to maintain consistency.

## Tooltips

### Background and Colors

Tooltips use a dark background with high contrast text for optimal readability:

- **Background**: `bg-slate-900` (dark slate background)
- **Text Colors**:
  - Headings/Titles: `text-slate-50` (bright white)
  - Body Text: `text-slate-200` (light gray)
  - Examples/Secondary Text: `text-slate-300` (medium gray)
- **Shadow**: `shadow-lg` for better visibility and depth

### Implementation Example

```tsx
<TooltipContent side="bottom" className="max-w-xs">
  <div className="space-y-1">
    <p className="font-medium text-xs text-slate-50">Title</p>
    <p className="text-xs text-slate-200">Description text</p>
    <p className="text-xs text-slate-300 italic">Example text</p>
  </div>
</TooltipContent>
```

### Usage Guidelines

- Use tooltips for contextual help and explanations
- Keep tooltip content concise and scannable
- Use `text-slate-50` for primary information
- Use `text-slate-200` for secondary information
- Use `text-slate-300` for examples or less important details
- Always include proper contrast ratios for accessibility

### Component Location

Tooltip components are located in: `dashboard/components/ui/tooltip.tsx`

---

## Advanced Settings Sections

### Visual Indication

When advanced settings are expanded, use visual hierarchy to indicate nested content:

- **Left Border**: `border-l-2 border-muted` (2px left border)
- **Background Shading**: `bg-muted/20` (subtle background tint)
- **Indentation**: `pl-4` (padding-left for indentation)
- **Rounded Corners**: `rounded-r-md` (rounded right corners only)

### Implementation Example

```tsx
<CollapsibleContent className="space-y-4 pt-2 pl-4 border-l-2 border-muted bg-muted/20 rounded-r-md">
  {/* Advanced settings content */}
</CollapsibleContent>
```

### Icon Usage

- Use caret icons (`ChevronDown`/`ChevronRight`) for expand/collapse indicators
- Chevron points right when closed, down when open
- Avoid using other icons (like `Layers`) for expand/collapse

---

## Drag and Drop

### Visual Feedback

When implementing drag and drop functionality:

- **Drop Zone Highlight**:
  - Border: `border-2 border-primary/50`
  - Background: `bg-primary/5`
  - Rounded: `rounded-lg`
- **Dragging State**:
  - Opacity: `opacity-50`
  - Scale: `scale-[0.98]` (slight shrink effect)

### Implementation Example

```tsx
<CardContent
  className="pt-0 transition-colors"
  onDragOver={(e) => {
    if (draggedItem) {
      e.preventDefault();
      e.currentTarget.classList.add(
        "border-2",
        "border-primary/50",
        "bg-primary/5",
        "rounded-lg"
      );
    }
  }}
  onDragLeave={(e) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      e.currentTarget.classList.remove(
        "border-2",
        "border-primary/50",
        "bg-primary/5",
        "rounded-lg"
      );
    }
  }}
  onDrop={async (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove(
      "border-2",
      "border-primary/50",
      "bg-primary/5",
      "rounded-lg"
    );
    // Handle drop logic
  }}
>
```

---

## General Principles

1. **Consistency**: Follow established patterns for similar UI elements
2. **Accessibility**: Maintain proper contrast ratios and semantic HTML
3. **Progressive Disclosure**: Show essential information first, details on demand
4. **Visual Hierarchy**: Use indentation, borders, and backgrounds to show relationships
5. **User Feedback**: Provide clear visual feedback for all interactive elements

---

## Future Additions

This document will be expanded as new styling patterns are established. When adding new patterns:

1. Document the pattern with examples
2. Explain the rationale behind the design choice
3. Include implementation code snippets
4. Note any accessibility considerations
