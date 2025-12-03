"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import { cn } from "@/lib/utils";
import { MapPin, MapPinned, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

export interface LocationOverrideRow {
  id: string;
  scopeLabel: string;
  scopeType: "location" | "hierarchy";
  price: number;
  workerPayment?: number | null;
  pricingType?: string;
  effectiveAt?: string;
  expiresAt?: string | null;
  isActive?: boolean;
  isFuture?: boolean;
}

interface LocationOverridesMatrixProps {
  rows: LocationOverrideRow[];
  emptyMessage?: string;
  className?: string;
  onDelete?: (id: string) => Promise<void>;
  deletingIds?: Set<string>;
}

export function LocationOverridesMatrix({
  rows,
  emptyMessage = "No overrides yet",
  className,
  onDelete,
  deletingIds,
}: LocationOverridesMatrixProps) {
  const [open, setOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { formatCurrency } = useOrganizationCurrency();

  const formattedRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        formattedPrice: formatCurrency(row.price),
        formattedWorker:
          row.workerPayment !== undefined && row.workerPayment !== null
            ? formatCurrency(row.workerPayment)
            : null,
      })),
    [rows, formatCurrency]
  );

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "rounded-md border bg-muted/30 text-sm text-muted-foreground",
        className
      )}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left font-medium text-foreground">
        <span>Location overrides</span>
        <Badge variant="secondary">{rows.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {rows.length === 0 ? (
          <p className="px-3 pb-3 text-xs italic">{emptyMessage}</p>
        ) : (
          <div className="px-1 pb-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Customer price</TableHead>
                  <TableHead>Worker rate</TableHead>
                  <TableHead>Period</TableHead>
                  {onDelete && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {formattedRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      row.isActive === false && "opacity-50",
                      row.isFuture && "border-l-2 border-l-primary/50"
                    )}
                  >
                    <TableCell className="flex items-center gap-2 font-medium text-foreground">
                      {row.scopeType === "location" ? (
                        <MapPin className="h-4 w-4 text-primary" />
                      ) : (
                        <MapPinned className="h-4 w-4 text-primary" />
                      )}
                      <div className="flex items-center gap-2">
                        <span>{row.scopeLabel}</span>
                        {row.isFuture && (
                          <Badge variant="outline" className="text-xs">
                            Future
                          </Badge>
                        )}
                        {row.isActive === false && row.expiresAt && (
                          <Badge variant="secondary" className="text-xs">
                            Expired
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{row.formattedPrice}</TableCell>
                    <TableCell>
                      {row.formattedWorker ? row.formattedWorker : "–"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.effectiveAt && (
                        <div>
                          <div>From: {formatDate(row.effectiveAt)}</div>
                          {row.expiresAt ? (
                            <div>Until: {formatDate(row.expiresAt)}</div>
                          ) : (
                            <div className="text-muted-foreground/70">
                              No end date
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    {onDelete && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(row.id)}
                          disabled={deletingIds?.has(row.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CollapsibleContent>
      {onDelete && (
        <AlertDialog
          open={deleteConfirmId !== null}
          onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Override</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this override for{" "}
                {deleteConfirmId &&
                  rows.find((r) => r.id === deleteConfirmId)?.scopeLabel}
                ? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (deleteConfirmId && onDelete) {
                    await onDelete(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Collapsible>
  );
}
