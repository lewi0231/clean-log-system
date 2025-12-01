import { FieldRenderer } from "@/components/field-renderer";
import { Badge } from "@/components/ui/badge";
import { Select, SelectItem } from "@/components/ui/select";
import { useColleagues } from "@/hooks/use-colleagues";
import { useEntryForm } from "@/hooks/use-entry-form";
import {
  groupFieldsByMutualExclusivity,
  isFieldDisabled,
} from "@/hooks/use-field-configs";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/lib/supabase";
import { ConditionalLogic, FieldConfig } from "@/shared/types";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// Helper to evaluate conditional logic
function evaluateCondition(
  logic: ConditionalLogic | null,
  fieldValues: Record<string, string | number | boolean | unknown>,
  fieldConfigs: FieldConfig[]
): boolean {
  if (!logic || !logic.conditions || logic.conditions.length === 0) {
    return true; // No conditions = always visible
  }

  const { conditions, match_type = "all" } = logic;

  const results = conditions.map((condition) => {
    // Find the source field
    const sourceField = fieldConfigs.find((f) => f.id === condition.field_id);
    if (!sourceField) return true; // If field not found, show by default

    const sourceValue = fieldValues[sourceField.id];

    switch (condition.operator) {
      case "equals":
        return sourceValue === condition.value;
      case "not_equals":
        return sourceValue !== condition.value;
      case "is_empty":
        return (
          sourceValue === undefined ||
          sourceValue === null ||
          sourceValue === "" ||
          sourceValue === 0
        );
      case "is_not_empty":
        return (
          sourceValue !== undefined &&
          sourceValue !== null &&
          sourceValue !== "" &&
          sourceValue !== 0
        );
      case "contains":
        return String(sourceValue || "").includes(String(condition.value));
      case "greater_than":
        return Number(sourceValue) > Number(condition.value);
      case "less_than":
        return Number(sourceValue) < Number(condition.value);
      default:
        return true;
    }
  });

  return match_type === "all" ? results.every(Boolean) : results.some(Boolean);
}

// Collapsible Section Component
interface CollapsibleSectionProps {
  title: string;
  description?: string | null;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  fieldCount: number;
}

