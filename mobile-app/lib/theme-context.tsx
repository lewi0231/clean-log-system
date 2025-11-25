import React, { createContext, useContext, useState } from "react";
import { useColorScheme as useNativeColorScheme } from "react-native";
import { themes } from "./theme";

type ThemeType = "light" | "dark";

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  activeTheme: any;
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
  const [theme, setTheme] = useState<ThemeType>(
    defaultTheme === "system" ? systemColorScheme : (defaultTheme as ThemeType)
  );

  const activeTheme = themes[theme];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, activeTheme }}>
      {children}
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
