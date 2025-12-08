import { FieldRendererNativeBase } from "@/components/field-renderer-nativebase";
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
import {
  Box,
  Button,
  Divider,
  HStack,
  ScrollView,
  Text,
  VStack,
} from "native-base";
import { JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable } from "react-native";
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
    return true;
  }

  const { conditions, match_type = "all" } = logic;

  const results = conditions.map((condition) => {
    const sourceField = fieldConfigs.find((f) => f.id === condition.field_id);
    if (!sourceField) return true;

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

// Collapsible Section Component with NativeBase
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
    <Box
      bg="gray.800"
      borderRadius="2xl"
      borderWidth={1}
      borderColor="gray.700"
      mb={4}
      overflow="hidden"
      shadow={3}
    >
      <Pressable
        onPress={toggleCollapse}
        style={({ pressed }) => ({
          backgroundColor: pressed ? "#374151" : "#1f2937",
        })}
      >
        <HStack
          alignItems="center"
          justifyContent="space-between"
          p={4}
          bg="gray.750"
        >
          <VStack flex={1}>
            <Text fontSize="md" fontWeight="semibold" color="gray.100">
              {title}
            </Text>
            {description && (
              <Text fontSize="xs" color="gray.400" mt={0.5}>
                {description}
              </Text>
            )}
          </VStack>
          <HStack alignItems="center" space={2}>
            <Box bg="gray.700" px={2} py={1} borderRadius="full">
              <Text fontSize="xs" color="gray.300">
                {fieldCount}
              </Text>
            </Box>
            <Ionicons
              name={isCollapsed ? "chevron-forward" : "chevron-down"}
              size={18}
              color="#9ca3af"
            />
          </HStack>
        </HStack>
      </Pressable>
      <Animated.View style={animatedStyle}>
        <VStack p={4} space={4}>
          {children}
        </VStack>
      </Animated.View>
    </Box>
  );
}

