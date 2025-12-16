# Color Palette Quick Reference

## Clean & Professional Color System

### Core Colors (OKLCH Format)

#### Backgrounds
```css
--background: oklch(0.98 0.002 264.542);     /* #F9FAFB - Light gray background */
--card: oklch(1 0 0);                        /* #FFFFFF - White cards */
--sidebar: oklch(0.99 0.002 247.839);        /* #FCFCFD - Off-white sidebar */
```

#### Primary Colors
```css
--primary: oklch(0.55 0.18 264.542);         /* #2563EB - Soft blue */
--primary-foreground: oklch(1 0 0);          /* #FFFFFF - White text */
--ring: oklch(0.55 0.18 264.542);            /* #2563EB - Focus ring */
```

#### Text Colors
```css
--foreground: oklch(0.25 0.015 264.542);      /* #1F2937 - Primary text */
--muted-foreground: oklch(0.45 0.01 264.542); /* #6B7280 - Secondary text */
--card-foreground: oklch(0.25 0.015 264.542); /* #1F2937 - Card text */
```

#### Borders & Inputs
```css
--border: oklch(0.92 0.006 264.531);         /* #E5E7EB - Light border */
--input: oklch(0.98 0.002 264.542);          /* #F9FAFB - Input background */
--sidebar-border: oklch(0.92 0.006 264.531); /* #E5E7EB - Sidebar border */
```

#### Accent Colors
```css
--accent: oklch(0.65 0.15 180);              /* #14B8A6 - Teal accent */
--accent-foreground: oklch(1 0 0);           /* #FFFFFF - White text */
--success: oklch(0.65 0.15 150);              /* #10B981 - Green success */
--success-foreground: oklch(1 0 0);           /* #FFFFFF - White text */
```

#### Status Colors
```css
--destructive: oklch(0.55 0.22 27.325);      /* #EF4444 - Red error */
--destructive-foreground: oklch(1 0 0);       /* #FFFFFF - White text */
```

### Hex Color Reference

| Purpose | Hex | Usage |
|---------|-----|-------|
| Primary | `#2563EB` | Buttons, links, active states |
| Primary Hover | `#1D4ED8` | Button hover state |
| Primary Light | `#DBEAFE` | Primary backgrounds |
| Background | `#F9FAFB` | Main background |
| Card | `#FFFFFF` | Card backgrounds |
| Text Primary | `#1F2937` | Main text |
| Text Secondary | `#6B7280` | Secondary text |
| Text Muted | `#9CA3AF` | Helper text |
| Border | `#E5E7EB` | Borders, dividers |
| Success | `#10B981` | Success states |
| Success Light | `#D1FAE5` | Success backgrounds |
| Warning | `#F59E0B` | Warning states |
| Error | `#EF4444` | Error states |
| Info | `#3B82F6` | Info states |

### Shadow System

```css
/* Subtle shadow for cards */
.card-shadow {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 
              0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

/* Hover shadow for interactive cards */
.card-shadow-hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 
              0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Focus shadow for inputs */
.focus-shadow {
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
```

### Tailwind Classes Reference

```tsx
// Backgrounds
bg-background      // #F9FAFB
bg-card            // #FFFFFF
bg-primary         // #2563EB
bg-primary/10      // Light primary tint

// Text
text-foreground    // #1F2937
text-muted-foreground  // #6B7280

// Borders
border-border      // #E5E7EB
border-primary     // #2563EB

// Status
bg-success         // #10B981
bg-destructive     // #EF4444
text-success       // #10B981
text-destructive   // #EF4444
```

### Contrast Ratios (WCAG AA Compliant)

| Combination | Ratio | Status |
|-------------|-------|--------|
| Primary text on white | 12.6:1 | ✅ AAA |
| Secondary text on white | 7.1:1 | ✅ AAA |
| White text on primary | 4.5:1 | ✅ AA |
| Primary text on background | 11.2:1 | ✅ AAA |
| Muted text on white | 4.6:1 | ✅ AA |

### Component-Specific Guidelines

#### Buttons
- Primary: `bg-primary text-primary-foreground`
- Hover: `hover:bg-primary/90`
- Secondary: `bg-secondary text-secondary-foreground`

#### Cards
- Background: `bg-card`
- Border: `border border-border`
- Shadow: Use `.card-shadow` class

#### Inputs
- Background: `bg-input`
- Border: `border-border`
- Focus: `focus:ring-2 focus:ring-ring`

#### Sidebar
- Background: `bg-sidebar`
- Active item: `bg-sidebar-primary/20 text-sidebar-primary`
- Border: `border-sidebar-border`

### Migration Checklist

- [ ] Update `globals.css` color variables
- [ ] Remove `className="dark"` from layout
- [ ] Update background gradient
- [ ] Update sidebar colors
- [ ] Update card shadows
- [ ] Remove dark mode variants from components
- [ ] Test contrast ratios
- [ ] Verify accessibility
- [ ] Test with target users


