/** @type {import('tailwindcss').Config} */

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          foreground: "rgb(var(--color-primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--color-secondary) / <alpha-value>)",
          foreground: "rgb(var(--color-secondary-foreground) / <alpha-value>)",
        },
        background: {
          DEFAULT: "rgb(var(--color-background) / <alpha-value>)",
          foreground: "rgb(var(--color-background-foreground) / <alpha-value>)",
        },
        foreground: {
          DEFAULT: "rgb(var(--color-foreground) / <alpha-value>)",
          muted: "rgb(var(--color-foreground-muted) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--color-muted) / <alpha-value>)",
          foreground: "rgb(var(--color-muted-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--color-destructive) / <alpha-value>)",
          foreground:
            "rgb(var(--color-destructive-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--color-success) / <alpha-value>)",
          foreground: "rgb(var(--color-success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--color-warning) / <alpha-value>)",
          foreground: "rgb(var(--color-warning-foreground) / <alpha-value>)",
        },
        info: {
          DEFAULT: "rgb(var(--color-info) / <alpha-value>)",
          foreground: "rgb(var(--color-info-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--color-card) / <alpha-value>)",
          foreground: "rgb(var(--color-card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--color-popover) / <alpha-value>)",
          foreground: "rgb(var(--color-popover-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          foreground: "rgb(var(--color-accent-foreground) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          foreground: "rgb(var(--border-foreground) / <alpha-value>)",
        },
        input: {
          DEFAULT: "rgb(var(--input) / <alpha-value>)",
          foreground: "rgb(var(--input-foreground) / <alpha-value>)",
        },

        toggle: {
          active: "rgb(var(--toggle-active) / <alpha-value>)",
          "active-foreground":
            "rgb(var(--toggle-active-foreground) / <alpha-value>)",
          border: "rgb(var(--toggle-border) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [
    ({ addBase }) => {
      addBase({
        ":root": {
          "--color-primary": "37 99 235",
          "--color-primary-foreground": "255 255 255",
          "--color-secondary": "226 232 240",
          "--color-secondary-foreground": "30 41 59",
          "--color-background": "248 249 250",
          "--color-background-foreground": "30 41 59",
          "--color-foreground": "30 41 59",
          "--color-foreground-muted": "100 116 139",
          "--color-muted": "241 245 249",
          "--color-muted-foreground": "100 116 139",
          "--color-card": "255 255 255",
          "--color-card-foreground": "30 41 59",
          "--color-destructive": "220 38 38",
          "--color-destructive-foreground": "255 255 255",
          "--color-success": "22 163 74",
          "--color-warning": "234 179 8",
          "--color-info": "37 99 235",
          "--border": "229 231 235",
          "--border-foreground": "30 41 59",
          "--input": "255 255 255",
          "--input-foreground": "30 41 59",
          "--toggle-active": "37 99 235",
          "--toggle-border": "226 232 240",
        },
      });
    },
  ],
};
