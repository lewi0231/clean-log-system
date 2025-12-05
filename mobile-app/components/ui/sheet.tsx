import { cn } from "@/lib/utils";
import { Feather } from "@expo/vector-icons";
import * as React from "react";
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Edge, SafeAreaView } from "react-native-safe-area-context";

// Animation config constants
const ANIMATION = {
  OPEN: {
    BACKDROP_DURATION: 180,
    SPRING_VELOCITY: 3,
    SPRING_TENSION: 120,
    SPRING_FRICTION: 22,
  },
  CLOSE: {
    SPRING_FRICTION: 26,
    SPRING_TENSION: 100,
    SPRING_VELOCITY: 0.5,
    BACKDROP_DURATION: 280,
    BACKDROP_DELAY: 100,
  },
};

// Sheet sizes based on platform guidelines
const SHEET_SIZES = {
  SMALL: 0.3, // 30% of screen height
  MEDIUM: 0.5, // 50% of screen height
  LARGE: 0.7, // 70% of screen height
  FULL: 0.9, // 90% of screen height
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

export type SheetSize = "small" | "medium" | "large" | "full" | number;

const resolveSheetSize = (size: SheetSize): number => {
  if (typeof size === "number") return size;

  switch (size) {
    case "small":
      return SHEET_SIZES.SMALL;
    case "medium":
      return SHEET_SIZES.MEDIUM;
    case "large":
      return SHEET_SIZES.LARGE;
    case "full":
      return SHEET_SIZES.FULL;
    default:
      return SHEET_SIZES.MEDIUM;
  }
};

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  size?: SheetSize;
  side?: "left" | "right" | "top" | "bottom";
  contentClassName?: string;
  avoidKeyboard?: boolean;
  closeOnBackdropPress?: boolean;
  disableBackHandler?: boolean;
}

interface SheetContextValue {
  close: () => void;
  isClosing: boolean;
  isAnimating: boolean;
  position: Animated.Value;
}

export const SheetContext = React.createContext<SheetContextValue>({
  close: () => {},
  isClosing: false,
  isAnimating: false,
  position: new Animated.Value(0),
});

export const useSheet = () => React.useContext(SheetContext);

