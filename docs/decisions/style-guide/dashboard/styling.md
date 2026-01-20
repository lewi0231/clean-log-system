# Dashboard Styling

> Tailwind CSS v4 and shadcn/ui patterns for the dashboard.

---

## Tech Stack

- **Tailwind CSS v4** - CSS-first configuration (no `tailwind.config.ts`)
- **shadcn/ui** - Accessible component primitives
- **CSS Variables** - Design tokens in oklch color space
- **`cn()` utility** - Class merging with clsx + tailwind-merge

---

## Color System

### Semantic Color Tokens

Always use semantic tokens, not direct colors:

```typescript
// ✅ Good: Semantic tokens
<div className="bg-primary text-primary-foreground">
<div className="bg-secondary text-secondary-foreground">
<div className="bg-muted text-muted-foreground">
<div className="bg-destructive text-destructive-foreground">
<div className="bg-accent text-accent-foreground">
<div className="border-border">
<div className="text-foreground bg-background">

// ❌ Bad: Direct colors
<div className="bg-blue-500 text-white">
<div className="bg-gray-100 text-gray-900">
<div className="bg-[#2563EB]">
```

### Available Tokens

| Token | Purpose |
|-------|---------|
| `background` / `foreground` | Page background and text |
| `primary` / `primary-foreground` | Primary actions (buttons, links) |
| `secondary` / `secondary-foreground` | Secondary actions |
| `muted` / `muted-foreground` | Subdued backgrounds, helper text |
| `accent` / `accent-foreground` | Highlights, hover states |
| `destructive` / `destructive-foreground` | Delete, error actions |
| `border` | Border color |
| `input` | Input borders |
| `ring` | Focus rings |

---

## The `cn()` Utility

Use `cn()` for all conditional class merging:

```typescript
import { cn } from "@/lib/utils";

// Basic conditional
<div className={cn("p-4", isActive && "bg-primary/10")}>

// Multiple conditions
<div className={cn(
  "rounded-lg border p-4",
  isSelected && "border-primary bg-primary/5",
  isDisabled && "opacity-50 cursor-not-allowed"
)}>

// With prop forwarding
export function Card({ className, ...props }: CardProps) {
  return (
    <div 
      className={cn("rounded-lg border p-4", className)} 
      {...props} 
    />
  );
}
```

---

## Spacing

### Use the Spacing Scale

```typescript
// ✅ Good: Tailwind spacing scale
<div className="p-4 mt-6 space-y-4 gap-2">

// ❌ Bad: Arbitrary values
<div className="p-[17px] mt-[23px] gap-[7px]">
```

### Common Patterns

```typescript
// Card padding
<Card className="p-4 md:p-6">

// Section spacing
<section className="space-y-6">

// List gaps
<div className="grid gap-4">

// Form field spacing
<div className="space-y-4">
  <FormField />
  <FormField />
</div>
```

---

## Responsive Design

### Mobile-First Approach

```typescript
// ✅ Good: Base styles for mobile, breakpoints for larger
<div className="p-4 md:p-6 lg:p-8">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
<div className="flex flex-col md:flex-row">

// ❌ Bad: Desktop-first
<div className="p-8 sm:p-4">  // Confusing direction
```

### Breakpoints

| Breakpoint | Min Width | Use Case |
|------------|-----------|----------|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

---

## Component Patterns

### Settings Sections

Use primary-tinted styling for settings/configuration areas:

```typescript
// Settings card pattern
<Card className="border-primary/20 bg-primary/5">
  <CardHeader>
    <CardTitle>Email Settings</CardTitle>
    <CardDescription>Configure email notifications</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Form fields */}
  </CardContent>
</Card>
```

### Interactive Elements

Always include cursor and hover states:

```typescript
// ✅ Good: Clear interactive feedback
<div 
  onClick={handleClick}
  className="cursor-pointer hover:bg-muted/50 transition-colors"
>

// ❌ Bad: No visual feedback
<div onClick={handleClick}>
```

### Focus States

