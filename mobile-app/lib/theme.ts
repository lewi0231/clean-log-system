import { vars } from "nativewind";

export const themes = {
  light: vars({
    // Modern SaaS Light Theme
    // Primary colors - Vibrant blue for actions
    "--color-primary": "37 99 235", // #2563eb - Vibrant blue
    "--color-primary-foreground": "255 255 255", // White text on primary
    "--color-foreground": "30 41 59", // #1e293b - Dark slate text

    // General context (background) and cards / popovers
    "--color-background": "248 249 250", // #f8f9fa - Light grey background
    "--color-background-foreground": "30 41 59", // Dark slate text
    "--color-card": "255 255 255", // #ffffff - White cards/surface
    "--color-card-foreground": "30 41 59", // Dark slate text
    "--color-popover": "255 255 255", // White popovers
    "--color-popover-foreground": "30 41 59", // Dark slate text

    // Secondary colors
    "--color-secondary": "226 232 240", // #e2e8f0 - Subtle borders/backgrounds
    "--color-secondary-foreground": "30 41 59", // Dark slate text
    "--color-foreground-muted": "100 116 139", // #64748b - Grey text (secondary)
    "--color-muted-foreground": "100 116 139", // #64748b - Grey text
    "--color-muted": "241 245 249", // Slightly lighter grey for muted backgrounds

    // Accent colors
    "--color-accent": "226 232 240", // Subtle accent
    "--color-accent-foreground": "30 41 59", // Dark slate text

    // Status colors
    "--color-destructive": "220 38 38", // #dc2626 - Red for errors
    "--color-destructive-foreground": "255 255 255", // White text

    "--color-success": "22 163 74", // Green for success
    "--color-success-foreground": "255 255 255", // White text

    "--color-warning": "234 179 8", // Yellow/amber for warnings
    "--color-warning-foreground": "30 41 59", // Dark text

    "--color-info": "37 99 235", // Blue for info (same as primary)
    "--color-info-foreground": "255 255 255", // White text

    // Borders, inputs and "rings"
    "--border": "229 231 235", // #e5e7eb - Very subtle borders (lighter grey for less visibility)
    "--border-foreground": "30 41 59", // Dark slate
    "--input": "255 255 255", // White input backgrounds
    "--input-foreground": "30 41 59", // Dark slate text
    "--ring": "37 99 235", // Blue ring for focus

    // Toggle specific colors
    "--toggle-active": "37 99 235", // Blue when active
    "--toggle-active-foreground": "255 255 255", // White text
    "--toggle-border": "226 232 240", // Subtle border
  }),

  dark: vars({
    // Primary colors - matching dashboard dark theme
    "--color-primary": "237 237 237", // oklch(0.928 0.006 264.531) converted to RGB
    "--color-primary-foreground": "54 54 54", // oklch(0.21 0.034 264.665) converted to RGB
    "--color-foreground": "255 255 255", // oklch(1 0 0) - pure white for better readability

    // General context (background) and cards / popovers - matching dashboard
    "--color-background": "33 33 40", // oklch(0.13 0.028 261.692) converted to RGB
    "--color-background-foreground": "255 255 255",
    "--color-card": "54 54 54", // oklch(0.21 0.034 264.665) converted to RGB
    "--color-card-foreground": "255 255 255",
    "--color-popover": "54 54 54",
    "--color-popover-foreground": "255 255 255",

    // Secondary colors - matching dashboard
    "--color-secondary": "71 71 71", // oklch(0.278 0.033 256.848) converted to RGB
    "--color-secondary-foreground": "255 255 255",
    "--color-muted": "71 71 71",
    "--color-foreground-muted": "199 199 199", // oklch(0.78 0 0) converted to RGB
    "--color-muted-foreground": "199 199 199",

    // Accent colors - matching dashboard
    "--color-accent": "71 71 71",
    "--color-accent-foreground": "255 255 255",

    // Status colors
    "--color-destructive": "180 83 9", // oklch(0.704 0.191 22.216) converted to RGB
    "--color-destructive-foreground": "255 255 255",

    "--color-success": "22 163  74",
    "--color-success-foreground": "250 250 250",

    "--color-warning": "161  98   7",
    "--color-warning-foreground": "250 250 250",

    "--color-info": " 37  99 235",
    "--color-info-foreground": "250 250 250",

    // Borders, inputs and "rings" - matching dashboard
    "--border": "26 26 26", // oklch(1 0 0 / 10%) converted to RGB
    "--input": "38 38 38", // oklch(1 0 0 / 15%) converted to RGB
    "--ring": "140 140 140", // oklch(0.551 0.027 264.364) converted to RGB

    // Toggle specific colors
    "--toggle-active": "120 120 120",
    "--toggle-active-foreground": "250 250 250",
    "--toggle-border": "100 100 100",
  }),
} as const;
