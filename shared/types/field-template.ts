import { FieldType } from "./field-type";
import { ValidationRules } from "./validation-rule";

export interface FieldTemplateField {
  name: string;
  label: string;
  field_type: FieldType;
  description?: string | null;
  required: boolean;
  validation_rules?: ValidationRules | null;
  options?: string[] | null;
}

export interface FieldTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  category: "contact" | "vehicle" | "measurement" | "service" | "general";
  fields: FieldTemplateField[];
}

// Built-in templates
export const BUILT_IN_TEMPLATES: FieldTemplate[] = [
  {
    id: "contact_info",
    name: "Contact Information",
    description: "Name, email, and phone fields",
    icon: "User",
    category: "contact",
    fields: [
      {
        name: "customer_name",
        label: "Customer Name",
        field_type: "text",
        required: true,
      },
      {
        name: "customer_email",
        label: "Email Address",
        field_type: "email",
        required: false,
      },
      {
        name: "customer_phone",
        label: "Phone Number",
        field_type: "phone",
        required: false,
      },
    ],
  },
  {
    id: "vehicle_details",
    name: "Vehicle Details",
    description: "Make, model, year, color, and VIN",
    icon: "Car",
    category: "vehicle",
    fields: [
      {
        name: "vehicle_make",
        label: "Make",
        field_type: "text",
        required: true,
      },
      {
        name: "vehicle_model",
        label: "Model",
        field_type: "text",
        required: true,
      },
      {
        name: "vehicle_year",
        label: "Year",
        field_type: "number",
        required: false,
        validation_rules: { min: 1900, max: 2030 },
      },
      {
        name: "vehicle_color",
        label: "Color",
        field_type: "text",
        required: false,
      },
      {
        name: "vehicle_vin",
        label: "VIN",
        field_type: "text",
        required: false,
        validation_rules: { minLength: 17, maxLength: 17 },
      },
    ],
  },
  {
    id: "service_selection",
    name: "Service Selection",
    description: "Service type dropdown and notes",
    icon: "Wrench",
    category: "service",
    fields: [
      {
        name: "service_type",
        label: "Service Type",
        field_type: "select",
        required: true,
        options: [
          "Basic Wash",
          "Full Detail",
          "Interior Only",
          "Exterior Only",
        ],
      },
      {
        name: "service_notes",
        label: "Special Instructions",
        field_type: "textarea",
        required: false,
        description: "Any special requests or notes",
      },
    ],
  },
  {
    id: "measurements",
    name: "Measurements",
    description: "Length, width, and quantity fields",
    icon: "Ruler",
    category: "measurement",
    fields: [
      {
        name: "length",
        label: "Length",
        field_type: "number",
        required: false,
      },
      {
        name: "width",
        label: "Width",
        field_type: "number",
        required: false,
      },
      {
        name: "quantity",
        label: "Quantity",
        field_type: "number",
        required: true,
        validation_rules: { min: 1 },
      },
    ],
  },
  {
    id: "date_time",
    name: "Date & Time",
    description: "Date and time selection fields",
    icon: "Calendar",
    category: "general",
    fields: [
      {
        name: "scheduled_date",
        label: "Scheduled Date",
        field_type: "date",
        required: true,
      },
      {
        name: "scheduled_time",
        label: "Scheduled Time",
        field_type: "time",
        required: false,
      },
    ],
  },
  {
    id: "notes_confirmation",
    name: "Notes & Confirmation",
    description: "Notes textarea and confirmation checkbox",
    icon: "FileText",
    category: "general",
    fields: [
      {
        name: "additional_notes",
        label: "Additional Notes",
        field_type: "textarea",
        required: false,
      },
      {
        name: "confirmed",
        label: "I confirm this information is correct",
        field_type: "boolean",
        required: true,
      },
    ],
  },
];
