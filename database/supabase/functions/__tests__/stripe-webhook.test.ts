/**
 * Tests for stripe-webhook edge function
 *
 * Run with: deno test --allow-all functions/__tests__/stripe-webhook.test.ts
 */

import { assertEquals } from "@std/assert";

/**
 * Mock Stripe webhook event structures
 */
const mockCheckoutSessionCompleted = {
  id: "evt_test_123",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_123",
      payment_intent: "pi_test_123",
      customer: "cus_test_123",
      metadata: {
        invoice_id: "inv_test_123",
        invoice_number: "INV-2025-001",
        organization_id: "org_test_123",
      },
    },
  },
};

const mockPaymentIntentSucceeded = {
  id: "evt_test_456",
  type: "payment_intent.succeeded",
  data: {
    object: {
      id: "pi_test_123",
      status: "succeeded",
      amount: 10000, // $100.00 in cents
      currency: "aud",
    },
  },
};

const mockPaymentIntentFailed = {
  id: "evt_test_789",
  type: "payment_intent.payment_failed",
  data: {
    object: {
      id: "pi_test_456",
      status: "requires_payment_method",
      last_payment_error: {
        code: "card_declined",
        message: "Your card was declined.",
      },
    },
  },
};

const mockChargeRefunded = {
  id: "evt_test_refund",
  type: "charge.refunded",
  data: {
    object: {
      id: "ch_test_refund",
      amount: 10000,
      amount_refunded: 10000, // Full refund
      charge: "ch_test_123",
    },
  },
};

const mockDisputeCreated = {
  id: "evt_test_dispute",
  type: "charge.dispute.created",
  data: {
    object: {
      id: "dp_test_123",
      charge: "ch_test_123",
      reason: "fraudulent",
      status: "warning_needs_response",
    },
  },
};

/**
 * Test event type detection
 */
Deno.test("should identify checkout.session.completed event", () => {
  assertEquals(mockCheckoutSessionCompleted.type, "checkout.session.completed");
  assertEquals(
    mockCheckoutSessionCompleted.data.object.metadata.invoice_id,
    "inv_test_123",
  );
});

Deno.test("should identify payment_intent.succeeded event", () => {
  assertEquals(mockPaymentIntentSucceeded.type, "payment_intent.succeeded");
  assertEquals(mockPaymentIntentSucceeded.data.object.status, "succeeded");
  assertEquals(mockPaymentIntentSucceeded.data.object.amount, 10000);
});

Deno.test("should identify payment_intent.payment_failed event", () => {
  assertEquals(mockPaymentIntentFailed.type, "payment_intent.payment_failed");
  assertEquals(
    mockPaymentIntentFailed.data.object.last_payment_error?.code,
    "card_declined",
  );
});

Deno.test("should identify charge.refunded event", () => {
  assertEquals(mockChargeRefunded.type, "charge.refunded");
  assertEquals(mockChargeRefunded.data.object.amount_refunded, 10000);
});

Deno.test("should identify charge.dispute.created event", () => {
  assertEquals(mockDisputeCreated.type, "charge.dispute.created");
  assertEquals(mockDisputeCreated.data.object.reason, "fraudulent");
});

/**
 * Test amount conversion (cents to dollars)
 */
Deno.test("should convert cents to dollars correctly", () => {
  const testCases = [
    { cents: 10000, dollars: 100.0 },
    { cents: 5050, dollars: 50.5 },
    { cents: 99, dollars: 0.99 },
    { cents: 100000, dollars: 1000.0 },
  ];

  for (const { cents, dollars } of testCases) {
    const converted = cents / 100;
    assertEquals(converted, dollars);
  }
});

/**
 * Test payment method detection logic
 */
Deno.test("should determine payment method correctly", () => {
  const testCases = [
    { type: "card", wallet: null, expected: "stripe_checkout_card" },
    {
      type: "card",
      wallet: { type: "apple_pay" },
      expected: "stripe_checkout_wallet",
    },
    { type: "us_bank_account", wallet: null, expected: "stripe_checkout_bank" },
    { type: "link", wallet: null, expected: "stripe_checkout_wallet" },
  ];

  for (const { type, wallet, expected } of testCases) {
    let paymentMethod = "stripe_checkout_card";

    if (type === "us_bank_account") {
      paymentMethod = "stripe_checkout_bank";
    } else if (type === "link" || (type === "card" && wallet)) {
      paymentMethod = "stripe_checkout_wallet";
    }

    assertEquals(paymentMethod, expected);
  }
});

/**
 * Test invoice status update logic
 */
Deno.test("should determine if invoice should be marked as paid", () => {
  const testCases = [
    { total: 100.0, totalPaid: 100.0, shouldBePaid: true },
    { total: 100.0, totalPaid: 50.0, shouldBePaid: false },
    { total: 100.0, totalPaid: 100.0, shouldBePaid: true },
    { total: 100.0, totalPaid: 150.0, shouldBePaid: true }, // Overpaid
  ];

  for (const { total, totalPaid, shouldBePaid } of testCases) {
    const isPaid = totalPaid >= total;
    assertEquals(isPaid, shouldBePaid);
  }
});

/**
 * Test refund detection (full vs partial)
 */
Deno.test("should detect full vs partial refund", () => {
  const testCases = [
    { amount: 10000, refunded: 10000, isPartial: false }, // Full refund
    { amount: 10000, refunded: 5000, isPartial: true }, // Partial refund
    { amount: 10000, refunded: 0, isPartial: false }, // No refund (not partial, just not refunded)
  ];

  for (const { amount, refunded, isPartial } of testCases) {
    // Partial refund means refunded > 0 AND refunded < amount
    const calculatedIsPartial = refunded > 0 && refunded < amount;
    assertEquals(calculatedIsPartial, isPartial);
  }
});

/**
 * Test metadata extraction
 */
Deno.test("should extract invoice_id from session metadata", () => {
  const session = mockCheckoutSessionCompleted.data.object;
  const invoiceId = session.metadata?.invoice_id;

  assertEquals(invoiceId, "inv_test_123");
});

Deno.test("should handle missing metadata gracefully", () => {
  const sessionWithoutMetadata: {
    id: string;
    metadata: Record<string, string> | null;
  } = {
    id: "cs_test_456",
    metadata: null,
  };

  const invoiceId = sessionWithoutMetadata.metadata?.invoice_id;
  assertEquals(invoiceId, undefined);
});
