import type { Job, Location, Worker } from "@/lib/types";
import type { Payment, PaymentLink } from "@/lib/types/payment";
import type { FieldConfig } from "@clean-log/shared/types";

/**
 * Test fixtures for consistent test data
 */

export const createMockWorker = (overrides?: Partial<Worker>): Worker => ({
  id: "worker-1",
  name: "John Doe",
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  phone: "1234567890",
  address: null,
  abn: null,
  auth_user_id: null,
  active: true,
  created_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

export const createMockLocation = (overrides?: Partial<Location>): Location => ({
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
  approval_status: "approved",
  auto_approve_at: null,
  edit_window_expires_at: null,
  submitted_by_worker_id: null,
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
      confirmation_status: "confirmed",
      confirmed_at: "2024-01-15T10:00:00Z",
      flagged_at: null,
      flag_reason: null,
    },
  ],
  ...overrides,
});

export const createMockPendingJob = (overrides?: Partial<Job>): Job => ({
  id: "job-pending-1",
  organization_id: "org-1",
  location_id: "location-1",
  submission_data: {},
  completed_at: "2024-01-15T10:00:00Z",
  created_at: "2024-01-15T10:00:00Z",
  approval_status: "pending",
  auto_approve_at: "2024-01-16T10:00:00Z",
  edit_window_expires_at: "2024-01-15T13:00:00Z",
  submitted_by_worker_id: "worker-1",
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
      confirmation_status: "confirmed",
      confirmed_at: "2024-01-15T10:00:00Z",
      flagged_at: null,
      flag_reason: null,
    },
    {
      id: "worker-2",
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "0987654321",
      confirmation_status: "pending",
      confirmed_at: null,
      flagged_at: null,
      flag_reason: null,
    },
  ],
  ...overrides,
});

export const createMockFlaggedJob = (overrides?: Partial<Job>): Job => ({
  id: "job-flagged-1",
  organization_id: "org-1",
  location_id: "location-1",
  submission_data: {},
  completed_at: "2024-01-15T10:00:00Z",
  created_at: "2024-01-15T10:00:00Z",
  approval_status: "flagged",
  auto_approve_at: "2024-01-16T10:00:00Z",
  edit_window_expires_at: "2024-01-15T13:00:00Z",
  submitted_by_worker_id: "worker-1",
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
      confirmation_status: "confirmed",
      confirmed_at: "2024-01-15T10:00:00Z",
      flagged_at: null,
      flag_reason: null,
    },
    {
      id: "worker-2",
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "0987654321",
      confirmation_status: "flagged",
      confirmed_at: null,
      flagged_at: "2024-01-15T11:00:00Z",
      flag_reason: "I was not at this location on this date",
    },
  ],
  ...overrides,
});

export const createMockFieldConfig = (overrides?: Partial<FieldConfig>): FieldConfig => ({
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

export const createMockPaymentLink = (overrides?: Partial<PaymentLink>): PaymentLink => ({
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

export const createMockLocationHierarchyNode = (
  overrides?: Partial<import("@/lib/types").LocationHierarchyNode>
): import("@/lib/types").LocationHierarchyNode => ({
  id: "node-1",
  organization_id: "org-1",
  name: "Test Company",
  type: "company",
  parent_id: null,
  code: null,
  sort_order: 0,
  metadata: null,
  active: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  parent: null,
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
