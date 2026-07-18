import { ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { createNavigationTheme } from "@/lib/navigation-theme";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { ActivityIndicator, View } from "react-native";

export const unstable_settings = {
  anchor: "(tabs)",
};

function AppNavigation() {
  const { theme } = useTheme();
  const { user } = useAuth();

  return (
    <NavigationThemeProvider value={createNavigationTheme(theme)}>
      <Stack screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="job/[id]" />
            <Stack.Screen
              name="modal"
              options={{
                presentation: "modal",
                title: "Modal",
              }}
            />
          </>
        ) : (
          <Stack.Screen name="login" />
        )}
      </Stack>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
    </NavigationThemeProvider>
  );
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const { loading } = useAuth();
  const theme = colorScheme || "light";

  return (
    <ThemeProvider defaultTheme={theme}>
      {loading ? (
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator size="large" color={themeColorsForLoading(theme)} />
          <StatusBar style={theme === "dark" ? "light" : "dark"} />
        </View>
      ) : (
        <AppNavigation />
      )}
    </ThemeProvider>
  );
}

function themeColorsForLoading(theme: "light" | "dark") {
  return theme === "dark" ? "rgb(237, 237, 237)" : "rgb(37, 99, 235)";
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutContent />
    </AuthProvider>
  );
}
