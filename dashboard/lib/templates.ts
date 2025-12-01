import type { FieldType } from "@/shared/types";
import type { BusinessMode } from "./types";

/**
 * Template field configuration (without id, organization_id, timestamps)
 * Used to create field configs from templates
 */
export interface TemplateFieldConfig {
  name: string;
  label: string;
  field_type: FieldType;
  description: string | null;
  required: boolean;
  order_position: number;
  validation_rules: Record<string, unknown> | null;
  options: string[] | null;
}

/**
 * Field configuration templates for different business modes
 */
export const FIELD_CONFIG_TEMPLATES: Record<
  BusinessMode,
  TemplateFieldConfig[]
> = {
  service_based: [
    {
      name: "service_type",
      label: "Service Type",
      field_type: "select",
      description: "Select the service performed",
      required: true,
      order_position: 0,
      validation_rules: null,
      options: [
        "Vacuum + Clean",
        "Wax",
        "Interior Detail",
        "Full Detail",
        "Exterior Wash",
      ],
    },
    {
      name: "number_of_vehicles",
      label: "Number of Vehicles",
      field_type: "number",
      description: "How many vehicles were serviced",
      required: true,
      order_position: 1,
      validation_rules: {
        min: 1,
        max: null,
      },
      options: null,
    },
    {
      name: "notes",
      label: "Notes",
      field_type: "text",
      description: "Additional notes about the job",
      required: false,
      order_position: 2,
      validation_rules: null,
      options: null,
    },
  ],
  resource_tracking: [
    {
      name: "services_performed",
      label: "Services Performed",
      field_type: "grouped_breakdown",
      description: "Select services performed per car",
      required: true,
      order_position: 0,
      validation_rules: null,
      options: ["Vacuum", "Soap", "Wipe", "Polish", "Wax"],
    },
    {
      name: "number_of_cars",
      label: "Number of Cars",
      field_type: "number",
      description: "Total number of cars processed",
      required: true,
      order_position: 1,
      validation_rules: {
        min: 1,
        max: null,
      },
      options: null,
    },
    {
      name: "bulk_services",
      label: "Bulk Services",
      field_type: "grouped_breakdown",
      description: "Services performed in bulk (e.g., vacuum 10 cars)",
      required: false,
      order_position: 2,
      validation_rules: null,
      options: ["Vacuum", "Soap", "Wipe", "Polish", "Wax"],
    },
    {
      name: "notes",
      label: "Notes",
      field_type: "text",
      description: "Additional notes about the job",
      required: false,
      order_position: 3,
      validation_rules: null,
      options: null,
    },
  ],
};

/**
 * Get template fields for a business mode
 */
export function getTemplateFields(
  businessMode: BusinessMode
): TemplateFieldConfig[] {
  return FIELD_CONFIG_TEMPLATES[businessMode] || [];
}

/**
 * Get template description for a business mode
 */
export function getTemplateDescription(businessMode: BusinessMode): string {
  switch (businessMode) {
    case "service_based":
      return "Pre-configured fields for car detailers offering specific services at fixed prices. Includes service type selection, vehicle count, and notes.";
    case "resource_tracking":
      return "Pre-configured fields for car yard businesses tracking services performed. Includes per-car service breakdown, bulk services, and vehicle count.";
    default:
      return "";
  }
}
