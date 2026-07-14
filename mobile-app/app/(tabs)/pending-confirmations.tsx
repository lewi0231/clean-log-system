import { useCurrentWorker } from "@/hooks/use-current-worker";
import { useAuth } from "@/hooks/useAuth";
import { Drawer } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSubmissionDataRows } from "@/lib/format-submission-summary";
import { useTheme } from "@/lib/theme-context";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface PendingConfirmation {
  job_id: string;
  location_name: string | null;
  location_address: string | null;
  completed_at: string;
  created_at: string;
  auto_approve_at: string | null;
  submitted_by: string;
  submitted_by_worker_id: string | null;
  workers: Array<{
    id: string;
    name: string;
    confirmation_status: string;
  }>;
  submission_data: Record<string, unknown>;
}

export default function PendingConfirmationsScreen() {
  const { user, session, loading: authLoading } = useAuth();
  const { worker } = useCurrentWorker();
  const { colors } = useTheme();

  const [confirmations, setConfirmations] = useState<PendingConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedConfirmation, setSelectedConfirmation] = useState<PendingConfirmation | null>(
    null
  );

  // Flag modal state
  const [flagModalVisible, setFlagModalVisible] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchConfirmations = useCallback(async () => {
    if (!user || !session?.access_token) {
      if (!authLoading) setLoading(false); // Auth resolved but no session
      return;
    }

    try {
      setError(null);

      const { data, error: fetchError } = await supabase.functions.invoke(
        "list-pending-confirmations",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (fetchError) {
        console.error("PendingConfirmations: Error fetching", fetchError);
        setError("Failed to load pending confirmations.");
        return;
      }

      if (data?.pending_confirmations) {
        setConfirmations(data.pending_confirmations);
      } else {
        setConfirmations([]);
      }
    } catch (err) {
      console.error("PendingConfirmations: Failed to fetch", err);
      setError("Failed to load pending confirmations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, session?.access_token, authLoading]);

  useEffect(() => {
    fetchConfirmations();
  }, [fetchConfirmations]);

  const pendingJobIds = useMemo(() => confirmations.map((c) => c.job_id), [confirmations]);
  const pendingJobIdsKey = useMemo(() => [...pendingJobIds].sort().join(","), [pendingJobIds]);

  // Refetch when a colleague confirms (job_worker) or job status changes (job) — same pattern as dashboard realtime
  useEffect(() => {
    if (!session?.access_token) return;
    if (pendingJobIds.length === 0) return;

    const inList = pendingJobIds.join(",");
    const filterJobWorker = `job_id=in.(${inList})`;
    const filterJob = `id=in.(${inList})`;

    const channel = supabase
      .channel(`pending_confirmations:${pendingJobIdsKey.slice(0, 60)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "job_worker",
          filter: filterJobWorker,
        },
        () => {
          fetchConfirmations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "job",
          filter: filterJob,
        },
        () => {
          fetchConfirmations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.access_token, pendingJobIdsKey, pendingJobIds, fetchConfirmations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConfirmations();
  }, [fetchConfirmations]);

  const handleConfirm = async (jobId: string) => {
    if (!session?.access_token) return;

    setIsSubmitting(true);
    try {
      const { data, error: confirmError } = await supabase.functions.invoke(
        "confirm-job-participation",
        {
          body: { job_id: jobId },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (confirmError) {
        Alert.alert("Error", "Failed to confirm participation. Please try again.");
        return;
      }

      // Remove from list
      setConfirmations((prev) => prev.filter((c) => c.job_id !== jobId));
      setSelectedConfirmation((prev) => (prev?.job_id === jobId ? null : prev));

      const message = data?.job_approved
        ? "Job has been approved!"
        : "Your participation has been confirmed.";
      Alert.alert("Confirmed", message);
    } catch (err) {
      console.error("Confirm error:", err);
      Alert.alert("Error", "Failed to confirm participation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenFlagModal = (jobId: string) => {
    setSelectedConfirmation(null);
    setSelectedJobId(jobId);
    setFlagReason("");
    setFlagModalVisible(true);
  };

  const handleFlag = async () => {
    if (!session?.access_token || !selectedJobId) return;

    if (flagReason.trim().length < 10) {
      Alert.alert("Error", "Please provide a reason (at least 10 characters).");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: flagError } = await supabase.functions.invoke("flag-job", {
        body: { job_id: selectedJobId, reason: flagReason.trim() },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (flagError) {
        Alert.alert("Error", "Failed to flag job. Please try again.");
        return;
      }

      // Remove from list
      setConfirmations((prev) => prev.filter((c) => c.job_id !== selectedJobId));

      setFlagModalVisible(false);
      setSelectedJobId(null);
      setFlagReason("");

      Alert.alert("Job Flagged", "The job has been flagged for admin review.");
    } catch (err) {
      console.error("Flag error:", err);
      Alert.alert("Error", "Failed to flag job. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimeUntilAutoApprove = (autoApproveAt: string | null): string => {
    if (!autoApproveAt) return "Soon";

    const now = new Date();
    const autoApprove = new Date(autoApproveAt);
    const diffMs = autoApprove.getTime() - now.getTime();

    if (diffMs <= 0) return "Soon";

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ${diffHours % 24}h`;
    }

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }

    return `${diffMinutes}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const selectedSummaryRows = selectedConfirmation
    ? formatSubmissionDataRows(selectedConfirmation.submission_data)
    : [];

  const renderWorkerBadges = (confirmation: PendingConfirmation) => (
    <View className="flex-row flex-wrap gap-2">
      {confirmation.workers.map((w) => (
        <View
          key={w.id}
          className={`px-2 py-1 rounded-full ${
            w.confirmation_status === "confirmed"
              ? "bg-green-100 dark:bg-green-900/30"
              : w.confirmation_status === "flagged"
                ? "bg-red-100 dark:bg-red-900/30"
                : "bg-yellow-100 dark:bg-yellow-900/30"
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              w.confirmation_status === "confirmed"
                ? "text-green-700 dark:text-green-400"
                : w.confirmation_status === "flagged"
                  ? "text-red-700 dark:text-red-400"
                  : "text-yellow-700 dark:text-yellow-400"
            }`}
          >
            {w.id === worker?.id ? "You" : w.name}
            {w.confirmation_status === "confirmed" && " ✓"}
            {w.confirmation_status === "flagged" && " ⚠"}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderActionButtons = (jobId: string) => (
    <View className="flex-row gap-3">
      <Pressable
        onPress={() => handleConfirm(jobId)}
        disabled={isSubmitting}
        className="flex-1 bg-green-600 py-3 rounded-lg items-center active:opacity-80 disabled:opacity-50"
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="checkmark" size={18} color="white" />
          <Text className="text-white font-semibold">Confirm</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => handleOpenFlagModal(jobId)}
        disabled={isSubmitting}
        className="flex-1 bg-red-100 dark:bg-red-900/30 py-3 rounded-lg items-center active:opacity-80 disabled:opacity-50"
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="flag-outline" size={18} color={colors.destructive} />
          <Text className="text-red-600 dark:text-red-400 font-semibold">Flag Issue</Text>
        </View>
      </Pressable>
    </View>
  );

  // Show skeleton until we've completed the initial fetch (never show empty state before load)
  const isInitialLoad = loading || authLoading;
  if (isInitialLoad) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-1">
          {/* Header skeleton */}
          <View className="px-4 pt-4 pb-3 border-b border-border/50">
            <Skeleton width="60%" height={28} className="mb-2" />
            <Skeleton width="80%" height={16} />
          </View>
          {/* Content skeleton - card placeholders */}
          <View className="p-4 gap-4">
            {[1, 2, 3].map((i) => (
              <View key={i} className="bg-card rounded-xl p-4 border border-border/50">
                <View className="flex-row justify-between mb-3">
                  <Skeleton width="50%" height={18} />
                  <Skeleton width={60} height={24} rounded />
                </View>
                <Skeleton width="70%" height={14} className="mb-3" />
                <View className="flex-row gap-2 mb-4">
                  <Skeleton width={80} height={24} rounded />
                  <Skeleton width={80} height={24} rounded />
                </View>
                <View className="flex-row gap-3">
                  <Skeleton width="48%" height={44} rounded={false} />
                  <Skeleton width="48%" height={44} rounded={false} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1">
        {/* Header */}
        <View className="bg-background px-4 pt-4 pb-3 border-b border-border/50">
          <Text className="text-2xl font-bold text-foreground">Pending Confirmations</Text>
          <Text className="text-sm text-muted-foreground mt-1">
            {confirmations.length === 0
              ? "No jobs need your confirmation"
              : `${confirmations.length} job${
                  confirmations.length === 1 ? "" : "s"
                } need your confirmation`}
          </Text>
        </View>

        {/* Content */}
        {error ? (
          <View className="flex-1 items-center justify-center px-4">
            <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
            <Text className="text-destructive text-center mt-4">{error}</Text>
            <Pressable onPress={onRefresh} className="mt-4 px-4 py-2 bg-primary rounded-lg">
              <Text className="text-primary-foreground font-medium">Try Again</Text>
            </Pressable>
          </View>
        ) : confirmations.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Ionicons name="checkmark-circle-outline" size={64} color="rgb(34 197 94)" />
            <Text className="text-foreground text-center mt-4 text-lg font-medium">
              All caught up!
            </Text>
            <Text className="text-muted-foreground text-center mt-2">
              You have no pending job confirmations
            </Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View className="flex-col gap-4">
              {confirmations.map((confirmation) => (
                <View
                  key={confirmation.job_id}
                  className="bg-card rounded-xl p-4 border border-border/50"
                >
                  <Pressable
                    onPress={() => setSelectedConfirmation(confirmation)}
                    className="active:opacity-80"
                  >
                    {/* Header */}
                    <View className="flex-row justify-between items-start mb-3">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-card-foreground">
                          {confirmation.location_name || "Unknown Location"}
                        </Text>
                        <Text className="text-sm text-muted-foreground mt-0.5">
                          {formatDate(confirmation.completed_at)}
                        </Text>
                      </View>
                      <View className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
                        <Text className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
                          ⏱️ {formatTimeUntilAutoApprove(confirmation.auto_approve_at)}
                        </Text>
                      </View>
                    </View>

                    {/* Submitted by */}
                    <View className="flex-row items-center gap-2 mb-3">
                      <Ionicons name="person-outline" size={14} color={colors.mutedForeground} />
                      <Text className="text-sm text-muted-foreground">
                        Submitted by{" "}
                        <Text className="font-medium text-foreground">
                          {confirmation.submitted_by}
                        </Text>
                      </Text>
                    </View>

                    {/* Workers */}
                    <View className="mb-3">{renderWorkerBadges(confirmation)}</View>

                    <View className="flex-row items-center justify-between py-2 border-t border-border/40">
                      <Text className="text-sm font-medium text-primary">
                        View submitted details
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                    </View>
                  </Pressable>

                  {/* Action buttons */}
                  <View className="mt-4">{renderActionButtons(confirmation.job_id)}</View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Submission detail drawer */}
      <Drawer
        open={selectedConfirmation !== null}
        onClose={() => setSelectedConfirmation(null)}
        title={selectedConfirmation?.location_name || "Job details"}
        description={
          selectedConfirmation
            ? `Submitted ${formatDate(selectedConfirmation.completed_at)}`
            : undefined
        }
        size="large"
      >
        {selectedConfirmation ? (
          <ScrollView
            className="flex-1 px-4"
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {selectedConfirmation.location_address ? (
              <View className="mb-4">
                <Text className="text-xs text-muted-foreground mb-1">Location</Text>
                <Text className="text-sm text-foreground">
                  {selectedConfirmation.location_address}
                </Text>
              </View>
            ) : null}

            <View className="mb-4">
              <Text className="text-xs text-muted-foreground mb-1">Submitted by</Text>
              <Text className="text-sm font-medium text-foreground">
                {selectedConfirmation.submitted_by}
              </Text>
            </View>

            <View className="mb-4">
              <Text className="text-xs text-muted-foreground mb-2">Workers</Text>
              {renderWorkerBadges(selectedConfirmation)}
            </View>

            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-foreground">Submitted details</Text>
              <Text className="text-xs text-yellow-700 dark:text-yellow-400">
                Auto-confirms in {formatTimeUntilAutoApprove(selectedConfirmation.auto_approve_at)}
              </Text>
            </View>

            {selectedSummaryRows.length === 0 ? (
              <View className="bg-muted/40 rounded-xl p-4 border border-border/50 mb-6">
                <Text className="text-sm text-muted-foreground text-center">
                  No field data was stored for this job.
                </Text>
              </View>
            ) : (
              <View className="bg-card rounded-xl p-4 border border-border/50 mb-6">
                {selectedSummaryRows}
              </View>
            )}

            {renderActionButtons(selectedConfirmation.job_id)}
          </ScrollView>
        ) : null}
      </Drawer>

      {/* Flag Modal */}
      <Modal
        visible={flagModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFlagModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-2xl p-6">
            <Text className="text-xl font-bold text-foreground mb-2">Flag This Job</Text>
            <Text className="text-muted-foreground mb-4">
              Please explain what&apos;s incorrect about this job submission.
            </Text>

            <TextInput
              value={flagReason}
              onChangeText={setFlagReason}
              placeholder="e.g., I wasn't at this location on this date..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              className="bg-muted p-4 rounded-lg text-foreground mb-4"
              style={{ minHeight: 100, textAlignVertical: "top", color: colors.foreground }}
            />

            <Text className="text-xs text-muted-foreground mb-4">
              Minimum 10 characters. This will be sent to your admin for review.
            </Text>

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setFlagModalVisible(false)}
                disabled={isSubmitting}
                className="flex-1 bg-muted py-3 rounded-lg items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleFlag}
                disabled={isSubmitting || flagReason.trim().length < 10}
                className="flex-1 bg-red-600 py-3 rounded-lg items-center disabled:opacity-50"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-semibold">Submit Flag</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