export default function NewEntryScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<any>(null);
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

  const currentUserColleagueId = useMemo(() => {
    if (!user || !colleagues.length) return null;
    const currentUser = colleagues.find(
      (colleague) => colleague.auth_user_id === user.id
    );
    return currentUser?.id || null;
  }, [user, colleagues]);

  const [selectedColleagues, setSelectedColleagues] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");

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
  }, [currentUserColleagueId]);

  const organizedFields = useMemo(() => {
    const sectionMap = new Map<string | null, FieldConfig[]>();
    sectionMap.set(null, []);

    fieldConfigs.forEach((config) => {
      const sectionId = config.section_id;
      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, []);
      }
      sectionMap.get(sectionId)!.push(config);
    });

    return sectionMap;
  }, [fieldConfigs]);

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

    const submissionData = buildSubmissionData();

    if (selectedColleagues.length > 0) {
      submissionData.colleague_ids = selectedColleagues;
    }

    if (selectedLocation) {
      submissionData.location_id = selectedLocation;
    }

    if (!validateInputs(submissionData)) {
      setTimeout(() => {
        scrollToError();
      }, 100);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error: fetchError } = await supabase.functions.invoke(
        "create-job",
        {
          body: { submissionData },
        }
      );

      if (fetchError) {
        Alert.alert(
          "Error",
          "There was a problem on the server! Please try again later.",
          [{ text: "OK" }]
        );
        return;
      }

      if (data?.error) {
        Alert.alert("Error", data.error, [{ text: "OK" }]);
        return;
      }

      if (data?.success) {
        try {
          if (Platform.OS === "ios") {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
          }
        } catch (err) {}

        Alert.alert("Success", "Entry submitted successfully!", [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              if (currentUserColleagueId) {
                setSelectedColleagues([currentUserColleagueId]);
              } else {
                setSelectedColleagues([]);
              }
              setSelectedLocation("");
              router.push("./");
            },
          },
        ]);
      }
    } catch (err) {
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
    if (!isFieldVisible(config)) {
      return null;
    }

    const disabled = isFieldDisabled(config, fieldConfigs, fieldValues);
    const hasError = !!errors[config.name];

    return (
      <Box
        key={config.id}
        onLayout={(event) => {
          const { y } = event.nativeEvent.layout;
          fieldPositions.current[config.id] = y;
        }}
        mb={hasError ? 3 : 0}
      >
        <FieldRendererNativeBase
          config={config}
          value={fieldValues[config.id]}
          error={errors[config.name]}
          onChange={(value) => updateFieldValue(config.id, value)}
          onErrorClear={() => clearFieldError(config.name)}
          disabled={disabled}
        />
      </Box>
    );
  };

  const getVisibleFieldCount = (fields: FieldConfig[]): number => {
    return fields.filter(isFieldVisible).length;
  };

  const unsectionedFields = organizedFields.get(null) || [];

  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => a.order_position - b.order_position);
  }, [sections]);

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
    <Box flex={1} bg="gray.900">
      {/* Background gradient overlay */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg={{
          linearGradient: {
            colors: ["gray.900", "gray.800", "gray.900"],
            start: [0, 0],
            end: [1, 1],
          },
        }}
        opacity={0.3}
      />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            ref={scrollViewRef}
            flex={1}
            px={4}
            pt={4}
            pb={24}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            keyboardDismissMode="on-drag"
          >
            {/* Main Card Container */}
            <Box
              bg="gray.800"
              borderRadius="2xl"
              p={6}
              mb={4}
              shadow={5}
              borderWidth={1}
              borderColor="gray.700"
            >
              {/* Progress Indicator */}
              {!fieldsLoading && fieldConfigs.length > 0 && (
                <Box mb={6}>
                  <HStack
                    justifyContent="space-between"
                    alignItems="center"
                    mb={2}
                  >
                    <Text fontSize="sm" fontWeight="semibold" color="gray.200">
                      Form Progress
                    </Text>
                    <Text fontSize="sm" fontWeight="bold" color="primary.500">
                      {formProgress}%
                    </Text>
                  </HStack>
                  <Progress value={formProgress} />
                </Box>
              )}

              {/* Error Summary */}
              {Object.keys(errors).length > 0 && (
                <Box
                  bg="red.900"
                  borderWidth={2}
                  borderColor="red.600"
                  borderRadius="xl"
                  p={4}
                  mb={6}
                >
                  <HStack alignItems="center" space={2} mb={3}>
                    <Ionicons name="alert-circle" size={22} color="#ef4444" />
                    <Text fontSize="md" fontWeight="bold" color="red.100">
                      Please fix the following errors:
                    </Text>
                  </HStack>
                  <VStack space={2}>
                    {Object.entries(errors).map(([fieldName, errorMessage]) => {
                      const field = fieldConfigs.find(
                        (fc) => fc.name === fieldName
                      );
                      return (
                        <Text
                          key={fieldName}
                          fontSize="sm"
                          color="red.200"
                          lineHeight={5}
                        >
                          • {field?.label || fieldName}: {errorMessage}
                        </Text>
                      );
                    })}
                  </VStack>
                </Box>
              )}

              {/* Colleague Select */}
              {filteredColleagues.length > 0 && (
                <Box mb={6}>
                  <Text
                    fontSize="md"
                    fontWeight="semibold"
                    color="gray.200"
                    mb={3}
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
                  {selectedColleagues.length > 0 && (
                    <HStack flexWrap="wrap" space={2} mt={3}>
                      {selectedColleagues.map((colleagueId) => (
                        <Badge
                          key={colleagueId}
                          variant="secondary"
                          className="flex-row items-center gap-1.5 px-3 py-1.5"
                        >
                          <Text className="text-sm font-medium text-primary-foreground">
                            {getColleagueName(colleagueId)}
                          </Text>
                          <Pressable
                            onPress={() => handleRemoveColleague(colleagueId)}
                            disabled={isSubmitting}
                          >
                            <Ionicons
                              name="close-circle"
                              size={16}
                              color="#fff"
                            />
                          </Pressable>
                        </Badge>
                      ))}
                    </HStack>
                  )}
                  <Divider my={4} bg="gray.700" />
                </Box>
              )}

              {/* Location Select */}
              {locations.length > 0 && settings?.use_predefined_locations && (
                <Box mb={6}>
                  <Text
                    fontSize="md"
                    fontWeight="semibold"
                    color="gray.200"
                    mb={3}
                  >
                    Location
                  </Text>
                  <Select
                    value={selectedLocation}
                    onValueChange={setSelectedLocation}
                    size="medium"
                    placeholder="Select a location"
                  >
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </Select>
                  <Divider my={4} bg="gray.700" />
                </Box>
              )}

              {/* Dynamic Fields */}
              {fieldsLoading ? (
                <VStack space={4}>
                  {[1, 2, 3].map((i) => (
                    <VStack key={i} space={2}>
                      <Skeleton height={16} width="60%" />
                      <Skeleton height={48} fullWidth rounded />
                    </VStack>
                  ))}
                </VStack>
              ) : (
                <VStack space={4}>
                  {/* Sectioned fields */}
                  {sortedSections.map((section: FormSectionWithFields) => {
                    const sectionFields = organizedFields.get(section.id) || [];
                    const visibleCount = getVisibleFieldCount(sectionFields);

                    if (visibleCount === 0) return null;

                    return (
                      <Box key={section.id}>
                        <CollapsibleSection
                          title={section.title}
                          description={section.description}
                          fieldCount={visibleCount}
                          defaultCollapsed={section.collapsed_by_default}
                        >
                          {sectionFields.map(renderField)}
                        </CollapsibleSection>
                        <Divider my={4} bg="gray.700" />
                      </Box>
                    );
                  })}

                  {/* Unsectioned fields */}
                  {unsectionedFields.length > 0 && (
                    <>
                      {(() => {
                        const groupedFields =
                          groupFieldsByMutualExclusivity(unsectionedFields);
                        const fieldElements: JSX.Element[] = [];

                        Array.from(groupedFields.entries()).forEach(
                          ([groupId, configs]) => {
                            const visibleConfigs =
                              configs.filter(isFieldVisible);
                            if (visibleConfigs.length === 0) return;

                            if (groupId) {
                              fieldElements.push(
                                <Box key={`group-${groupId}`} mb={2} mt={4}>
                                  <Text
                                    fontSize="xs"
                                    fontWeight="semibold"
                                    color="gray.400"
                                    textTransform="uppercase"
                                    letterSpacing="wide"
                                  >
                                    Choose One: {groupId}
                                  </Text>
                                </Box>
                              );
                            }

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
                </VStack>
              )}
            </Box>
          </ScrollView>

          {/* Fixed Bottom Action Bar */}
          <Box
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            bg="gray.800"
            borderTopWidth={1}
            borderTopColor="gray.700"
            px={4}
            py={4}
            safeAreaBottom
            shadow={8}
          >
            <Button
              onPress={handleSubmit}
              isLoading={isSubmitting}
              isDisabled={isSubmitting}
              bg="primary.500"
              _pressed={{ bg: "primary.600" }}
              _disabled={{ opacity: 0.5 }}
              size="lg"
              borderRadius="xl"
              leftIcon={
                <Ionicons name="checkmark-circle" size={20} color="white" />
              }
            >
              <Text color="white" fontSize="lg" fontWeight="semibold">
                {isSubmitting ? "Submitting..." : "Submit Entry"}
              </Text>
            </Button>
          </Box>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Box>
  );
}
