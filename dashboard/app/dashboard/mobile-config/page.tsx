"use client";

// 1. React
import { useState } from "react";

// 2. Third-party
import { Package, RotateCcw, Sparkles } from "lucide-react";

// 3. Internal components
import { VisualFormBuilder } from "@/components/form-builder";
import { MutuallyExclusiveGroupManager } from "@/components/form-builder/mutually-exclusive-group-manager";
import {
  AlertDialog,
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

// 4. Hooks
import { useMobileConfig } from "@/hooks/use-mobile-config";
import { useModeAwareLabels } from "@/hooks/use-mode-aware-labels";
import { useOrganizationSettings } from "@/hooks/use-organization-settings";
import useOrganization from "@/hooks/useOrganization";

// 5. Services/Utils
import { getTemplateDescription, getTemplateFields } from "@/lib/templates";

export default function MobileConfigPage() {
  const [advancedSectionOpen, setAdvancedSectionOpen] = useState(false);
  const [createdClusters, setCreatedClusters] = useState<string[]>([]);

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">
            Loading mobile application configuration...
          </p>
        </div>
      </div>
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
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="w-3/4">
            <h1 className="text-3xl font-bold tracking-tight">
              Mobile Application
            </h1>
            <p className="text-muted-foreground mt-2">
              {labels.mobileConfigDescription}
            </p>
          </div>
          {fieldConfigs.length > 0 && (
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
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Show template options when no field configs exist */}
        {fieldConfigs.length === 0 && !loading && (
          <Card>
            <CardHeader>
              <CardTitle>Get Started with a Template</CardTitle>
              <CardDescription>
                Start with a pre-configured set of fields tailored to your
                business mode, or build from scratch with the visual form
                builder.
                {settings?.business_mode && (
                  <span className="block mt-2 text-sm font-medium">
                    Recommended:{" "}
                    {settings.business_mode === "service_based"
                      ? "Service-Based Template"
                      : "Resource Tracking Template"}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <button
                    onClick={() => handleApplyTemplate("service_based")}
                    disabled={applyingTemplate}
                    className={`w-full flex flex-col rounded-lg border-2 p-6 hover:bg-accent hover:text-accent-foreground hover:border-primary cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left ${
                      settings?.business_mode === "service_based"
                        ? "border-primary bg-primary/5"
                        : "border-muted bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="font-semibold">
                          Service-Based Template
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Car Detailer
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {getTemplateDescription("service_based")}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <div className="font-medium mb-1">Includes:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {getTemplateFields("service_based").map((field) => (
                          <li key={field.name}>{field.label}</li>
                        ))}
                      </ul>
                    </div>
                  </button>
                </div>
                <div className="relative">
                  <button
                    onClick={() => handleApplyTemplate("resource_tracking")}
                    disabled={applyingTemplate}
                    className={`w-full flex flex-col rounded-lg border-2 p-6 hover:bg-accent hover:text-accent-foreground hover:border-primary cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left ${
                      settings?.business_mode === "resource_tracking"
                        ? "border-primary bg-primary/5"
                        : "border-muted bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Package className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="font-semibold">
                          Resource Tracking Template
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Car Yard Business
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {getTemplateDescription("resource_tracking")}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <div className="font-medium mb-1">Includes:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {getTemplateFields("resource_tracking").map((field) => (
                          <li key={field.name}>{field.label}</li>
                        ))}
                      </ul>
                    </div>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Show Visual Form Builder when fields exist */}
        {(fieldConfigs.length > 0 || loading) && (
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

        {/* Advanced Form Configuration */}
        <Collapsible
          open={advancedSectionOpen}
          onOpenChange={setAdvancedSectionOpen}
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Advanced Form Configuration</CardTitle>
                    <CardDescription className="mt-1">
                      Configure mutually exclusive groups and clusters for
                      advanced form behavior
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {advancedSectionOpen ? "Expanded" : "Collapsed"}
                  </Badge>
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
    </>
  );
}
