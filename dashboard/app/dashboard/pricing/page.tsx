"use client";

import BasePricingEditor from "@/components/pricing/base-pricing-editor";
import FieldPricingList from "@/components/pricing/field-pricing-list";
import LocationScopeSelector from "@/components/pricing/location-scope-selector";
import OptionPricingEditor from "@/components/pricing/option-pricing-editor";
import { PricingHistory } from "@/components/pricing/pricing-history";
import {
  PricingScopeProvider,
  usePricingScope,
} from "@/components/pricing/pricing-scope-context";
import { PricingScopeIndicator } from "@/components/pricing/pricing-scope-indicator";
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
import useOrganization from "@/hooks/useOrganization";
import { CalendarRange } from "lucide-react";
import { useMemo } from "react";

export default function PricingPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { fieldConfigs } = useFieldConfigs();

  // Filter fields that support option pricing
  const optionPricingFields = useMemo(() => {
    return fieldConfigs.filter(
      (fc) =>
        fc.field_type === "select" || fc.field_type === "grouped_breakdown"
    );
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

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground mt-2">
          Configure how you charge customers for services and how you pay
          workers. Prices are calculated using equations based on field values
          from completed jobs.
        </p>
      </div>

      <Tabs defaultValue="set-pricing" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="set-pricing">Customer Pricing</TabsTrigger>
          <TabsTrigger value="worker-payments">Worker Payments</TabsTrigger>
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

          <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
            <div className="space-y-6">
              <Tabs defaultValue="field-pricing" className="space-y-6">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="field-pricing">Field Pricing</TabsTrigger>
                  <TabsTrigger value="option-pricing">
                    Group & Option Pricing
                  </TabsTrigger>
                  <TabsTrigger value="base-pricing">Base Pricing</TabsTrigger>
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
                              {fieldConfig.field_type === "grouped_breakdown"
                                ? "Set prices for each group (e.g., car makes, wipe types). Total = sum of (price_per_group × quantity_per_group) for all selected options."
                                : "Set prices for each option. Total = sum of (price_per_option × quantity_per_option) for all selected options."}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <OptionPricingEditor
                              fieldConfig={fieldConfig}
                              locationHierarchyId={locationNodeId}
                              locationId={locationId}
                              effectiveAt={effectiveDate}
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle>No Group or Option Fields</CardTitle>
                        <CardDescription>
                          Create select or grouped breakdown fields in Mobile
                          Application to configure option pricing.
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

        <TabsContent value="worker-payments" className="space-y-6">
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
                      Viewing worker payment rules as of{" "}
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

          <div className="space-y-6">
            <Tabs defaultValue="field-pricing" className="space-y-6">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="field-pricing">Field Payments</TabsTrigger>
                <TabsTrigger value="option-pricing">
                  Group & Option Payments
                </TabsTrigger>
                <TabsTrigger value="base-pricing">Base Payments</TabsTrigger>
              </TabsList>

              <TabsContent value="field-pricing" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Field Payments</CardTitle>
                    <CardDescription>
                      Set payment rates for fields that collect quantities or
                      counts. These rates are multiplied by the field value to
                      calculate worker payment totals.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldPricingList
                      locationHierarchyId={locationNodeId}
                      locationId={locationId}
                      effectiveAt={effectiveDate}
                      pricingContext="worker"
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
                            {fieldConfig.field_type === "grouped_breakdown"
                              ? "Set payment rates for each group. Total = sum of (rate_per_group × quantity_per_group) for all selected options."
                              : "Set payment rates for each option. Total = sum of (rate_per_option × quantity_per_option) for all selected options."}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <OptionPricingEditor
                            fieldConfig={fieldConfig}
                            locationHierarchyId={locationNodeId}
                            locationId={locationId}
                            effectiveAt={effectiveDate}
                            pricingContext="worker"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>No Group or Option Fields</CardTitle>
                      <CardDescription>
                        Create select or grouped breakdown fields in Mobile
                        Application to configure option payment rates.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="base-pricing" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Base Payments</CardTitle>
                    <CardDescription>
                      Add fixed amounts or multiply the entire worker payment.
                      Can be a fixed adjustment or vary by job type.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BasePricingEditor
                      locationHierarchyId={locationNodeId}
                      locationId={locationId}
                      effectiveAt={effectiveDate}
                      pricingContext="worker"
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="pricing-history" className="space-y-6">
          <PricingHistory />
        </TabsContent>
      </Tabs>
    </>
  );
}
