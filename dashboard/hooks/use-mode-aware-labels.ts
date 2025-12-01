"use client";

import { useOrganizationSettings } from "./use-organization-settings";

export interface ModeAwareLabels {
  // Field/Service terminology
  fieldLabel: string;
  serviceLabel: string;
  materialLabel: string;

  // Pricing terminology
  pricingLabel: string;
  servicePriceLabel: string;
  unitCostLabel: string;

  // Job terminology
  jobLabel: string;
  jobDescription: string;

  // Invoicing terminology
  invoiceDescription: string;
  pricingDescription: string;

  // Mobile config terminology
  mobileConfigDescription: string;
}

export function useModeAwareLabels(): ModeAwareLabels {
  const { settings } = useOrganizationSettings();
  const businessMode = settings?.business_mode ?? "service_based";

  if (businessMode === "service_based") {
    return {
      fieldLabel: "Service",
      serviceLabel: "Service",
      materialLabel: "Material",
      pricingLabel: "Service Price",
      servicePriceLabel: "Service Price",
      unitCostLabel: "Unit Cost",
      jobLabel: "Job",
      jobDescription: "A completed service job",
      invoiceDescription:
        "Configure prices for the services you offer. These prices will be used when generating invoices based on job submissions.",
      pricingDescription:
        "Set prices for each service you offer. These prices will be used when generating invoices.",
      mobileConfigDescription:
        "Configure the services you offer and the fields needed to log each job. These fields will appear in your mobile app for workers to complete.",
    };
  } else {
    // resource_tracking
    return {
      fieldLabel: "Field",
      serviceLabel: "Service",
      materialLabel: "Material",
      pricingLabel: "Unit Cost",
      servicePriceLabel: "Service Price",
      unitCostLabel: "Unit Cost",
      jobLabel: "Job",
      jobDescription: "A completed job tracking services performed",
      invoiceDescription:
        "Configure unit costs for materials and services tracked. These costs will be used when generating invoices based on job submissions.",
      pricingDescription:
        "Set unit costs for materials and services you track. These costs will be used when generating invoices.",
      mobileConfigDescription:
        "Configure the fields to track materials and services used per job. These fields will appear in your mobile app for workers to complete.",
    };
  }
}
