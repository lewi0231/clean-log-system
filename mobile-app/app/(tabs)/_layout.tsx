import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View, Text } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { getTabBarColors } from "@/lib/navigation-theme";
import { useTheme } from "@/lib/theme-context";
import { usePendingConfirmationsCount } from "@/hooks/use-pending-confirmations-count";

export default function TabLayout() {
  const { theme } = useTheme();
  const tabBar = getTabBarColors(theme);
  const { count: pendingCount } = usePendingConfirmationsCount();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tabBar.active,
        tabBarInactiveTintColor: tabBar.inactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
        tabBarStyle: {
          backgroundColor: tabBar.background,
          borderTopColor: tabBar.border,
          borderTopWidth: 1,
        },
        tabBarBackground: () => <View style={{ flex: 1, backgroundColor: tabBar.background }} />,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
          href: null,
        }}
      />

      <Tabs.Screen
        name="jobs"
        options={{
          title: "Jobs",
          tabBarIcon: ({ color }) => <Ionicons name="document-text" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pending-confirmations"
        options={{
          title: "Confirm",
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="checkmark-circle-outline" size={24} color={color} />
              {pendingCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    right: -6,
                    top: -3,
                    backgroundColor: "rgb(239 68 68)",
                    borderRadius: 9,
                    minWidth: 18,
                    height: 18,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      fontSize: 10,
                      fontWeight: "bold",
                    }}
                  >
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="new-entry"
        options={{
          title: "Entry",
          tabBarIcon: ({ color }) => <Ionicons name="add-circle" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
