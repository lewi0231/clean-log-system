"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { log } from "@/lib/logger";
import { WorkerTaxInvoiceService } from "@/lib/services/worker-tax-invoice.service";
import { getInvokeErrorMessage } from "@/lib/supabase/invoke-edge-function";
import type { WorkerTaxInvoice, WorkerTaxInvoiceStatus } from "@/lib/types";
import { format } from "date-fns";
import { Check, FileText, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface TaxInvoiceQueueProps {
  organizationId: string;
  isAdmin?: boolean;
  onHistoryPresenceChange?: (hasRows: boolean) => void;
}

function workerLabel(invoice: WorkerTaxInvoice): string {
  const w = invoice.worker;
  if (!w) return "Worker";
  if (w.name?.trim()) return w.name.trim();
  const parts = [w.first_name, w.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Worker";
}

function statusBadge(status: WorkerTaxInvoiceStatus) {
  const variants: Record<
    WorkerTaxInvoiceStatus,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    draft: "outline",
    submitted: "default",
    approved: "secondary",
    rejected: "destructive",
    cancelled: "outline",
    paid: "secondary",
  };
  return <Badge variant={variants[status] || "default"}>{status}</Badge>;
}

export default function TaxInvoiceQueue({
  organizationId,
  isAdmin = false,
  onHistoryPresenceChange,
}: TaxInvoiceQueueProps) {
  const { formatCurrency } = useOrganizationCurrency();
  const [invoices, setInvoices] = useState<WorkerTaxInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkerTaxInvoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await WorkerTaxInvoiceService.list(organizationId);
      setInvoices(rows);
      onHistoryPresenceChange?.(rows.length > 0);
    } catch (error) {
      log.error("TaxInvoiceQueue: list failed", { error });
      toast.error(getInvokeErrorMessage(error) || "Failed to load tax invoices");
    } finally {
      setLoading(false);
    }
  }, [organizationId, onHistoryPresenceChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (invoice: WorkerTaxInvoice) => {
    setDetailLoading(true);
    setSelected(invoice);
    try {
      const full = await WorkerTaxInvoiceService.get(organizationId, invoice.id);
      if (full) setSelected(full);
    } catch (error) {
      toast.error(getInvokeErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const runAction = async (fn: () => Promise<WorkerTaxInvoice | null>, successMessage: string) => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const updated = await fn();
      toast.success(successMessage);
      if (updated) setSelected(updated);
      await load();
    } catch (error) {
      toast.error(getInvokeErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const openPdf = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const { html } = await WorkerTaxInvoiceService.generatePdfHtml(organizationId, selected.id);
      if (!html) {
        toast.error("PDF content was empty");
        return;
      }
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Pop-up blocked — allow pop-ups to view the tax invoice");
        return;
      }
      win.document.write(html);
      win.document.close();
    } catch (error) {
      toast.error(getInvokeErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <TableSkeleton rows={5} columns={5} />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        Approving a tax invoice does not pay the worker or mark a remittance paid. Use Summary /
        History to record payouts separately when needed.
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => void load()} className="cursor-pointer">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {invoices.length === 0 ? (
        <p className="text-muted-foreground text-sm">No contractor tax invoices yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow
                key={invoice.id}
                className="cursor-pointer"
                onClick={() => void openDetail(invoice)}
              >
                <TableCell className="font-mono text-sm">
                  {invoice.invoice_number || "Draft"}
                </TableCell>
                <TableCell>{workerLabel(invoice)}</TableCell>
                <TableCell>{statusBadge(invoice.status)}</TableCell>
                <TableCell>
                  {invoice.submitted_at
                    ? format(new Date(invoice.submitted_at), "dd MMM yyyy")
                    : format(new Date(invoice.created_at), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(Number(invoice.total))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.invoice_number || "Draft tax invoice"}</DialogTitle>
            <DialogDescription>
              {selected ? workerLabel(selected) : ""} · {selected && statusBadge(selected.status)}
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !selected ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(Number(selected.total))}
                  </span>
                </div>
              </div>
              {selected.lines && selected.lines.length > 0 && (
                <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                  {selected.lines.map((line) => (
                    <li
                      key={line.id}
                      className="flex justify-between gap-4 border-b border-border/50 pb-2"
                    >
                      <span className="text-muted-foreground">
                        {line.description || "Job line"}
                      </span>
                      <span className="font-mono shrink-0">
                        {formatCurrency(Number(line.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button
              variant="outline"
              disabled={
                actionLoading ||
                !selected ||
                selected.status === "draft" ||
                !selected.invoice_number
              }
              onClick={() => void openPdf()}
              className="cursor-pointer"
            >
              <FileText className="mr-2 h-4 w-4" />
              View document
            </Button>
            {isAdmin && selected?.status === "submitted" && (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={actionLoading}
                  onClick={() =>
                    void runAction(
                      () => WorkerTaxInvoiceService.review(organizationId, selected.id, "reject"),
                      "Tax invoice rejected"
                    )
                  }
                  className="cursor-pointer"
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  disabled={actionLoading}
                  onClick={() =>
                    void runAction(
                      () => WorkerTaxInvoiceService.review(organizationId, selected.id, "approve"),
                      "Tax invoice approved"
                    )
                  }
                  className="cursor-pointer"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
            )}
            {isAdmin && selected?.status === "approved" && (
              <Button
                disabled={actionLoading}
                onClick={() =>
                  void runAction(
                    () =>
                      WorkerTaxInvoiceService.updateStatus(
                        organizationId,
                        selected.id,
                        "mark_paid"
                      ),
                    "Marked tax invoice as paid"
                  )
                }
                className="cursor-pointer"
              >
                Mark TI paid
              </Button>
            )}
            {isAdmin &&
              selected &&
              (selected.status === "draft" ||
                selected.status === "submitted" ||
                selected.status === "approved") && (
                <Button
                  variant="ghost"
                  disabled={actionLoading}
                  onClick={() =>
                    void runAction(
                      () =>
                        WorkerTaxInvoiceService.updateStatus(organizationId, selected.id, "cancel"),
                      "Tax invoice cancelled"
                    )
                  }
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
