import { useCurrentWorker } from "@/hooks/use-current-worker";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { fetchMyJobs, getSubmitterNameForJob, type MyJobListItem } from "@/lib/fetch-my-jobs";
import { useTheme } from "@/lib/theme-context";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ApprovalStatus = "approved" | "pending" | "flagged" | "cancelled";

type Job = MyJobListItem & {
  approval_status?: ApprovalStatus;
  edit_window_expires_at?: string | null;
  auto_approve_at?: string | null;
  location?: { name: string };
};

export default function JobsScreen() {
  const router = useRouter();
  const { user, session } = useAuth();
  const { worker } = useCurrentWorker();
  const { organizationId, loading: orgLoading } = useOrganization();
  const { colors } = useTheme();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawingJobId, setWithdrawingJobId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!user || !organizationId || !session?.access_token) {
      if (!orgLoading) setLoading(false);
      return;
    }

    try {
      setError(null);

      const result = await fetchMyJobs(organizationId, session.access_token);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setJobs(result.jobs as Job[]);
    } catch (err) {
      console.error("Jobs: Failed to fetch", err);
      setError("Failed to load jobs. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, organizationId, session?.access_token, orgLoading]);

  const jobIdsKey = useMemo(
    () =>
      jobs
        .map((j) => j.id)
        .sort()
        .join(","),
    [jobs]
  );

  useEffect(() => {
    if (!session?.access_token || !organizationId) return;
    if (jobs.length === 0) return;

    const ids = jobs.map((j) => j.id);
    const inList = ids.join(",");
    const filterJobWorker = `job_id=in.(${inList})`;
    const filterJob = `id=in.(${inList})`;

    const channel = supabase
      .channel(`my_jobs:${jobIdsKey.slice(0, 60)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "job_worker",
          filter: filterJobWorker,
        },
        () => {
          fetchJobs();
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
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.access_token, organizationId, jobIdsKey, fetchJobs]);

  useEffect(() => {
    setLoading(true);
    fetchJobs();
  }, [fetchJobs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
  }, [fetchJobs]);

  const handleWithdraw = async (jobId: string) => {
    Alert.alert(
      "Withdraw Job",
      "Are you sure you want to withdraw this job? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            if (!session?.access_token) return;

            setWithdrawingJobId(jobId);
            try {
              const { data, error: withdrawError } = await supabase.functions.invoke(
                "withdraw-job",
                {
                  body: { job_id: jobId },
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                  },
                }
              );

              if (withdrawError || data?.error) {
                Alert.alert("Error", data?.error || "Failed to withdraw job. Please try again.");
                return;
              }

              // Remove job from list
              setJobs((prev) => prev.filter((j) => j.id !== jobId));
              Alert.alert("Success", "Job has been withdrawn.");
            } catch (err) {
              console.error("Withdraw error:", err);
              Alert.alert("Error", "Failed to withdraw job. Please try again.");
            } finally {
              setWithdrawingJobId(null);
            }
          },
        },
      ]
    );
  };

  const getTimeRemaining = (expiresAt: string): string => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs <= 0) return "Expired";

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;

    if (diffHours > 0) {
      return `${diffHours}h ${remainingMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  const canWithdraw = (job: Job): boolean => {
    if (!worker) return false;
    if (job.submitted_by_worker_id !== worker.id) return false;
    if (job.approval_status !== "pending") return false;
    if (!job.edit_window_expires_at) return false;
    return new Date(job.edit_window_expires_at) > new Date();
  };

  const getStatusBadge = (job: Job) => {
    switch (job.approval_status) {
      case "pending":
        return (
          <View className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
            <Text className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
              Pending confirmation
            </Text>
          </View>
        );
      case "flagged":
        return (
          <View className="bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
            <Text className="text-xs font-medium text-red-700 dark:text-red-400">Flagged</Text>
          </View>
        );
      case "cancelled":
        return (
          <View className="bg-gray-100 dark:bg-gray-800/50 px-2 py-0.5 rounded-full">
            <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">Cancelled</Text>
          </View>
        );
      default:
        return null; // Don't show badge for approved jobs
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) {
        return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
      } else {
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
      }
    }
  };

  const getSubmitterBadge = (job: Job) => {
    const submitterName = getSubmitterNameForJob(job, worker?.id);
    if (!submitterName) return null;

    return (
      <View className="bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded-full">
        <Text className="text-xs font-medium text-primary">Submitted by {submitterName}</Text>
      </View>
    );
  };

  // Show skeleton until we've completed the initial fetch (never show empty state before load)
  const isInitialLoad = loading || orgLoading;
  if (isInitialLoad) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-1">
          {/* Header skeleton */}
          <View className="px-4 pt-4 pb-3 border-b border-border/50">
            <Skeleton width="40%" height={28} className="mb-2" />
            <Skeleton width="50%" height={16} />
          </View>
          {/* Content skeleton - job card placeholders */}
          <View className="p-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <View key={i} className="bg-card rounded-xl p-4 border border-border/50">
                <View className="flex-row justify-between mb-2">
                  <Skeleton width="45%" height={18} />
                  <Skeleton width={50} height={14} />
                </View>
                <View className="flex-row gap-1.5 mt-2">
                  <Skeleton width={70} height={22} rounded />
                  <Skeleton width={60} height={22} rounded />
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
          <Text className="text-2xl font-bold text-foreground">My Jobs</Text>
          <Text className="text-sm text-muted-foreground mt-1">
            {jobs.length === 0
              ? "No jobs on your record yet"
              : `${jobs.length} job${jobs.length === 1 ? "" : "s"} you've worked on`}
          </Text>
        </View>

        {/* Content */}
        {error ? (
          <View className="flex-1 items-center justify-center px-4">
            <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
            <Text className="text-destructive text-center mt-4">{error}</Text>
            <Pressable
              onPress={() => {
                setError(null);
                setLoading(true);
                fetchJobs();
              }}
              className="mt-4 px-4 py-2 bg-primary rounded-lg"
            >
              <Text className="text-primary-foreground font-medium">Try Again</Text>
            </Pressable>
          </View>
        ) : jobs.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Ionicons name="document-text-outline" size={64} color={colors.mutedForeground} />
            <Text className="text-muted-foreground text-center mt-4 text-lg">No jobs yet</Text>
            <Text className="text-muted-foreground text-center mt-2">
              Jobs you submit or work on will appear here
            </Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={true}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <View className="flex-col gap-3">
              {jobs.map((job) => (
                <View
                  key={job.id}
                  className={`bg-card rounded-xl p-4 border ${
                    job.approval_status === "flagged"
                      ? "border-red-300 dark:border-red-800"
                      : job.approval_status === "pending"
                        ? "border-yellow-300 dark:border-yellow-800"
                        : "border-border/50"
                  }`}
                >
                  <Pressable
                    onPress={() => router.push(`/job/${job.id}`)}
                    className="active:opacity-90"
                  >
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 flex-wrap">
                          <Text className="text-base font-semibold text-card-foreground">
                            {job.location?.name || `Job #${job.id.slice(0, 8)}`}
                          </Text>
                          {getStatusBadge(job)}
                          {getSubmitterBadge(job)}
                        </View>
                        {job.location?.name && (
                          <Text className="text-xs text-muted-foreground mt-0.5">
                            #{job.id.slice(0, 8)}
                          </Text>
                        )}
                      </View>
                      <Text className="text-xs text-muted-foreground">
                        {formatDate(job.completed_at || job.created_at || "")}
                      </Text>
                    </View>

                    {/* Workers list */}
                    {job.workers && job.workers.length > 0 && (
                      <View className="flex-row flex-wrap gap-1.5 mt-2">
                        {job.workers.map((w) => (
                          <View
                            key={w.id}
                            className={`px-2 py-0.5 rounded-full ${
                              w.confirmation_status === "confirmed"
                                ? "bg-green-100 dark:bg-green-900/30"
                                : w.confirmation_status === "flagged"
                                  ? "bg-red-100 dark:bg-red-900/30"
                                  : "bg-yellow-100 dark:bg-yellow-900/30"
                            }`}
                          >
                            <Text
                              className={`text-xs ${
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
                    )}

                    {/* Auto-approve countdown for pending jobs (tappable → job detail) */}
                    {job.approval_status === "pending" &&
                      job.auto_approve_at &&
                      !canWithdraw(job) && (
                        <View className="mt-3 flex-row items-center gap-1.5">
                          <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                          <Text className="text-xs text-yellow-700 dark:text-yellow-400">
                            Auto-approves in {getTimeRemaining(job.auto_approve_at)}
                          </Text>
                        </View>
                      )}
                  </Pressable>

                  {/* Withdraw button for submitter */}
                  {canWithdraw(job) && (
                    <Pressable
                      onPress={() => handleWithdraw(job.id)}
                      disabled={withdrawingJobId === job.id}
                      className="mt-3 flex-row items-center justify-center gap-2 py-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg active:opacity-80 disabled:opacity-50"
                    >
                      {withdrawingJobId === job.id ? (
                        <ActivityIndicator size="small" color={colors.destructive} />
                      ) : (
                        <>
                          <Ionicons
                            name="close-circle-outline"
                            size={16}
                            color={colors.destructive}
                          />
                          <Text className="text-red-600 dark:text-red-400 font-medium text-sm">
                            Withdraw ({getTimeRemaining(job.edit_window_expires_at!)})
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
