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
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useColleagues } from "@/hooks/use-colleagues";
import { useCurrentWorker } from "@/hooks/use-current-worker";
import { useEntryForm } from "@/hooks/use-entry-form";
import {
  getFieldCluster,
  groupFieldsByMutualExclusivity,
  hasValue,
  isFieldDisabled,
} from "@/hooks/use-field-configs";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useUserRole } from "@/hooks/use-user-role";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/lib/supabase";
import { ConditionalLogic, FieldConfig } from "@clean-log/shared/types";
import { FormSectionWithFields } from "@clean-log/shared/types/form-section";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
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
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/0d1ba94f-1dd7-415c-b280-fce28d1bc840", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "new-entry.tsx:102",
      message: "Component rendering/mounting",
      data: {},
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion
  const scrollViewRef = useRef<any>(null);
  const fieldPositions = useRef<Record<string, number>>({});
  const { organizationId } = useOrganization();
  const { settings } = useOrganizationSettings(organizationId);
  const { user } = useAuth();
  const { worker } = useCurrentWorker();
  const { isAdmin } = useUserRole();
  const { locations } = useLocations(organizationId);
  const { colleagues } = useColleagues(organizationId);
  const [selectedColleagues, setSelectedColleagues] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");

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
  } = useEntryForm({ organizationId, locationId: selectedLocation });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Alert dialog management
  const {
    alertOpen,
    alertTitle,
    alertMessage,
    showAlert,
    showSuccessAndNavigate,
    handleDialogChange,
    handleOkPress,
  } = useAlertDialog();

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Time states
  const [startTime, setStartTime] = useState<Date | undefined>(undefined);
  const [finishTime, setFinishTime] = useState<Date>(() => new Date());

  // Per-worker time entry state
  const [useIndividualTimes, setUseIndividualTimes] = useState(false);
  const [workerTimes, setWorkerTimes] = useState<
    Record<string, { startTime: Date | undefined; finishTime: Date | undefined }>
  >({});

  const currentUserColleagueId = useMemo(() => {
    if (!user || !colleagues.length) return null;
    const currentUser = colleagues.find(
      (colleague) => colleague.auth_user_id === user.id
    );
    return currentUser?.id || null;
  }, [user, colleagues]);

  // Track selected clusters for mutual exclusion groups
  const [selectedClusters, setSelectedClusters] = useState<
    Record<string, string | null>
  >({});

  // Track touched fields for validation UX (only show errors after interaction)
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const markFieldAsTouched = (fieldId: string) => {
    setTouchedFields((prev) => new Set(prev).add(fieldId));
  };

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

  // Sync worker times when colleagues change or shared times change
  useEffect(() => {
    if (selectedColleagues.length > 0) {
      setWorkerTimes((prev) => {
        const updated = { ...prev };
        selectedColleagues.forEach((id) => {
          if (!updated[id]) {
            // Initialize with shared times as default
            updated[id] = {
              startTime: startTime,
              finishTime: finishTime,
            };
          }
        });
        // Remove times for colleagues no longer selected
        Object.keys(updated).forEach((id) => {
          if (!selectedColleagues.includes(id)) {
            delete updated[id];
          }
        });
        return updated;
      });
    }
  }, [selectedColleagues, startTime, finishTime]);

  // Handle individual worker time change
  const handleWorkerTimeChange = (
    workerId: string,
    timeType: "startTime" | "finishTime",
    value: Date | undefined
  ) => {
    setWorkerTimes((prev) => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        [timeType]: value,
      },
    }));
  };

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
      // Validate location is required if predefined locations are enabled
      if (settings?.use_predefined_locations && !selectedLocation) {
        showAlert("Required Field", "Please select a location to continue.");
        return;
      }

      // Validate times based on whether using individual times or shared times
      if (useIndividualTimes && selectedColleagues.length > 1) {
        // Validate per-worker times
        for (const colleagueId of selectedColleagues) {
          const times = workerTimes[colleagueId];
          const colleagueName = getColleagueName(colleagueId);
          const isCurrentUser = colleagueId === currentUserColleagueId;
          const displayName = isCurrentUser ? "your" : `${colleagueName}'s`;

          if (!times?.startTime) {
            showAlert(
              "Required Field",
              `Please select ${displayName} start time to continue.`
            );
            return;
          }
          if (times.finishTime && times.finishTime > new Date()) {
            showAlert(
              "Invalid Time",
              `${isCurrentUser ? "Your" : colleagueName + "'s"} finish time cannot be in the future.`
            );
            return;
          }
          if (times.startTime && times.finishTime && times.startTime > times.finishTime) {
            showAlert(
              "Invalid Time",
              `${isCurrentUser ? "Your" : colleagueName + "'s"} start time cannot be after finish time.`
            );
            return;
          }
        }
      } else {
        // Validate shared times (original behavior)
        if (!startTime) {
          showAlert("Required Field", "Please select a start time to continue.");
          return;
        }
        if (finishTime && finishTime > new Date()) {
          showAlert(
            "Invalid Time",
            "Finish time cannot be in the future. Please select a valid finish time."
          );
          return;
        }
        if (startTime && finishTime && startTime > finishTime) {
          showAlert(
            "Invalid Time",
            "Start time cannot be after finish time. Please select a valid start time."
          );
          return;
        }
      }
      // Validate required fields in step 0 (fields with section_id === null)
      const basicInfoFields = organizedFields.get(null) || [];
      const visibleBasicFields = basicInfoFields.filter(isFieldVisible);
      for (const config of visibleBasicFields) {
        if (config.required) {
          const value = fieldValues[config.id];
          if (!hasValue(value, config.field_type, config)) {
            // Mark field as touched to show error
            markFieldAsTouched(config.id);
            showAlert(
              "Required Field",
              `Please fill in ${config.label} to continue.`
            );
            return;
          }
        }
      }
    } else if (currentStep > 0 && currentStep < totalSteps - 1) {
      // Validate section steps: Check if mutual exclusion groups have selections
      const sectionFields = organizedFields.get(currentSection?.id || "") || [];
      const visibleFields = sectionFields.filter(isFieldVisible);
      const mutualExclusionGroups =
        groupFieldsByMutualExclusivity(visibleFields);

      // Check each mutual exclusion group
      for (const [groupId, configs] of mutualExclusionGroups.entries()) {
        if (!groupId) continue; // Skip ungrouped fields

        const selectedCluster = selectedClusters[groupId];
        if (!selectedCluster) {
          // Find the group label
          const firstField = configs[0];
          const isDefaultGroup = groupId === "default_exclusive_group";
          const groupLabel =
            isDefaultGroup && settings?.default_exclusive_group_label
              ? settings.default_exclusive_group_label
              : firstField.mutually_exclusive_group
                  ?.split("_")
                  .map(
                    (word) =>
                      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  )
                  .join(" ") || "an option";

          showAlert(
            "Required Field",
            `Please select ${groupLabel} to continue.`
          );
          return;
        }
      }

      // Validate required fields in the current section (ungrouped fields)
      for (const config of visibleFields) {
        // Skip fields that are in mutual exclusion groups (already validated above)
        if (config.mutually_exclusive_group) continue;

        if (config.required) {
          const value = fieldValues[config.id];
          if (!hasValue(value, config.field_type, config)) {
            // Mark field as touched to show error
            markFieldAsTouched(config.id);
            showAlert(
              "Required Field",
              `Please fill in ${config.label} to continue.`
            );
            return;
          }
        }
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

    // Handle time entries based on toggle state
    if (useIndividualTimes && selectedColleagues.length > 1) {
      // Per-worker times - include worker_times array
      submissionData.worker_times = selectedColleagues.map((workerId) => ({
        worker_id: workerId,
        start_time: workerTimes[workerId]?.startTime?.toISOString() || startTime?.toISOString(),
        finish_time: workerTimes[workerId]?.finishTime?.toISOString() || finishTime?.toISOString(),
      }));
      // Also include shared times as fallback
      if (startTime) {
        submissionData.start_time = startTime.toISOString();
      }
      if (finishTime) {
        submissionData.finish_time = finishTime.toISOString();
      }
    } else {
      // Shared times for all workers (original behavior)
      if (startTime) {
        submissionData.start_time = startTime.toISOString();
      }
      if (finishTime) {
        submissionData.finish_time = finishTime.toISOString();
      }
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
        showAlert(
          "Error",
          "There was a problem on the server! Please try again later."
        );
        return;
      }

      if (data?.error) {
        setIsSubmitting(false);
        showAlert("Error", data.error);
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

        // Reset form state immediately (before showing dialog)
        setIsSubmitting(false);
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
        setTouchedFields(new Set()); // Reset touched fields
        setUseIndividualTimes(false); // Reset per-worker times toggle
        setWorkerTimes({}); // Reset worker times

        // Show success alert and navigate after OK is clicked
        showSuccessAndNavigate("Entry submitted successfully!");
      }
    } catch (err) {
      setIsSubmitting(false);
      showAlert(
        "Error",
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
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
    const isTouched = touchedFields.has(config.id);
    // Only show error if field has been touched AND has an error
    const hasError = isTouched && !!errors[config.id];

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
          error={hasError ? errors[config.id] : undefined}
          onChange={(value) => {
            updateFieldValue(config.id, value);
            markFieldAsTouched(config.id);
            // Clear error when user starts typing/selecting
            if (errors[config.id]) {
              clearFieldError(config.id);
            }
          }}
          onErrorClear={() => clearFieldError(config.id)}
          disabled={disabled}
          onFocus={(opts) => {
            // Scroll to field when focused to ensure it's visible above keyboard
            setTimeout(() => {
              const fieldY = fieldPositions.current[config.id];
              if (fieldY !== undefined && scrollViewRef.current) {
                const subFieldYOffset = opts?.subFieldYOffset ?? 0;
                scrollViewRef.current.scrollTo({
                  // For compound fields (like address), include the sub-field y-offset.
                  // Use a larger offset so the focused input sits comfortably above the keyboard.
                  y: Math.max(0, fieldY + subFieldYOffset - 160),
                  animated: true,
                });
              }
            }, 100);
          }}
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
              <Text className="text-sm font-medium text-foreground">
                Who worked on this job?
              </Text>
            </View>
            <View className="rounded-xl h-12 bg-card border border-border">
              <Select
                value=""
                onValueChange={handleAddColleague}
                placeholder={
                  selectedColleagues.length > 0
                    ? "Add another colleague"
                    : "Add a colleague"
                }
                size="medium"
                triggerClassName="border-0 h-12 pl-5"
              >
                {filteredColleagues.map((colleague) => (
                  <SelectItem
                    key={colleague.id}
                    value={colleague.id}
                    className=""
                  >
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
                      className="min-w-[44px] min-h-[44px] items-center justify-center -mr-2"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={20} color="#fff" />
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
              <Text className="text-sm font-medium text-foreground">
                Where did you work?
                <Text className="text-destructive ml-1">*</Text>
              </Text>
            </View>
            <View
              className={`rounded-xl h-12 bg-card border ${
                touchedFields.has("location") && !selectedLocation
                  ? "border-destructive"
                  : "border-border"
              }`}
            >
              <Select
                value={selectedLocation}
                onValueChange={(value) => {
                  setSelectedLocation(value);
                  markFieldAsTouched("location");
                }}
                placeholder="Choose work location"
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
            {touchedFields.has("location") && !selectedLocation && (
              <Text className="text-sm text-destructive mt-1">
                Location is required
              </Text>
            )}
          </View>
        )}

        {/* Per-worker times toggle - only show when 2+ colleagues selected */}
        {selectedColleagues.length > 1 && (
          <View className="flex-row items-center justify-between py-3 px-4 bg-card border border-border rounded-xl">
            <View className="flex-1 mr-3">
              <Text className="text-sm font-medium text-foreground">
                Different times per colleague
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Set individual start/finish times for each colleague
              </Text>
            </View>
            <Switch
              value={useIndividualTimes}
              onValueChange={setUseIndividualTimes}
              trackColor={{ false: "#767577", true: "rgb(37 99 235)" }}
              thumbColor={useIndividualTimes ? "#fff" : "#f4f3f4"}
            />
          </View>
        )}

        {/* Shared times section - show when NOT using individual times */}
        {!useIndividualTimes && (
          <>
            {/* Start Time */}
            <View>
              <View className="mb-2">
                <Text className="text-sm font-medium text-foreground">
                  What time did you start?
                  <Text className="text-destructive ml-1">*</Text>
                </Text>
              </View>
              <View
                className={`bg-card border rounded-xl h-12 justify-center ${
                  touchedFields.has("startTime") && !startTime
                    ? "border-destructive"
                    : "border-border"
                }`}
              >
                <TimePicker
                  value={startTime}
                  onValueChange={(value) => {
                    setStartTime(value);
                    markFieldAsTouched("startTime");
                  }}
                  placeholder={
                    startTime
                      ? `${startTime
                          .getHours()
                          .toString()
                          .padStart(2, "0")}:${startTime
                          .getMinutes()
                          .toString()
                          .padStart(2, "0")}`
                      : "Select start time"
                  }
                  disabled={false}
                  className="bg-transparent border-0 h-12"
                  size="md"
                />
              </View>
              {startTime && (
                <Text className="text-xs text-muted-foreground mt-1">
                  Tap to change
                </Text>
              )}
              {touchedFields.has("startTime") && !startTime && (
                <Text className="text-sm text-destructive mt-1">
                  Start time is required
                </Text>
              )}
            </View>

            {/* Finish Time */}
            <View>
              <View className="mb-2">
                <Text className="text-sm font-medium text-foreground">
                  What time did you finish?
                </Text>
              </View>
              <View
                className={`bg-card border rounded-xl h-12 justify-center ${
                  finishTime && finishTime > new Date()
                    ? "border-destructive"
                    : "border-border"
                }`}
              >
                <TimePicker
                  value={finishTime}
                  onValueChange={(value) => {
                    if (value) {
                      setFinishTime(value);
                    }
                  }}
                  placeholder={
                    finishTime
                      ? `${finishTime
                          .getHours()
                          .toString()
                          .padStart(2, "0")}:${finishTime
                          .getMinutes()
                          .toString()
                          .padStart(2, "0")}`
                      : "Select finish time"
                  }
                  disabled={false}
                  className="bg-transparent border-0 h-12"
                  size="md"
                />
              </View>
              <Text className="text-xs text-muted-foreground mt-1">
                {finishTime ? "Tap to change" : "Defaults to current time"}
              </Text>
              {finishTime && finishTime > new Date() && (
                <Text className="text-sm text-destructive mt-1">
                  Finish time cannot be in the future
                </Text>
              )}
            </View>
          </>
        )}

        {/* Per-worker time entries - show when using individual times */}
        {useIndividualTimes && selectedColleagues.length > 1 && (
          <View className="flex-col gap-4">
            {selectedColleagues.map((colleagueId) => {
              const colleagueName = getColleagueName(colleagueId);
              const isCurrentUser = colleagueId === currentUserColleagueId;
              const times = workerTimes[colleagueId] || {
                startTime: startTime,
                finishTime: finishTime,
              };

              return (
                <View
                  key={colleagueId}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  {/* Worker header */}
                  <View className="flex-row items-center gap-2 mb-3 pb-2 border-b border-border/50">
                    <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                      <Text className="text-sm font-semibold text-primary">
                        {colleagueName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text className="text-base font-medium text-foreground">
                      {isCurrentUser ? "You" : colleagueName}
                    </Text>
                  </View>

                  {/* Start Time */}
                  <View className="mb-3">
                    <Text className="text-xs text-muted-foreground mb-1.5">
                      Start time
                    </Text>
                    <View className="bg-background border border-border rounded-lg h-11 justify-center">
                      <TimePicker
                        value={times.startTime}
                        onValueChange={(value) => {
                          handleWorkerTimeChange(colleagueId, "startTime", value);
                        }}
                        placeholder={
                          times.startTime
                            ? `${times.startTime
                                .getHours()
                                .toString()
                                .padStart(2, "0")}:${times.startTime
                                .getMinutes()
                                .toString()
                                .padStart(2, "0")}`
                            : "Select time"
                        }
                        disabled={false}
                        className="bg-transparent border-0 h-11"
                        size="sm"
                      />
                    </View>
                  </View>

                  {/* Finish Time */}
                  <View>
                    <Text className="text-xs text-muted-foreground mb-1.5">
                      Finish time
                    </Text>
                    <View className="bg-background border border-border rounded-lg h-11 justify-center">
                      <TimePicker
                        value={times.finishTime}
                        onValueChange={(value) => {
                          if (value) {
                            handleWorkerTimeChange(colleagueId, "finishTime", value);
                          }
                        }}
                        placeholder={
                          times.finishTime
                            ? `${times.finishTime
                                .getHours()
                                .toString()
                                .padStart(2, "0")}:${times.finishTime
                                .getMinutes()
                                .toString()
                                .padStart(2, "0")}`
                            : "Select time"
                        }
                        disabled={false}
                        className="bg-transparent border-0 h-11"
                        size="sm"
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
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
        {/* Section Card - following mobile UX best practices */}
        <View className="bg-gray-50 dark:bg-gray-900/30 rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
          <View className="mb-4">
            <Text className="text-lg font-bold text-foreground mb-1">
              {section.title}
            </Text>
            {section.description && (
              <Text className="text-sm text-muted-foreground">
                {section.description}
              </Text>
            )}
          </View>

          {/* Render mutual exclusion groups with select dropdowns */}
          {Array.from(groupedFields.keys()).map((groupId) => {
            const fields = groupedFields.get(groupId) || [];
            const clusters = getClustersForGroup(groupId);
            const selectedCluster = selectedClusters[groupId] || null;

            // Use custom label for default_exclusive_group if available, otherwise generate from group ID
            const firstField = fields[0];
            const isDefaultGroup = groupId === "default_exclusive_group";
            const groupLabel =
              isDefaultGroup && settings?.default_exclusive_group_label
                ? settings.default_exclusive_group_label
                : firstField.mutually_exclusive_group
                    ?.split("_")
                    .map(
                      (word) =>
                        word.charAt(0).toUpperCase() +
                        word.slice(1).toLowerCase()
                    )
                    .join(" ") || "Select Option";

            return (
              <View key={groupId} className="mb-4">
                <View className="mb-2">
                  <Text className="text-sm font-medium text-foreground">
                    {groupLabel}
                    <Text className="text-destructive ml-1">*</Text>
                  </Text>
                </View>
                <View
                  className={`rounded-xl h-12 bg-card border ${
                    touchedFields.has(`mutual-exclusion-${groupId}`) &&
                    !selectedCluster
                      ? "border-destructive"
                      : "border-border"
                  }`}
                >
                  <Select
                    value={selectedCluster || ""}
                    onValueChange={(value) => {
                      handleClusterSelect(groupId, value || null);
                      markFieldAsTouched(`mutual-exclusion-${groupId}`);
                    }}
                    placeholder={`Choose ${groupLabel.toLowerCase()}`}
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
                {touchedFields.has(`mutual-exclusion-${groupId}`) &&
                  !selectedCluster && (
                    <Text className="text-sm text-destructive mt-1">
                      {groupLabel} is required
                    </Text>
                  )}

                {/* Render fields only for the selected cluster */}
                {selectedCluster &&
                  fields
                    .filter(
                      (field) => getFieldCluster(field) === selectedCluster
                    )
                    .map(renderField)}
              </View>
            );
          })}

          {/* Render regular fields (not in mutual exclusion groups) */}
          {regularFields.map(renderField)}
        </View>
      </View>
    );
  };

  // Format field value for display
  const formatFieldValue = (
    config: FieldConfig,
    value:
      | string
      | number
      | boolean
      | string[]
      | GroupedBreakdownItem[]
      | undefined
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
        if (
          Array.isArray(value) &&
          value.length > 0 &&
          typeof value[0] !== "string"
        ) {
          return (value as GroupedBreakdownItem[])
            .map((item) => `${item.brand}: ${item.quantity}`)
            .join(", ");
        }
        return "None";
      case "select":
        // Handle multi-select (array) and single-select (string)
        if (config.validation_rules?.allow_multiple && Array.isArray(value)) {
          if (value.length === 0) return "None";
          return (value as string[]).join(", ");
        }
        return String(value);
      default:
        return String(value);
    }
  };

  // Render Summary Step
  const renderSummaryStep = () => {
    // Get visible sections (same logic as getCurrentSection)
    const visibleSections = sortedSections.filter((section) => {
      const sectionFields = organizedFields.get(section.id) || [];
      return sectionFields.filter(isFieldVisible).length > 0;
    });

    const allVisibleSections = visibleSections;

    return (
      <View className="flex-col gap-4">
        <View className="mb-4">
          <Text className="text-xl font-bold text-foreground mb-2">
            Review Your Entry
          </Text>
          <Text className="text-sm text-muted-foreground">
            Review your entry. You can edit any section before submitting.
          </Text>
        </View>

        {/* Basic Info Section */}
        <View className="bg-card rounded-xl p-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-card-foreground">
              Basic Information
            </Text>
            <Pressable
              onPress={() => setCurrentStep(0)}
              className="px-3 py-1.5 rounded-lg bg-secondary active:opacity-80"
            >
              <Text className="text-sm text-primary font-medium">Edit</Text>
            </Pressable>
          </View>
          <View className="flex-col gap-4">
            {/* Colleagues */}
            {selectedColleagues.length > 0 && (
              <View className="flex-row justify-between items-start">
                <Text className="text-sm text-muted-foreground flex-1">
                  Who worked on this job?
                </Text>
                <Text className="text-base text-card-foreground flex-1 text-right">
                  {selectedColleagues
                    .map((id) => getColleagueName(id))
                    .join(", ")}
                </Text>
              </View>
            )}

            {/* Location */}
            {selectedLocation && (
              <View className="flex-row justify-between items-start">
                <Text className="text-sm text-muted-foreground flex-1">
                  Where did you work?
                </Text>
                <Text className="text-base text-card-foreground flex-1 text-right">
                  {locations.find((l) => l.id === selectedLocation)?.name ||
                    selectedLocation}
                </Text>
              </View>
            )}

            {/* Start Time */}
            {startTime && (
              <View className="flex-row justify-between items-start">
                <Text className="text-sm text-muted-foreground flex-1">
                  Start Time
                </Text>
                <Text className="text-base text-card-foreground flex-1 text-right">
                  {startTime.getHours().toString().padStart(2, "0")}:
                  {startTime.getMinutes().toString().padStart(2, "0")}
                </Text>
              </View>
            )}

            {/* Finish Time */}
            {finishTime && (
              <View className="flex-row justify-between items-start">
                <Text className="text-sm text-muted-foreground flex-1">
                  Finish Time
                </Text>
                <Text className="text-base text-card-foreground flex-1 text-right">
                  {finishTime.getHours().toString().padStart(2, "0")}:
                  {finishTime.getMinutes().toString().padStart(2, "0")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Field Sections */}
        {allVisibleSections.map((section, sectionIndex) => {
          const sectionFields = organizedFields.get(section.id) || [];
          const visibleFields = sectionFields.filter(isFieldVisible);

          // Filter out optional empty fields
          const fieldsToShow = visibleFields.filter((config) => {
            const value = fieldValues[config.id];
            // Show if required OR has a value
            return (
              config.required || hasValue(value, config.field_type, config)
            );
          });

          if (fieldsToShow.length === 0) return null;

          // Calculate which step this section corresponds to
          // Step 0 = Basic Info, Step 1+ = Sections (in order)
          const sectionStep = 1 + sectionIndex; // Step 0 is basic info, sections start at 1

          return (
            <View key={section.id}>
              {sectionIndex > 0 && <View className="h-px bg-border/30 mb-4" />}
              <View className="bg-card rounded-xl p-4">
                <View className="flex-row justify-between items-center mb-3">
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-card-foreground">
                      {section.title}
                    </Text>
                    {section.description && (
                      <Text className="text-sm text-muted-foreground mt-1">
                        {section.description}
                      </Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => setCurrentStep(sectionStep)}
                    className="px-3 py-1.5 rounded-lg bg-secondary active:opacity-80 ml-3"
                  >
                    <Text className="text-sm text-primary font-medium">
                      Edit
                    </Text>
                  </Pressable>
                </View>
                <View className="flex-col gap-4">
                  {fieldsToShow.map((config) => {
                    const value = fieldValues[config.id];
                    const displayValue = formatFieldValue(config, value);

                    return (
                      <View
                        key={config.id}
                        className="flex-row justify-between items-start"
                      >
                        <Text className="text-sm text-muted-foreground flex-1">
                          {config.label}
                          {config.required && (
                            <Text className="text-destructive ml-1">*</Text>
                          )}
                        </Text>
                        <Text className="text-base text-card-foreground flex-1 text-right">
                          {displayValue}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Calculate progress percentage - simplified to step-based for accuracy
  const progressPercentage = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* User Header */}
        {user && (
          <View className="bg-background px-4 pt-2 pb-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                  {worker?.name || (isAdmin && user?.email) ? (
                    <Text className="text-xs font-semibold text-primary">
                      {(
                        worker?.name ||
                        (isAdmin && user?.email
                          ? user.email.split("@")[0]
                          : "") ||
                        ""
                      )
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </Text>
                  ) : (
                    <Ionicons name="person" size={16} color="rgb(37 99 235)" />
                  )}
                </View>
                <View>
                  <Text className="text-sm font-medium text-foreground">
                    {worker?.name || user?.email?.split("@")[0] || "User"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Progress Bar at Top */}
        <View className="bg-background px-4 pt-4 pb-3">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm font-semibold text-foreground">
              Step {currentStep + 1} of {totalSteps}
            </Text>
            <Text className="text-sm font-bold text-primary">
              {Math.round(progressPercentage)}%
            </Text>
          </View>
          <Progress value={progressPercentage} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
        >
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-4 pt-4"
            // Best practice: allow scrolling even when content is short, so focused inputs
            // can always scroll above the keyboard (prevents "third field hidden" issue).
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 320 }}
            // iOS best practice: let ScrollView automatically adjust for keyboard insets.
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            keyboardDismissMode="on-drag"
          >
            {/* Main Card Container */}
            <View
              className="bg-card rounded-2xl p-6 mb-10"
              style={{ borderWidth: 0, outlineWidth: 0 }}
            >
              {/* Error Summary */}
              {Object.keys(errors).length > 0 && (
                <View className="bg-destructive/10 border-2 border-destructive rounded-xl p-4 mb-6">
                  <View className="flex-row items-center gap-2 mb-3">
                    <Ionicons
                      name="alert-circle"
                      size={22}
                      color="rgb(220 38 38)"
                    />
                    <Text className="text-base font-bold text-destructive">
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
                          className="text-sm text-destructive leading-5"
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
          {!isKeyboardVisible && (
            <View className="absolute bottom-0 left-0 right-0 bg-card border-t border-border/50 px-4 py-4 shadow-2xl">
              <View className="flex-row gap-3">
                {/* Previous Button - shown on all steps except first */}
                {currentStep > 0 && (
                  <Button
                    onPress={handlePrevious}
                    disabled={isSubmitting}
                    variant="secondary"
                    size="lg"
                    className="flex-1 bg-secondary"
                  >
                    <Ionicons
                      name="chevron-back"
                      size={20}
                      color="rgb(var(--color-secondary-foreground))"
                    />
                    <Text className="text-secondary-foreground text-base font-semibold">
                      Previous
                    </Text>
                  </Button>
                )}
                {/* Next Button - shown on all steps except last */}
                {!isLastStep && (
                  <Button
                    onPress={async () => {
                      if (Platform.OS === "ios") {
                        try {
                          await Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light
                          );
                        } catch (err) {
                          // Haptics not available
                        }
                      }
                      handleNext();
                    }}
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
                    onPress={async () => {
                      if (Platform.OS === "ios") {
                        try {
                          await Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Medium
                          );
                        } catch (err) {
                          // Haptics not available
                        }
                      }
                      handleSubmit();
                    }}
                    disabled={isSubmitting}
                    variant="default"
                    size="lg"
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="white"
                      />
                    )}
                    <Text className="text-white text-base font-semibold">
                      {isSubmitting ? "Submitting..." : "Submit Entry"}
                    </Text>
                  </Button>
                )}
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Alert Dialog */}
      <AlertDialog open={alertOpen} onOpenChange={handleDialogChange}>
        <AlertDialogContent
          className="bg-secondary border-border"
          onInteractOutside={() => {
            // Allow dismissing by clicking outside, but don't execute callback
            handleDialogChange(false);
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-card-foreground">
              {alertTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {alertMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-center">
            <AlertDialogAction>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleOkPress();
                }}
                className="bg-primary active:bg-primary-600 px-6 py-3 rounded-lg"
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
