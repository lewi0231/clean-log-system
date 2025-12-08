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
import { PricingScopeIndicator } from "@/components/pricing/pricing-scope-indicator";
import ServiceTypePricingEditor from "@/components/pricing/service-type-pricing-editor";
import { UnifiedInvoicePreview } from "@/components/pricing/unified-invoice-preview";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFieldConfigs } from "@/hooks/use-field-configs";
import { useOrganizationCurrency } from "@/hooks/use-organization-currency";
import useOrganization from "@/hooks/useOrganization";
import { AlertTriangle, CalendarRange, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

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
    return <LoadingState message="Loading pricing..." fullScreen />;
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

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground mt-2">
          Configure customer pricing and worker payments. Prices are calculated
          using equations based on field values from completed jobs. Customer
          pricing is used for invoicing, while worker payments determine how
          much workers are paid for completed jobs.
        </p>
      </div>

      <Tabs defaultValue="set-pricing" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="set-pricing">Pricing</TabsTrigger>
          <TabsTrigger value="pricing-history">Pricing History</TabsTrigger>
        </TabsList>

        <TabsContent value="set-pricing" className="space-y-6">
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

          {effectiveDate && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <CalendarRange className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">
                      Viewing pricing as of{" "}
                      {new Date(effectiveDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This is a view-only filter. Changes you save will create
                      rules effective immediately (today).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <PricingScopeIndicator
            locationNodeId={locationNodeId}
            locationId={locationId}
          />

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
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Edit in Location Settings
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
            <div className="space-y-6">
              <Tabs defaultValue="field-pricing" className="space-y-6">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="field-pricing" disabled={isFixedPricing}>
                    Field Pricing
                  </TabsTrigger>
                  <TabsTrigger value="option-pricing" disabled={isFixedPricing}>
                    Option Pricing
                  </TabsTrigger>
                  <TabsTrigger value="base-pricing" disabled={isFixedPricing}>
                    Base Pricing
                  </TabsTrigger>
                  <TabsTrigger value="service-type-pricing">
                    Service-Type Pricing
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="field-pricing" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Field Pricing</CardTitle>
                      <CardDescription>
                        Set prices for fields that collect quantities or counts.
                        These prices are multiplied by the field value to
                        calculate totals.
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
                  {optionPricingFields.length > 0 ? (
                    <div className="space-y-6">
                      {optionPricingFields.map((fieldConfig) => (
                        <Card key={fieldConfig.id}>
                          <CardHeader>
                            <CardTitle>{fieldConfig.label}</CardTitle>
                            <CardDescription>
                              Set prices for each group (e.g., car makes, wipe
                              types). Total = sum of (price_per_group ×
                              quantity_per_group) for all selected options.
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <OptionPricingEditor
                              fieldConfig={fieldConfig}
                              locationHierarchyId={locationNodeId}
                              locationId={locationId}
                              effectiveAt={effectiveDate}
                              showBothContexts={true}
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle>No Grouped Breakdown Fields</CardTitle>
                        <CardDescription>
                          Create grouped breakdown fields in Mobile Application
                          to configure option pricing. Select fields are
                          configured in the Service-Type Pricing tab.
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="base-pricing" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Base Pricing</CardTitle>
                      <CardDescription>
                        Add fixed amounts or multiply the entire invoice. Can be
                        a fixed adjustment or vary by job type (e.g., scale
                        larger vehicles by 1.2x).
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
                        Configure fixed prices for specific service type
                        options. When enabled, these service types will use a
                        fixed price and bypass all field-based calculations.
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

            <div>
              <UnifiedInvoicePreview />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pricing-history" className="space-y-6">
          <PricingHistory />
        </TabsContent>
      </Tabs>
    </>
  );
}
