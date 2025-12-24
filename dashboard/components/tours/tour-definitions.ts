import { TourStep } from "./page-tour-tooltip";

export const dashboardTourSteps: TourStep[] = [
    {
        target: "[data-tour='workers-card']",
        title: "Workers Overview",
        content:
            "This card shows your total number of workers and how many are currently active. Click 'Manage Users' to add or edit workers.",
        position: "bottom",
    },
    {
        target: "[data-tour='locations-card']",
        title: "Locations Overview",
        content:
            "Track all your customer locations here. Use this to see how many locations you're managing and quickly navigate to location management.",
        position: "bottom",
    },
];

export const usersTourSteps: TourStep[] = [
    {
        target: "[data-tour='dashboard-users-tab']",
        title: "Dashboard Users",
        content:
            "Manage users who can access the dashboard. Add admins or viewers who need access to your organization's data.",
        position: "bottom",
    },
    {
        target: "[data-tour='add-dashboard-user-button']",
        title: "Add Dashboard User",
        content:
            "Click here to invite new users to your dashboard. They'll receive an email invitation to join your organization.",
        position: "left",
    },
    {
        target: "[data-tour='workers-tab']",
        title: "Workers Tab",
        content:
            "Workers are mobile app users who complete jobs in the field. They access the app on their phones to log job details.",
        position: "bottom",
    },
    {
        target: "[data-tour='add-worker-button']",
        title: "Add Worker",
        content:
            "Add workers who will use the mobile app. They'll receive an invitation to download and use the mobile application.",
        position: "left",
    },
];

export const locationsTourSteps: TourStep[] = [
    {
        target: "[data-tour='locations-tab']",
        title: "Customer Locations",
        content:
            "Manage all your customer locations here. These are the sites where your workers complete jobs.",
        position: "bottom",
    },
    {
        target: "[data-tour='location-settings']",
        title: "Location Settings",
        content:
            "Configure whether locations appear in the mobile app. When enabled, workers can select from your predefined locations when completing jobs.",
        position: "bottom",
    },
    {
        target: "[data-tour='add-location-button']",
        title: "Add Location",
        content:
            "Add new customer locations with contact details, addresses, and pricing information. Locations can be organized in a hierarchy for regional pricing.",
        position: "left",
    },
    {
        target: "[data-tour='hierarchy-tab']",
        title: "Location Hierarchy",
        content:
            "Organize locations into regions or companies. This enables automatic regional pricing rules based on location groupings.",
        position: "bottom",
    },
];

export const mobileConfigTourSteps: TourStep[] = [
    {
        target: "[data-tour='sections']",
        title: "Form Sections",
        content:
            "Organize your form fields into sections. Fields must be added to a section to appear in the mobile app. Use sections to group related fields together.",
        position: "right",
    },
    {
        target: "[data-tour='add-field-button']",
        title: "Add Fields",
        content:
            "Click here to add new fields to your form. Choose from text, number, select, checkbox, and other field types. After adding a field, drag it into a section.",
        position: "left",
    },
    {
        target: "[data-tour='mobile-preview']",
        title: "Mobile Preview",
        content:
            "Preview how your form will appear in the mobile app. This shows exactly what workers will see when logging a job. Fields only appear here if they're in a section.",
        position: "left",
    },
];

export const pricingTourSteps: TourStep[] = [
    {
        target: "[data-tour='location-scope']",
        title: "Location Scope",
        content:
            "Select which location or region you're configuring pricing for. You can set pricing at the organization level, regional level, or for specific locations.",
        position: "bottom",
    },
    {
        target: "[data-tour='pricing-tabs']",
        title: "Pricing Types",
        content:
            "Configure different types of pricing: Field Pricing for numerical values, Option Pricing for dropdowns, Base Pricing for adjustments, and Service-Type Pricing for fixed prices.",
        position: "bottom",
    },
    {
        target: "[data-tour='field-pricing-tab']",
        title: "Field Pricing",
        content:
            "Set prices for numerical or boolean fields. Define how much each unit costs for the customer and how much workers are paid.",
        position: "bottom",
    },
    {
        target: "[data-tour='option-pricing-tab']",
        title: "Option Pricing",
        content:
            "Configure prices for each option in grouped breakdown fields. For example, set different prices for different vehicle types or service options.",
        position: "bottom",
    },
    {
        target: "[data-tour='base-pricing-tab']",
        title: "Base Pricing",
        content:
            "Add fixed amounts or multipliers to invoices. Useful for base fees, call-out charges, or scaling entire invoices based on job type.",
        position: "bottom",
    },
    {
        target: "[data-tour='service-type-pricing-tab']",
        title: "Service-Type Pricing",
        content:
            "Set fixed prices for specific service types. When enabled, these bypass all field-based calculations and use a fixed price instead.",
        position: "bottom",
    },
    {
        target: "[data-tour='pricing-history-tab']",
        title: "Pricing History",
        content:
            "View historical pricing changes and see when pricing rules were created or modified. Useful for auditing and understanding pricing evolution.",
        position: "bottom",
    },
];
