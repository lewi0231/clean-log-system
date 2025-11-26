"use client";

import FieldPricingList from "@/components/invoicing/field-pricing-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import useOrganization from "@/hooks/useOrganization";

export default function InvoicingPage() {
  const {
    organizationId,
    loading: orgLoading,
    error: orgError,
  } = useOrganization();

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
          Configure pricing for number-type fields used in invoicing
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Field Pricing</CardTitle>
            <CardDescription>
              Set unit prices for number-type field configurations. These prices
              will be used when generating invoices based on job submissions.
              Only number-type fields from Mobile Config are shown here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldPricingList />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
