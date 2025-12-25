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

## Switch Components

### Standard Styling

All Switch components throughout the application should use consistent styling to match the location settings switch pattern:

- **Checked State**: Primary color background
- **Unchecked State**: Muted foreground with border for better visibility
- **Border**: 2px border when unchecked for clear visual distinction

### Implementation

```tsx
<Switch
  id="example-switch"
  checked={isEnabled}
  onCheckedChange={setIsEnabled}
  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
/>
```

### Styling Breakdown

- `data-[state=checked]:bg-primary` - Primary color when switch is ON
- `data-[state=unchecked]:bg-muted-foreground/50` - Semi-transparent muted background when OFF
- `data-[state=unchecked]:border-2` - 2px border when OFF
- `data-[state=unchecked]:border-muted-foreground/30` - Muted border color when OFF

### Usage Guidelines

- Always apply this className to all Switch components for consistency
- The styling provides clear visual feedback for both checked and unchecked states
- The border in the unchecked state improves visibility and accessibility
- Reference: Location settings switch (`dashboard/app/dashboard/locations/page.tsx`)

### Component Location

Switch components are located in: `dashboard/components/ui/switch.tsx`

---

## Buttons and Links

### Cursor Pointer

All clickable elements (buttons, links, and interactive components) should use `cursor-pointer` to provide clear visual feedback that the element is clickable.

### Implementation

```tsx
// Button component (already has cursor-pointer by default)
<Button onClick={handleClick}>Click Me</Button>

// Link component
<Link href="/path" className="cursor-pointer">
  Navigate
</Link>

// Custom clickable elements
<div
  onClick={handleClick}
  className="cursor-pointer hover:bg-muted/50"
>
  Clickable Card
</div>

// Collapsible triggers
<CollapsibleTrigger asChild>
  <CardHeader className="cursor-pointer hover:bg-muted/50">
    {/* Content */}
  </CardHeader>
</CollapsibleTrigger>
```

### Usage Guidelines

- Always add `cursor-pointer` to custom clickable elements (divs, cards, etc.)
- Use `cursor-pointer` on interactive elements that aren't standard buttons or links
- Combine with hover states for better UX (e.g., `hover:bg-muted/50`)
- Button and Link components from shadcn/ui already include cursor-pointer by default
- For drag-and-drop elements, use `cursor-move` instead

### Examples

- **Clickable Cards**: Add `cursor-pointer` to card headers that trigger actions
- **Collapsible Sections**: Use `cursor-pointer` on collapsible triggers
- **Interactive Lists**: Add `cursor-pointer` to list items that are clickable
- **Icon Buttons**: Ensure icon buttons have `cursor-pointer` if not using Button component

---

## Error Messages and Alerts

### AlertDialog for User-Facing Errors

When displaying error messages to users (especially for file uploads, form submissions, or critical operations), use `AlertDialog` instead of browser `alert()` or `confirm()` dialogs. This provides a consistent, accessible UI that matches the application design.

### Implementation

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// State for dialog
const [errorDialog, setErrorDialog] = useState<{
  open: boolean;
  title: string;
  message: string;
}>({ open: false, title: "", message: "" });

// Show error
setErrorDialog({
  open: true,
  title: "Upload Failed",
  message: "Failed to upload file. Please try again.",
});

// In JSX
<AlertDialog
  open={errorDialog.open}
  onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{errorDialog.title}</AlertDialogTitle>
      <AlertDialogDescription>{errorDialog.message}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogAction
        onClick={() => setErrorDialog({ open: false, title: "", message: "" })}
      >
        OK
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>;
```

### Usage Guidelines

- **Use AlertDialog for**: File upload errors, form validation errors, critical operation failures
- **Don't use browser alerts**: Avoid `alert()`, `confirm()`, or `prompt()` - they break the user experience
- **Keep messages clear**: Use descriptive titles and actionable error messages
- **Provide context**: Explain what went wrong and what the user can do next
- **Single action**: Typically just an "OK" button to dismiss, unless user action is required

### When to Use Other Patterns

- **Toast notifications** (`sonner`): For non-critical success/info messages
- **Inline error messages**: For form field validation (use `Alert` component)
- **Error boundaries**: For unexpected application errors

### Component Location

AlertDialog components are located in: `dashboard/components/ui/alert-dialog.tsx`

---

## Page Tours

### Tour Target Elements

When implementing page tours, use `data-tour` attributes to mark elements that should be highlighted during the tour. The tour system will automatically find and highlight these elements.

### Implementation

```tsx
// Mark a container element (preferred for cards/sections)
<div className="space-y-3" data-tour="sections">
  <Label>Form Sections</Label>
  {/* Content */}
</div>

// Mark interactive elements (buttons, inputs, etc.)
<Button data-tour="add-field-button">
  Add Field
</Button>

// Mark preview/display areas
<Card data-tour="mobile-preview">
  {/* Preview content */}
</Card>
```

### Best Practices

- **Target containers, not labels**: For cards or sections, put `data-tour` on the container div, not just the label
- **Use descriptive names**: Use clear, descriptive names for `data-tour` attributes (e.g., `sections`, `add-field-button`, `mobile-preview`)
- **Handle dynamic content**: For popovers or modals, the tour system can automatically open them by clicking their triggers
- **Scroll behavior**: The tour system automatically scrolls elements into view, but for elements near the top of the page, use `block: "start"` to ensure they're fully visible

### Tour Step Configuration

```tsx
export const mobileConfigTourSteps: TourStep[] = [
  {
    target: "[data-tour='sections']",
    title: "Form Sections",
    content: "Description of what this section does...",
    position: "right", // or "left", "top", "bottom"
  },
];
```

### Popover Handling

When targeting popover content, the tour system will:

1. Find the trigger button
2. Click it to open the popover
3. Wait for the popover content to appear
4. Highlight the popover content

Ensure the `data-tour` attribute is on the `PopoverContent` element:

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button>Add Field</Button>
  </PopoverTrigger>
  <PopoverContent data-tour="add-field-button">
    {/* Popover content */}
  </PopoverContent>
</Popover>
```

### Component Location

Tour components are located in: `dashboard/components/tours/`

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
