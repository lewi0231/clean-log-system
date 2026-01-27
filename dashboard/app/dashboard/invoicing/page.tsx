"use client";

import { organizationSettingsKey } from "@/app/query-provider";
import CreateInvoiceDialog from "@/components/invoicing/create-invoice-dialog";
import InvoiceList from "@/components/invoicing/invoice-list";
import InvoicePreviewDialog from "@/components/invoicing/invoice-preview-dialog";
import InvoiceTemplateSettings from "@/components/settings/invoice-template-settings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton-loaders";
import { Switch } from "@/components/ui/switch";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import { useOrganizationUsers } from "@/hooks/use-organization-users";
import { useAuth } from "@/hooks/useAuth";
import useOrganization from "@/hooks/useOrganization";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { InvoiceWithJobs } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, Settings } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export default function InvoicingPage() {
  const searchParams = useSearchParams();
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { settings, loading: settingsLoading } = useOrganizationSettings();
  const { user } = useAuth();
  const { organizationUsers } = useOrganizationUsers();
  const queryClient = useQueryClient();
  const isAdmin = useMemo(() => {
    if (!user?.email || !organizationUsers.length) return false;
    const currentUser = organizationUsers.find((ou) => ou.email === user.email);
    return currentUser?.role === "admin";
  }, [user, organizationUsers]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [invoiceSettingsOpen, setInvoiceSettingsOpen] = useState(false);

  const handleInvoiceSendImmediatelyChange = async (checked: boolean) => {
    if (!organizationId) return;

    try {
      log.info("Invoicing: Updating invoice send immediately setting", {
        checked,
      });

      const { error: updateError } = await supabase.functions.invoke(
        "update-organization-settings",
        {
          body: {
            organization_id: organizationId,
            invoice_send_immediately: checked,
          },
        },
      );

      if (updateError) {
        throw updateError;
      }

      // Invalidate settings query to refetch updated data
      queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });

      log.info(
        "Invoicing: Invoice send immediately setting updated successfully",
      );
    } catch (err) {
      log.error(
        "Invoicing: Failed to update invoice send immediately setting",
        {
          error: err instanceof Error ? err.message : "Unknown error",
        },
      );
      alert("Failed to update setting. Please try again.");
    }
  };

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

      {/* Invoice Settings */}
      <Collapsible
        open={invoiceSettingsOpen}
        onOpenChange={setInvoiceSettingsOpen}
        className="mb-6"
      >
        <Card className="border-primary/20 bg-primary/5">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-primary/10 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <CardTitle>Invoice Settings</CardTitle>
                    <CardDescription className="mt-1">
                      Configure invoice behavior and template appearance
                    </CardDescription>
                  </div>
                </div>
                {invoiceSettingsOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Invoice Sending Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="invoice-send-immediately">
                      Send Invoices Immediately
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {settings?.invoice_send_immediately
                        ? "Invoices will be sent to customers immediately upon creation"
                        : "Invoices will be created in draft status and require review before sending"}
                    </p>
                  </div>
                  <Switch
                    id="invoice-send-immediately"
                    checked={settings?.invoice_send_immediately ?? false}
                    onCheckedChange={handleInvoiceSendImmediatelyChange}
                    disabled={settingsLoading}
                    className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/50 data-[state=unchecked]:border-2 data-[state=unchecked]:border-muted-foreground/30"
                  />
                </div>
              </div>

              {/* Invoice Template Settings */}
              <div className="pt-4 border-t">
                <InvoiceTemplateSettings />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <InvoiceList
        onInvoiceClick={handleInvoiceClick}
        initialStatusFilter={searchParams.get("status") || undefined}
        isAdmin={isAdmin}
      />

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