function CollapsibleSection({
  title,
  description,
  children,
  defaultCollapsed = false,
  fieldCount,
}: CollapsibleSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const animatedHeight = useSharedValue(defaultCollapsed ? 0 : 1);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
    animatedHeight.value = withTiming(isCollapsed ? 1 : 0, { duration: 200 });
  }, [isCollapsed, animatedHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: animatedHeight.value,
    maxHeight: animatedHeight.value === 0 ? 0 : undefined,
    overflow: "hidden",
  }));

  return (
    <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
      <Pressable
        onPress={toggleCollapse}
        className="flex-row items-center justify-between p-4 bg-gray-50 active:bg-gray-100"
      >
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">
            {title}
          </Text>
          {description && (
            <Text className="text-xs text-muted-foreground mt-0.5">
              {description}
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <View className="bg-gray-200 px-2 py-0.5 rounded-full">
            <Text className="text-xs text-gray-600">{fieldCount}</Text>
          </View>
          <Ionicons
            name={isCollapsed ? "chevron-forward" : "chevron-down"}
            size={18}
            color="#6b7280"
          />
        </View>
      </Pressable>
      <Animated.View style={animatedStyle}>
        <View className="p-4 space-y-4">{children}</View>
      </Animated.View>
    </View>
  );
}

export default function NewEntryScreen() {
  const router = useRouter();
  const { organizationId } = useOrganization();
  const { settings } = useOrganizationSettings(organizationId);
  const { user } = useAuth();
  const { locations } = useLocations(organizationId);
  const { colleagues } = useColleagues(organizationId);
  const {
    fieldConfigs,
    fieldValues,
    errors,
    updateFieldValue,
    buildSubmissionData,
    validateInputs,
    resetForm,
    clearFieldError,
  } = useEntryForm({ organizationId });

  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Group fields by section
  const organizedFields = useMemo(() => {
    const sectionMap = new Map<string | null, FieldConfig[]>();
    sectionMap.set(null, []); // Unsectioned fields

    fieldConfigs.forEach((config) => {
      const sectionId = config.section_id;
      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, []);
      }
      sectionMap.get(sectionId)!.push(config);
    });

    return sectionMap;
  }, [fieldConfigs]);

  // Check if a field should be visible based on conditional logic
  const isFieldVisible = useCallback(
    (field: FieldConfig): boolean => {
      return evaluateCondition(
        field.conditional_logic,
        fieldValues,
        fieldConfigs
      );
    },
    [fieldValues, fieldConfigs]
  );

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Build submission data from field configs and values
    const submissionData = buildSubmissionData();

    // Add colleague and location to submission if selected
    if (selectedColleagues.length > 0) {
      submissionData.colleague_ids = selectedColleagues;
    }

    if (selectedLocation) {
      submissionData.location_id = selectedLocation;
    }

    if (!validateInputs(submissionData)) return;

    console.log(
      "📤 Form Submission: submitting to edge function",
      submissionData
    );

    setIsSubmitting(true);
    try {
      const { data, error: fetchError } = await supabase.functions.invoke(
        "create-job",
        {
          body: { submissionData },
        }
      );

      if (fetchError) {
        const errorMessage =
          fetchError.message ||
          "There was a problem on the server!  Please try again later.";
        console.error("Form Submission: Failed", fetchError);
        Alert.alert(
          "Error",
          "There was a problem on the server! Please try again later.",
          [
            {
              text: "OK",
            },
          ]
        );
        return;
      }

      if (data?.error) {
        console.error("Form submission: Server error", data.error);
        Alert.alert("Error", data.error, [
          {
            text: "OK",
          },
        ]);
        return;
      }

      if (data?.success) {
        // For now, just show success and navigate back
        Alert.alert("Success", "Entry submitted successfully!", [
          {
            text: "OK",
            onPress: () => {
              // Reset form values
              resetForm();

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
      }
    } catch (err) {
      console.error("Form Submission: Failed.", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      Alert.alert(
        "Error",
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsSubmitting(false);
    }
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

  // Render a single field
  const renderField = (config: FieldConfig) => {
    // Check conditional visibility
    if (!isFieldVisible(config)) {
      return null;
    }

    const disabled = isFieldDisabled(config, fieldConfigs, fieldValues);

    return (
      <View key={config.id} className="mb-4">
        {config.field_type !== "boolean" && (
          <Text
            className={`text-base font-semibold mb-2 ${
              disabled ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {config.label}
            {config.required && <Text className="text-red-500"> *</Text>}
            {disabled && (
              <Text className="text-xs text-muted-foreground ml-2">
                (locked - another method selected)
              </Text>
            )}
          </Text>
        )}
        {config.description && (
          <Text className="text-sm text-muted-foreground mb-2 italic">
            {config.description}
          </Text>
        )}
        <FieldRenderer
          config={config}
          value={fieldValues[config.id]}
          error={errors[config.name]}
          onChange={(value) => updateFieldValue(config.id, value)}
          onErrorClear={() => clearFieldError(config.name)}
          disabled={disabled}
        />
      </View>
    );
  };

  // Get visible field count for a section
  const getVisibleFieldCount = (fields: FieldConfig[]): number => {
    return fields.filter(isFieldVisible).length;
  };

  // Get unsectioned fields
  const unsectionedFields = organizedFields.get(null) || [];

  // Get unique sections from field configs
  const sections = useMemo(() => {
    const sectionIds = new Set<string>();
    fieldConfigs.forEach((config) => {
      if (config.section_id) {
        sectionIds.add(config.section_id);
      }
    });
    return Array.from(sectionIds);
  }, [fieldConfigs]);

  return (
    <SafeAreaView className="flex-1 bg-background px-4 py-4" edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          contentContainerClassName=""
        >
          {/* Colleague Select - only show if at least one colleague exists */}
          {filteredColleagues.length > 0 && (
            <View className="mb-4">
              <Text className="text-base font-semibold mb-2 text-foreground">
                Who did you work with?
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
                        className=""
                        disabled={isSubmitting}
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
          {locations.length > 0 && settings?.use_predefined_locations && (
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
            <>
              {/* Render sectioned fields */}
              {sections.map((sectionId) => {
                const sectionFields = organizedFields.get(sectionId) || [];
                const visibleCount = getVisibleFieldCount(sectionFields);

                if (visibleCount === 0) return null;

                // For now, use section ID as title (will be enhanced with section metadata later)
                const sectionTitle =
                  sectionId
                    .replace(/-/g, " ")
                    .replace(/section/i, "")
                    .trim() || "Section";

                return (
                  <CollapsibleSection
                    key={sectionId}
                    title={sectionTitle}
                    fieldCount={visibleCount}
                    defaultCollapsed={false}
                  >
                    {sectionFields.map(renderField)}
                  </CollapsibleSection>
                );
              })}

              {/* Render unsectioned fields with mutual exclusivity grouping */}
              {unsectionedFields.length > 0 && (
                <>
                  {(() => {
                    const groupedFields =
                      groupFieldsByMutualExclusivity(unsectionedFields);
                    const fieldElements: JSX.Element[] = [];

                    // Render grouped fields
                    Array.from(groupedFields.entries()).forEach(
                      ([groupId, configs]) => {
                        // Filter out invisible fields
                        const visibleConfigs = configs.filter(isFieldVisible);
                        if (visibleConfigs.length === 0) return;

                        if (groupId) {
                          // Add group separator
                          fieldElements.push(
                            <View
                              key={`group-${groupId}`}
                              className="mb-2 mt-4"
                            >
                              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Choose One: {groupId}
                              </Text>
                            </View>
                          );
                        }

                        // Render fields in this group
                        visibleConfigs.forEach((config) => {
                          const element = renderField(config);
                          if (element) {
                            fieldElements.push(element);
                          }
                        });
                      }
                    );

                    return fieldElements;
                  })()}
                </>
              )}
            </>
          )}

          {/* Submit button */}
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            className={`bg-blue-500 rounded-xl py-4 px-8 items-center justify-center mt-6 active:bg-blue-600 active:scale-[0.98] ${
              isSubmitting ? "opacity-50" : ""
            }`}
          >
            <Text className="text-white text-lg font-semibold">
              {isSubmitting ? "Submitting..." : "Submit"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
