import React, { createContext, useContext, useEffect, useState } from "react";
import { View } from "react-native";
import { useColorScheme as useNativeColorScheme } from "react-native";
import { useColorScheme } from "nativewind";
import { themes } from "./theme";
import { getThemeColors, themeColors } from "./theme-colors";
import type { ThemeType } from "./theme-types";
import { useAndroidSystemBars } from "./use-android-system-bars";

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  activeTheme: (typeof themes)[ThemeType];
  colors: (typeof themeColors)[ThemeType];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode;
  defaultTheme?: "light" | "dark" | "system";
}) {
  const systemColorScheme = (useNativeColorScheme() as ThemeType) || "light";
  const { setColorScheme } = useColorScheme();
  const [theme, setTheme] = useState<ThemeType>(
    defaultTheme === "system" ? systemColorScheme : (defaultTheme as ThemeType)
  );

  const activeTheme = themes[theme];
  const colors = getThemeColors(theme);

  useAndroidSystemBars(theme);

  useEffect(() => {
    setColorScheme(theme);
  }, [setColorScheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, activeTheme, colors }}>
      <View
        style={activeTheme}
        className={`flex-1 bg-background ${theme === "dark" ? "dark" : ""}`}
      >
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
