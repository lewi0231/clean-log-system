import { cn } from "@/lib/utils";
import * as React from "react";
import { View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface ProgressProps {
  value: number; // 0-100
  className?: string;
  style?: ViewStyle;
  showLabel?: boolean;
}

function Progress({
  value,
  className,
  style,
  showLabel = false,
}: ProgressProps) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(100, value)), {
      duration: 300,
    });
  }, [value, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <View className={cn("w-full", className)} style={style}>
      {showLabel && (
        <View className="flex-row justify-between items-center mb-1">
          <View className="flex-row items-center gap-2">
            <View className="w-2 h-2 rounded-full bg-blue-500" />
            <View className="flex-1">
              <View className="h-2 bg-secondary rounded-full overflow-hidden">
                <Animated.View
                  className="h-full bg-primary rounded-full"
                  style={animatedStyle}
                />
              </View>
            </View>
          </View>
        </View>
      )}
      {!showLabel && (
        <View className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <Animated.View
            className="h-full bg-primary rounded-full"
            style={animatedStyle}
          />
        </View>
      )}
    </View>
  );
}

Progress.displayName = "Progress";

export { Progress };
