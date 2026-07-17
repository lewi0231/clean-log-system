import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorker } from "@/hooks/use-current-worker";
import { useOrganization } from "@/hooks/useOrganization";
import { fetchMyJobs, type MyJobListItem } from "@/lib/fetch-my-jobs";
import { useTheme } from "@/lib/theme-context";
import { draftWorkerTaxInvoice, submitWorkerTaxInvoice } from "@/lib/worker-tax-invoices";

function isEligibleJob(job: MyJobListItem, workerId: string | undefined): boolean {
  if (job.approval_status !== "approved") return false;
  if (!workerId) return false;
  const assignment = (job.workers || []).find((w) => w.id === workerId);
  if (!assignment) return false;
  if (assignment.confirmation_status === "flagged") return false;
  return true;
}

export default function CreateTaxInvoiceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();
  const { organizationId } = useOrganization();
  const { worker } = useCurrentWorker();
  const [jobs, setJobs] = useState<MyJobListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadJobs = useCallback(async () => {
    const token = session?.access_token;
    if (!organizationId || !token) {
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await fetchMyJobs(organizationId, token);
    if (result.ok) {
      setJobs(result.jobs.filter((j) => isEligibleJob(j, worker?.id)));
    } else {
      Alert.alert("Jobs", result.message);
    }
    setLoading(false);
  }, [organizationId, session?.access_token, worker?.id]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const onCreate = async () => {
    const token = session?.access_token;
    if (!organizationId || !token || selectedIds.length === 0) return;
    if (!worker?.abn?.trim()) {
      Alert.alert(
        "ABN required",
        "Add your ABN to your worker profile before submitting a tax invoice."
      );
      return;
    }

    setSubmitting(true);
    const draft = await draftWorkerTaxInvoice(organizationId, selectedIds, token);
    if (!draft.ok) {
      setSubmitting(false);
      Alert.alert("Draft failed", draft.message);
      return;
    }

    const submitted = await submitWorkerTaxInvoice(organizationId, draft.invoice.id, token);
    setSubmitting(false);
    if (!submitted.ok) {
      Alert.alert(
        "Submit failed",
        `${submitted.message}\n\nA draft may still be available in your list.`
      );
      router.replace("/tax-invoices" as Href);
      return;
    }

    Alert.alert("Submitted", `Tax invoice ${submitted.invoice.invoice_number || ""} created.`);
    router.replace("/tax-invoices" as Href);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 px-4 pt-4 pb-3 border-b border-border/50">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-2xl font-bold text-foreground flex-1">Select jobs</Text>
      </View>

      <Text className="px-4 pt-3 text-sm text-muted-foreground">
        Only approved jobs you worked on (and that are not flagged) can be included.
      </Text>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <FlatList
            data={jobs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100 }}
            ListEmptyComponent={
              <Text className="text-muted-foreground text-center mt-8">
                No eligible approved jobs found.
              </Text>
            }
            renderItem={({ item }) => {
              const checked = selected.has(item.id);
              return (
                <Pressable
                  onPress={() => toggle(item.id)}
                  className={`rounded-xl p-4 border flex-row items-center gap-3 ${
                    checked ? "border-primary bg-primary/5" : "border-border/50 bg-card"
                  }`}
                >
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={22}
                    color={checked ? colors.primary : colors.mutedForeground}
                  />
                  <View className="flex-1">
                    <Text className="font-medium text-card-foreground">
                      {item.location?.name || "Job"}
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-1">
                      {item.completed_at
                        ? new Date(item.completed_at).toLocaleDateString()
                        : new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />

          <View className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border/50">
            <Pressable
              disabled={submitting || selectedIds.length === 0}
              onPress={() => void onCreate()}
              className={`rounded-xl py-3 items-center ${
                submitting || selectedIds.length === 0 ? "bg-muted" : "bg-primary active:opacity-80"
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  className={`font-semibold ${
                    selectedIds.length === 0 ? "text-muted-foreground" : "text-primary-foreground"
                  }`}
                >
                  Draft & submit ({selectedIds.length})
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
