import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import DatePicker from "react-native-date-picker";

interface DateRange {
  from: Date;
  to: Date;
}

interface TimeConfig {
  minuteInterval?: 1 | 5 | 10 | 15 | 30;
  minTime?: string;
  maxTime?: string;
  disabledTimes?: string[];
}

interface DateTimePickerProps {
  mode?: "single" | "range" | "datetime" | "time";
  value?: Date | Date[] | DateRange;
  onValueChange?: (value: Date | Date[] | DateRange | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showOutsideDays?: boolean;
  disabledDates?: (date: Date) => boolean;
  disableWeekends?: boolean;
  fromDate?: Date;
  toDate?: Date;
  timeConfig?: TimeConfig;
  firstDayOfWeek?: 0 | 1;
  enableQuickMonthYear?: boolean;
  variant?: "default" | "outline";
  size?: "sm" | "md" | "lg";
}

const isDateRange = (value: any): value is DateRange => {
  return value && typeof value === "object" && "from" in value && "to" in value;
};

const formatDisplayValue = (
  value: Date | Date[] | DateRange | undefined,
  mode: "single" | "range" | "datetime" | "time",
  placeholder: string
): string => {
  if (!value) return placeholder;

  switch (mode) {
    case "single":
      if (value instanceof Date) {
        return format(value, "PPP", { locale: enUS });
      }
      break;
    case "datetime":
      if (value instanceof Date) {
        return format(value, "PPP 'at' HH:mm", { locale: enUS });
      }
      break;
    case "time":
      if (value instanceof Date) {
        return format(value, "HH:mm", { locale: enUS });
      }
      break;
    case "range":
      if (isDateRange(value)) {
        const fromFormatted = format(value.from, "PP", { locale: enUS });
        const toFormatted = format(value.to, "PP", { locale: enUS });
        return `${fromFormatted} - ${toFormatted}`;
      }
      break;
  }
  return placeholder;
};

const getInputIcon = (mode: "single" | "range" | "datetime" | "time") => {
  switch (mode) {
    case "time":
      return "time-outline";
    case "datetime":
      return "calendar-outline";
    case "range":
      return "calendar-outline";
    default:
      return "calendar-outline";
  }
};

const DateTimePicker = React.forwardRef<View, DateTimePickerProps>(
  (
    {
      mode = "single",
      value,
      onValueChange,
      placeholder = "Select date",
      disabled = false,
      className,
      showOutsideDays = true,
      disabledDates,
      disableWeekends = false,
      fromDate,
      toDate,
      timeConfig,
      firstDayOfWeek = 1,
      enableQuickMonthYear = false,
      variant = "default",
      size = "md",
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [currentDate, setCurrentDate] = React.useState<Date>(() => {
      if (value instanceof Date) {
        return value;
      }
      return new Date();
    });

    // Update currentDate when value prop changes
    React.useEffect(() => {
      if (value instanceof Date) {
        setCurrentDate(value);
      }
    }, [value]);

    const displayValue = formatDisplayValue(value, mode, placeholder);
    const iconName = getInputIcon(mode);

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

    const openPicker = React.useCallback(() => {
      if (disabled) return;
      setIsOpen(true);
    }, [disabled]);

    const closePicker = React.useCallback(() => {
      setIsOpen(false);
    }, []);

    const handleConfirm = React.useCallback(
      (date: Date) => {
        setCurrentDate(date);
        onValueChange?.(date);
        closePicker();
      },
      [onValueChange, closePicker]
    );

    const handleCancel = React.useCallback(() => {
      closePicker();
    }, [closePicker]);

    // Determine the picker mode for react-native-date-picker
    const pickerMode = React.useMemo(() => {
      if (mode === "datetime") return "datetime";
      if (mode === "time") return "time";
      return "date";
    }, [mode]);

    // For time mode, use the dedicated TimePicker component
    if (mode === "time") {
      return (
        <TimePicker
          ref={ref}
          value={value instanceof Date ? value : undefined}
          onValueChange={onValueChange as (value: Date | undefined) => void}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          size={size}
          variant={variant}
          {...props}
        />
      );
    }

    // Note: range mode is not supported by react-native-date-picker
    // For now, we'll treat it as single date selection
    if (mode === "range") {
      console.warn(
        "DateTimePicker: range mode is not fully supported with react-native-date-picker"
      );
    }

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
              name={iconName as any}
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

        <DatePicker
          modal
          open={isOpen}
          date={currentDate}
          mode={pickerMode}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          minimumDate={fromDate}
          maximumDate={toDate}
          minuteInterval={timeConfig?.minuteInterval || 1}
        />
      </>
    );
  }
);

DateTimePicker.displayName = "DateTimePicker";

export { DateTimePicker, type DateTimePickerProps };
