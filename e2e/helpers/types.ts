/**
 * Type definitions for E2E test data and seeding
 */

export interface Scenario1Data {
  scenario: {
    id: string;
    name: string;
    description: string;
  };
  organization: {
    name: string;
    org_code: string;
    industry: string;
    use_predefined_locations: boolean;
    settings: {
      currency: string;
      invoice_frequency: string;
      worker_payment_cycle: string;
      auto_send_invoices: boolean;
      require_invoice_review: boolean;
    };
  };
  admin: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: string;
  };
  locationHierarchy: {
    name: string;
    type: string;
    metadata: {
      auto_generate_invoices: {
        enabled: boolean;
        period: string;
        day_of_month: number;
        time: string;
        grouping: string;
        require_review: boolean;
      };
    };
  };
  locations: Array<{
    id: string;
    name: string;
    email: string;
    address: string;
    contact_person: string;
    phone: string;
    hierarchy_parent: string | null;
    pricing_modifier: {
      type: string;
      value: number;
      description: string;
    } | null;
  }>;
  workers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    role: string;
    has_rate_card: boolean;
  }>;
  fieldConfigs: Array<{
    id: string;
    name: string;
    label: string;
    field_type: string;
    description: string;
    required: boolean;
    order_position: number;
    mutually_exclusive_group: string;
    options: Array<{ value: string; label: string }> | null;
    validation_rules?: {
      min?: number;
      max?: number;
    };
  }>;
  pricingRules: Array<{
    id: string;
    name: string;
    scope: string;
    pricing_type: string;
    field_config_name?: string;
    location_name?: string;
    base_price?: number;
    percentage_rate?: number;
    currency: string;
    priority: number;
    active: boolean;
    description: string;
  }>;
  rateCards: {
    supervisor: {
      worker_name: string;
      cards: Array<{
        id: string;
        name: string;
        rate_type: string;
        field_config_name?: string;
        modifier_type?: string;
        base_amount?: number;
        percentage_rate?: number;
        description: string;
      }>;
    };
  };
  testJobs: Array<{
    id: string;
    description: string;
    location_name: string;
    worker_name: string;
    submission_data: Record<string, unknown>;
    expected: {
      invoice_subtotal: number;
      location_modifier?: number;
      invoice_total: number;
      worker_payment_base?: number;
      worker_payment_soap_bonus?: number;
      worker_payment_percentage_bonus?: number;
      worker_payment_total?: number;
      calculation: string;
    };
  }>;
  testCredentials: {
    defaultPassword: string;
    testEmailDomain: string;
  };
}

export interface SeededDataIds {
  testId: string;
  organizationId: string;
  adminUserId: string;
  adminEmail?: string;
  hierarchyNodeId: string;
  locationIds: Record<string, string>;
  workerIds: Record<string, string>;
  fieldConfigIds: Record<string, string>;
  pricingRuleIds: string[];
  rateCardIds: string[];
  jobIds?: string[];
  invoiceIds?: string[];
}

export interface TestJob {
  id: string;
  description: string;
  locationName: string;
  workerName: string;
  submissionData: Record<string, unknown>;
  expected: {
    invoiceSubtotal: number;
    locationModifier?: number;
    invoiceTotal: number;
    workerPaymentBase?: number;
    workerPaymentSoapBonus?: number;
    workerPaymentPercentageBonus?: number;
    workerPaymentTotal?: number;
    calculation: string;
  };
}
