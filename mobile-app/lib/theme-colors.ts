import type { ThemeType } from "@/lib/theme-types";

/** Resolved RGB values for props that cannot use NativeWind CSS variables. */
export const themeColors = {
  light: {
    foreground: "rgb(30, 41, 59)",
    mutedForeground: "rgb(100, 116, 139)",
    primary: "rgb(37, 99, 235)",
    primaryForeground: "rgb(255, 255, 255)",
    background: "rgb(248, 249, 250)",
    card: "rgb(255, 255, 255)",
    border: "rgb(229, 231, 235)",
    tabActive: "rgb(37, 99, 235)",
    tabInactive: "rgb(51, 65, 85)",
    destructive: "rgb(220, 38, 38)",
  },
  dark: {
    foreground: "rgb(255, 255, 255)",
    mutedForeground: "rgb(199, 199, 199)",
    primary: "rgb(237, 237, 237)",
    primaryForeground: "rgb(54, 54, 54)",
    background: "rgb(33, 33, 40)",
    card: "rgb(54, 54, 54)",
    border: "rgb(26, 26, 26)",
    tabActive: "rgb(237, 237, 237)",
    tabInactive: "rgb(199, 199, 199)",
    destructive: "rgb(180, 83, 9)",
  },
} as const satisfies Record<ThemeType, Record<string, string>>;

export function getThemeColors(theme: ThemeType) {
  return themeColors[theme];
}
