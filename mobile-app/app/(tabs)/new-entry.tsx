import {
  GroupedBreakdownField,
  GroupedBreakdownItem,
} from "@/components/group-breakdown-field";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Select, SelectItem } from "@/components/ui/select";
import { useColleagues } from "@/hooks/use-colleagues";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useLocations } from "@/hooks/use-locations";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { FieldConfig } from "@/types/field-config";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NewEntryScreen() {
  const router = useRouter();
  const { organizationId } = useOrganization();
  const { user } = useAuth();
  const { locations } = useLocations(organizationId);
  const { colleagues } = useColleagues(organizationId);
  const { fieldConfigs, fieldValues, resetFieldValues, updateFieldValue } =
    useFieldConfigs(organizationId);

  // Find the current user's colleague ID
  const currentUserColleagueId = useMemo(() => {
    if (!user || !colleagues.length) return null;
    const currentUser = colleagues.find(
      (colleague) => colleague.auth_user_id === user.id
    );

    return currentUser?.id || null;
  }, [user, colleagues]);

  // State for colleague and location selections
  const [selectedColleagues, setSelectedColleagues] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");

  // Filter colleagues to exclude current user
  const filteredColleagues = useMemo(() => {
    if (!currentUserColleagueId) return colleagues;
    return colleagues.filter(
      (colleague) => colleague.id !== currentUserColleagueId
    );
  }, [colleagues, currentUserColleagueId]);

  useEffect(() => {
    if (
      currentUserColleagueId &&
      !selectedColleagues.includes(currentUserColleagueId)
    ) {
      setSelectedColleagues([currentUserColleagueId]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserColleagueId]);

  // Fetch field configs when organization is available
  useEffect(() => {
    if (!organizationId) {
      console.log("📋 Field Configs: Waiting for organization ID...");
      return;
    }
  }, [organizationId]);

  const handleSubmit = async () => {
    // Build submission data from field configs and values
    const submissionData: Record<string, any> = {};
    fieldConfigs.forEach((config) => {
      const value = fieldValues[config.id];
      if (config.field_type === "grouped_breakdown") {
        submissionData[config.name] = value || [];
      } else {
        submissionData[config.name] = value ?? (config.required ? null : "");
      }
    });

    // Add colleague and location to submission if selected
    if (selectedColleagues.length > 0) {
      submissionData.colleague_ids = selectedColleagues;
    }
    if (selectedLocation) {
      submissionData.location_id = selectedLocation;
    }

    console.log("📤 Form Submission:", submissionData);

    // TODO: Add actual API call here
    // For now, just show success and navigate back
    Alert.alert("Success", "Entry submitted successfully!", [
      {
        text: "OK",
        onPress: () => {
          // Reset form values
          const resetValues: Record<
            string,
            string | number | boolean | GroupedBreakdownItem[]
          > = {};
          fieldConfigs.forEach((config) => {
            if (config.field_type === "number") {
              resetValues[config.id] = 0;
            } else if (config.field_type === "boolean") {
              resetValues[config.id] = false;
            } else if (config.field_type === "grouped_breakdown") {
              resetValues[config.id] = [];
            } else if (config.field_type === "time") {
              // For time fields, reset to current time as HH:mm string
              const now = new Date();
              const hours = now.getHours().toString().padStart(2, "0");
              const minutes = now.getMinutes().toString().padStart(2, "0");
              resetValues[config.id] = `${hours}:${minutes}`;
            } else {
              resetValues[config.id] = "";
            }
          });
          resetFieldValues(resetValues);

          // Reset colleague and location selections
          // Re-add current user on reset
          if (currentUserColleagueId) {
            setSelectedColleagues([currentUserColleagueId]);
          } else {
            setSelectedColleagues([]);
          }
          setSelectedLocation("");

          // Navigate back to home
          router.push("./");
        },
      },
    ]);
  };

  const handleAddColleague = (colleagueId: string) => {
    if (!selectedColleagues.includes(colleagueId)) {
      setSelectedColleagues([...selectedColleagues, colleagueId]);
    }
  };

  const handleRemoveColleague = (colleagueId: string) => {
    // Prevent removing the current user
    if (colleagueId === currentUserColleagueId) {
      return;
    }
    setSelectedColleagues(
      selectedColleagues.filter((id) => id !== colleagueId)
    );
  };

  const getColleagueName = (colleagueId: string) => {
    const colleague = colleagues.find((c) => c.id === colleagueId);

    if (!colleague) return "";
    return (
      colleague.name.charAt(0).toUpperCase() +
      colleague.name.substring(1).toLowerCase()
    );
  };

  const renderField = (config: FieldConfig) => {
    const value = fieldValues[config.id];
    const placeholder = config.required
      ? `${config.label} *`
      : config.description || config.label;

    switch (config.field_type) {
      case "text":
      case "email":
      case "phone":
        return (
          <TextInput
            key={config.id}
            className="bg-white border-[1.5px] border-[#e0e0e0] rounded-xl px-4 py-3.5 text-base text-foreground"
            placeholder={placeholder}
            placeholderTextColor="#999"
            value={String(value || "")}
            onChangeText={(text) => updateFieldValue(config.id, text)}
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
          />
        );

      case "number":
        return (
          <TextInput
            key={config.id}
            className="bg-white border-[1.5px] border-[#e0e0e0] rounded-xl px-4 py-3.5 text-base text-foreground"
            placeholder={placeholder}
            placeholderTextColor="#999"
            value={String(value || "0")}
            onChangeText={(text) => {
              const numValue = text === "" ? 0 : Number(text) || 0;
              updateFieldValue(config.id, numValue);
            }}
            keyboardType="number-pad"
          />
        );

      case "textarea":
        return (
          <TextInput
            key={config.id}
            className="bg-white border-[1.5px] border-[#e0e0e0] rounded-xl px-4 py-3.5 pt-3.5 text-base text-foreground min-h-[100px]"
            placeholder={placeholder}
            placeholderTextColor="#999"
            value={String(value || "")}
            onChangeText={(text) => updateFieldValue(config.id, text)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        );

      case "select":
        if (!config.options || config.options.length === 0) {
          return (
            <Text key={config.id} className="text-red-500 text-sm py-2">
              No options configured for {config.label}
            </Text>
          );
        }
        // Use Select component for select fields
        return (
          <Select
            key={config.id}
            value={String(value || "")}
            onValueChange={(selectedValue) =>
              updateFieldValue(config.id, selectedValue)
            }
            placeholder={placeholder}
            size="medium"
          >
            {config.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </Select>
        );

      case "grouped_breakdown":
        return (
          <GroupedBreakdownField
            key={config.id}
            config={config}
            value={(fieldValues[config.id] as GroupedBreakdownItem[]) || []}
            onChange={(items) => updateFieldValue(config.id, items)}
          />
        );

      case "boolean":
        return (
          <View
            key={config.id}
            className="flex-row items-center justify-between py-2"
          >
            <Text className="text-base font-semibold text-foreground flex-1">
              {config.label}
            </Text>
            <Switch
              value={Boolean(value)}
              onValueChange={(newValue) =>
                updateFieldValue(config.id, newValue)
              }
              trackColor={{ false: "#767577", true: "#007AFF" }}
              thumbColor="#fff"
            />
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
          <DateTimePicker
            key={config.id}
            mode="single"
            value={isValidDate ? dateValue : undefined}
            onValueChange={(selectedDate) => {
              if (selectedDate instanceof Date) {
                // Store as ISO string for consistency
                updateFieldValue(config.id, selectedDate.toISOString());
              } else {
                updateFieldValue(config.id, "");
              }
            }}
            placeholder={placeholder}
            disabled={false}
            className="bg-white border-[1.5px] border-[#e0e0e0] rounded-xl px-4 py-3.5"
            size="md"
            variant="outline"
          />
        );

      case "time":
        // For time fields, we use today's date with the selected time
        // The date part will be ignored when submitting
        let timeValue: Date | undefined = undefined;
        if (value) {
          if (typeof value === "string" && value !== "") {
            // Try to parse as time string (HH:mm) or ISO string
            const timeMatch = value.match(/^(\d{2}):(\d{2})$/);
            if (timeMatch) {
              // Format: HH:mm
              const today = new Date();
              today.setHours(parseInt(timeMatch[1], 10));
              today.setMinutes(parseInt(timeMatch[2], 10));
              today.setSeconds(0);
              timeValue = today;
            } else {
              // Try parsing as ISO string
              const parsedDate = new Date(value);
              if (!isNaN(parsedDate.getTime())) {
                timeValue = parsedDate;
              }
            }
          }
        }

        // If no value, initialize with current time and set it as the value
        if (!timeValue) {
          timeValue = new Date();
          // Initialize the field value if it's empty
          if (!value || value === "") {
            const hours = timeValue.getHours().toString().padStart(2, "0");
            const minutes = timeValue.getMinutes().toString().padStart(2, "0");
            updateFieldValue(config.id, `${hours}:${minutes}`);
          }
        }

        return (
          <DateTimePicker
            key={config.id}
            mode="time"
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
                updateFieldValue(config.id, `${hours}:${minutes}`);
              }
            }}
            placeholder={placeholder || "Select time"}
            disabled={false}
            className="bg-white border-[1.5px] border-[#e0e0e0] rounded-xl px-4 py-3.5"
            size="lg"
            variant="outline"
          />
        );

      default:
        return (
          <Text key={config.id} className="text-red-500 text-sm py-2">
            Unknown field type: {config.field_type}
          </Text>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          className="p-4"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          {/* Colleague Select - only show if at least one colleague exists */}
          {filteredColleagues.length > 0 && (
            <View className="mb-4">
              <Text className="text-base font-semibold mb-2 text-foreground">
                Colleagues
              </Text>
              <Select
                value=""
                onValueChange={handleAddColleague}
                placeholder="Select a colleague"
                size="medium"
              >
                {filteredColleagues.map((colleague) => (
                  <SelectItem key={colleague.id} value={colleague.id}>
                    {colleague.name.charAt(0).toUpperCase() +
                      colleague.name.substring(1).toLowerCase()}
                  </SelectItem>
                ))}
              </Select>
              {/* Display selected colleagues as badges */}
              {selectedColleagues.length > 0 && (
                <View className="flex-row flex-wrap gap-2 mt-3">
                  {selectedColleagues.map((colleagueId) => (
                    <Badge
                      key={colleagueId}
                      variant="secondary"
                      className="flex-row items-center gap-1.5 px-3 py-1.5 "
                    >
                      <Text className="text-sm  font-medium text-primary-foreground">
                        {getColleagueName(colleagueId)}
                      </Text>
                      <Pressable
                        onPress={() => handleRemoveColleague(colleagueId)}
                        className="ml-1"
                      >
                        <Ionicons name="close-circle" size={16} color="#fff" />
                      </Pressable>
                    </Badge>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Location Select - only show if at least one location exists */}
          {locations.length > 0 && (
            <View className="mb-4">
              <Text className="text-base font-semibold mb-2 text-foreground ">
                Location
              </Text>
              <Select
                value={selectedLocation}
                onValueChange={setSelectedLocation}
                size="medium"
              >
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </Select>
            </View>
          )}

          {/* Dynamically render fields based on field configs */}
          {fieldConfigs.length === 0 ? (
            <View className="mb-4">
              <Text className="text-muted-foreground">Loading fields...</Text>
            </View>
          ) : (
            fieldConfigs.map((config) => (
              <View key={config.id} className="mb-4">
                {config.field_type !== "boolean" && (
                  <Text className="text-base font-semibold mb-2 text-foreground">
                    {config.label}
                    {config.required && (
                      <Text className="text-red-500"> *</Text>
                    )}
                  </Text>
                )}
                {config.description && (
                  <Text className="text-sm text-muted-foreground mb-2 italic">
                    {config.description}
                  </Text>
                )}
                {renderField(config)}
              </View>
            ))
          )}

          {/* Submit button */}
          <Pressable
            onPress={handleSubmit}
            className="bg-blue-500 rounded-xl py-4 px-8 items-center justify-center mt-6 active:bg-blue-600 active:scale-[0.98]"
          >
            <Text className="text-white text-lg font-semibold">Submit</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
