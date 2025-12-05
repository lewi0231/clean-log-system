import { FieldRendererNativeBase } from "@/components/field-renderer-nativebase";
import { GroupedBreakdownItem } from "@/components/group-breakdown-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TimePicker } from "@/components/ui/time-picker";
import { useColleagues } from "@/hooks/use-colleagues";
import { useEntryForm } from "@/hooks/use-entry-form";
import {
  getFieldCluster,
  groupFieldsByMutualExclusivity,
  isFieldDisabled,
} from "@/hooks/use-field-configs";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/lib/supabase";
import { ConditionalLogic, FieldConfig } from "@/shared/types";
import { FormSectionWithFields } from "@/shared/types/form-section";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
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
  const [currentStep, setCurrentStep] = useState(0);

  // Alert dialog state
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertOnConfirm, setAlertOnConfirm] = useState<(() => void) | null>(
    null
  );

  // Time states
  const [startTime, setStartTime] = useState<Date | undefined>(undefined);
  const [finishTime, setFinishTime] = useState<Date>(() => new Date());

  const currentUserColleagueId = useMemo(() => {
    if (!user || !colleagues.length) return null;
    const currentUser = colleagues.find(
      (colleague) => colleague.auth_user_id === user.id
    );
    return currentUser?.id || null;
  }, [user, colleagues]);

  const [selectedColleagues, setSelectedColleagues] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  // Track selected clusters for mutual exclusion groups
  const [selectedClusters, setSelectedClusters] = useState<
    Record<string, string | null>
  >({});

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

  // Calculate steps: Step 0 = Basic Info, Step 1+ = Sections
  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => a.order_position - b.order_position);
  }, [sections]);

  const totalSteps = useMemo(() => {
    let steps = 1; // Step 0: Basic info
    steps += sortedSections.filter((section) => {
      const sectionFields = organizedFields.get(section.id) || [];
      return sectionFields.filter(isFieldVisible).length > 0;
    }).length;
    steps += 1; // Final step: Summary
    return steps;
  }, [sortedSections, organizedFields, isFieldVisible]);

  const getVisibleFieldCount = (fields: FieldConfig[]): number => {
    return fields.filter(isFieldVisible).length;
  };

  const handleNext = () => {
    // Don't allow proceeding from summary step
    if (isSummaryStep) {
      return;
    }

    // Validate current step before proceeding
    if (currentStep === 0) {
      // Step 0: Validate start time is required
      if (!startTime) {
        setAlertTitle("Required Field");
        setAlertMessage("Please select a start time to continue.");
        setAlertOnConfirm(null);
        setAlertOpen(true);
        return;
      }
      // Validate location is required if predefined locations are enabled
      if (settings?.use_predefined_locations && !selectedLocation) {
        setAlertTitle("Required Field");
        setAlertMessage("Please select a location to continue.");
        setAlertOnConfirm(null);
        setAlertOpen(true);
        return;
      }
      // Validate finish time is not in the future
      if (finishTime && finishTime > new Date()) {
        setAlertTitle("Invalid Time");
        setAlertMessage(
          "Finish time cannot be in the future. Please select a valid finish time."
        );
        setAlertOnConfirm(null);
        setAlertOpen(true);
        return;
      }
    }
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const submissionData = buildSubmissionData();

    if (selectedColleagues.length > 0) {
      submissionData.colleague_ids = selectedColleagues;
    }

    if (selectedLocation) {
      submissionData.location_id = selectedLocation;
    }

    // Add start and finish times
    if (startTime) {
      const hours = startTime.getHours().toString().padStart(2, "0");
      const minutes = startTime.getMinutes().toString().padStart(2, "0");
      submissionData.start_time = `${hours}:${minutes}`;
    }
    if (finishTime) {
      const hours = finishTime.getHours().toString().padStart(2, "0");
      const minutes = finishTime.getMinutes().toString().padStart(2, "0");
      submissionData.finish_time = `${hours}:${minutes}`;
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
        setIsSubmitting(false);
        setAlertTitle("Error");
        setAlertMessage(
          "There was a problem on the server! Please try again later."
        );
        setAlertOnConfirm(null);
        setAlertOpen(true);
        return;
      }

      if (data?.error) {
        setIsSubmitting(false);
        setAlertTitle("Error");
        setAlertMessage(data.error);
        setAlertOnConfirm(null);
        setAlertOpen(true);
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

        setIsSubmitting(false);
        setAlertTitle("Success");
        setAlertMessage("Entry submitted successfully!");
        setAlertOnConfirm(() => {
          // Reset form state
          resetForm();
          if (currentUserColleagueId) {
            setSelectedColleagues([currentUserColleagueId]);
          } else {
            setSelectedColleagues([]);
          }
          setSelectedLocation("");
          setStartTime(undefined);
          setFinishTime(new Date());
          setCurrentStep(0);
          setSelectedClusters({});
          // Close alert and navigate
          setAlertOpen(false);
          router.replace("./");
        });
        setAlertOpen(true);
      }
    } catch (err) {
      setIsSubmitting(false);
      setAlertTitle("Error");
      setAlertMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
      setAlertOnConfirm(null);
      setAlertOpen(true);
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

  // Format cluster name from snake_case to Title Case
  const formatClusterName = (clusterId: string): string => {
    return clusterId
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const renderField = (config: FieldConfig) => {
    if (!isFieldVisible(config)) {
      return null;
    }

    const disabled = isFieldDisabled(config, fieldConfigs, fieldValues);
    const hasError = !!errors[config.id];

    return (
      <View
        key={config.id}
        onLayout={(event) => {
          const { y } = event.nativeEvent.layout;
          fieldPositions.current[config.id] = y;
        }}
        className={hasError ? "mb-3" : ""}
      >
        <FieldRendererNativeBase
          config={config}
          value={fieldValues[config.id]}
          error={errors[config.id]}
          onChange={(value) => updateFieldValue(config.id, value)}
          onErrorClear={() => clearFieldError(config.id)}
          disabled={disabled}
        />
      </View>
    );
  };

  const scrollToError = useCallback(() => {
    const firstErrorField = fieldConfigs.find((fc) => errors[fc.id]);
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

  // Get current section for current step
  const getCurrentSection = () => {
    if (currentStep === 0) return null;
    const sectionIndex = currentStep - 1;
    const visibleSections = sortedSections.filter((section) => {
      const sectionFields = organizedFields.get(section.id) || [];
      return sectionFields.filter(isFieldVisible).length > 0;
    });
    if (sectionIndex < visibleSections.length) {
      return visibleSections[sectionIndex];
    }
    return null;
  };

  const isLastStep = currentStep === totalSteps - 1;
  const isSummaryStep = currentStep === totalSteps - 1;
  const currentSection = getCurrentSection();

  // Check if first step data is ready
  const isFirstStepReady =
    !fieldsLoading &&
    (filteredColleagues.length > 0 ||
      (locations.length > 0 && settings?.use_predefined_locations) ||
      true); // Always show time fields

  // Render Step 0: Basic Info
  const renderBasicInfoStep = () => {
    // Show skeletons while loading
    if (fieldsLoading || !isFirstStepReady) {
      return (
        <View className="flex-col gap-4">
          {/* Colleague Select Skeleton */}
          {filteredColleagues.length === 0 && (
            <View>
              <Skeleton width="40%" height={16} className="mb-2" />
              <Skeleton width="100%" height={48} rounded={false} />
            </View>
          )}

          {/* Location Select Skeleton */}
          {locations.length > 0 && settings?.use_predefined_locations && (
            <View>
              <Skeleton width="35%" height={16} className="mb-2" />
              <Skeleton width="100%" height={48} rounded={false} />
            </View>
          )}

          {/* Start Time Skeleton */}
          <View>
            <Skeleton width="45%" height={16} className="mb-2" />
            <Skeleton width="100%" height={48} rounded={false} />
          </View>

          {/* Finish Time Skeleton */}
          <View>
            <Skeleton width="50%" height={16} className="mb-2" />
            <Skeleton width="100%" height={48} rounded={false} />
          </View>
        </View>
      );
    }

    return (
      <View className="flex-col gap-4">
        {/* Colleague Select */}
        {filteredColleagues.length > 0 && (
          <View>
            <View className="mb-2">
              <Text className="text-sm font-medium text-gray-200">
                Who worked on this job?
              </Text>
            </View>
            <View className="border border-gray-700 rounded-xl overflow-hidden h-12">
              <Select
                value=""
                onValueChange={handleAddColleague}
                placeholder="Select a colleague"
                size="medium"
                triggerClassName="border-0 h-12 pl-5"
              >
                {filteredColleagues.map((colleague) => (
                  <SelectItem key={colleague.id} value={colleague.id}>
                    {colleague.name.charAt(0).toUpperCase() +
                      colleague.name.substring(1).toLowerCase()}
                  </SelectItem>
                ))}
              </Select>
            </View>
            {selectedColleagues.length > 0 && (
              <View className="flex-row flex-wrap gap-2 mt-3">
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
                      <Ionicons name="close-circle" size={16} color="#fff" />
                    </Pressable>
                  </Badge>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Location Select */}
        {locations.length > 0 && settings?.use_predefined_locations && (
          <View>
            <View className="mb-2">
              <Text className="text-sm font-medium text-gray-200">
                Where did you work?
                <Text className="text-red-400 ml-1">*</Text>
              </Text>
            </View>
            <View
              className={`border rounded-xl overflow-hidden h-12 ${
                !selectedLocation ? "border-red-500" : "border-gray-700"
              }`}
            >
              <Select
                value={selectedLocation}
                onValueChange={setSelectedLocation}
                size="medium"
                triggerClassName="border-0 h-12 pl-5"
              >
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </Select>
            </View>
            {!selectedLocation && (
              <Text className="text-sm text-red-400 mt-1">
                Location is required
              </Text>
            )}
          </View>
        )}

        {/* Start Time */}
        <View>
          <View className="mb-2">
            <Text className="text-sm font-medium text-gray-200">
              What time did you start?
              <Text className="text-red-400 ml-1">*</Text>
            </Text>
          </View>
          <View
            className={`bg-gray-800 border rounded-xl h-12 justify-center ${
              !startTime ? "border-red-500" : "border-gray-700"
            }`}
          >
            <TimePicker
              value={startTime}
              onValueChange={setStartTime}
              placeholder="Select start time"
              disabled={false}
              className="bg-transparent border-0 h-12"
              size="md"
            />
          </View>
          {!startTime && (
            <Text className="text-sm text-red-400 mt-1">
              Start time is required
            </Text>
          )}
        </View>

        {/* Finish Time */}
        <View>
          <View className="mb-2">
            <Text className="text-sm font-medium text-gray-200">
              What time did you finish?
            </Text>
          </View>
          <View
            className={`bg-gray-800 border rounded-xl h-12 justify-center ${
              finishTime && finishTime > new Date()
                ? "border-red-500"
                : "border-gray-700"
            }`}
          >
            <TimePicker
              value={finishTime}
              onValueChange={(value) => {
                if (value) {
                  setFinishTime(value);
                }
              }}
              placeholder="Select finish time"
              disabled={false}
              className="bg-transparent border-0 h-12"
              size="md"
            />
          </View>
          <Text className="text-xs text-gray-400 mt-1">
            Defaults to current time
          </Text>
          {finishTime && finishTime > new Date() && (
            <Text className="text-sm text-red-400 mt-1">
              Finish time cannot be in the future
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Render Section Step
  const renderSectionStep = (section: FormSectionWithFields) => {
    const sectionFields = organizedFields.get(section.id) || [];
    const visibleFields = sectionFields.filter(isFieldVisible);

    // Group fields by mutual exclusion groups
    const mutualExclusionGroups = groupFieldsByMutualExclusivity(visibleFields);
    const regularFields: FieldConfig[] = [];
    const groupedFields = new Map<string, FieldConfig[]>();

    visibleFields.forEach((field) => {
      if (field.mutually_exclusive_group) {
        const groupId = field.mutually_exclusive_group;
        if (!groupedFields.has(groupId)) {
          groupedFields.set(groupId, []);
        }
        groupedFields.get(groupId)!.push(field);
      } else {
        regularFields.push(field);
      }
    });

    // Get unique clusters for each mutual exclusion group
    const getClustersForGroup = (groupId: string): string[] => {
      const fields = groupedFields.get(groupId) || [];
      const clusters = new Set<string>();
      fields.forEach((field) => {
        const cluster = getFieldCluster(field);
        if (cluster) {
          clusters.add(cluster);
        }
      });
      return Array.from(clusters).sort();
    };

    // Handle cluster selection
    const handleClusterSelect = (groupId: string, clusterId: string | null) => {
      setSelectedClusters((prev) => ({
        ...prev,
        [groupId]: clusterId,
      }));

      // Clear values from other clusters in the same group
      const fields = groupedFields.get(groupId) || [];
      fields.forEach((field) => {
        const fieldCluster = getFieldCluster(field);
        if (fieldCluster !== clusterId) {
          // Clear the field value based on its type
          if (field.field_type === "boolean") {
            updateFieldValue(field.id, false);
          } else if (field.field_type === "number") {
            updateFieldValue(field.id, 0);
          } else if (field.field_type === "grouped_breakdown") {
            updateFieldValue(field.id, []);
          } else {
            updateFieldValue(field.id, "");
          }
        }
      });
    };

    return (
      <View className="flex-col gap-4">
        <View className="mb-2">
          <Text className="text-lg font-bold text-gray-100 mb-1">
            {section.title}
          </Text>
          {section.description && (
            <Text className="text-sm text-gray-400">{section.description}</Text>
          )}
        </View>

        {/* Render mutual exclusion groups with select dropdowns */}
        {Array.from(groupedFields.keys()).map((groupId) => {
          const fields = groupedFields.get(groupId) || [];
          const clusters = getClustersForGroup(groupId);
          const selectedCluster = selectedClusters[groupId] || null;

          // Get the first field to use its group name for the label
          const firstField = fields[0];
          const groupLabel =
            firstField.mutually_exclusive_group
              ?.split("_")
              .map(
                (word) =>
                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              )
              .join(" ") || "Select Option";

          return (
            <View key={groupId} className="mb-4">
              <View className="mb-2">
                <Text className="text-sm font-medium text-gray-200">
                  {groupLabel}
                </Text>
              </View>
              <View className="border border-gray-700 rounded-xl overflow-hidden h-12">
                <Select
                  value={selectedCluster || ""}
                  onValueChange={(value) =>
                    handleClusterSelect(groupId, value || null)
                  }
                  placeholder={`Select ${groupLabel}`}
                  size="medium"
                  triggerClassName="border-0 h-12 pl-5"
                >
                  {clusters.map((clusterId) => (
                    <SelectItem key={clusterId} value={clusterId}>
                      {formatClusterName(clusterId)}
                    </SelectItem>
                  ))}
                </Select>
              </View>

              {/* Render fields only for the selected cluster */}
              {selectedCluster &&
                fields
                  .filter((field) => getFieldCluster(field) === selectedCluster)
                  .map(renderField)}
            </View>
          );
        })}

        {/* Render regular fields (not in mutual exclusion groups) */}
        {regularFields.map(renderField)}
      </View>
    );
  };

  // Format field value for display
  const formatFieldValue = (
    config: FieldConfig,
    value: string | number | boolean | GroupedBreakdownItem[] | undefined
  ): string => {
    if (value === undefined || value === null || value === "") {
      return "Not provided";
    }

    switch (config.field_type) {
      case "boolean":
        return value ? "Yes" : "No";
      case "date":
        if (typeof value === "string") {
          try {
            const date = new Date(value);
            return date.toLocaleDateString();
          } catch {
            return String(value);
          }
        }
        return String(value);
      case "time":
        if (typeof value === "string") {
          return value; // Already in HH:mm format
        }
        return String(value);
      case "grouped_breakdown":
        if (Array.isArray(value)) {
          if (value.length === 0) return "None";
          return value
            .map((item) => `${item.brand}: ${item.quantity}`)
            .join(", ");
        }
        return "None";
      case "select":
        return String(value);
      default:
        return String(value);
    }
  };

  // Render Summary Step
  const renderSummaryStep = () => {
    const allVisibleSections = sortedSections.filter((section) => {
      const sectionFields = organizedFields.get(section.id) || [];
      return sectionFields.filter(isFieldVisible).length > 0;
    });

    return (
      <View className="flex-col gap-4">
        <View className="mb-4">
          <Text className="text-xl font-bold text-gray-100 mb-2">
            Review Your Entry
          </Text>
          <Text className="text-sm text-gray-400">
            Please review all information before submitting
          </Text>
        </View>

        {/* Basic Info Section */}
        <View className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <Text className="text-lg font-semibold text-gray-100 mb-3">
            Basic Information
          </Text>
          <View className="flex-col gap-3">
            {/* Colleagues */}
            {selectedColleagues.length > 0 && (
              <View>
                <Text className="text-sm text-gray-400 mb-1">
                  Who worked on this job?
                </Text>
                <Text className="text-base text-gray-100">
                  {selectedColleagues
                    .map((id) => getColleagueName(id))
                    .join(", ")}
                </Text>
              </View>
            )}

            {/* Location */}
            {selectedLocation && (
              <View>
                <Text className="text-sm text-gray-400 mb-1">
                  Where did you work?
                </Text>
                <Text className="text-base text-gray-100">
                  {locations.find((l) => l.id === selectedLocation)?.name ||
                    selectedLocation}
                </Text>
              </View>
            )}

            {/* Start Time */}
            {startTime && (
              <View>
                <Text className="text-sm text-gray-400 mb-1">Start Time</Text>
                <Text className="text-base text-gray-100">
                  {startTime.getHours().toString().padStart(2, "0")}:
                  {startTime.getMinutes().toString().padStart(2, "0")}
                </Text>
              </View>
            )}

            {/* Finish Time */}
            {finishTime && (
              <View>
                <Text className="text-sm text-gray-400 mb-1">Finish Time</Text>
                <Text className="text-base text-gray-100">
                  {finishTime.getHours().toString().padStart(2, "0")}:
                  {finishTime.getMinutes().toString().padStart(2, "0")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Field Sections */}
        {allVisibleSections.map((section) => {
          const sectionFields = organizedFields.get(section.id) || [];
          const visibleFields = sectionFields.filter(isFieldVisible);

          if (visibleFields.length === 0) return null;

          return (
            <View
              key={section.id}
              className="bg-gray-800 rounded-xl p-4 border border-gray-700"
            >
              <Text className="text-lg font-semibold text-gray-100 mb-3">
                {section.title}
              </Text>
              {section.description && (
                <Text className="text-sm text-gray-400 mb-3">
                  {section.description}
                </Text>
              )}
              <View className="flex-col gap-3">
                {visibleFields.map((config) => {
                  const value = fieldValues[config.id];
                  const displayValue = formatFieldValue(config, value);

                  return (
                    <View key={config.id}>
                      <Text className="text-sm text-gray-400 mb-1">
                        {config.label}
                        {config.required && (
                          <Text className="text-red-400 ml-1">*</Text>
                        )}
                      </Text>
                      <Text className="text-base text-gray-100">
                        {displayValue}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const progressPercentage = ((currentStep + 1) / totalSteps) * 100;

  return (
    <View className="flex-1 bg-gray-900">
      {/* Background gradient overlay */}
      <View className="absolute inset-0 bg-gray-900 opacity-30" />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Progress Bar at Top */}
        <View className="bg-gray-800 border-b border-gray-700 px-4 pt-3 pb-3">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm font-semibold text-gray-200">
              Step {currentStep + 1} of {totalSteps}
            </Text>
            <Text className="text-sm font-bold text-primary-500">
              {Math.round(progressPercentage)}%
            </Text>
          </View>
          <Progress value={progressPercentage} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-4 pt-4"
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            keyboardDismissMode="on-drag"
          >
            {/* Main Card Container */}
            <View className="bg-gray-800 rounded-2xl p-6 mb-10 border border-gray-700 shadow-lg">
              {/* Error Summary */}
              {Object.keys(errors).length > 0 && (
                <View className="bg-red-900 border-2 border-red-600 rounded-xl p-4 mb-6">
                  <View className="flex-row items-center gap-2 mb-3">
                    <Ionicons name="alert-circle" size={22} color="#ef4444" />
                    <Text className="text-base font-bold text-red-100">
                      Please fix the following errors:
                    </Text>
                  </View>
                  <View className="flex-col gap-2">
                    {Object.entries(errors).map(([fieldId, errorMessage]) => {
                      const field = fieldConfigs.find(
                        (fc) => fc.id === fieldId
                      );
                      return (
                        <Text
                          key={fieldId}
                          className="text-sm text-red-200 leading-5"
                        >
                          • {field?.label || fieldId}: {errorMessage}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Dynamic Fields */}
              {fieldsLoading ? (
                <View className="flex-col gap-4">
                  {[1, 2, 3].map((i) => (
                    <View key={i} className="flex-col gap-2">
                      <Skeleton height={16} width="60%" />
                      <Skeleton height={48} fullWidth rounded />
                    </View>
                  ))}
                </View>
              ) : (
                <>
                  {currentStep === 0 && renderBasicInfoStep()}
                  {currentStep > 0 &&
                    currentStep < totalSteps - 1 &&
                    currentSection &&
                    renderSectionStep(currentSection as FormSectionWithFields)}
                  {currentStep === totalSteps - 1 && renderSummaryStep()}
                </>
              )}
            </View>
          </ScrollView>

          {/* Fixed Bottom Action Bar */}
          <View className="absolute bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-4 py-4 shadow-2xl">
            <View className="flex-row gap-3">
              {/* Previous Button - shown on all steps except first */}
              {currentStep > 0 && (
                <Button
                  onPress={handlePrevious}
                  disabled={isSubmitting}
                  variant="secondary"
                  size="lg"
                  className="flex-1 bg-gray-700"
                >
                  <Ionicons name="chevron-back" size={20} color="white" />
                  <Text className="text-white text-base font-semibold">
                    Previous
                  </Text>
                </Button>
              )}
              {/* Next Button - shown on all steps except last */}
              {!isLastStep && (
                <Button
                  onPress={handleNext}
                  disabled={isSubmitting}
                  variant="default"
                  size="lg"
                  className="flex-1"
                >
                  <Text className="text-white text-base font-semibold">
                    Next
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="white" />
                </Button>
              )}
              {/* Submit Button - shown only on last step */}
              {isLastStep && (
                <Button
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  variant="default"
                  size="lg"
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                  )}
                  <Text className="text-white text-base font-semibold">
                    {isSubmitting ? "Submitting..." : "Submit Entry"}
                  </Text>
                </Button>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Alert Dialog */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
            <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>
              <Pressable
                onPress={() => {
                  if (alertOnConfirm) {
                    alertOnConfirm();
                  }
                  setAlertOpen(false);
                }}
                className="bg-primary-500 active:bg-primary-600 px-6 py-3 rounded-lg"
              >
                <Text className="text-white text-base font-semibold">OK</Text>
              </Pressable>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
