import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useTheme } from "@/lib/theme-context";
import {
  cancelWorkerTaxInvoice,
  listWorkerTaxInvoices,
  submitWorkerTaxInvoice,
  type WorkerTaxInvoice,
} from "@/lib/worker-tax-invoices";

function formatMoney(amount: number, currency = "AUD") {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export default function TaxInvoicesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();
  const { organizationId } = useOrganization();
  const [invoices, setInvoices] = useState<WorkerTaxInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = session?.access_token;
    if (!organizationId || !token) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await listWorkerTaxInvoices(organizationId, token);
    if (result.ok) {
      setInvoices(result.invoices);
    } else {
      Alert.alert("Tax invoices", result.message);
    }
    setLoading(false);
  }, [organizationId, session?.access_token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onSubmit = (invoice: WorkerTaxInvoice) => {
    Alert.alert("Submit tax invoice", "Amounts will be recalculated. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Submit",
        onPress: async () => {
          const token = session?.access_token;
          if (!organizationId || !token) return;
          setBusyId(invoice.id);
          const result = await submitWorkerTaxInvoice(organizationId, invoice.id, token);
          setBusyId(null);
          if (!result.ok) {
            Alert.alert("Submit failed", result.message);
            return;
          }
          await load();
        },
      },
    ]);
  };

  const onCancel = (invoice: WorkerTaxInvoice) => {
    Alert.alert("Cancel draft?", "This draft will be cancelled.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel draft",
        style: "destructive",
        onPress: async () => {
          const token = session?.access_token;
          if (!organizationId || !token) return;
          setBusyId(invoice.id);
          const result = await cancelWorkerTaxInvoice(organizationId, invoice.id, token);
          setBusyId(null);
          if (!result.ok) {
            Alert.alert("Cancel failed", result.message);
            return;
          }
          await load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 px-4 pt-4 pb-3 border-b border-border/50">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text className="text-2xl font-bold text-foreground flex-1">Tax invoices</Text>
        <Pressable
          onPress={() => router.push("/tax-invoices/create" as Href)}
          className="bg-primary px-3 py-2 rounded-lg active:opacity-80"
        >
          <Text className="text-primary-foreground font-semibold text-sm">New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          ListEmptyComponent={
            <Text className="text-muted-foreground text-center mt-8">
              No tax invoices yet. Create one from approved jobs.
            </Text>
          }
          renderItem={({ item }) => (
            <View className="bg-card rounded-xl p-4 border border-border/50">
              <View className="flex-row justify-between items-start mb-2">
                <Text className="font-semibold text-card-foreground">
                  {item.invoice_number || "Draft"}
                </Text>
                <Text className="text-xs uppercase text-muted-foreground">{item.status}</Text>
              </View>
              <Text className="text-lg font-mono text-card-foreground mb-3">
                {formatMoney(Number(item.total), item.currency || "AUD")}
              </Text>
              {item.status === "draft" && (
                <View className="flex-row gap-2">
                  <Pressable
                    disabled={busyId === item.id}
                    onPress={() => onSubmit(item)}
                    className="flex-1 bg-primary rounded-lg py-2 items-center active:opacity-80"
                  >
                    <Text className="text-primary-foreground font-semibold">Submit</Text>
                  </Pressable>
                  <Pressable
                    disabled={busyId === item.id}
                    onPress={() => onCancel(item)}
                    className="px-4 rounded-lg py-2 border border-border items-center active:opacity-80"
                  >
                    <Text className="text-foreground">Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
