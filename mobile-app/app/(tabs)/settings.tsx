import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCurrentWorker } from "@/hooks/use-current-worker";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { worker } = useCurrentWorker();
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
                  {worker?.name ? (
                    <Text className="text-sm font-semibold text-primary">
                      {worker.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </Text>
                  ) : (
                    <Ionicons name="person" size={20} color="rgb(37 99 235)" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-card-foreground">
                    {worker?.name || user.email}
                  </Text>
                  <Text className="text-sm text-muted-foreground mt-0.5">
                    {user.email}
                  </Text>
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
              className="bg-card border border-destructive rounded-xl p-4 flex-row items-center justify-center gap-2 active:opacity-80"
            >
              <Ionicons
                name="log-out-outline"
                size={20}
                color="rgb(220 38 38)"
              />
              <Text className="text-destructive text-base font-semibold">
                Sign Out
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
