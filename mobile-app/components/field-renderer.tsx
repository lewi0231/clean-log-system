import {
  GroupedBreakdownField,
  GroupedBreakdownItem,
} from "@/components/group-breakdown-field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Select, SelectItem } from "@/components/ui/select";
import { FieldConfig } from "@/shared/types/field-config";
import { Switch, Text, TextInput, View } from "react-native";
import { TimePicker } from "./ui/time-picker";

interface FieldRendererProps {
  config: FieldConfig;
  value: string | number | boolean | GroupedBreakdownItem[] | undefined;
  error?: string;
  onChange: (value: string | number | boolean | GroupedBreakdownItem[]) => void;
  onErrorClear?: () => void;
  disabled?: boolean;
}

export function FieldRenderer({
  config,
  value,
  error,
  onChange,
  onErrorClear,
  disabled = false,
}: FieldRendererProps) {
  const placeholder = config.required
    ? `${config.label} *`
    : config.description || config.label;

  const handleFieldChange = (
    newValue: string | number | boolean | GroupedBreakdownItem[]
  ) => {
    if (disabled) return;
    onChange(newValue);
    // Clear error when user starts typing/selecting
    if (error && onErrorClear) {
      onErrorClear();
    }
  };

  switch (config.field_type) {
    case "text":
    case "email":
    case "phone":
      return (
        <View>
          <TextInput
            className={`bg-white border-[1.5px] ${
              error ? "border-red-500" : "border-[#e0e0e0]"
            } rounded-xl px-4 py-3.5 text-base text-foreground ${
              disabled ? "opacity-50" : ""
            }`}
            placeholder={placeholder}
            placeholderTextColor="#999"
            value={String(value || "")}
            onChangeText={(text) => handleFieldChange(text)}
            editable={!disabled}
            keyboardType={
              config.field_type === "email"
                ? "email-address"
                : config.field_type === "phone"
                ? "phone-pad"
                : "default"
            }
            autoCapitalize={
              config.field_type === "email" ? "none" : "sentences"
            }
            autoComplete={
              config.field_type === "email"
                ? "email"
                : config.field_type === "phone"
                ? "tel"
                : "off"
            }
            returnKeyType="next"
            accessibilityLabel={config.label}
            accessibilityHint={config.description || undefined}
            accessibilityState={{ disabled, invalid: !!error }}
            accessibilityLiveRegion={error ? "polite" : "none"}
          />
          {error && (
            <Text
              className="text-sm text-destructive mt-1"
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {error}
            </Text>
          )}
        </View>
      );

    case "number":
      return (
        <View>
          <TextInput
            className={`bg-white border-[1.5px] ${
              error ? "border-red-500" : "border-[#e0e0e0]"
            } rounded-xl px-4 py-3.5 text-base text-foreground ${
              disabled ? "opacity-50" : ""
            }`}
            placeholder={placeholder}
            placeholderTextColor="#999"
            value={String(value || "0")}
            onChangeText={(text) => {
              const numValue = text === "" ? 0 : Number(text) || 0;
              handleFieldChange(numValue);
            }}
            keyboardType="number-pad"
            returnKeyType="done"
            editable={!disabled}
            accessibilityLabel={config.label}
            accessibilityHint={config.description || undefined}
            accessibilityState={{ disabled, invalid: !!error }}
            accessibilityLiveRegion={error ? "polite" : "none"}
          />
          {error && (
            <Text
              className="text-sm text-destructive mt-1"
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {error}
            </Text>
          )}
        </View>
      );

    case "textarea":
      return (
        <View>
          <TextInput
            className={`bg-white border-[1.5px] ${
              error ? "border-red-500" : "border-[#e0e0e0]"
            } rounded-xl px-4 py-3.5 pt-3.5 text-base text-foreground min-h-[100px] ${
              disabled ? "opacity-50" : ""
            }`}
            placeholder={placeholder}
            placeholderTextColor="#999"
            value={String(value || "")}
            onChangeText={(text) => handleFieldChange(text)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            returnKeyType="default"
            editable={!disabled}
            accessibilityLabel={config.label}
            accessibilityHint={config.description || undefined}
            accessibilityState={{ disabled, invalid: !!error }}
            accessibilityLiveRegion={error ? "polite" : "none"}
          />
          {error && (
            <Text
              className="text-sm text-destructive mt-1"
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {error}
            </Text>
          )}
        </View>
      );

    case "select":
      if (!config.options || config.options.length === 0) {
        return (
          <View>
            <Text className="text-red-500 text-sm py-2">
              No options configured for {config.label}
            </Text>
            {error && (
              <Text className="text-sm text-destructive mt-1">{error}</Text>
            )}
          </View>
        );
      }
      return (
        <View>
          <Select
            value={String(value || "")}
            onValueChange={(selectedValue) => handleFieldChange(selectedValue)}
            placeholder={placeholder}
            size="medium"
            disabled={disabled}
          >
            {config.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </Select>
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    case "grouped_breakdown":
      return (
        <View>
          <GroupedBreakdownField
            config={config}
            value={(value as GroupedBreakdownItem[]) || []}
            onChange={(items) => handleFieldChange(items)}
            disabled={disabled}
          />
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    case "boolean":
      return (
        <View className="flex-row items-center justify-between py-2">
          <Text
            className="text-base font-semibold text-foreground flex-1"
            accessibilityRole="text"
          >
            {config.label}
          </Text>
          <Switch
            value={Boolean(value)}
            onValueChange={(newValue) => handleFieldChange(newValue)}
            trackColor={{ false: "#767577", true: "#007AFF" }}
            thumbColor="#fff"
            disabled={disabled}
            accessibilityLabel={config.label}
            accessibilityHint={config.description || undefined}
            accessibilityState={{ disabled }}
          />
          {error && (
            <Text
              className="text-sm text-destructive mt-1 absolute bottom-[-20] left-0"
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {error}
            </Text>
          )}
        </View>
      );

    case "date":
      // Convert string value to Date for DateTimePicker
      let dateValue: Date | undefined = undefined;
      if (value) {
        if (typeof value === "string" && value !== "") {
          const parsedDate = new Date(value);
          if (!isNaN(parsedDate.getTime())) {
            dateValue = parsedDate;
          }
        }
      }

      // Validate date value
      const isValidDate =
        dateValue instanceof Date && !isNaN(dateValue.getTime());

      return (
        <View>
          <DateTimePicker
            mode="single"
            value={isValidDate ? dateValue : undefined}
            onValueChange={(selectedDate) => {
              if (selectedDate instanceof Date) {
                // Store as ISO string for consistency
                handleFieldChange(selectedDate.toISOString());
              } else {
                handleFieldChange("");
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="bg-white border-[1.5px] border-[#e0e0e0] rounded-xl px-4 py-3.5"
            size="md"
            variant="outline"
          />
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    case "time":
      // For time fields, we use today's date with the selected time
      // The date part will be ignored when submitting
      let timeValue: Date | undefined = undefined;
      if (value && typeof value === "string" && value !== "") {
        // Try to parse as time string (HH:mm)
        const timeMatch = value.match(/^(\d{2}):(\d{2})$/);
        if (timeMatch) {
          // Format: HH:mm
          const today = new Date();
          today.setHours(parseInt(timeMatch[1], 10));
          today.setMinutes(parseInt(timeMatch[2], 10));
          today.setSeconds(0);
          timeValue = today;
        } else {
          // Try parsing as ISO string (fallback)
          const parsedDate = new Date(value);
          if (!isNaN(parsedDate.getTime())) {
            timeValue = parsedDate;
          }
        }
      }

      // If no valid value, use current time as default (but don't set state during render)
      if (!timeValue) {
        timeValue = new Date();
      }

      return (
        <View>
          <TimePicker
            value={timeValue}
            onValueChange={(selectedTime) => {
              if (selectedTime instanceof Date) {
                // Store as time string (HH:mm) for easy handling
                const hours = selectedTime
                  .getHours()
                  .toString()
                  .padStart(2, "0");
                const minutes = selectedTime
                  .getMinutes()
                  .toString()
                  .padStart(2, "0");
                handleFieldChange(`${hours}:${minutes}`);
              }
            }}
            placeholder={placeholder || "Select time"}
            disabled={disabled}
            className="bg-white border-[1.5px] border-[#e0e0e0] rounded-xl px-4 py-3.5"
            size="lg"
            variant="outline"
          />
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    default:
      return (
        <Text className="text-red-500 text-sm py-2">
          Unknown field type: {config.field_type}
        </Text>
      );
  }
}