const Sheet = React.forwardRef<View, SheetProps>(
  (
    {
      open,
      onClose,
      children,
      title,
      description,
      size = "medium",
      side = "right",
      contentClassName,
      avoidKeyboard = true,
      closeOnBackdropPress = true,
      disableBackHandler = false,
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const sheetSize = React.useMemo(() => resolveSheetSize(size), [size]);

    const translateValue = React.useRef(new Animated.Value(0)).current;
    const backdropOpacity = React.useRef(new Animated.Value(0)).current;
    const isClosing = React.useRef(false);
    const isAnimating = React.useRef(false);
    const hasInitializedOpen = React.useRef(false);

    const getInitialPosition = () => {
      switch (side) {
        case "left":
          return -SCREEN_WIDTH;
        case "right":
          return SCREEN_WIDTH;
        case "top":
          return -SCREEN_HEIGHT;
        case "bottom":
          return SCREEN_HEIGHT;
        default:
          return SCREEN_WIDTH;
      }
    };

    const getTargetPosition = () => {
      switch (side) {
        case "left":
        case "right":
          return 0;
        case "top":
        case "bottom":
          return 0;
        default:
          return 0;
      }
    };

    const getSheetDimensions = () => {
      switch (side) {
        case "left":
        case "right":
          return {
            width: SCREEN_WIDTH * sheetSize,
            height: SCREEN_HEIGHT,
          };
        case "top":
        case "bottom":
          return {
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT * sheetSize,
          };
        default:
          return {
            width: SCREEN_WIDTH * sheetSize,
            height: SCREEN_HEIGHT,
          };
      }
    };

    const animateOpen = React.useCallback(() => {
      if (isAnimating.current) {
        translateValue.stopAnimation();
        backdropOpacity.stopAnimation();
      }

      isAnimating.current = true;
      translateValue.setValue(getInitialPosition());
      backdropOpacity.setValue(0);
      isClosing.current = false;

      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: ANIMATION.OPEN.BACKDROP_DURATION,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();

      Animated.spring(translateValue, {
        toValue: getTargetPosition(),
        useNativeDriver: true,
        velocity: ANIMATION.OPEN.SPRING_VELOCITY,
        tension: ANIMATION.OPEN.SPRING_TENSION,
        friction: ANIMATION.OPEN.SPRING_FRICTION,
      }).start(() => {
        isAnimating.current = false;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [backdropOpacity, translateValue]);

    const animateClose = React.useCallback(() => {
      if (isClosing.current) return;

      isClosing.current = true;

      if (isAnimating.current) {
        translateValue.stopAnimation();
        backdropOpacity.stopAnimation();
      }

      isAnimating.current = true;

      Animated.spring(translateValue, {
        toValue: getInitialPosition(),
        useNativeDriver: true,
        friction: ANIMATION.CLOSE.SPRING_FRICTION,
        tension: ANIMATION.CLOSE.SPRING_TENSION,
        velocity: ANIMATION.CLOSE.SPRING_VELOCITY,
      }).start();

      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: ANIMATION.CLOSE.BACKDROP_DURATION,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
        delay: ANIMATION.CLOSE.BACKDROP_DELAY,
      }).start(() => {
        requestAnimationFrame(() => {
          setIsVisible(false);
          isClosing.current = false;
          isAnimating.current = false;
          hasInitializedOpen.current = false;
          onClose();
        });
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [backdropOpacity, translateValue, onClose]);

    React.useEffect(() => {
      if (open && !isVisible) {
        setIsVisible(true);
        return;
      }

      if (
        open &&
        isVisible &&
        !hasInitializedOpen.current &&
        !isClosing.current
      ) {
        animateOpen();
        hasInitializedOpen.current = true;
        return;
      }

      if (!open && isVisible && !isClosing.current) {
        animateClose();
      }
    }, [open, isVisible, animateOpen, animateClose]);

    const handleBackdropPress = React.useCallback(() => {
      if (closeOnBackdropPress && !isClosing.current) {
        animateClose();
      }
    }, [animateClose, closeOnBackdropPress]);

    const contextValue = React.useMemo(
      () => ({
        close: animateClose,
        isClosing: isClosing.current,
        isAnimating: isAnimating.current,
        position: translateValue,
      }),
      [animateClose, translateValue]
    );

    const getTransformStyle = () => {
      switch (side) {
        case "left":
        case "right":
          return { transform: [{ translateX: translateValue }] };
        case "top":
        case "bottom":
          return { transform: [{ translateY: translateValue }] };
        default:
          return { transform: [{ translateX: translateValue }] };
      }
    };

    const getSheetPosition = () => {
      switch (side) {
        case "left":
          return "left-0 top-0 bottom-0";
        case "right":
          return "right-0 top-0 bottom-0";
        case "top":
          return "top-0 left-0 right-0";
        case "bottom":
          return "bottom-0 left-0 right-0";
        default:
          return "right-0 top-0 bottom-0";
      }
    };

    const getSafeAreaEdges = (): Edge[] => {
      switch (side) {
        case "left":
        case "right":
          return ["top", "bottom"];
        case "top":
          return ["top", "left", "right"];
        case "bottom":
          return ["bottom", "left", "right"];
        default:
          return ["top", "bottom"];
      }
    };

    const renderContent = React.useCallback(
      () => (
        <View className="flex-1">
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          >
            {closeOnBackdropPress && (
              <TouchableWithoutFeedback onPress={handleBackdropPress}>
                <View style={StyleSheet.absoluteFillObject} />
              </TouchableWithoutFeedback>
            )}
          </Animated.View>

          <Animated.View
            style={[
              styles.sheetContainer,
              getTransformStyle(),
              getSheetDimensions(),
            ]}
            className={cn(
              "absolute bg-gray-800",
              Platform.OS === "ios" ? "ios:shadow-xl" : "android:elevation-24",
              getSheetPosition(),
              contentClassName
            )}
          >
            <SafeAreaView edges={getSafeAreaEdges()} className="flex-1">
              <View className="flex-1">
                <View className="flex-row items-center justify-between p-4 border-b border-gray-700">
                  <View className="flex-1">
                    {title && (
                      <Text className="text-lg font-semibold text-gray-100">
                        {title}
                      </Text>
                    )}
                    {description && (
                      <Text className="text-sm text-gray-400 mt-1">
                        {description}
                      </Text>
                    )}
                  </View>
                  <TouchableWithoutFeedback onPress={animateClose}>
                    <View className="p-2 rounded-full bg-gray-700">
                      <Feather name="x" size={20} color="#9CA3AF" />
                    </View>
                  </TouchableWithoutFeedback>
                </View>

                <View ref={ref} className="flex-1">
                  {children}
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      ),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        animateClose,
        backdropOpacity,
        closeOnBackdropPress,
        contentClassName,
        description,
        title,
        translateValue,
        children,
        ref,
      ]
    );

    if (!isVisible) return null;

    return (
      <SheetContext.Provider value={contextValue}>
        <Modal
          visible={isVisible}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={disableBackHandler ? undefined : animateClose}
        >
          {avoidKeyboard && Platform.OS === "ios" ? (
            <KeyboardAvoidingView
              behavior="padding"
              style={{ flex: 1 }}
              keyboardVerticalOffset={10}
            >
              {renderContent()}
            </KeyboardAvoidingView>
          ) : (
            renderContent()
          )}
        </Modal>
      </SheetContext.Provider>
    );
  }
);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheetContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 24,
  },
});

Sheet.displayName = "Sheet";

export { Sheet };
