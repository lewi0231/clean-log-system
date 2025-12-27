"use client";

import BasePricingEditor from "@/components/pricing/base-pricing-editor";
import BooleanPricingList from "@/components/pricing/boolean-pricing-list";
import { useLocationFixedPricingGuard } from "@/components/pricing/location-fixed-pricing-guard";
import LocationScopeSelector from "@/components/pricing/location-scope-selector";
import NumberPricingList from "@/components/pricing/number-pricing-list";
import OptionPricingEditor from "@/components/pricing/option-pricing-editor";
import { PricingHistory } from "@/components/pricing/pricing-history";
import {
  PricingScopeProvider,
  usePricingScope,
} from "@/components/pricing/pricing-scope-context";
import TestInvoiceModal from "@/components/pricing/test-invoice-modal";
import { PageTourWrapper } from "@/components/tours/page-tour-wrapper";
import { pricingTourSteps } from "@/components/tours/tour-definitions";
import { TourTriggerButton } from "@/components/tours/tour-trigger-button";
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
import { ErrorState } from "@/components/ui/error-state";
import {
  FormSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/skeleton-loaders";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import useOrganization from "@/hooks/useOrganization";
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
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
import { useMemo, useState } from "react";

export default function PricingPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { fieldConfigs } = useFieldConfigs();

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
    return (
      <ErrorState
        message={orgError || "Failed to load organization"}
        fullScreen
      />
    );
  }

  return (
    <PricingScopeProvider>
      <PricingPageContent
        numberFields={numberFields}
        booleanFields={booleanFields}
        selectFields={selectFields}
        groupedBreakdownFields={groupedBreakdownFields}
      />
    </PricingScopeProvider>
  );
}

interface PricingPageContentProps {
  numberFields: ReturnType<typeof useFieldConfigs>["fieldConfigs"];
  booleanFields: ReturnType<typeof useFieldConfigs>["fieldConfigs"];
  selectFields: ReturnType<typeof useFieldConfigs>["fieldConfigs"];
  groupedBreakdownFields: ReturnType<typeof useFieldConfigs>["fieldConfigs"];
}

