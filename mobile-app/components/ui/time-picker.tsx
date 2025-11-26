import { cn } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";

interface TimePickerProps {
  value?: Date;
  onValueChange?: (value: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline";
}

const TimePicker = React.forwardRef<View, TimePickerProps>(
  (
    {
      value,
      onValueChange,
      placeholder = "Select time",
      disabled = false,
      className,
      size = "md",
      variant = "default",
      ...props
    },
    ref
  ) => {
    const [show, setShow] = React.useState(false);
    const [time, setTime] = React.useState<Date>(() => {
      if (value instanceof Date) {
        return value;
      }
      return new Date();
    });

    // Update time when value prop changes
    React.useEffect(() => {
      if (value instanceof Date) {
        setTime(value);
      }
    }, [value]);

    const displayValue = React.useMemo(() => {
      if (value instanceof Date) {
        const hour = value.getHours().toString().padStart(2, "0");
        const minute = value.getMinutes().toString().padStart(2, "0");
        return `${hour}:${minute}`;
      }
      return placeholder;
    }, [value, placeholder]);

    const sizeClasses = {
      sm: "h-10 px-3 text-sm",
      md: "h-12 px-3 text-base",
      lg: "h-14 px-4 text-lg",
    };

    const iconSizes = {
      sm: 18,
      md: 20,
      lg: 22,
    };

    const onChange = React.useCallback(
      (event: any, selectedTime?: Date) => {
        setShow(false);
        if (selectedTime) {
          setTime(selectedTime);
          onValueChange?.(selectedTime);
        }
      },
      [onValueChange]
    );

    const openPicker = React.useCallback(() => {
      if (disabled) return;
      setShow(true);
    }, [disabled]);

    return (
      <>
        <Pressable
          ref={ref}
          onPress={openPicker}
          disabled={disabled}
          className={cn(
            "w-full rounded-md border border-input bg-transparent flex-row items-center justify-between",
            sizeClasses[size],
            value ? "border-primary" : "",
            disabled ? "opacity-50 cursor-not-allowed" : "active:bg-accent/5",
            className
          )}
          {...props}
        >
          <View className="ml-3 mr-2">
            <Ionicons
              name="time-outline"
              size={iconSizes[size]}
              color={disabled ? "#999" : "#666"}
            />
          </View>
          <Text
            className={cn(
              "flex-1",
              value ? "text-primary" : "text-muted-foreground"
            )}
            numberOfLines={1}
          >
            {displayValue}
          </Text>
        </Pressable>

        {show && (
          <DateTimePicker
            value={time}
            mode="time"
            is24Hour={true}
            display={Platform.OS === "ios" ? "spinner" : "spinner"}
            onChange={onChange}
          />
        )}
      </>
    );
  }
);

TimePicker.displayName = "TimePicker";

export { TimePicker, type TimePickerProps };
