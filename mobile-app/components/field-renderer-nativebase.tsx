import {
  GroupedBreakdownField,
  GroupedBreakdownItem,
} from "@/components/group-breakdown-field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Select, SelectItem } from "@/components/ui/select";
import { FieldConfig } from "@clean-log/shared/types/field-config";
import { Ionicons } from "@expo/vector-icons";
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

// Icon mapping for different field types
const getFieldIcon = (fieldType: string): keyof typeof Ionicons.glyphMap => {
  switch (fieldType) {
    case "email":
      return "mail-outline";
    case "phone":
      return "call-outline";
    case "number":
      return "calculator-outline";
    case "date":
      return "calendar-outline";
    case "time":
      return "time-outline";
    case "textarea":
      return "document-text-outline";
    case "select":
      return "chevron-down-outline";
    default:
      return "text-outline";
  }
};

export function FieldRendererNativeBase({
  config,
  value,
  error,
  onChange,
  onErrorClear,
  disabled = false,
}: FieldRendererProps) {
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

  const iconName = getFieldIcon(config.field_type);
  const isInvalid = !!error;

  switch (config.field_type) {
    case "text":
    case "email":
    case "phone":
      return (
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-sm font-medium text-foreground">
              {config.label}
              {config.required && (
                <Text className="text-destructive ml-1">*</Text>
              )}
            </Text>
          </View>
          <View
            className={`bg-card border rounded-xl overflow-hidden ${
              isInvalid ? "border-destructive" : "border-border"
            }`}
          >
            <View className="flex-row items-center">
              <View className="ml-3">
                <Ionicons
                  name={iconName}
                  size={20}
                  color={disabled ? "#6b7280" : "#9ca3af"}
                />
              </View>
              <TextInput
                className="flex-1 bg-transparent text-card-foreground px-4 py-3.5 text-base"
                placeholder={config.description || config.label}
                placeholderTextColor="#6b7280"
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
                style={{ opacity: disabled ? 0.5 : 1 }}
              />
            </View>
          </View>
          {config.description && (
            <Text className="text-xs text-muted-foreground mt-1">
              {config.description}
            </Text>
          )}
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    case "number":
      return (
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-sm font-medium text-foreground">
              {config.label}
              {config.required && (
                <Text className="text-destructive ml-1">*</Text>
              )}
            </Text>
          </View>
          <View
            className={`bg-card border rounded-xl overflow-hidden ${
              isInvalid ? "border-destructive" : "border-border"
            }`}
          >
            <View className="flex-row items-center">
              <View className="ml-3">
                <Ionicons
                  name={iconName}
                  size={20}
                  color={disabled ? "#6b7280" : "#9ca3af"}
                />
              </View>
              <TextInput
                className="flex-1 bg-transparent text-card-foreground px-4 py-3.5 text-base"
                placeholder={config.description || config.label}
                placeholderTextColor="#6b7280"
                value={String(value || "0")}
                onChangeText={(text) => {
                  const numValue = text === "" ? 0 : Number(text) || 0;
                  handleFieldChange(numValue);
                }}
                keyboardType="number-pad"
                editable={!disabled}
                style={{ opacity: disabled ? 0.5 : 1 }}
              />
            </View>
          </View>
          {config.description && (
            <Text className="text-xs text-muted-foreground mt-1">
              {config.description}
            </Text>
          )}
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    case "textarea":
      return (
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-sm font-medium text-foreground">
              {config.label}
              {config.required && (
                <Text className="text-destructive ml-1">*</Text>
              )}
            </Text>
          </View>
          <View
            className={`bg-card border rounded-xl overflow-hidden ${
              isInvalid ? "border-destructive" : "border-border"
            }`}
          >
            <TextInput
              className="bg-transparent text-card-foreground px-4 py-3.5 text-base min-h-[128px]"
              placeholder={config.description || config.label}
              placeholderTextColor="#6b7280"
              value={String(value || "")}
              onChangeText={(text) => handleFieldChange(text)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!disabled}
              style={{ opacity: disabled ? 0.5 : 1 }}
            />
          </View>
          {config.description && (
            <Text className="text-xs text-muted-foreground mt-1">
              {config.description}
            </Text>
          )}
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    case "select":
      if (!config.options || config.options.length === 0) {
        return (
          <View className="mb-4">
            <Text className="text-destructive text-sm py-2">
              No options configured for {config.label}
            </Text>
            {error && (
              <Text className="text-sm text-destructive mt-1">{error}</Text>
            )}
          </View>
        );
      }
      return (
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-sm font-medium text-foreground">
              {config.label}
              {config.required && (
                <Text className="text-destructive ml-1">*</Text>
              )}
            </Text>
          </View>
          <Select
            value={String(value || "")}
            onValueChange={(selectedValue) => handleFieldChange(selectedValue)}
            placeholder={config.description || config.label}
            size="medium"
            disabled={disabled}
          >
            {config.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </Select>
          {config.description && (
            <Text className="text-xs text-muted-foreground mt-1">
              {config.description}
            </Text>
          )}
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    case "grouped_breakdown":
      return (
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-sm font-medium text-foreground">
              {config.label}
              {config.required && (
                <Text className="text-destructive ml-1">*</Text>
              )}
            </Text>
          </View>
          <GroupedBreakdownField
            config={config}
            value={(value as GroupedBreakdownItem[]) || []}
            onChange={(items) => handleFieldChange(items)}
            disabled={disabled}
          />
          {config.description && (
            <Text className="text-xs text-muted-foreground mt-1">
              {config.description}
            </Text>
          )}
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    case "boolean":
      return (
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-sm font-medium text-foreground">
              {config.label}
              {config.required && (
                <Text className="text-destructive ml-1">*</Text>
              )}
            </Text>
          </View>
          <View
            className={`bg-card border rounded-xl px-4 py-3 flex-row items-center justify-between h-12 ${
              isInvalid ? "border-destructive" : "border-border"
            }`}
          >
            <View className="flex-1">
              {config.description && (
                <Text className="text-xs text-muted-foreground">
                  {config.description}
                </Text>
              )}
            </View>
            <Switch
              value={Boolean(value)}
              onValueChange={(newValue) => handleFieldChange(newValue)}
              trackColor={{ false: "rgb(226 232 240)", true: "rgb(37 99 235)" }}
              thumbColor="#ffffff"
              disabled={disabled}
              style={{ opacity: disabled ? 0.5 : 1 }}
            />
          </View>
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    case "date":
      let dateValue: Date | undefined = undefined;
      if (value) {
        if (typeof value === "string" && value !== "") {
          const parsedDate = new Date(value);
          if (!isNaN(parsedDate.getTime())) {
            dateValue = parsedDate;
          }
        }
      }

      const isValidDate =
        dateValue instanceof Date && !isNaN(dateValue.getTime());

      return (
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-sm font-medium text-foreground">
              {config.label}
              {config.required && (
                <Text className="text-destructive ml-1">*</Text>
              )}
            </Text>
          </View>
          <DateTimePicker
            mode="single"
            value={isValidDate ? dateValue : undefined}
            onValueChange={(selectedDate) => {
              if (selectedDate instanceof Date) {
                handleFieldChange(selectedDate.toISOString());
              } else {
                handleFieldChange("");
              }
            }}
            placeholder={config.description || config.label}
            disabled={disabled}
            className="bg-card border border-border rounded-xl px-4 py-3.5"
            size="md"
          />
          {config.description && (
            <Text className="text-xs text-muted-foreground mt-1">
              {config.description}
            </Text>
          )}
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    case "time":
      let timeValue: Date | undefined = undefined;
      if (value && typeof value === "string" && value !== "") {
        const timeMatch = value.match(/^(\d{2}):(\d{2})$/);
        if (timeMatch) {
          const today = new Date();
          today.setHours(parseInt(timeMatch[1], 10));
          today.setMinutes(parseInt(timeMatch[2], 10));
          today.setSeconds(0);
          timeValue = today;
        } else {
          const parsedDate = new Date(value);
          if (!isNaN(parsedDate.getTime())) {
            timeValue = parsedDate;
          }
        }
      }

      if (!timeValue) {
        timeValue = new Date();
      }

      return (
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <Text className="text-sm font-medium text-foreground">
              {config.label}
              {config.required && (
                <Text className="text-destructive ml-1">*</Text>
              )}
            </Text>
          </View>
          <TimePicker
            value={timeValue}
            onValueChange={(selectedTime) => {
              if (selectedTime instanceof Date) {
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
            placeholder={config.description || "Select time"}
            disabled={disabled}
            className="bg-card border border-border rounded-xl px-4 py-3.5"
            size="lg"
          />
          {config.description && (
            <Text className="text-xs text-muted-foreground mt-1">
              {config.description}
            </Text>
          )}
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    default:
      return (
        <View className="mb-4">
          <Text className="text-destructive text-sm py-2">
            Unknown field type: {config.field_type}
          </Text>
        </View>
      );
  }
}
