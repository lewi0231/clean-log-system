"use client";

import BasePricingEditor from "@/components/invoicing/base-pricing-editor";
import FieldPricingList from "@/components/invoicing/field-pricing-list";
import OptionPricingEditor from "@/components/invoicing/option-pricing-editor";
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

export default function InvoicingPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();
  const { fieldConfigs } = useFieldConfigs();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );

  // Filter fields that support option pricing
  const optionPricingFields = useMemo(() => {
    return fieldConfigs.filter(
      (fc) =>
        fc.field_type === "select" || fc.field_type === "grouped_breakdown"
    );
  }, [fieldConfigs]);

  if (orgLoading) {
    return <LoadingState message="Loading invoicing..." fullScreen />;
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
        <h1 className="text-3xl font-bold tracking-tight">Invoicing</h1>
        <p className="text-muted-foreground mt-2">
          Configure pricing for fields used in invoicing
        </p>
      </div>

      <Tabs defaultValue="customer-pricing" className="space-y-6">
        <TabsList>
          <TabsTrigger value="customer-pricing">Customer Pricing</TabsTrigger>
          <TabsTrigger value="worker-payments">Worker Payments</TabsTrigger>
          <TabsTrigger value="base-pricing">Base Pricing</TabsTrigger>
          <TabsTrigger value="location-pricing">Location Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="customer-pricing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Field Pricing</CardTitle>
              <CardDescription>
                Set prices for field configurations. These prices will be used
                when generating invoices based on job submissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldPricingList />
            </CardContent>
          </Card>

          {optionPricingFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Option Pricing</CardTitle>
                <CardDescription>
                  Set prices for individual options within select and grouped
                  breakdown fields.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {optionPricingFields.map((fieldConfig) => (
                  <div key={fieldConfig.id} className="space-y-2">
                    <h3 className="font-semibold">{fieldConfig.label}</h3>
                    <OptionPricingEditor
                      fieldConfig={fieldConfig}
                      locationId={selectedLocationId}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="worker-payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Worker Payment Configuration</CardTitle>
              <CardDescription>
                Configure how workers are paid. You can use the same structure
                as customer pricing, a percentage of customer price, or fixed
                rates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Worker payment configuration is managed through the same pricing
                interfaces. Use the &quot;Worker Payments&quot; tab to set
                worker-specific rates when configuring field pricing, option
                pricing, and base pricing.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Worker payment fields are available in all pricing configuration
                sections. Configure them alongside customer pricing for each
                field, option, or base price.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="base-pricing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Base Pricing</CardTitle>
              <CardDescription>
                Set base prices that are added to invoices. Can be field-based
                (tied to a select field) or standalone (fixed amount).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BasePricingEditor locationId={selectedLocationId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="location-pricing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Location-Specific Pricing</CardTitle>
              <CardDescription>
                Configure location-specific pricing overrides. Select a location
                to view and manage its pricing settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Location-specific pricing overrides are configured by selecting
                a location when setting prices in the Customer Pricing, Worker
                Payments, and Base Pricing tabs. Use the location selector in
                each pricing section to create location-specific overrides.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Location overrides will take precedence over organization-wide
                default pricing when generating invoices for jobs at that
                location.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
