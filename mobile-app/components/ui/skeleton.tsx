import { cn } from "@/lib/utils";
import * as React from "react";
import { DimensionValue, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export interface SkeletonProps {
  className?: string;
  style?: ViewStyle;
  width?: number | string;
  height?: number;
  rounded?: boolean;
  fullWidth?: boolean;
}

function Skeleton({
  className,
  style,
  width,
  height = 20,
  rounded = false,
  fullWidth = false,
}: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const baseStyle: ViewStyle = {
    width: (fullWidth ? "100%" : width ?? "100%") as DimensionValue,
    height,
  };

  return (
    <Animated.View
      className={cn(
        "bg-gray-700",
        rounded ? "rounded-full" : "rounded-md",
        fullWidth && "w-full",
        className
      )}
      style={[baseStyle, animatedStyle, style]}
    />
  );
}

Skeleton.displayName = "Skeleton";

export { Skeleton };
