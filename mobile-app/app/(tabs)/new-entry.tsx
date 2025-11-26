import { FieldRenderer } from "@/components/field-renderer";
import { Badge } from "@/components/ui/badge";
import { Select, SelectItem } from "@/components/ui/select";
import { useColleagues } from "@/hooks/use-colleagues";
import { useEntryForm } from "@/hooks/use-entry-form";
import { useLocations } from "@/hooks/use-locations";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
                Who did you work with?!
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
                <FieldRenderer
                  config={config}
                  value={fieldValues[config.id]}
                  error={errors[config.name]}
                  onChange={(value) => updateFieldValue(config.id, value)}
                  onErrorClear={() => clearFieldError(config.name)}
                />
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
