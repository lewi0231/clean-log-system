import { useCurrentWorker } from "@/hooks/use-current-worker";
import { useUserRole } from "@/hooks/use-user-role";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { formatSubmissionDataRows } from "@/lib/format-submission-summary";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type JobWorker = {
  id: string;
  name: string;
  confirmation_status?: string;
};

type JobDetail = {
  id: string;
  created_at: string;
  completed_at?: string;
  approval_status?: string;
  submission_data?: Record<string, unknown> | null;
  location?: { name?: string; address?: string };
  workers?: JobWorker[];
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { worker } = useCurrentWorker();
  const { organizationId, loading: orgLoading } = useOrganization();
  const { isAdmin } = useUserRole();

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJob = useCallback(async () => {
    if (!user || !organizationId || !id) {
      if (!orgLoading) setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fetchError } = await supabase.functions.invoke(
        "list-jobs",
        {
          body: { organization_id: organizationId },
        },
      );

      if (fetchError) {
        setError("Failed to load job.");
        return;
      }

      let list = (data?.jobs || []) as JobDetail[];
      if (!isAdmin && worker) {
        const workerJobIds = new Set(
          list
            .filter((j) => j.workers?.some((w) => w.id === worker.id))
            .map((j) => j.id),
        );
        list = list.filter((j) => workerJobIds.has(j.id));
      }

      const found = list.find((j) => j.id === id);
      if (!found) {
        setError("Job not found or you do not have access.");
        setJob(null);
        return;
      }

      setJob(found);
    } catch {
      setError("Failed to load job.");
    } finally {
      setLoading(false);
    }
  }, [user, organizationId, id, isAdmin, worker, orgLoading]);

  useEffect(() => {
    setLoading(true);
    loadJob();
  }, [loadJob]);

  const summaryRows = job?.submission_data
    ? formatSubmissionDataRows(job.submission_data)
    : [];

  if (loading || orgLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="px-4 pt-2 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 py-2"
          >
            <Ionicons name="chevron-back" size={24} color="rgb(59 130 246)" />
            <Text className="text-primary font-medium">Back</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-muted-foreground">
            {error || "Job not found."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const completed =
    job.completed_at || job.created_at
      ? new Date(job.completed_at || job.created_at).toLocaleString()
      : "—";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-4 pt-2 pb-3 border-b border-border/50 flex-row items-center justify-between">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1 py-2"
        >
          <Ionicons name="chevron-back" size={24} color="rgb(59 130 246)" />
          <Text className="text-primary font-medium">Jobs</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <Text className="text-xl font-bold text-foreground mb-1">
          {job.location?.name || `Job #${job.id.slice(0, 8)}`}
        </Text>
        <Text className="text-xs text-muted-foreground mb-4">
          ID {job.id.slice(0, 8)}… · {completed}
        </Text>

        {job.approval_status ? (
          <View className="mb-4">
            <Text className="text-xs text-muted-foreground mb-1">Status</Text>
            <Text className="text-sm font-medium text-foreground capitalize">
              {job.approval_status}
            </Text>
          </View>
        ) : null}

        {job.location?.address ? (
          <View className="mb-4">
            <Text className="text-xs text-muted-foreground mb-1">Address</Text>
            <Text className="text-sm text-foreground">{job.location.address}</Text>
          </View>
        ) : null}

        {job.workers && job.workers.length > 0 ? (
          <View className="mb-4">
            <Text className="text-xs text-muted-foreground mb-2">Workers</Text>
            <View className="flex-row flex-wrap gap-2">
              {job.workers.map((w) => (
                <View
                  key={w.id}
                  className="px-2 py-1 rounded-full bg-muted"
                >
                  <Text className="text-xs text-foreground">
                    {w.id === worker?.id ? "You" : w.name}
                    {w.confirmation_status === "confirmed" ? " ✓" : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text className="text-sm font-semibold text-foreground mb-2 mt-2">
          Submitted details
        </Text>
        {summaryRows.length === 0 ? (
          <Text className="text-sm text-muted-foreground">
            No field data was stored for this job.
          </Text>
        ) : (
          <View className="bg-card rounded-xl p-4 border border-border/50">
            {summaryRows}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
