import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const router = useRouter();

  const handleMakeNewEntry = () => {
    router.push("./new-entry");
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center px-6">
        <View className="items-center mb-8">
          <View className="bg-blue-100 rounded-full p-6 mb-4">
            <Ionicons name="document-text-outline" size={64} color="#007AFF" />
          </View>
          <Text className="text-3xl font-bold text-foreground mb-2 text-center">
            Clean Log
          </Text>
          <Text className="text-base text-muted-foreground text-center">
            Track your entries and stay organized
          </Text>
        </View>

        <Pressable
          onPress={handleMakeNewEntry}
          className="bg-blue-500 rounded-xl py-5 px-12 items-center justify-center w-full max-w-sm active:bg-blue-600 active:scale-[0.98] shadow-lg"
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text className="text-white text-lg font-semibold">
              Make New Entry
            </Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
