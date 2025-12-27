/**
 * FieldRendererNativeBase - Main field renderer component for the mobile app
 *
 * NOTE: Despite the "NativeBase" name, this component does NOT use NativeBase library.
 * The name is a legacy reference. This is the active field renderer used throughout the app.
 *
 * The separate `field-renderer.tsx` file exists only for backward compatibility with tests.
 * All new development should use this component (FieldRendererNativeBase).
 *
 * Features:
 * - Multi-select support for select fields (via validation_rules.allow_multiple)
 * - Address autocomplete using Geoapify API
 * - Enhanced styling with icons and consistent card-based layout
 * - Support for all field types: text, email, phone, number, textarea, select, boolean, date, time, address, image, grouped_breakdown
 */

import {
  GroupedBreakdownField,
  GroupedBreakdownItem,
} from "@/components/group-breakdown-field";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Select, SelectItem } from "@/components/ui/select";
import { FieldConfig } from "@clean-log/shared/types/field-config";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { TimePicker } from "./ui/time-picker";

interface FieldRendererProps {
  config: FieldConfig;
  value:
    | string
    | number
    | boolean
    | string[]
    | GroupedBreakdownItem[]
    | undefined;
  error?: string;
  onChange: (
    value: string | number | boolean | string[] | GroupedBreakdownItem[]
  ) => void;
  onErrorClear?: () => void;
  disabled?: boolean;
  onFocus?: () => void; // Callback when field receives focus
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
    case "image":
      return "image-outline";
    case "address":
      return "location-outline";
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
  onFocus,
}: FieldRendererProps) {
  const handleFieldChange = (
    newValue: string | number | boolean | string[] | GroupedBreakdownItem[]
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
                onFocus={onFocus}
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
                onFocus={onFocus}
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
              onFocus={onFocus}
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

      const isMultiSelect = config.validation_rules?.allow_multiple === true;
      const selectedValues: string[] = isMultiSelect
        ? Array.isArray(value)
          ? (value as string[])
          : []
        : [];
      const singleValue = isMultiSelect ? "" : String(value || "");

      const handleSelectChange = (selectedValue: string) => {
        if (isMultiSelect) {
          // Add to array if not already selected
          if (!selectedValues.includes(selectedValue)) {
            handleFieldChange([...selectedValues, selectedValue] as string[]);
          }
        } else {
          // Single select
          handleFieldChange(selectedValue);
        }
      };

      const handleRemoveSelection = (optionToRemove: string) => {
        if (isMultiSelect) {
          handleFieldChange(
            selectedValues.filter((val) => val !== optionToRemove) as string[]
          );
        }
      };

      // Filter out already selected options for multi-select
      const availableOptions = isMultiSelect
        ? config.options.filter((option) => !selectedValues.includes(option))
        : config.options;

      const placeholder = isMultiSelect
        ? selectedValues.length > 0
          ? "Add another option"
          : config.description || config.label
        : config.description || config.label;

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
          {availableOptions.length > 0 && (
            <Select
              value={singleValue}
              onValueChange={handleSelectChange}
              placeholder={placeholder}
              size="medium"
              disabled={disabled}
            >
              {availableOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </Select>
          )}
          {isMultiSelect && selectedValues.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mt-3">
              {selectedValues.map((selectedOption) => (
                <Badge
                  key={selectedOption}
                  variant="secondary"
                  className="flex-row items-center gap-1.5 px-3 py-1.5"
                >
                  <Text className="text-sm font-medium text-primary-foreground">
                    {selectedOption}
                  </Text>
                  <Pressable
                    onPress={() => handleRemoveSelection(selectedOption)}
                    disabled={disabled}
                    className="min-w-[44px] min-h-[44px] items-center justify-center -mr-2"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={20} color="#fff" />
                  </Pressable>
                </Badge>
              ))}
            </View>
          )}
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

    case "image":
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
            <View className="flex-row items-center px-4 py-3.5">
              <View className="ml-3">
                <Ionicons
                  name="image-outline"
                  size={20}
                  color={disabled ? "#6b7280" : "#9ca3af"}
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-card-foreground text-base">
                  Image upload coming soon
                </Text>
                {config.description && (
                  <Text className="text-xs text-muted-foreground mt-1">
                    {config.description}
                  </Text>
                )}
              </View>
            </View>
          </View>
          {error && (
            <Text className="text-sm text-destructive mt-1">{error}</Text>
          )}
        </View>
      );

    case "address":
      // Address field - uses autocomplete if enabled, otherwise separate fields for better UX
      const useAutocomplete =
        Constants.expoConfig?.extra?.enableAddressAutocomplete !== false;

      if (useAutocomplete) {
        // Use AddressAutocomplete component
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
            <AddressAutocomplete
              value={String(value || "")}
              onChange={(address) => handleFieldChange(address)}
              placeholder={config.description || "Start typing an address..."}
              disabled={disabled}
              error={isInvalid}
              onFocus={onFocus}
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
      }

      // Separate fields for manual address entry (better mobile UX)
      // Parse existing value to populate fields
      const parseAddress = (
        addr: string | undefined
      ): {
        street: string;
        city: string;
        state: string;
        postcode: string;
      } => {
        if (!addr) return { street: "", city: "", state: "", postcode: "" };

        // Try to parse common Australian address formats
        // Format: "Street, City State Postcode" or "Street, City, State Postcode"
        const parts = addr.split(",").map((p) => p.trim());
        if (parts.length >= 2) {
          const street = parts[0];
          const lastPart = parts[parts.length - 1];
          // Extract state and postcode from last part (e.g., "NSW 2000" or "NSW")
          const statePostcodeMatch = lastPart.match(
            /^([A-Z]{2,3})\s*(\d{4})?$/
          );
          if (statePostcodeMatch) {
            const state = statePostcodeMatch[1] || "";
            const postcode = statePostcodeMatch[2] || "";
            const city =
              parts.length > 2
                ? parts.slice(1, -1).join(", ")
                : parts[1].replace(/^[A-Z]{2,3}\s*\d{0,4}$/, "").trim();
            return { street, city, state, postcode };
          }
          // Fallback: treat last part as city, no state/postcode
          return {
            street: parts[0],
            city: parts.slice(1).join(", "),
            state: "",
            postcode: "",
          };
        }
        // Single field - assume it's street
        return { street: addr, city: "", state: "", postcode: "" };
      };

      const [addressParts, setAddressParts] = useState(() =>
        parseAddress(String(value || ""))
      );

      // Update local state when external value changes
      useEffect(() => {
        setAddressParts(parseAddress(String(value || "")));
      }, [value]);

      const updateAddressPart = (
        part: "street" | "city" | "state" | "postcode",
        partValue: string
      ) => {
        const updated = { ...addressParts, [part]: partValue };
        setAddressParts(updated);

        // Concatenate and update parent
        const fullAddress = [
          updated.street,
          updated.city,
          updated.state && updated.postcode
            ? `${updated.state} ${updated.postcode}`
            : updated.state || updated.postcode,
        ]
          .filter(Boolean)
          .join(", ");

        handleFieldChange(fullAddress);
      };

      const renderAddressField = (
        label: string,
        part: "street" | "city" | "state" | "postcode",
        placeholder: string,
        autoComplete?:
          | "street-address"
          | "address-line1"
          | "address-line2"
          | "postal-code"
      ) => (
        <View className="mb-3">
          <Text className="text-xs font-medium text-muted-foreground mb-1.5">
            {label}
          </Text>
          <View
            className={`bg-card border rounded-xl overflow-hidden ${
              isInvalid ? "border-destructive" : "border-border"
            }`}
          >
            <View className="flex-row items-center">
              <View className="ml-3">
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={disabled ? "#6b7280" : "#9ca3af"}
                />
              </View>
              <TextInput
                className="flex-1 bg-transparent text-card-foreground px-4 py-3 text-base"
                placeholder={placeholder}
                placeholderTextColor="#6b7280"
                value={addressParts[part]}
                onChangeText={(text) => updateAddressPart(part, text)}
                onFocus={onFocus}
                editable={!disabled}
                autoCapitalize={part === "state" ? "characters" : "words"}
                autoComplete={autoComplete}
                keyboardType={part === "postcode" ? "numeric" : "default"}
                maxLength={
                  part === "state" ? 3 : part === "postcode" ? 4 : undefined
                }
                style={{ opacity: disabled ? 0.5 : 1 }}
              />
            </View>
          </View>
        </View>
      );

      return (
        <View className="mb-4">
          <View className="flex-row items-center mb-3">
            <Text className="text-sm font-medium text-foreground">
              {config.label}
              {config.required && (
                <Text className="text-destructive ml-1">*</Text>
              )}
            </Text>
          </View>
          {renderAddressField(
            "Street Address",
            "street",
            "e.g., 123 Main Street",
            "street-address"
          )}
          {renderAddressField("City", "city", "e.g., Sydney", "address-line2")}
          <View className="flex-row gap-3">
            <View className="flex-1">
              {renderAddressField(
                "State",
                "state",
                "e.g., NSW",
                "address-line1"
              )}
            </View>
            <View className="flex-1">
              {renderAddressField(
                "Postcode",
                "postcode",
                "e.g., 2000",
                "postal-code"
              )}
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
