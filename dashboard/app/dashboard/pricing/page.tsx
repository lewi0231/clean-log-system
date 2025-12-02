"use client";

import BasePricingEditor from "@/components/pricing/base-pricing-editor";
import FieldPricingList from "@/components/pricing/field-pricing-list";
import LocationScopeSelector from "@/components/pricing/location-scope-selector";
import OptionPricingEditor from "@/components/pricing/option-pricing-editor";
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
import { useMemo, useState } from "react";

export default function PricingPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { fieldConfigs } = useFieldConfigs();

  const [selectedLocationNodeId, setSelectedLocationNodeId] = useState<
    string | null
  >(null);
  const [effectiveDate, setEffectiveDate] = useState<string | null>(null);

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
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground mt-2">
          Configure how you charge customers for services. Prices are calculated
          using equations based on field values from completed jobs.
        </p>
      </div>

      <LocationScopeSelector
        selectedNodeId={selectedLocationNodeId}
        onNodeChange={setSelectedLocationNodeId}
        effectiveDate={effectiveDate}
        onEffectiveDateChange={setEffectiveDate}
      />

      <Tabs defaultValue="field-pricing" className="space-y-6">
        <TabsList>
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
                Set prices for fields that collect quantities or counts. These
                prices are multiplied by the field value to calculate totals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldPricingList
                locationHierarchyId={selectedLocationNodeId}
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
                        ? "Set prices for each group (e.g., car makes, wipe types). Total = sum of (price_per_group × quantity_per_group)."
                        : "Set prices for each option. Total = sum of selected option prices."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <OptionPricingEditor
                      fieldConfig={fieldConfig}
                      locationHierarchyId={selectedLocationNodeId}
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
                Add fixed amounts or multiply the entire invoice. Can be a fixed
                adjustment or vary by job type (e.g., scale larger vehicles by
                1.2x).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BasePricingEditor
                locationHierarchyId={selectedLocationNodeId}
                effectiveAt={effectiveDate}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
