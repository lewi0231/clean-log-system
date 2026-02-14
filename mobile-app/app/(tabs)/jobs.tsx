import { useCurrentWorker } from "@/hooks/use-current-worker";
import { useUserRole } from "@/hooks/use-user-role";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
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

interface JobWorker {
  id: string;
  name: string;
  confirmation_status?: string;
}

interface Job {
  id: string;
  created_at: string;
  completed_at?: string;
  location_name?: string;
  worker_name?: string;
  approval_status?: ApprovalStatus;
  submitted_by_worker_id?: string | null;
  edit_window_expires_at?: string | null;
  auto_approve_at?: string | null;
  location?: { name: string };
  workers?: JobWorker[];
  [key: string]: unknown;
}

export default function JobsScreen() {
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const { worker } = useCurrentWorker();
  const { organizationId } = useOrganization();
  const { isAdmin } = useUserRole();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawingJobId, setWithdrawingJobId] = useState<string | null>(null);

  // Get session for authenticated requests
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchJobs = useCallback(async () => {
    if (!user || !organizationId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // Call edge function to get jobs for this worker
      // Note: list-jobs doesn't filter by worker_id, so we filter client-side
      const { data, error: fetchError } = await supabase.functions.invoke(
        "list-jobs",
        {
          body: {
            organization_id: organizationId,
          },
        }
      );

      if (fetchError) {
        console.error("Jobs: Error fetching", fetchError);
        setError("Failed to load jobs. Please try again.");
        return;
      }

      if (data?.jobs) {
        // If admin, show all jobs. If worker, filter to only assigned jobs
        let filteredJobs = data.jobs;
        if (!isAdmin && worker) {
          const workerJobIds = new Set(
            data.jobs
              .filter((job: Job) =>
                job.workers?.some((w) => w.id === worker.id)
              )
              .map((job: Job) => job.id)
          );

          filteredJobs = data.jobs.filter((job: Job) =>
            workerJobIds.has(job.id)
          );
        }

        // Sort by created_at descending (newest first)
        const sortedJobs = filteredJobs.sort(
          (a: Job, b: Job) =>
            new Date(b.created_at || b.completed_at || "").getTime() -
            new Date(a.created_at || a.completed_at || "").getTime()
        );
        setJobs(sortedJobs);
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.error("Jobs: Failed to fetch", err);
      setError("Failed to load jobs. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, organizationId, worker, isAdmin]);

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
              const { data, error: withdrawError } =
                await supabase.functions.invoke("withdraw-job", {
                  body: { job_id: jobId },
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                  },
                });

              if (withdrawError || data?.error) {
                Alert.alert(
                  "Error",
                  data?.error || "Failed to withdraw job. Please try again."
                );
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
              Pending
            </Text>
          </View>
        );
      case "flagged":
        return (
          <View className="bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
            <Text className="text-xs font-medium text-red-700 dark:text-red-400">
              Flagged
            </Text>
          </View>
        );
      case "cancelled":
        return (
          <View className="bg-gray-100 dark:bg-gray-800/50 px-2 py-0.5 rounded-full">
            <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Cancelled
            </Text>
          </View>
        );
      default:
        return null; // Don't show badge for approved jobs
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

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
          year:
            date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="rgb(37 99 235)" />
          <Text className="text-muted-foreground mt-4">Loading jobs...</Text>
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
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"} submitted
          </Text>
        </View>

        {/* Content */}
        {error ? (
          <View className="flex-1 items-center justify-center px-4">
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color="rgb(220 38 38)"
            />
            <Text className="text-destructive text-center mt-4">{error}</Text>
            <Pressable
              onPress={() => {
                setError(null);
                setLoading(true);
                fetchJobs();
              }}
              className="mt-4 px-4 py-2 bg-primary rounded-lg"
            >
              <Text className="text-primary-foreground font-medium">
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : jobs.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Ionicons
              name="document-text-outline"
              size={64}
              color="rgb(100 116 139)"
            />
            <Text className="text-muted-foreground text-center mt-4 text-lg">
              No jobs submitted yet
            </Text>
            <Text className="text-muted-foreground text-center mt-2">
              Your submitted jobs will appear here
            </Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={true}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
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
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-base font-semibold text-card-foreground">
                          {job.location?.name || `Job #${job.id.slice(0, 8)}`}
                        </Text>
                        {getStatusBadge(job)}
                      </View>
                      {job.location?.name && (
                        <Text className="text-xs text-muted-foreground mt-0.5">
                          #{job.id.slice(0, 8)}
                        </Text>
                      )}
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      {formatDate(job.created_at || job.completed_at || "")}
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

                  {/* Withdraw button for submitter */}
                  {canWithdraw(job) && (
                    <Pressable
                      onPress={() => handleWithdraw(job.id)}
                      disabled={withdrawingJobId === job.id}
                      className="mt-3 flex-row items-center justify-center gap-2 py-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg active:opacity-80 disabled:opacity-50"
                    >
                      {withdrawingJobId === job.id ? (
                        <ActivityIndicator size="small" color="rgb(220 38 38)" />
                      ) : (
                        <>
                          <Ionicons
                            name="close-circle-outline"
                            size={16}
                            color="rgb(220 38 38)"
                          />
                          <Text className="text-red-600 dark:text-red-400 font-medium text-sm">
                            Withdraw ({getTimeRemaining(job.edit_window_expires_at!)})
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}

                  {/* Auto-approve countdown for pending jobs */}
                  {job.approval_status === "pending" &&
                    job.auto_approve_at &&
                    !canWithdraw(job) && (
                      <View className="mt-3 flex-row items-center gap-1.5">
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color="rgb(161 98 7)"
                        />
                        <Text className="text-xs text-yellow-700 dark:text-yellow-400">
                          Auto-approves in {getTimeRemaining(job.auto_approve_at)}
                        </Text>
                      </View>
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
