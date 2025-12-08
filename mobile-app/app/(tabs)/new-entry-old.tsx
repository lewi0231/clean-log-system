import { FieldRenderer } from "@/components/field-renderer";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ConditionalLogic, FieldConfig } from "@clean-log/shared/types";
import { FormSectionWithFields } from "@clean-log/shared/types/form-section";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
        accessibilityRole="button"
        accessibilityLabel={`${
          isCollapsed ? "Expand" : "Collapse"
        } ${title} section`}
        accessibilityState={{ expanded: !isCollapsed }}
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
        <View className="p-4 space-y-4" style={{ gap: 16 }}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

export default function NewEntryScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const fieldPositions = useRef<Record<string, number>>({});
  const { organizationId } = useOrganization();
  const { settings } = useOrganizationSettings(organizationId);
  const { user } = useAuth();
  const { locations } = useLocations(organizationId);
  const { colleagues } = useColleagues(organizationId);
  const {
    fieldConfigs,
    fieldValues,
    sections,
    loading: fieldsLoading,
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

    if (!validateInputs(submissionData)) {
      // Scroll to first error after a short delay to allow state update
      setTimeout(() => {
        scrollToError();
      }, 100);
      return;
    }

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
        // Show success with haptic feedback
        try {
          if (Platform.OS === "ios") {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
          }
        } catch (err) {
          // Haptics not available, continue without it
        }

        // Show success message briefly before navigating
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

    const hasError = !!errors[config.name];

    return (
      <View
        key={config.id}
        onLayout={(event) => {
          const { y } = event.nativeEvent.layout;
          fieldPositions.current[config.id] = y;
        }}
        className={`mb-5 ${
          hasError
            ? "border-l-4 border-red-500 pl-3 bg-red-50/30 rounded-r-lg py-2"
            : ""
        }`}
      >
        {config.field_type !== "boolean" && (
          <View className="flex-row items-center gap-2 mb-2">
            <Text
              className={`text-base font-semibold ${
                disabled ? "text-muted-foreground" : "text-foreground"
              }`}
              accessibilityRole="header"
            >
              {config.label}
              {config.required && <Text className="text-red-500"> *</Text>}
            </Text>
            {hasError && (
              <Ionicons
                name="alert-circle"
                size={16}
                color="#DC2626"
                accessibilityLabel="Error indicator"
              />
            )}
            {disabled && (
              <Text
                className="text-xs text-muted-foreground ml-2"
                accessibilityLabel="Field is locked because another method is selected"
              >
                (locked - another method selected)
              </Text>
            )}
          </View>
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

  // Get sections sorted by order_position (already sorted from hook, but ensure)
  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => a.order_position - b.order_position);
  }, [sections]);

  // Calculate form completion percentage
  const formProgress = useMemo(() => {
    if (fieldConfigs.length === 0) return 0;
    const requiredFields = fieldConfigs.filter((fc) => fc.required);
    if (requiredFields.length === 0) return 100;

    const filledRequiredFields = requiredFields.filter((fc) => {
      const value = fieldValues[fc.id];
      if (fc.field_type === "number") {
        return typeof value === "number" && value > 0;
      } else if (fc.field_type === "boolean") {
        return value === true;
      } else if (fc.field_type === "grouped_breakdown") {
        return Array.isArray(value) && value.length > 0;
      } else {
        return typeof value === "string" && value.trim().length > 0;
      }
    });

    // Also check location if required
    const locationFilled =
      !settings?.use_predefined_locations || selectedLocation !== "";

    const totalRequired =
      requiredFields.length + (settings?.use_predefined_locations ? 1 : 0);
    const filled = filledRequiredFields.length + (locationFilled ? 1 : 0);

    return Math.round((filled / totalRequired) * 100);
  }, [
    fieldConfigs,
    fieldValues,
    settings?.use_predefined_locations,
    selectedLocation,
  ]);

  // Scroll to first error field
  const scrollToError = useCallback(() => {
    const firstErrorField = fieldConfigs.find((fc) => errors[fc.name]);
    if (
      firstErrorField &&
      fieldPositions.current[firstErrorField.id] !== undefined
    ) {
      const y = fieldPositions.current[firstErrorField.id];
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, y - 50),
        animated: true,
      });
    }
  }, [fieldConfigs, errors]);

  return (
    <SafeAreaView className="flex-1 bg-background px-4 py-4" edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          contentContainerClassName="pb-4"
          showsVerticalScrollIndicator={true}
          keyboardDismissMode="on-drag"
        >
          {/* Progress Indicator */}
          {!fieldsLoading && fieldConfigs.length > 0 && (
            <View className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-semibold text-foreground">
                  Form Progress
                </Text>
                <Text className="text-sm font-bold text-blue-600">
                  {formProgress}%
                </Text>
              </View>
              <Progress value={formProgress} />
            </View>
          )}

          {/* Error Summary */}
          {Object.keys(errors).length > 0 && (
            <View className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-xl shadow-sm">
              <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="alert-circle" size={22} color="#DC2626" />
                <Text className="text-base font-bold text-red-900">
                  Please fix the following errors:
                </Text>
              </View>
              <View style={{ gap: 8 }}>
                {Object.entries(errors).map(([fieldName, errorMessage]) => {
                  const field = fieldConfigs.find(
                    (fc) => fc.name === fieldName
                  );
                  return (
                    <Text
                      key={fieldName}
                      className="text-sm text-red-800 leading-5"
                    >
                      • {field?.label || fieldName}: {errorMessage}
                    </Text>
                  );
                })}
              </View>
            </View>
          )}
          {/* Colleague Select - only show if at least one colleague exists */}
          {filteredColleagues.length > 0 && (
            <View className="mb-4">
              <Text
                className="text-base font-semibold mb-2 text-foreground"
                accessibilityRole="header"
              >
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
              <Text
                className="text-base font-semibold mb-2 text-foreground"
                accessibilityRole="header"
              >
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
          {fieldsLoading ? (
            <View className="mb-4 space-y-4">
              {/* Skeleton loaders for form fields */}
              {[1, 2, 3].map((i) => (
                <View key={i} className="space-y-2">
                  <Skeleton height={16} width="60%" />
                  <Skeleton height={48} fullWidth rounded />
                </View>
              ))}
            </View>
          ) : (
            <>
              {/* Render sectioned fields */}
              {sortedSections.map((section: FormSectionWithFields) => {
                const sectionFields = organizedFields.get(section.id) || [];
                const visibleCount = getVisibleFieldCount(sectionFields);

                if (visibleCount === 0) return null;

                return (
                  <CollapsibleSection
                    key={section.id}
                    title={section.title}
                    description={section.description}
                    fieldCount={visibleCount}
                    defaultCollapsed={section.collapsed_by_default}
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
            className={`bg-blue-500 rounded-xl py-4 px-8 items-center justify-center mt-6 mb-6 active:bg-blue-600 active:scale-[0.98] shadow-lg ${
              isSubmitting ? "opacity-50" : ""
            }`}
            accessibilityRole="button"
            accessibilityLabel={
              isSubmitting ? "Submitting form" : "Submit form"
            }
            accessibilityState={{ disabled: isSubmitting }}
            accessibilityHint="Submits the current form entry"
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
