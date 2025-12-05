import { vars } from "nativewind";

export const themes = {
  light: vars({
    // Primary colors
    "--color-primary": "0 0 0",
    "--color-primary-foreground": "255 255 255",
    "--color-foreground": "13 13 13",

    // General context (background) and cards / popovers
    "--color-background": "255 255 255",
    "--color-background-foreground": "13 13 13",
    "--color-card": "255 255 255",
    "--color-card-foreground": "13 13 13",
    "--color-popover": "255 255 255",
    "--color-popover-foreground": "13 13 13",

    // Secondary colors
    "--color-secondary": "45 45 45",
    "--color-secondary-foreground": "255 255 255",
    "--color-foreground-muted": "115 115 115",
    "--color-muted-foreground": "115 115 115",
    "--color-muted": "240 240 240",

    // Accent colors
    "--color-accent": "145 145 145",
    "--color-accent-foreground": "255 255 255",

    // Status colors
    "--color-destructive": "239 68 68",
    "--color-destructive-foreground": "250 250 250",

    "--color-success": "34 197 94",
    "--color-success-foreground": "250 250 250",

    "--color-warning": "234 179  8",
    "--color-warning-foreground": "13 13 13",

    "--color-info": "59 130 246",
    "--color-info-foreground": "250 250 250",

    // Borders, inputs and "rings"
    "--border": "229 231 235",
    "--border-foreground": "13 13 13",
    "--input": "229 231 235",
    "--input-foreground": "13 13 13",
    "--ring": "13 13 13",

    // Toggle specific colors
    "--toggle-active": "45 45 45",
    "--toggle-active-foreground": "255 255 255",
    "--toggle-border": "229 231 235",
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
