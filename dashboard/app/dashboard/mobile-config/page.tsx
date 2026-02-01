"use client";

// 1. React
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// 2. Third-party
import { HelpCircle, Package, Settings, Sparkles } from "lucide-react";

// 3. Internal components
import { VisualFormBuilder } from "@/components/form-builder";
import { MutuallyExclusiveGroupManager } from "@/components/form-builder/mutually-exclusive-group-manager";
import { PageTourWrapper } from "@/components/tours/page-tour-wrapper";
import { mobileConfigTourSteps } from "@/components/tours/tour-definitions";
import { TourTriggerButton } from "@/components/tours/tour-trigger-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PageHeaderSkeleton } from "@/components/ui/skeleton-loaders";
import { ErrorState } from "@/components/ui/error-state";

// 4. Hooks
import { useMobileConfig } from "@/hooks/use-mobile-config";
import { useModeAwareLabels } from "@/hooks/use-mode-aware-labels";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import useOrganization from "@/hooks/useOrganization";

// 5. Services/Utils
import { organizationSettingsKey } from "@/app/query-provider";
import { log } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
import { getTemplateDescription } from "@/lib/templates";
import { toast } from "sonner";

export default function MobileConfigPage() {
  const [advancedOptionsModalOpen, setAdvancedOptionsModalOpen] =
    useState(false);
  const [createdClusters, setCreatedClusters] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { settings, loading: settingsLoading } = useOrganizationSettings();
  const labels = useModeAwareLabels();

  const {
    fieldConfigs,
    optimisticFieldConfigs,
    sections,
    loading,
    applyingTemplate,
    handleAddFieldConfig,
    handleUpdateFieldConfig,
    handleDeleteFieldConfig,
    handleReorderFieldConfigs,
    handleAddSection,
    handleUpdateSection,
    handleDeleteSection,
    handleReorderSections,
    handleApplyTemplate,
  } = useMobileConfig(organizationId);

  const [resetTemplateMode, setResetTemplateMode] = useState<
    "service_based" | "resource_tracking" | null
  >(null);

  if (orgLoading || settingsLoading) {
    return (
      <>
        <PageHeaderSkeleton />
        <div className="space-y-6">
          <div className="h-10 w-64 bg-muted animate-pulse rounded-md" />
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              <div className="h-64 bg-muted animate-pulse rounded-lg" />
              <div className="h-32 bg-muted animate-pulse rounded-lg" />
            </div>
            <div className="h-96 bg-muted animate-pulse rounded-lg" />
          </div>
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
    <PageTourWrapper pageId="mobile-config" steps={mobileConfigTourSteps}>
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Mobile Application
                </h1>
                <p className="text-muted-foreground mt-2">
                  {labels.mobileConfigDescription}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAdvancedOptionsModalOpen(true)}
                  className="cursor-pointer"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Field Group Settings
                </Button>
                <TourTriggerButton />
              </div>
            </div>
          </div>
          {/* Reset to Template button disabled for now */}
          {/* {fieldConfigs.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                if (settings?.business_mode) {
                  setResetTemplateMode(settings.business_mode);
                }
              }}
              className="cursor-pointer"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Template
            </Button>
          )} */}
        </div>
      </div>

      <div className="space-y-6">
        {/* Template options disabled for now - need more specific information */}
        {/* {fieldConfigs.length === 0 && !loading && (
          <Card>
            <CardHeader>
              <CardTitle>Get Started with a Template</CardTitle>
              ...
            </CardHeader>
            ...
          </Card>
        )} */}

        {/* Show Visual Form Builder when fields exist or when loading */}
        {(fieldConfigs.length > 0 || loading || fieldConfigs.length === 0) && (
          <VisualFormBuilder
            fields={optimisticFieldConfigs}
            sections={sections}
            onAddField={handleAddFieldConfig}
            onUpdateField={handleUpdateFieldConfig}
            onDeleteField={handleDeleteFieldConfig}
            onReorderFields={handleReorderFieldConfigs}
            onAddSection={handleAddSection}
            onUpdateSection={handleUpdateSection}
            onDeleteSection={handleDeleteSection}
            onReorderSections={handleReorderSections}
            createdClusters={createdClusters}
            organizationId={organizationId}
          />
        )}
      </div>

      {/* Advanced Options Modal */}
      <Dialog
        open={advancedOptionsModalOpen}
        onOpenChange={setAdvancedOptionsModalOpen}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>Field Group Settings</DialogTitle>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/20"
                  >
                    <HelpCircle className="w-4 h-4 text-indigo-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-indigo-900 dark:text-indigo-200">
                      How it works?
                    </h4>
                    <p className="text-sm text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
                      Workers will see these options in a single-select dropdown
                      menu. When they select an option, only the fields assigned
                      to that option will be visible to them.
                    </p>
                    <p className="text-sm text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
                      This helps reduce clutter and ensures workers only fill
                      out relevant data for their specific task.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <DialogDescription>
              Configure how workers select specific task options in the field
            </DialogDescription>
          </DialogHeader>
          <MutuallyExclusiveGroupManager
            fields={optimisticFieldConfigs}
            onUpdateField={handleUpdateFieldConfig}
            createdClusters={createdClusters}
            onCreatedClustersChange={setCreatedClusters}
            defaultExclusiveGroupLabel={
              settings?.default_exclusive_group_label || null
            }
            onUpdateDefaultExclusiveGroupLabel={async (label) => {
              if (!organizationId) return;
              try {
                await invokeEdgeFunction<{ success?: boolean }>(
                  "update-organization-settings",
                  {
                    organization_id: organizationId,
                    default_exclusive_group_label: label,
                  },
                );
                toast.success("Field group label updated");
              } catch (err) {
                log.error("MobileConfig: Failed to update group label", {
                  message: err instanceof Error ? err.message : "Unknown error",
                });
                toast.error(
                  err instanceof Error
                    ? err.message
                    : "Failed to update field group label",
                );
                throw err;
              }
              // Invalidate settings query to refetch updated data
              queryClient.invalidateQueries({
                queryKey: organizationSettingsKey(organizationId),
              });
            }}
            isInModal={true}
          />
        </DialogContent>
      </Dialog>

      {/* Reset Template Dialog */}
      <AlertDialog
        open={resetTemplateMode !== null}
        onOpenChange={(open) => {
          if (!open) setResetTemplateMode(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all your current field configurations with the
              template fields. This action cannot be undone. Your existing
              fields will be archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <button
                onClick={() => {
                  if (resetTemplateMode) {
                    handleApplyTemplate("service_based", true).then(() => {
                      setResetTemplateMode(null);
                    });
                  }
                }}
                disabled={applyingTemplate}
                className={`flex flex-col rounded-lg border-2 p-4 hover:bg-accent hover:text-accent-foreground hover:border-primary cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left ${
                  resetTemplateMode === "service_based"
                    ? "border-primary bg-primary/5"
                    : "border-muted bg-card"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <div className="font-semibold text-sm">
                    Service-Based Template
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {getTemplateDescription("service_based")}
                </p>
              </button>
              <button
                onClick={() => {
                  if (resetTemplateMode) {
                    handleApplyTemplate("resource_tracking", true).then(() => {
                      setResetTemplateMode(null);
                    });
                  }
                }}
                disabled={applyingTemplate}
                className={`flex flex-col rounded-lg border-2 p-4 hover:bg-accent hover:text-accent-foreground hover:border-primary cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left ${
                  resetTemplateMode === "resource_tracking"
                    ? "border-primary bg-primary/5"
                    : "border-muted bg-card"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-primary" />
                  <div className="font-semibold text-sm">
                    Resource Tracking Template
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {getTemplateDescription("resource_tracking")}
                </p>
              </button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTourWrapper>
  );
}
