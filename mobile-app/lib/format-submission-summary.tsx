import type { ReactNode } from "react";
import { Text, View } from "react-native";
import {
  buildSubmissionSummaryEntries,
  type SubmissionSummaryOptions,
} from "@/lib/submission-summary-entries";

/**
 * Render submission_data from a job as readable rows for the mobile job summary screen.
 */
export function formatSubmissionDataRows(
  data: Record<string, unknown> | null | undefined,
  options: SubmissionSummaryOptions = {}
): ReactNode[] {
  return buildSubmissionSummaryEntries(data, options).map((entry, index) => {
    if (entry.kind === "grouped_breakdown") {
      return (
        <View key={`${entry.label}-${index}`} className="mb-3">
          <Text className="text-xs text-muted-foreground mb-2">{entry.label}</Text>
          <View className="rounded-lg border border-border/50 overflow-hidden">
            {entry.items.map((item, itemIndex) => (
              <View
                key={`${item.brand}-${itemIndex}`}
                className={`flex-row items-center justify-between px-3 py-2.5 ${
                  itemIndex < entry.items.length - 1 ? "border-b border-border/30" : ""
                }`}
              >
                <Text className="text-sm text-foreground flex-1 mr-3">{item.brand}</Text>
                <Text className="text-sm font-semibold text-foreground">{item.quantity}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (entry.kind === "worker_times") {
      return (
        <View key={`${entry.label}-${index}`} className="mb-3">
          <Text className="text-xs text-muted-foreground mb-2">{entry.label}</Text>
          <View className="rounded-lg border border-border/50 overflow-hidden">
            {entry.items.map((item, itemIndex) => (
              <View
                key={`${item.workerLabel}-${itemIndex}`}
                className={`flex-row items-center justify-between px-3 py-2.5 ${
                  itemIndex < entry.items.length - 1 ? "border-b border-border/30" : ""
                }`}
              >
                <Text className="text-sm text-foreground flex-1 mr-3">{item.workerLabel}</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {item.start} – {item.finish}
                </Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View key={`${entry.label}-${index}`} className="mb-2">
        <Text className="text-xs text-muted-foreground">{entry.label}</Text>
        <Text className="text-sm text-foreground">{entry.value}</Text>
      </View>
    );
  });
}
