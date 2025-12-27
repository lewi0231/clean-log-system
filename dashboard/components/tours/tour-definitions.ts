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
            "Click the 'Add Field' button to see all available field types. Choose from text, number, select, checkbox, and other field types. After adding a field, drag it into a section.",
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
        target: "[data-tour='invoice-adjustments']",
        title: "Invoice Adjustments",
        content:
            "Apply universal adjustments (e.g., call-out fee, profit margin) to every invoice, or service-based adjustments that vary by service type. This is often the first thing to set up.",
        position: "bottom",
    },
    {
        target: "[data-tour='pricing-tabs']",
        title: "Field Pricing",
        content:
            "Configure pricing by field type. Each tab shows fields of that type with their pricing. Tabs with (0) have no fields yet—create them in Mobile Config first.",
        position: "bottom",
    },
    {
        target: "[data-tour='number-pricing-tab']",
        title: "Number Fields",
        content:
            "Set per-unit prices for countable items. Workers enter a quantity, and the price is calculated automatically (e.g., 10 windows × $5 = $50).",
        position: "bottom",
    },
    {
        target: "[data-tour='boolean-pricing-tab']",
        title: "Boolean Fields",
        content:
            "Set fixed prices for yes/no options. The price is added only when the worker checks the box (e.g., Premium Materials = +$25).",
        position: "bottom",
    },
    {
        target: "[data-tour='select-pricing-tab']",
        title: "Select Fields",
        content:
            "Set different prices for each dropdown option. Workers choose an option, and its price is added (e.g., Basic = $100, Premium = $200).",
        position: "bottom",
    },
    {
        target: "[data-tour='group-pricing-tab']",
        title: "Group Fields",
        content:
            "Set per-unit prices for categorized counts. Workers count items by group, each with its own price (e.g., 5 Nissan × $7 + 3 Toyota × $8).",
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
