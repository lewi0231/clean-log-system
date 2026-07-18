import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCurrentWorker } from "@/hooks/use-current-worker";
import { useUserRole } from "@/hooks/use-user-role";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/lib/theme-context";
import { useState } from "react";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const { worker } = useCurrentWorker();
  const { isAdmin } = useUserRole();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await signOut();
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1">
        {/* Header */}
        <View className="bg-background px-4 pt-4 pb-3 border-b border-border/50">
          <Text className="text-2xl font-bold text-foreground">Settings</Text>
        </View>

        <View className="flex-1 px-4 pt-4">
          {/* User Section */}
          {user && (
            <View className="bg-card rounded-xl p-4 mb-4">
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
                  {worker?.name || (isAdmin && user?.email) ? (
                    <Text className="text-sm font-semibold text-primary">
                      {(
                        worker?.name ||
                        (isAdmin && user?.email ? user.email.split("@")[0] : "") ||
                        ""
                      )
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </Text>
                  ) : (
                    <Ionicons name="person" size={20} color={colors.primary} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-card-foreground">
                    {worker?.name || user?.email || "User"}
                  </Text>
                  <Text className="text-sm text-muted-foreground mt-0.5">{user.email}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Notifications Section */}
          <View className="bg-card rounded-xl p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-base font-semibold text-card-foreground mb-1">
                  Notifications
                </Text>
                <Text className="text-sm text-muted-foreground">
                  Receive notifications about job updates and reminders
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{
                  false: "rgb(226 232 240)",
                  true: "rgb(37 99 235)",
                }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {/* Sign Out Button */}
          <View className="mt-auto pb-4">
            <Pressable
              onPress={handleLogout}
              className="bg-destructive/10 border border-destructive rounded-xl p-4 flex-row items-center justify-center gap-2 active:opacity-80"
            >
              <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
              <Text className="text-destructive text-base font-semibold">Sign Out</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
