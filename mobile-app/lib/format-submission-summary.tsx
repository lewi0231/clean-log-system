import type { ReactNode } from "react";
import { Text, View } from "react-native";

type GroupedBreakdownItem = { brand: string; quantity: number };

function isGroupedBreakdownArray(value: unknown[]): value is GroupedBreakdownItem[] {
  return value.every(
    (item) => typeof item === "object" && item !== null && "brand" in item && "quantity" in item
  );
}

/**
 * Render submission_data from a job as readable rows for the mobile job summary screen.
 */
export function formatSubmissionDataRows(
  data: Record<string, unknown> | null | undefined
): ReactNode[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const rows: ReactNode[] = [];
  let rowIndex = 0;

  const walk = (obj: Record<string, unknown>, prefix = "") => {
    for (const [key, value] of Object.entries(obj)) {
      const label = prefix ? `${prefix} › ${humanizeKey(key)}` : humanizeKey(key);
      const keyId = `row-${rowIndex++}`;

      if (value === null || value === undefined) {
        rows.push(
          <View key={keyId} className="mb-2">
            <Text className="text-xs text-muted-foreground">{label}</Text>
            <Text className="text-sm text-foreground">—</Text>
          </View>
        );
        continue;
      }

      if (Array.isArray(value) && isGroupedBreakdownArray(value)) {
        rows.push(
          <View key={keyId} className="mb-3">
            <Text className="text-xs text-muted-foreground mb-2">{label}</Text>
            <View className="rounded-lg border border-border/50 overflow-hidden">
              {value.map((item, index) => (
                <View
                  key={`${item.brand}-${index}`}
                  className={`flex-row items-center justify-between px-3 py-2.5 ${
                    index < value.length - 1 ? "border-b border-border/30" : ""
                  }`}
                >
                  <Text className="text-sm text-foreground flex-1 mr-3">{item.brand}</Text>
                  <Text className="text-sm font-semibold text-foreground">{item.quantity}</Text>
                </View>
              ))}
            </View>
          </View>
        );
        continue;
      }

      if (typeof value === "object" && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, label);
        continue;
      }

      rows.push(
        <View key={keyId} className="mb-2">
          <Text className="text-xs text-muted-foreground">{label}</Text>
          <Text className="text-sm text-foreground">{formatLeaf(value)}</Text>
        </View>
      );
    }
  };

  walk(data);
  return rows;
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatLeaf(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((v) => formatLeaf(v)).join(", ");
  }
  return JSON.stringify(value);
}