Use consistent focus rings:

```typescript
// shadcn components handle this automatically
<Button>Click me</Button>

// For custom interactive elements
<div 
  tabIndex={0}
  className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
>
```

---

## Layout Patterns

### Page Layout

```typescript
export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button>Add New</Button>
      </div>
      
      <div className="grid gap-6">
        {/* Content */}
      </div>
    </div>
  );
}
```

### Card Grid

```typescript
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {items.map(item => (
    <Card key={item.id}>
      <CardContent className="p-4">
        {/* Card content */}
      </CardContent>
    </Card>
  ))}
</div>
```

### Two-Column Layout

```typescript
<div className="grid gap-6 lg:grid-cols-[300px_1fr]">
  <aside className="space-y-4">
    {/* Sidebar */}
  </aside>
  <main className="space-y-6">
    {/* Main content */}
  </main>
</div>
```

---

## Typography

### Headings

```typescript
<h1 className="text-2xl font-bold tracking-tight">Page Title</h1>
<h2 className="text-xl font-semibold">Section Title</h2>
<h3 className="text-lg font-medium">Subsection Title</h3>
```

### Body Text

```typescript
<p className="text-muted-foreground">Helper text</p>
<p className="text-sm text-muted-foreground">Small helper text</p>
<span className="font-medium">Emphasized text</span>
```

---

## shadcn/ui Components

### Import Pattern

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

### Common Components

| Component | Use Case |
|-----------|----------|
| `Button` | Actions, form submission |
| `Card` | Content containers |
| `Dialog` | Modals, confirmations |
| `Input` | Text input |
| `Select` | Dropdown selection |
| `Table` | Data display |
| `Tabs` | Content organization |
| `Toast` | Notifications |

### Customizing shadcn Components

```typescript
// Add variants via className
<Button className="w-full" variant="outline" size="lg">
  Full Width Button
</Button>

// Extend with cn()
<Card className={cn(
  "transition-shadow hover:shadow-lg",
  isSelected && "ring-2 ring-primary"
)}>
```

---

## State Components

### Loading State

```typescript
import { LoadingState } from "@/components/ui/loading-state";

<LoadingState message="Loading workers..." />
```

### Error State

```typescript
import { ErrorState } from "@/components/ui/error-state";

<ErrorState 
  message="Failed to load workers" 
  onRetry={refetch}
/>
```

### Empty State

```typescript
import { EmptyState } from "@/components/ui/empty-state";

<EmptyState
  title="No workers yet"
  description="Add your first worker to get started."
  action={<Button>Add Worker</Button>}
/>
```

---

## Dark Mode

Tailwind v4 handles dark mode via CSS variables. The design tokens automatically adapt:

```css
/* app.css - simplified example */
:root {
  --background: oklch(100% 0 0);
  --foreground: oklch(10% 0 0);
}

.dark {
  --background: oklch(10% 0 0);
  --foreground: oklch(90% 0 0);
}
```

Components using semantic tokens work in both modes automatically.

---

## Animations

### Transitions

```typescript
// ✅ Good: Smooth transitions
<div className="transition-colors hover:bg-muted">
<div className="transition-all duration-200">
<div className="transition-opacity opacity-0 group-hover:opacity-100">
```

### Tailwind Animate

```typescript
// Available animations (from tw-animate-css)
<div className="animate-fade-in">
<div className="animate-slide-in-bottom">
<div className="animate-pulse">
```

---

## Rules Summary

| Rule | Description |
|------|-------------|
| Semantic tokens | Use `bg-primary`, not `bg-blue-500` |
| `cn()` utility | Always use for conditional classes |
| Spacing scale | Use `p-4`, not `p-[17px]` |
| Mobile-first | Base styles for mobile, breakpoints for larger |
| Interactive feedback | Always add hover/cursor states |
| Settings pattern | `border-primary/20 bg-primary/5` |
| shadcn components | Import from `@/components/ui` |
| State components | Use LoadingState, ErrorState, EmptyState |
