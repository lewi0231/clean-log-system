import * as NavigationBar from "expo-navigation-bar";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import type { ThemeType } from "@/lib/theme-types";

function applyAndroidSystemNavigationBar(theme: ThemeType) {
  if (Platform.OS !== "android") return;

  // "light" style = light bar background with DARK buttons (for light app themes)
  // "dark" style = dark bar background with LIGHT buttons (for dark app themes)
  NavigationBar.setStyle(theme === "light" ? "light" : "dark");
}

/**
 * Keeps Android's system navigation buttons (back/home/recents) readable over app content.
 */
export function useAndroidSystemBars(theme: ThemeType) {
  useEffect(() => {
    applyAndroidSystemNavigationBar(theme);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        applyAndroidSystemNavigationBar(theme);
      }
    });

    return () => subscription.remove();
  }, [theme]);
}
