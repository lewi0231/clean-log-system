import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";
import { getThemeColors } from "@/lib/theme-colors";
import type { ThemeType } from "@/lib/theme-types";

export function createNavigationTheme(theme: ThemeType): Theme {
  const colors = getThemeColors(theme);
  const baseTheme = theme === "dark" ? DarkTheme : DefaultTheme;

  return {
    ...baseTheme,
    dark: theme === "dark",
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.foreground,
      border: colors.border,
      notification: colors.primary,
    },
  };
}

export function getTabBarColors(theme: ThemeType) {
  const colors = getThemeColors(theme);

  if (theme === "light") {
    return {
      background: colors.card,
      border: colors.border,
      active: colors.primary,
      inactive: "rgb(51, 65, 85)",
      label: "rgb(30, 41, 59)",
    };
  }

  return {
    background: colors.card,
    border: colors.border,
    active: colors.tabActive,
    inactive: colors.tabInactive,
    label: colors.foreground,
  };
}
