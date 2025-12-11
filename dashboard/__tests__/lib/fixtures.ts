import type { Job, Location, Worker } from "@/lib/types";
import type { Payment, PaymentLink } from "@/lib/types/payment";
import type { FieldConfig } from "@clean-log/shared/types";

/**
 * Test fixtures for consistent test data
 */

export const createMockWorker = (overrides?: Partial<Worker>): Worker => ({
  id: "worker-1",
  name: "John Doe",
  email: "john@example.com",
  phone: "1234567890",
  auth_user_id: null,
  active: true,
  created_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

export const createMockLocation = (
  overrides?: Partial<Location>,
): Location => ({
  id: "location-1",
  name: "Main Office",
  email: "office@example.com",
  address: "123 Main St",
  contact_person: "John Doe",
  phone: "1234567890",
  active: true,
  created_at: "2024-01-01T00:00:00Z",
  hierarchy_parent_id: null,
  ...overrides,
});

export const createMockJob = (overrides?: Partial<Job>): Job => ({
  id: "job-1",
  organization_id: "org-1",
  location_id: "location-1",
  submission_data: {},
  completed_at: "2024-01-15T10:00:00Z",
  created_at: "2024-01-15T10:00:00Z",
  location: {
    id: "location-1",
    name: "Main Office",
    email: "office@example.com",
    address: "123 Main St",
    contact_person: "John Doe",
    phone: "1234567890",
  },
  workers: [
    {
      id: "worker-1",
      name: "John Doe",
      email: "john@example.com",
      phone: "1234567890",
    },
  ],
  ...overrides,
});

export const createMockFieldConfig = (
  overrides?: Partial<FieldConfig>,
): FieldConfig => ({
  id: "field-1",
  organization_id: "org-1",
  name: "test_field",
  label: "Test Field",
  field_type: "text",
  description: null,
  required: false,
  order_position: 0,
  validation_rules: null,
  options: null,
  mutually_exclusive_group: null,
  group_cluster: null,
  section_id: null,
  conditional_logic: null,
  version: 1,
  active: true,
  archived_at: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

export const createMockPayment = (overrides?: Partial<Payment>): Payment => ({
  id: "payment-1",
  organization_id: "org-1",
  invoice_id: "invoice-1",
  amount: 1000.0,
  currency: "AUD",
  payment_method: "stripe_checkout_card",
  stripe_payment_intent_id: "pi_test_123",
  stripe_checkout_session_id: "cs_test_123",
  stripe_customer_id: "cus_test_123",
  stripe_charge_id: "ch_test_123",
  status: "succeeded",
  payment_reference: null,
  payment_date: null,
  received_at: "2025-01-15T10:00:00Z",
  fees: 30.0,
  net_amount: 970.0,
  reconciled_at: null,
  reconciled_by: null,
  reconciliation_notes: null,
  created_at: "2025-01-15T10:00:00Z",
  updated_at: "2025-01-15T10:00:00Z",
  metadata: {},
  ...overrides,
});

export const createMockPaymentLink = (
  overrides?: Partial<PaymentLink>,
): PaymentLink => ({
  id: "plink-1",
  organization_id: "org-1",
  invoice_id: "invoice-1",
  stripe_checkout_session_id: "cs_test_123",
  checkout_url: "https://checkout.stripe.com/test",
  status: "open",
  clicked_at: null,
  clicked_count: 0,
  payment_completed_at: null,
  expires_at: "2025-02-15T10:00:00Z",
  customer_email: null,
  amount_total: 1000.0,
  created_at: "2025-01-15T10:00:00Z",
  updated_at: "2025-01-15T10:00:00Z",
  ...overrides,
});

/**
 * Mock Supabase response helpers
 */
export const createMockSupabaseSuccessResponse = <T>(data: T) => ({
  data,
  error: null,
});

export const createMockSupabaseErrorResponse = (message: string) => ({
  data: null,
  error: { message, status: 500 },
});
