/**
 * Client-side remittance PDF generation using @react-pdf/renderer.
 * S2 §2 O-3: client-side PDF, triggered after successful status updates.
 * S2 §6: itemize per-line metadata when values differ.
 */
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { format } from "date-fns";
import {
  type BatchWorkerPaymentRow,
  hoursFromCalculationDetails,
  poolWeightFromCalculationDetails,
} from "./export-batch-worker-csv";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 120,
    color: "#666",
  },
  value: {
    flex: 1,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableHeaderCell: {
    fontWeight: "bold",
    color: "#333",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  colJob: { width: "28%" },
  colSplit: { width: "9%", textAlign: "right", fontSize: 8 },
  colAmount: { width: "16%", textAlign: "right" },
  colDate: { width: "16%", textAlign: "right" },
  colRef: { width: "23%", textAlign: "right" },
  colHeadSplit: { width: "9%", fontSize: 8 },
  totalRow: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  totalLabel: {
    width: "28%",
    fontWeight: "bold",
  },
  totalAmount: {
    width: "16%",
    textAlign: "right",
    fontWeight: "bold",
  },
  splitSkip: { width: "9%" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
  disclaimer: {
    marginTop: 24,
    fontSize: 8,
    color: "#999",
    fontStyle: "italic",
  },
});

export interface RemittanceLineItem {
  id: string;
  jobName: string;
  amount: number;
  paidAt: string | null;
  paymentReference: string | null;
  paymentMethod: string | null;
  /** Rate-card pool weight when time-based (hours × weight). */
  poolWeight?: number | null;
  hoursWorked?: number | null;
}

export interface RemittancePdfData {
  organizationName: string;
  workerName: string;
  periodLabel: string;
  generatedAt: Date;
  currency: string;
  lines: RemittanceLineItem[];
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paymentDate?: string | null;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "dd MMM yyyy");
  } catch {
    return dateStr;
  }
}

function allReferencesMatch(lines: RemittanceLineItem[]): boolean {
  if (lines.length <= 1) return true;
  const first = lines[0]?.paymentReference ?? null;
  return lines.every((l) => (l.paymentReference ?? null) === first);
}

function formatWt(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return "—";
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

function formatPoolWeight(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return Number.isInteger(p) ? String(p) : p.toFixed(1);
}

function RemittanceDocument({ data }: { data: RemittancePdfData }) {
  const total = data.lines.reduce((sum, l) => sum + l.amount, 0);
  const showPerLineRef = !allReferencesMatch(data.lines);
  const singleRef = data.paymentReference ?? data.lines[0]?.paymentReference ?? null;
  const showSplitCols = data.lines.some(
    (l) => l.poolWeight != null || (l.hoursWorked != null && l.hoursWorked > 0)
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Remittance Advice</Text>
          <Text style={styles.subtitle}>{data.organizationName}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Payee:</Text>
            <Text style={styles.value}>{data.workerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Period:</Text>
            <Text style={styles.value}>{data.periodLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Amount:</Text>
            <Text style={styles.value}>{formatCurrency(total, data.currency)}</Text>
          </View>
          {data.paymentMethod && (
            <View style={styles.row}>
              <Text style={styles.label}>Payment Method:</Text>
              <Text style={styles.value}>{data.paymentMethod.replace(/_/g, " ")}</Text>
            </View>
          )}
          {!showPerLineRef && singleRef && (
            <View style={styles.row}>
              <Text style={styles.label}>Reference:</Text>
              <Text style={styles.value}>{singleRef}</Text>
            </View>
          )}
          {data.paymentDate && (
            <View style={styles.row}>
              <Text style={styles.label}>Payment Date:</Text>
              <Text style={styles.value}>{formatDate(data.paymentDate)}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Itemised Payments ({data.lines.length} job
            {data.lines.length === 1 ? "" : "s"})
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colJob]}>Job</Text>
              {showSplitCols && (
                <>
                  <Text style={[styles.tableHeaderCell, styles.colHeadSplit]}>Wt</Text>
                  <Text style={[styles.tableHeaderCell, styles.colHeadSplit]}>Hrs</Text>
                </>
              )}
              <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
              <Text style={[styles.tableHeaderCell, styles.colDate]}>Paid</Text>
              {showPerLineRef && (
                <Text style={[styles.tableHeaderCell, styles.colRef]}>Reference</Text>
              )}
            </View>
            {data.lines.map((line) => (
              <View key={line.id} style={styles.tableRow}>
                <Text style={styles.colJob}>{line.jobName}</Text>
                {showSplitCols && (
                  <>
                    <Text style={styles.colSplit}>{formatPoolWeight(line.poolWeight ?? null)}</Text>
                    <Text style={styles.colSplit}>{formatWt(line.hoursWorked ?? null)}</Text>
                  </>
                )}
                <Text style={styles.colAmount}>{formatCurrency(line.amount, data.currency)}</Text>
                <Text style={styles.colDate}>{formatDate(line.paidAt)}</Text>
                {showPerLineRef && (
                  <Text style={styles.colRef}>{line.paymentReference ?? "-"}</Text>
                )}
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              {showSplitCols && (
                <>
                  <Text style={styles.splitSkip}></Text>
                  <Text style={styles.splitSkip}></Text>
                </>
              )}
              <Text style={styles.totalAmount}>{formatCurrency(total, data.currency)}</Text>
              <Text style={styles.colDate}></Text>
              {showPerLineRef && <Text style={styles.colRef}></Text>}
            </View>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          This is a record of payments as stored in Tally. It is not a bank statement or official
          payslip. Please retain for your records.
        </Text>

        <Text style={styles.footer}>
          Generated {format(data.generatedAt, "dd MMM yyyy 'at' HH:mm")} · Tally Runner
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Generate and download a remittance PDF.
 */
export async function downloadRemittancePdf(data: RemittancePdfData): Promise<void> {
  const blob = await pdf(<RemittanceDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = data.workerName.replace(/[^a-zA-Z0-9]/g, "_");
  link.download = `remittance_${safeName}_${format(data.generatedAt, "yyyy-MM-dd")}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Build remittance line items with pool weight / hours from saved `calculation_details`.
 */
export function remittanceLineItemsFromWorkerRows(
  rows: BatchWorkerPaymentRow[],
  jobNameForId: (jobId: string) => string
): RemittanceLineItem[] {
  return rows.map((p) => {
    const hw = hoursFromCalculationDetails(p.calculation_details);
    const poolWeight = poolWeightFromCalculationDetails(p.calculation_details);
    return {
      id: p.id,
      jobName: jobNameForId(p.job_id),
      amount: p.amount,
      paidAt: p.paid_at,
      paymentReference: p.payment_reference,
      paymentMethod: p.payment_method,
      poolWeight,
      hoursWorked: hw,
    };
  });
}
