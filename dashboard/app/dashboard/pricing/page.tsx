"use client";

import BasePricingEditor from "@/components/pricing/base-pricing-editor";
import { InvoiceAdjustmentsGstHint } from "@/components/pricing/invoice-adjustments-gst-hint";
import BooleanPricingList from "@/components/pricing/boolean-pricing-list";
import { useLocationFixedPricingGuard } from "@/components/pricing/location-fixed-pricing-guard";
import NumberPricingList from "@/components/pricing/number-pricing-list";
import OptionPricingEditor from "@/components/pricing/option-pricing-editor";
import { PricingHistory } from "@/components/pricing/pricing-history";
import { PricingScopeProvider, usePricingScope } from "@/components/pricing/pricing-scope-context";
import {
  PricingFieldTypeNav,
  type InnerFieldType,
} from "@/components/pricing/pricing-field-type-nav";
import TestInvoiceModal from "@/components/pricing/test-invoice-modal";
import { PageTourWrapper } from "@/components/tours/page-tour-wrapper";
import { pricingTourSteps } from "@/components/tours/tour-definitions";
import { TourTriggerButton } from "@/components/tours/tour-trigger-button";
import { ContextualHelp } from "@/components/ui/contextual-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { FormSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton-loaders";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import useOrganization from "@/hooks/useOrganization";
import {
  AlertTriangle,
  CheckSquare,
  DollarSign,
  ExternalLink,
  Hash,
  Layers,
  List,
  ScrollText,
  Sparkles,
  TestTube,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function PricingPage() {
  const { organizationId, loading: orgLoading, error: orgError } = useOrganization();
  const { fieldConfigs, loading: fieldConfigsLoading } = useFieldConfigs();

  // Filter fields by type for each pricing tab
  const numberFields = useMemo(() => {
    return fieldConfigs.filter((fc) => fc.field_type === "number");
  }, [fieldConfigs]);

  const booleanFields = useMemo(() => {
    return fieldConfigs.filter((fc) => fc.field_type === "boolean");
  }, [fieldConfigs]);

  const selectFields = useMemo(() => {
    return fieldConfigs.filter((fc) => fc.field_type === "select");
  }, [fieldConfigs]);

  const groupedBreakdownFields = useMemo(() => {
    return fieldConfigs.filter((fc) => fc.field_type === "grouped_breakdown");
  }, [fieldConfigs]);

  if (orgLoading) {
    return (
      <>
        <PageHeaderSkeleton />
        <div className="space-y-6">
          <div className="h-10 w-64 bg-muted animate-pulse rounded-md" />
          <FormSkeleton fields={6} />
        </div>
      </>
    );
  }

  if (orgError || !organizationId) {
    return <ErrorState message={orgError || "Failed to load organization"} fullScreen />;
  }

  return (
    <PricingScopeProvider fieldConfigs={fieldConfigs}>
      <PricingPageContent
        numberFields={numberFields}
        booleanFields={booleanFields}
        selectFields={selectFields}
        groupedBreakdownFields={groupedBreakdownFields}
        fieldConfigs={fieldConfigs}
        fieldConfigsLoading={fieldConfigsLoading}
        organizationId={organizationId}
      />
    </PricingScopeProvider>
  );
}

interface PricingPageContentProps {
  numberFields: ReturnType<typeof useFieldConfigs>["fieldConfigs"];
  booleanFields: ReturnType<typeof useFieldConfigs>["fieldConfigs"];
  selectFields: ReturnType<typeof useFieldConfigs>["fieldConfigs"];
  groupedBreakdownFields: ReturnType<typeof useFieldConfigs>["fieldConfigs"];
  fieldConfigs: ReturnType<typeof useFieldConfigs>["fieldConfigs"];
  fieldConfigsLoading: boolean;
  organizationId: string | null;
}

function PricingPageContent({
  numberFields,
  booleanFields,
  selectFields,
  groupedBreakdownFields,
  fieldConfigs,
  fieldConfigsLoading,
  organizationId,
}: PricingPageContentProps) {
  const { locationNodeId, locationId, effectiveDate, setShowBothContexts } = usePricingScope();

  // Set showBothContexts to true for pricing page (all components show both customer and worker pricing)
  useEffect(() => {
    setShowBothContexts(true);
  }, [setShowBothContexts]);

  const { isFixedPricing, location } = useLocationFixedPricingGuard(null);
  const { formatCurrency } = useOrganizationCurrency();
  const [testInvoiceOpen, setTestInvoiceOpen] = useState(false);
  const [mainTab, setMainTab] = useState("pricing");

  const resolvedMainTab = isFixedPricing && mainTab === "invoice-adjustments" ? "pricing" : mainTab;

  // Check if there are any priceable fields
  const totalPriceableFields =
    numberFields.length +
    booleanFields.length +
    selectFields.length +
    groupedBreakdownFields.length;
  const hasNoPriceableFields = totalPriceableFields === 0;

  // Determine the first active field type (leftmost type that has fields)
  const defaultFieldType = useMemo((): InnerFieldType => {
    if (!isFixedPricing) {
      if (numberFields.length > 0) return "number-pricing";
      if (booleanFields.length > 0) return "boolean-pricing";
      if (selectFields.length > 0) return "select-pricing";
      if (groupedBreakdownFields.length > 0) return "group-pricing";
    }
    // Fallback to number-pricing if all are disabled or empty
    return "number-pricing";
  }, [
    isFixedPricing,
    numberFields.length,
    booleanFields.length,
    selectFields.length,
    groupedBreakdownFields.length,
  ]);

  // Inner field type selection for sidebar navigation (S2 §4.1.2)
  const [innerFieldType, setInnerFieldType] = useState<InnerFieldType>(defaultFieldType);

  // Callback for "View history" from field cards (S2 §4.6.4)
  const handleNavigateToHistory = useCallback(() => {
    setMainTab("history");
  }, []);

  return (
    <PageTourWrapper pageId="pricing" steps={pricingTourSteps}>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
          <p className="text-muted-foreground mt-2">
            Configure customer pricing and worker payments. Customer pricing is used for invoicing,
            while worker payments determine how much workers are paid for completed jobs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TourTriggerButton />
        </div>
      </div>

      <Tabs value={resolvedMainTab} onValueChange={setMainTab} className="space-y-6">
        <TabsList className="w-full h-auto min-h-10 flex-wrap justify-start gap-1">
          <TabsTrigger
            value="pricing"
            className="cursor-pointer"
            title="Set prices by field type for the current scope"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Pricing
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="cursor-pointer"
            title="Chronological log of pricing changes—what changed, when, and the scope they applied to"
          >
            <ScrollText className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          {!isFixedPricing && (
            <TabsTrigger
              value="invoice-adjustments"
              className="cursor-pointer"
              title="Call-out fees, markups, and other base invoice adjustments for the current scope"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Invoice adjustments
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="pricing" className="space-y-6">
          {isFixedPricing && location && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">Fixed Pricing Enabled for This Location</p>
                    <p className="text-xs text-muted-foreground">
                      This location uses fixed pricing. Customer pricing rules do not apply. All
                      jobs at this location will be charged a fixed price.
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Customer Price: </span>
                        <span className="font-medium">
                          {formatCurrency(location.fixed_customer_price || 0)}
                        </span>
                      </div>
                      {location.fixed_worker_payment !== null && (
                        <div>
                          <span className="text-muted-foreground">Worker Payment: </span>
                          <span className="font-medium">
                            {formatCurrency(location.fixed_worker_payment || 0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <Link
                      href="/dashboard/locations"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                    >
                      Edit in Location Settings
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-6">
            {/* Smart Empty State for First-Time Users */}
            {hasNoPriceableFields && (
              <Card className="border-dashed">
                <CardContent className="py-12">
                  <div className="text-center space-y-6 max-w-lg mx-auto">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <DollarSign className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold">Ready to set up pricing?</h3>
                      <p className="text-muted-foreground">
                        It all starts with your first field. Create fields in your mobile app forms,
                        and they&apos;ll appear here for pricing.
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-left">
                      <p className="text-sm font-medium mb-2">Field types you can price:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-blue-500" />
                          <span>
                            <strong>Number</strong> — count items (e.g., windows, panels)
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-green-500" />
                          <span>
                            <strong>Boolean</strong> — yes/no options (e.g., premium materials)
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <List className="h-4 w-4 text-purple-500" />
                          <span>
                            <strong>Select</strong> — dropdown choices (e.g., service tier)
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-orange-500" />
                          <span>
                            <strong>Group</strong> — categorized counts (e.g., car makes)
                          </span>
                        </li>
                      </ul>
                    </div>
                    <Link href="/dashboard/mobile-config">
                      <Button size="lg" className="gap-2">
                        Create Your First Field
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {!hasNoPriceableFields && (
              <div className="grid grid-cols-1 lg:grid-cols-[14rem_1fr] gap-6">
                {/* Sidebar: Field type navigation (desktop: vertical, mobile: horizontal scroll) */}
                <aside className="hidden lg:block">
                  <PricingFieldTypeNav
                    value={innerFieldType}
                    onValueChange={setInnerFieldType}
                    numberCount={numberFields.length}
                    booleanCount={booleanFields.length}
                    selectCount={selectFields.length}
                    groupCount={groupedBreakdownFields.length}
                    disabled={fieldConfigsLoading}
                    isFixedPricing={isFixedPricing}
                  />
                </aside>

                {/* Mobile: Horizontal scroll row of field types */}
                <div className="lg:hidden overflow-x-auto -mx-4 px-4 pb-2">
                  <div className="flex gap-2 min-w-max" role="radiogroup" aria-label="Field type">
                    {[
                      {
                        type: "number-pricing" as const,
                        label: "Number",
                        count: numberFields.length,
                        icon: Hash,
                        color: "blue",
                      },
                      {
                        type: "boolean-pricing" as const,
                        label: "Boolean",
                        count: booleanFields.length,
                        icon: CheckSquare,
                        color: "green",
                      },
                      {
                        type: "select-pricing" as const,
                        label: "Select",
                        count: selectFields.length,
                        icon: List,
                        color: "purple",
                      },
                      {
                        type: "group-pricing" as const,
                        label: "Group",
                        count: groupedBreakdownFields.length,
                        icon: Layers,
                        color: "orange",
                      },
                    ].map(({ type, label, count, icon: Icon, color }) => {
                      const isSelected = innerFieldType === type;
                      const isDisabled = isFixedPricing || count === 0;
                      return (
                        <button
                          key={type}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          disabled={isDisabled}
                          onClick={() => !isDisabled && setInnerFieldType(type)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap min-h-[44px] transition-colors
                            ${isSelected ? "bg-primary/10 border border-primary/30 text-primary font-medium" : "bg-muted/50 border border-transparent hover:bg-muted"}
                            ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <Icon className={`h-4 w-4 text-${color}-600 dark:text-${color}-400`} />
                          {label}
                          <span className="text-xs text-muted-foreground">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Main content area */}
                <main className="min-h-0 overflow-y-auto">
                  {/* Number Field Pricing */}
                  {innerFieldType === "number-pricing" && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-1 flex-wrap">
                          <CardTitle>Number Field Pricing</CardTitle>
                          <ContextualHelp label="How number field pricing works">
                            <p>
                              If &quot;Windows&quot; costs $5 each and a worker enters 10 windows →{" "}
                              <span className="font-medium text-foreground">$50</span>
                            </p>
                          </ContextualHelp>
                        </div>
                        <CardDescription>
                          Set per-unit prices for countable items. Workers enter a quantity, and the
                          price is calculated automatically.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <NumberPricingList
                          fieldConfigs={fieldConfigs}
                          configsLoading={fieldConfigsLoading}
                          locationHierarchyId={null}
                          locationId={null}
                          effectiveAt={effectiveDate}
                          organizationId={organizationId}
                          onNavigateToHistory={handleNavigateToHistory}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Boolean Field Pricing */}
                  {innerFieldType === "boolean-pricing" && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-1 flex-wrap">
                          <CardTitle>Boolean Field Pricing</CardTitle>
                          <ContextualHelp label="How boolean field pricing works">
                            <p>
                              If &quot;Premium Materials&quot; costs $25 and is checked →{" "}
                              <span className="font-medium text-foreground">+$25</span> added to
                              invoice.
                            </p>
                          </ContextualHelp>
                        </div>
                        <CardDescription>
                          Set fixed prices for yes/no options. The price is added only when the
                          worker checks the box.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <BooleanPricingList
                          fieldConfigs={fieldConfigs}
                          configsLoading={fieldConfigsLoading}
                          locationHierarchyId={null}
                          locationId={null}
                          effectiveAt={effectiveDate}
                          organizationId={organizationId}
                          onNavigateToHistory={handleNavigateToHistory}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Select Field Pricing */}
                  {innerFieldType === "select-pricing" && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-1 flex-wrap">
                          <CardTitle>Select Field Pricing</CardTitle>
                          <ContextualHelp label="How select field pricing works">
                            <p>
                              If &quot;Service Type&quot; has Basic ($100) and Premium ($200), and
                              the worker selects Premium →{" "}
                              <span className="font-medium text-foreground">+$200</span>
                            </p>
                          </ContextualHelp>
                        </div>
                        <CardDescription>
                          Set different prices for each option in dropdown fields. Workers choose an
                          option, and its price is added to the invoice.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {selectFields.length > 0 ? (
                          <div className="space-y-8">
                            {selectFields.map((fieldConfig) => (
                              <OptionPricingEditor
                                key={fieldConfig.id}
                                fieldConfig={fieldConfig}
                                fieldLabel={fieldConfig.label}
                                showBulkOverride
                                effectiveAt={effectiveDate}
                                organizationId={organizationId}
                                disabled={isFixedPricing}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="py-8">
                            <div className="text-center space-y-4 max-w-md mx-auto">
                              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto">
                                <List className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div className="space-y-2">
                                <h3 className="font-semibold">No select fields... yet</h3>
                                <p className="text-sm text-muted-foreground">
                                  Select fields let customers choose options like &quot;Basic&quot;
                                  or &quot;Premium&quot; service tiers. Add one to your mobile app
                                  forms to set option-based pricing.
                                </p>
                              </div>
                              <Link href="/dashboard/mobile-config" className="cursor-pointer">
                                <Button variant="outline" size="sm">
                                  Go to Mobile App Configuration
                                </Button>
                              </Link>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Group Field Pricing */}
                  {innerFieldType === "group-pricing" && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-1 flex-wrap">
                          <CardTitle>Group Field Pricing</CardTitle>
                          <ContextualHelp label="How grouped breakdown pricing works">
                            <p>
                              If Nissan costs $7 and Toyota costs $8, and the worker enters 5 Nissan
                              + 3 Toyota →{" "}
                              <span className="font-medium text-foreground">$35 + $24 = $59</span>
                            </p>
                          </ContextualHelp>
                        </div>
                        <CardDescription>
                          Set per-unit prices for each category in grouped breakdown fields. Workers
                          count items by group, and each group can have its own price.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {groupedBreakdownFields.length > 0 ? (
                          <div className="space-y-8">
                            {groupedBreakdownFields.map((fieldConfig) => (
                              <OptionPricingEditor
                                key={fieldConfig.id}
                                fieldConfig={fieldConfig}
                                fieldLabel={fieldConfig.label}
                                showBulkOverride
                                effectiveAt={effectiveDate}
                                organizationId={organizationId}
                                disabled={isFixedPricing}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="py-8">
                            <div className="text-center space-y-4 max-w-md mx-auto">
                              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto">
                                <Layers className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                              </div>
                              <div className="space-y-2">
                                <h3 className="font-semibold">
                                  No grouped breakdown fields... yet
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Grouped breakdown fields let workers count items by category
                                  (e.g., &quot;5 Nissan, 3 Toyota&quot;). Add one to your mobile app
                                  forms to set per-group pricing.
                                </p>
                              </div>
                              <Link href="/dashboard/mobile-config" className="cursor-pointer">
                                <Button variant="outline" size="sm">
                                  Go to Mobile App Configuration
                                </Button>
                              </Link>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </main>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <div data-tour="pricing-history-tab">
            <PricingHistory organizationId={organizationId} />
          </div>
        </TabsContent>

        {!isFixedPricing && (
          <TabsContent
            value="invoice-adjustments"
            className="space-y-6"
            data-tour="invoice-adjustments"
          >
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <CardTitle className="text-base">Invoice adjustments</CardTitle>
                      <ContextualHelp label="How invoice adjustments work">
                        <p>
                          Add a call-out fee or a markup to every invoice. Example:{" "}
                          <span className="font-medium text-foreground">
                            $100 job + $50 fee = $150
                          </span>
                          , or multiply by 1.15 for a 15% markup.
                        </p>
                      </ContextualHelp>
                    </div>
                    <CardDescription>
                      Add call-out fees, markups, or service-based adjustments to every invoice.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <InvoiceAdjustmentsGstHint />
                <BasePricingEditor
                  fieldConfigs={fieldConfigs}
                  locationHierarchyId={locationNodeId}
                  locationId={locationId}
                  effectiveAt={effectiveDate}
                  organizationId={organizationId}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Sticky Test Invoice Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setTestInvoiceOpen(true)}
          size="lg"
          className="shadow-lg gap-2 cursor-pointer"
        >
          <TestTube className="h-4 w-4" />
          Test Invoice
        </Button>
      </div>

      <TestInvoiceModal
        open={testInvoiceOpen}
        onOpenChange={setTestInvoiceOpen}
        organizationId={organizationId}
        fieldConfigs={fieldConfigs}
        fieldsLoading={fieldConfigsLoading}
      />
    </PageTourWrapper>
  );
}
