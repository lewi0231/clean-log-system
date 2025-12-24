"use client";

// 1. React
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// 2. Third-party
import { ChevronDown, ChevronRight, Package, Sparkles } from "lucide-react";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PageHeaderSkeleton } from "@/components/ui/skeleton-loaders";

// 4. Hooks
import { useMobileConfig } from "@/hooks/use-mobile-config";
import { useModeAwareLabels } from "@/hooks/use-mode-aware-labels";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import useOrganization from "@/hooks/useOrganization";

// 5. Services/Utils
import { organizationSettingsKey } from "@/app/query-provider";
import { supabase } from "@/lib/supabase";
import { getTemplateDescription } from "@/lib/templates";

export default function MobileConfigPage() {
  const [advancedSectionOpen, setAdvancedSectionOpen] = useState(false);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive">
            {orgError || "Failed to load organization"}
          </p>
        </div>
      </div>
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
              <TourTriggerButton />
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
          />
        )}

        {/* Choose One Options Configuration */}
        <Collapsible
          open={advancedSectionOpen}
          onOpenChange={setAdvancedSectionOpen}
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Advanced Options</CardTitle>
                  </div>
                  {advancedSectionOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
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
                    const { error } = await supabase.functions.invoke(
                      "update-organization-settings",
                      {
                        body: {
                          organization_id: organizationId,
                          default_exclusive_group_label: label,
                        },
                      }
                    );
                    if (error) throw error;
                    // Invalidate settings query to refetch updated data
                    queryClient.invalidateQueries({
                      queryKey: organizationSettingsKey(organizationId),
                    });
                  }}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

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
