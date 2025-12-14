"use client";

import CreateInvoiceDialog from "@/components/invoicing/create-invoice-dialog";
import InvoiceList from "@/components/invoicing/invoice-list";
import InvoicePreviewDialog from "@/components/invoicing/invoice-preview-dialog";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton-loaders";
import useOrganization from "@/hooks/useOrganization";
import type { InvoiceWithJobs } from "@/lib/types";
import { Plus } from "lucide-react";
import { useState } from "react";

export default function InvoicingPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);

  const handleInvoiceClick = (invoice: InvoiceWithJobs) => {
    setPreviewInvoiceId(invoice.id);
    setPreviewDialogOpen(true);
  };

  const handlePreviewDialogClose = (open: boolean) => {
    setPreviewDialogOpen(open);
    if (!open) {
      // Clear invoice ID when closing to reset state
      setPreviewInvoiceId(null);
    }
  };

  if (orgLoading) {
    return (
      <>
        <PageHeaderSkeleton />
        <div className="space-y-4">
          <TableSkeleton rows={5} columns={5} />
        </div>
      </>
    );
  }

  if (orgError || !organizationId) {
    return (
      <ErrorState
        message={orgError || "Failed to load organization"}
        fullScreen
      />
    );
  }

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoicing</h1>
          <p className="text-muted-foreground mt-2">
            Create invoices from completed jobs and view invoice history
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      <InvoiceList onInvoiceClick={handleInvoiceClick} />

      <CreateInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          // Dialog will close automatically, list will refresh via hook
        }}
      />

      <InvoicePreviewDialog
        open={previewDialogOpen}
        onOpenChange={handlePreviewDialogClose}
        invoiceId={previewInvoiceId}
      />
    </>
  );
}