function PricingPageContent({
  numberFields,
  booleanFields,
  selectFields,
  groupedBreakdownFields,
}: PricingPageContentProps) {
  const {
    locationNodeId,
    setLocationNodeId,
    locationId,
    setLocationId,
    effectiveDate,
    setEffectiveDate,
    expirationDate,
    setExpirationDate,
  } = usePricingScope();

  const { isFixedPricing, location } = useLocationFixedPricingGuard(locationId);
  const { formatCurrency } = useOrganizationCurrency();
  const [testInvoiceOpen, setTestInvoiceOpen] = useState(false);
  const [adjustmentsExpanded, setAdjustmentsExpanded] = useState(false);

  // Check if there are any priceable fields
  const totalPriceableFields =
    numberFields.length +
    booleanFields.length +
    selectFields.length +
    groupedBreakdownFields.length;
  const hasNoPriceableFields = totalPriceableFields === 0;

  return (
    <PageTourWrapper pageId="pricing" steps={pricingTourSteps}>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
          <p className="text-muted-foreground mt-2">
            Configure customer pricing and worker payments. Prices are
            calculated using equations based on field values from completed
            jobs. Customer pricing is used for invoicing, while worker payments
            determine how much workers are paid for completed jobs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TourTriggerButton />
        </div>
      </div>

      <Tabs defaultValue="set-pricing" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="set-pricing" className="cursor-pointer">
            <DollarSign className="h-4 w-4 mr-2" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="pricing-history" className="cursor-pointer">
            <ScrollText className="h-4 w-4 mr-2" />
            Pricing History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="set-pricing" className="space-y-6">
          <div data-tour="location-scope">
            <LocationScopeSelector
              selectedNodeId={locationNodeId}
              selectedLocationId={locationId}
              onNodeChange={setLocationNodeId}
              onLocationChange={setLocationId}
              effectiveDate={effectiveDate}
              onEffectiveDateChange={setEffectiveDate}
              expirationDate={expirationDate}
              onExpirationDateChange={setExpirationDate}
            />
          </div>

          {isFixedPricing && location && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">
                      Fixed Pricing Enabled for This Location
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This location uses fixed pricing. Customer pricing rules
                      do not apply. All jobs at this location will be charged a
                      fixed price.
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Customer Price:{" "}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(location.fixed_customer_price || 0)}
                        </span>
                      </div>
                      {location.fixed_worker_payment !== null && (
                        <div>
                          <span className="text-muted-foreground">
                            Worker Payment:{" "}
                          </span>
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
            {/* Invoice Adjustments - Prominent Card Above Tabs */}
            {!isFixedPricing && (
              <Card
                className="border-primary/20 bg-primary/5"
                data-tour="invoice-adjustments"
              >
                <Collapsible
                  open={adjustmentsExpanded}
                  onOpenChange={setAdjustmentsExpanded}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-primary/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                            <CardTitle className="text-base">
                              Invoice Adjustments
                            </CardTitle>
                            <CardDescription>
                              Add call-out fees, markups, or service-based
                              adjustments to every invoice
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 text-muted-foreground transition-transform ${
                            adjustmentsExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="mb-4 bg-muted/50 rounded-md p-3 text-sm">
                        <p className="font-medium text-foreground">
                          How it works:
                        </p>
                        <p className="text-muted-foreground">
                          Add a $50 call-out fee to every invoice, or multiply
                          by 1.15 for a 15% markup →{" "}
                          <span className="font-medium text-foreground">
                            $100 job + $50 fee = $150
                          </span>
                        </p>
                      </div>
                      <BasePricingEditor
                        locationHierarchyId={locationNodeId}
                        locationId={locationId}
                        effectiveAt={effectiveDate}
                        showBothContexts={true}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            {/* Smart Empty State for First-Time Users */}
            {hasNoPriceableFields && (
              <Card className="border-dashed">
                <CardContent className="py-12">
                  <div className="text-center space-y-6 max-w-lg mx-auto">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <DollarSign className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold">
                        Ready to set up pricing?
                      </h3>
                      <p className="text-muted-foreground">
                        It all starts with your first field. Create fields in
                        your mobile app forms, and they&apos;ll appear here for
                        pricing.
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-left">
                      <p className="text-sm font-medium mb-2">
                        Field types you can price:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-blue-500" />
                          <span>
                            <strong>Number</strong> — count items (e.g.,
                            windows, panels)
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-green-500" />
                          <span>
                            <strong>Boolean</strong> — yes/no options (e.g.,
                            premium materials)
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <List className="h-4 w-4 text-purple-500" />
                          <span>
                            <strong>Select</strong> — dropdown choices (e.g.,
                            service tier)
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-orange-500" />
                          <span>
                            <strong>Group</strong> — categorized counts (e.g.,
                            car makes)
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

            {/* Field Type Pricing Tabs */}
            {!hasNoPriceableFields && (
              <Tabs defaultValue="number-pricing" className="space-y-6">
                <TabsList
                  className="w-full justify-start"
                  data-tour="pricing-tabs"
                >
                  <TabsTrigger
                    value="number-pricing"
                    disabled={isFixedPricing || numberFields.length === 0}
                    data-tour="number-pricing-tab"
                    className={`cursor-pointer ${
                      numberFields.length === 0 ? "opacity-50" : ""
                    }`}
                  >
                    <div className="h-5 w-5 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-2">
                      <Hash className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    </div>
                    Number
                    {numberFields.length > 0 ? (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {numberFields.length}
                      </Badge>
                    ) : (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (0)
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="boolean-pricing"
                    disabled={isFixedPricing || booleanFields.length === 0}
                    data-tour="boolean-pricing-tab"
                    className={`cursor-pointer ${
                      booleanFields.length === 0 ? "opacity-50" : ""
                    }`}
                  >
                    <div className="h-5 w-5 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-2">
                      <CheckSquare className="h-3 w-3 text-green-600 dark:text-green-400" />
                    </div>
                    Boolean
                    {booleanFields.length > 0 ? (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {booleanFields.length}
                      </Badge>
                    ) : (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (0)
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="select-pricing"
                    disabled={isFixedPricing || selectFields.length === 0}
                    data-tour="select-pricing-tab"
                    className={`cursor-pointer ${
                      selectFields.length === 0 ? "opacity-50" : ""
                    }`}
                  >
                    <div className="h-5 w-5 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mr-2">
                      <List className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                    </div>
                    Select
                    {selectFields.length > 0 ? (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {selectFields.length}
                      </Badge>
                    ) : (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (0)
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="group-pricing"
                    disabled={
                      isFixedPricing || groupedBreakdownFields.length === 0
                    }
                    data-tour="group-pricing-tab"
                    className={`cursor-pointer ${
                      groupedBreakdownFields.length === 0 ? "opacity-50" : ""
                    }`}
                  >
                    <div className="h-5 w-5 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mr-2">
                      <Layers className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                    </div>
                    Group
                    {groupedBreakdownFields.length > 0 ? (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {groupedBreakdownFields.length}
                      </Badge>
                    ) : (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (0)
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="number-pricing" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Number Field Pricing</CardTitle>
                      <CardDescription>
                        Set per-unit prices for countable items. Workers enter a
                        quantity, and the price is calculated automatically.
                      </CardDescription>
                      <div className="mt-3 bg-muted/50 rounded-md p-3 text-sm">
                        <p className="font-medium text-foreground">
                          How it works:
                        </p>
                        <p className="text-muted-foreground">
                          If &quot;Windows&quot; costs $5 each and a worker
                          enters 10 windows →{" "}
                          <span className="font-medium text-foreground">
                            $50
                          </span>
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <NumberPricingList
                        locationHierarchyId={locationNodeId}
                        locationId={locationId}
                        effectiveAt={effectiveDate}
                        showBothContexts={true}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="boolean-pricing" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Boolean Field Pricing</CardTitle>
                      <CardDescription>
                        Set fixed prices for yes/no options. The price is added
                        only when the worker checks the box.
                      </CardDescription>
                      <div className="mt-3 bg-muted/50 rounded-md p-3 text-sm">
                        <p className="font-medium text-foreground">
                          How it works:
                        </p>
                        <p className="text-muted-foreground">
                          If &quot;Premium Materials&quot; costs $25 and is
                          checked →{" "}
                          <span className="font-medium text-foreground">
                            +$25
                          </span>{" "}
                          added to invoice
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <BooleanPricingList
                        locationHierarchyId={locationNodeId}
                        locationId={locationId}
                        effectiveAt={effectiveDate}
                        showBothContexts={true}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="select-pricing" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Select Field Pricing</CardTitle>
                      <CardDescription>
                        Set different prices for each option in dropdown fields.
                        Workers choose an option, and its price is added to the
                        invoice.
                      </CardDescription>
                      <div className="mt-3 bg-muted/50 rounded-md p-3 text-sm">
                        <p className="font-medium text-foreground">
                          How it works:
                        </p>
                        <p className="text-muted-foreground">
                          If &quot;Service Type&quot; has Basic ($100) and
                          Premium ($200), and worker selects Premium →{" "}
                          <span className="font-medium text-foreground">
                            +$200
                          </span>
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {selectFields.length > 0 ? (
                        <div className="space-y-6">
                          {selectFields.map((fieldConfig) => (
                            <div key={fieldConfig.id} className="space-y-4">
                              <div>
                                <h3 className="text-lg font-semibold">
                                  {fieldConfig.label}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Configure pricing for each option in this
                                  field
                                </p>
                              </div>
                              <OptionPricingEditor
                                fieldConfig={fieldConfig}
                                locationHierarchyId={locationNodeId}
                                locationId={locationId}
                                effectiveAt={effectiveDate}
                                showBothContexts={true}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8">
                          <div className="text-center space-y-4 max-w-md mx-auto">
                            <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto">
                              <List className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="font-semibold">
                                No select fields... yet
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Select fields let customers choose options like
                                &quot;Basic&quot; or &quot;Premium&quot; service
                                tiers. Add one to your mobile app forms to set
                                option-based pricing.
                              </p>
                            </div>
                            <Link
                              href="/dashboard/mobile-config"
                              className="cursor-pointer"
                            >
                              <Button variant="outline" size="sm">
                                Go to Mobile App Configuration
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="group-pricing" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Group Field Pricing</CardTitle>
                      <CardDescription>
                        Set per-unit prices for each category in grouped
                        breakdown fields. Workers count items by group, and each
                        group can have its own price.
                      </CardDescription>
                      <div className="mt-3 bg-muted/50 rounded-md p-3 text-sm">
                        <p className="font-medium text-foreground">
                          How it works:
                        </p>
                        <p className="text-muted-foreground">
                          If Nissan costs $7 and Toyota costs $8, and worker
                          enters 5 Nissan + 3 Toyota →{" "}
                          <span className="font-medium text-foreground">
                            $35 + $24 = $59
                          </span>
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {groupedBreakdownFields.length > 0 ? (
                        <div className="space-y-6">
                          {groupedBreakdownFields.map((fieldConfig) => (
                            <div key={fieldConfig.id} className="space-y-4">
                              <div>
                                <h3 className="text-lg font-semibold">
                                  {fieldConfig.label}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Configure pricing for each group in this field
                                </p>
                              </div>
                              <OptionPricingEditor
                                fieldConfig={fieldConfig}
                                locationHierarchyId={locationNodeId}
                                locationId={locationId}
                                effectiveAt={effectiveDate}
                                showBothContexts={true}
                              />
                            </div>
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
                                Grouped breakdown fields let workers count items
                                by category (e.g., &quot;5 Nissan, 3
                                Toyota&quot;). Add one to your mobile app forms
                                to set per-group pricing.
                              </p>
                            </div>
                            <Link
                              href="/dashboard/mobile-config"
                              className="cursor-pointer"
                            >
                              <Button variant="outline" size="sm">
                                Go to Mobile App Configuration
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pricing-history" className="space-y-6">
          <div data-tour="pricing-history-tab">
            <PricingHistory />
          </div>
        </TabsContent>
      </Tabs>

      {/* Sticky Test Invoice Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setTestInvoiceOpen(true)}
          size="lg"
          className="shadow-lg gap-2"
        >
          <TestTube className="h-4 w-4" />
          Test Invoice
        </Button>
      </div>

      <TestInvoiceModal
        open={testInvoiceOpen}
        onOpenChange={setTestInvoiceOpen}
      />
    </PageTourWrapper>
  );
}
