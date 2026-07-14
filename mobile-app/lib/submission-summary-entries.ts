export type SubmissionSummaryEntry =
  | { kind: "field"; label: string; value: string }
  | { kind: "grouped_breakdown"; label: string; items: Array<{ brand: string; quantity: number }> };

type GroupedBreakdownItem = { brand: string; quantity: number };

function isGroupedBreakdownArray(value: unknown[]): value is GroupedBreakdownItem[] {
  return value.every(
    (item) => typeof item === "object" && item !== null && "brand" in item && "quantity" in item
  );
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

/**
 * Build a flat list of display entries from raw submission_data.
 * Shared by mobile screens and unit tests.
 */
export function buildSubmissionSummaryEntries(
  data: Record<string, unknown> | null | undefined
): SubmissionSummaryEntry[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const entries: SubmissionSummaryEntry[] = [];

  const walk = (obj: Record<string, unknown>, prefix = "") => {
    for (const [key, value] of Object.entries(obj)) {
      const label = prefix ? `${prefix} › ${humanizeKey(key)}` : humanizeKey(key);

      if (value === null || value === undefined) {
        entries.push({ kind: "field", label, value: "—" });
        continue;
      }

      if (Array.isArray(value) && isGroupedBreakdownArray(value)) {
        entries.push({ kind: "grouped_breakdown", label, items: value });
        continue;
      }

      if (typeof value === "object" && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, label);
        continue;
      }

      entries.push({ kind: "field", label, value: formatLeaf(value) });
    }
  };

  walk(data);
  return entries;
}
