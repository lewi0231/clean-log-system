import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        Alert.alert("Login Failed", error.message);
        setIsLoading(false);
        return;
      }

      // Success - reset loading state before navigation
      setIsLoading(false);
      router.replace("/(tabs)");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : (error as string);
      Alert.alert("Error", errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 20,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full max-w-sm self-center gap-5">
            <View className="items-center mb-2">
              <Text className="text-3xl font-bold text-center mb-2 text-foreground">
                Tally Runner
              </Text>
              <Text className="text-base text-center mb-8 text-muted-foreground">
                Sign in to continue
              </Text>
            </View>

            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3.5 text-base text-foreground"
              placeholder="Email"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!isLoading}
            />

            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3.5 text-base text-foreground"
              placeholder="Password"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              editable={!isLoading}
            />

            <Pressable
              onPress={handleLogin}
              disabled={isLoading}
              className={`bg-primary rounded-xl py-4 px-8 items-center justify-center mt-2 min-h-[52px] shadow-lg ${
                isLoading ? "opacity-70" : "active:opacity-90 active:scale-[0.98]"
              }`}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text className="text-primary-foreground text-lg font-semibold">Sign In</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
