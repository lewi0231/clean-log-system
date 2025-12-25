"use client";

import BasePricingEditor from "@/components/pricing/base-pricing-editor";
import FieldPricingList from "@/components/pricing/field-pricing-list";
import { useLocationFixedPricingGuard } from "@/components/pricing/location-fixed-pricing-guard";
import LocationScopeSelector from "@/components/pricing/location-scope-selector";
import OptionPricingEditor from "@/components/pricing/option-pricing-editor";
import { PricingHistory } from "@/components/pricing/pricing-history";
import {
  PricingScopeProvider,
  usePricingScope,
} from "@/components/pricing/pricing-scope-context";
import ServiceTypePricingEditor from "@/components/pricing/service-type-pricing-editor";
import TestInvoiceModal from "@/components/pricing/test-invoice-modal";
import { PageTourWrapper } from "@/components/tours/page-tour-wrapper";
import { pricingTourSteps } from "@/components/tours/tour-definitions";
import { TourTriggerButton } from "@/components/tours/tour-trigger-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DollarSign,
  ExternalLink,
  Hash,
  Layers,
  List,
  ScrollText,
  TestTube,
  Zap,
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

  // Filter fields that support option pricing (exclude select - those go in Service-Type Pricing)
  const optionPricingFields = useMemo(() => {
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
      <PricingPageContent optionPricingFields={optionPricingFields} />
    </PricingScopeProvider>
  );
}

interface PricingPageContentProps {
  optionPricingFields: ReturnType<typeof useFieldConfigs>["fieldConfigs"];
}

function PricingPageContent({ optionPricingFields }: PricingPageContentProps) {
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
          <Button
            variant="outline"
            onClick={() => setTestInvoiceOpen(true)}
            className="gap-2"
          >
            <TestTube className="h-4 w-4" />
            Test Invoice
          </Button>
          <TourTriggerButton />
        </div>
      </div>

      <Tabs defaultValue="set-pricing" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="set-pricing">
            <DollarSign className="h-4 w-4 mr-2" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="pricing-history">
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
            <Tabs defaultValue="field-pricing" className="space-y-6">
              <TabsList
                className="w-full justify-start"
                data-tour="pricing-tabs"
              >
                <TabsTrigger
                  value="field-pricing"
                  disabled={isFixedPricing}
                  data-tour="field-pricing-tab"
                >
                  <Hash className="h-4 w-4 mr-2" />
                  Field Pricing
                </TabsTrigger>
                <TabsTrigger
                  value="option-pricing"
                  disabled={isFixedPricing}
                  data-tour="option-pricing-tab"
                >
                  <List className="h-4 w-4 mr-2" />
                  Option Pricing
                </TabsTrigger>
                <TabsTrigger
                  value="base-pricing"
                  disabled={isFixedPricing}
                  data-tour="base-pricing-tab"
                >
                  <Layers className="h-4 w-4 mr-2" />
                  Base Pricing
                </TabsTrigger>
                <TabsTrigger
                  value="service-type-pricing"
                  data-tour="service-type-pricing-tab"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Service-Type Pricing
                </TabsTrigger>
              </TabsList>

              <TabsContent value="field-pricing" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Field Pricing</CardTitle>
                    <CardDescription>
                      Set prices for numerical or boolean fields.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldPricingList
                      locationHierarchyId={locationNodeId}
                      locationId={locationId}
                      effectiveAt={effectiveDate}
                      showBothContexts={true}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="option-pricing" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Option Pricing</CardTitle>
                    <CardDescription>
                      Set prices for each option within grouped breakdown fields
                      (e.g., Nissan: $10, Chairs_Cleaned: $15). Each grouped
                      breakdown field can have different pricing for its
                      options.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {optionPricingFields.length > 0 ? (
                      <div className="space-y-6">
                        {optionPricingFields.map((fieldConfig) => (
                          <div key={fieldConfig.id} className="space-y-4">
                            <div>
                              <h3 className="text-lg font-semibold">
                                {fieldConfig.label}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Configure pricing for each option in this field
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
                      <div className="py-6">
                        <div className="text-center space-y-4">
                          <p className="text-sm text-muted-foreground">
                            To configure option pricing, you need to add grouped
                            breakdown fields to your mobile app forms. Select
                            fields are configured in the Service-Type Pricing
                            tab.
                          </p>
                          <div className="flex items-center justify-center">
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
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="base-pricing" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Base Pricing</CardTitle>
                    <CardDescription>
                      Add fixed amounts or multiply the entire invoice. Can be a
                      fixed adjustment or vary by job type (e.g., scale larger
                      vehicles by 1.2x).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BasePricingEditor
                      locationHierarchyId={locationNodeId}
                      locationId={locationId}
                      effectiveAt={effectiveDate}
                      showBothContexts={true}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="service-type-pricing" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Service-Type Pricing</CardTitle>
                    <CardDescription>
                      Configure fixed prices for specific service type options.
                      When enabled, these service types will use a fixed price
                      and bypass all field-based calculations.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ServiceTypePricingEditor
                      locationHierarchyId={locationNodeId}
                      locationId={locationId}
                      effectiveAt={effectiveDate}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="pricing-history" className="space-y-6">
          <div data-tour="pricing-history-tab">
            <PricingHistory />
          </div>
        </TabsContent>
      </Tabs>

      <TestInvoiceModal
        open={testInvoiceOpen}
        onOpenChange={setTestInvoiceOpen}
      />
    </PageTourWrapper>
  );
}
