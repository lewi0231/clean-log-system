import { useCurrentWorker } from "@/hooks/use-current-worker";
import { useUserRole } from "@/hooks/use-user-role";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Job {
  id: string;
  created_at: string;
  location_name?: string;
  worker_name?: string;
  [key: string]: any;
}

export default function JobsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { worker } = useCurrentWorker();
  const { organizationId } = useOrganization();
  const { isAdmin } = useUserRole();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !organizationId) {
      setLoading(false);
      return;
    }

    async function fetchJobs() {
      try {
        setLoading(true);
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
                .filter((job: any) =>
                  job.workers?.some((w: any) => w.id === worker.id)
                )
                .map((job: any) => job.id)
            );

            filteredJobs = data.jobs.filter((job: any) =>
              workerJobIds.has(job.id)
            );
          }

          // Sort by created_at descending (newest first)
          const sortedJobs = filteredJobs.sort(
            (a: Job, b: Job) =>
              new Date(b.created_at || b.completed_at).getTime() -
              new Date(a.created_at || a.completed_at).getTime()
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
      }
    }

    fetchJobs();
  }, [user, organizationId, worker?.id, isAdmin]);

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
                // Retry fetch
                if (user && organizationId) {
                  supabase.functions
                    .invoke("list-jobs", {
                      body: {
                        organization_id: organizationId,
                      },
                    })
                    .then(({ data, error: fetchError }) => {
                      if (!fetchError && data?.jobs) {
                        // If admin, show all jobs. If worker, filter to only assigned jobs
                        let filteredJobs = data.jobs;
                        if (!isAdmin && worker) {
                          const workerJobIds = new Set(
                            data.jobs
                              .filter((job: any) =>
                                job.workers?.some(
                                  (w: any) => w.id === worker.id
                                )
                              )
                              .map((job: any) => job.id)
                          );

                          filteredJobs = data.jobs.filter((job: any) =>
                            workerJobIds.has(job.id)
                          );
                        }

                        const sortedJobs = filteredJobs.sort(
                          (a: Job, b: Job) =>
                            new Date(b.created_at || b.completed_at).getTime() -
                            new Date(a.created_at || a.completed_at).getTime()
                        );
                        setJobs(sortedJobs);
                      }
                      setLoading(false);
                    });
                }
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
          >
            <View className="flex-col gap-3">
              {jobs.map((job) => (
                <Pressable
                  key={job.id}
                  className="bg-card rounded-xl p-4 border border-border/50 active:opacity-80"
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-card-foreground">
                        Job #{job.id.slice(0, 8)}
                      </Text>
                      {job.location?.name && (
                        <Text className="text-sm text-muted-foreground mt-1">
                          {job.location.name}
                        </Text>
                      )}
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      {formatDate(job.created_at || job.completed_at)}
                    </Text>
                  </View>
                  {job.workers && job.workers.length > 0 && (
                    <View className="flex-row items-center gap-1 mt-2">
                      <Ionicons
                        name="people-outline"
                        size={14}
                        color="rgb(100 116 139)"
                      />
                      <Text className="text-xs text-muted-foreground">
                        {job.workers.map((w: any) => w.name).join(", ")}
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
