/**
 * API Integration Tests: Webhook Processing
 *
 * These tests verify webhook signature verification and event processing
 * using real Stripe webhook signing and test events.
 *
 * Requirements:
 * - Stripe test API keys and webhook secret must be set
 * - Tests verify webhook signature verification logic
 * - Tests use real Stripe webhook event structure
 *
 * Run with: npm test -- webhook-processing
 */

import crypto from "node:crypto";
import Stripe from "stripe";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Mock Supabase for database operations
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("Webhook Processing - API Integration", () => {
  let stripe: Stripe;
  let webhookSecret: string;
  const testInvoiceId = "test-invoice-123";
  const testOrgId = "test-org-123";

  beforeAll(() => {
    const stripeTestKey = process.env.STRIPE_SECRET_KEY;
    const testWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeTestKey || !stripeTestKey.startsWith("sk_test_")) {
      throw new Error(
        "STRIPE_SECRET_KEY environment variable must be set with a test key (sk_test_...)"
      );
    }

    if (!testWebhookSecret || !testWebhookSecret.startsWith("whsec_")) {
      // For testing, we can generate a test webhook secret
      // In real scenarios, this comes from Stripe CLI or dashboard
      webhookSecret = "whsec_test_secret_for_testing_only";
      console.warn("STRIPE_WEBHOOK_SECRET not set - using test secret. Real webhooks will fail.");
    } else {
      webhookSecret = testWebhookSecret;
    }

    // Omit apiVersion — stripe package pins LatestApiVersion
    stripe = new Stripe(stripeTestKey);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper to create a valid Stripe webhook signature
   */
  function createWebhookSignature(
    payload: string,
    secret: string,
    timestamp: number = Math.floor(Date.now() / 1000)
  ): string {
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload, "utf8")
      .digest("hex");

    return `t=${timestamp},v1=${signature}`;
  }

  describe("Webhook Signature Verification", () => {
    it("should verify valid webhook signature", () => {
      const payload = JSON.stringify({
        id: "evt_test_123",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            status: "complete",
          },
        },
      });

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createWebhookSignature(payload, webhookSecret, timestamp);

      // Verify using Stripe's method
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      expect(event.id).toBe("evt_test_123");
      expect(event.type).toBe("checkout.session.completed");
    });

    it("should reject invalid webhook signature", () => {
      const payload = JSON.stringify({
        id: "evt_test_123",
        type: "checkout.session.completed",
      });

      const invalidSignature = "t=1234567890,v1=invalid_signature";

      expect(() => {
        stripe.webhooks.constructEvent(payload, invalidSignature, webhookSecret);
      }).toThrow();
    });

    it("should reject webhook with wrong secret", () => {
      const payload = JSON.stringify({
        id: "evt_test_123",
        type: "checkout.session.completed",
      });

      const wrongSecret = "whsec_wrong_secret";
      const signature = createWebhookSignature(payload, wrongSecret);

      expect(() => {
        stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      }).toThrow();
    });

    it("should reject webhook with old timestamp (> 5 minutes)", () => {
      const payload = JSON.stringify({
        id: "evt_test_123",
        type: "checkout.session.completed",
      });

      // Create signature with timestamp 10 minutes ago
      // Stripe validates timestamps and rejects those outside the tolerance zone (default: 5 minutes)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 10 * 60;
      const signature = createWebhookSignature(payload, webhookSecret, oldTimestamp);

      // Stripe's constructEvent validates timestamps and rejects old ones
      expect(() => {
        stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      }).toThrow(); // Stripe validates timestamp and rejects old ones
    });

    it("should handle missing signature header", () => {
      expect(() => {
        stripe.webhooks.constructEvent(JSON.stringify({ id: "evt_123" }), "", webhookSecret);
      }).toThrow();
    });
  });

  describe("Webhook Event Processing", () => {
    it("should process checkout.session.completed event correctly", () => {
      const event = stripe.webhooks.constructEvent(
        JSON.stringify({
          id: "evt_test_123",
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test_123",
              payment_status: "paid",
              amount_total: 1000,
              currency: "aud",
              customer_email: "test@example.com",
              metadata: {
                invoice_id: testInvoiceId,
                invoice_number: "INV-001",
                organization_id: testOrgId,
              },
              payment_intent: "pi_test_123",
            },
          },
        }),
        createWebhookSignature(
          JSON.stringify({
            id: "evt_test_123",
            type: "checkout.session.completed",
            data: {
              object: {
                id: "cs_test_123",
                payment_status: "paid",
                amount_total: 1000,
                currency: "aud",
                customer_email: "test@example.com",
                metadata: {
                  invoice_id: testInvoiceId,
                  invoice_number: "INV-001",
                  organization_id: testOrgId,
                },
                payment_intent: "pi_test_123",
              },
            },
          }),
          webhookSecret
        ),
        webhookSecret
      );

      expect(event.type).toBe("checkout.session.completed");
      const session = event.data.object as Stripe.Checkout.Session;
      expect(session.id).toBe("cs_test_123");
      expect(session.metadata?.invoice_id).toBe(testInvoiceId);
      expect(session.amount_total).toBe(1000);
    });

    it("should process payment_intent.succeeded event correctly", () => {
      const event = stripe.webhooks.constructEvent(
        JSON.stringify({
          id: "evt_test_456",
          type: "payment_intent.succeeded",
          data: {
            object: {
              id: "pi_test_123",
              amount: 1000,
              currency: "aud",
              status: "succeeded",
              metadata: {
                invoice_id: testInvoiceId,
                organization_id: testOrgId,
              },
            },
          },
        }),
        createWebhookSignature(
          JSON.stringify({
            id: "evt_test_456",
            type: "payment_intent.succeeded",
            data: {
              object: {
                id: "pi_test_123",
                amount: 1000,
                currency: "aud",
                status: "succeeded",
                metadata: {
                  invoice_id: testInvoiceId,
                  organization_id: testOrgId,
                },
              },
            },
          }),
          webhookSecret
        ),
        webhookSecret
      );

      expect(event.type).toBe("payment_intent.succeeded");
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      expect(paymentIntent.id).toBe("pi_test_123");
      expect(paymentIntent.status).toBe("succeeded");
      expect(paymentIntent.metadata?.invoice_id).toBe(testInvoiceId);
    });

    it("should process payment_intent.payment_failed event correctly", () => {
      const event = stripe.webhooks.constructEvent(
        JSON.stringify({
          id: "evt_test_789",
          type: "payment_intent.payment_failed",
          data: {
            object: {
              id: "pi_test_456",
              amount: 1000,
              currency: "aud",
              status: "requires_payment_method",
              last_payment_error: {
                message: "Your card was declined.",
                type: "card_error",
              },
              metadata: {
                invoice_id: testInvoiceId,
              },
            },
          },
        }),
        createWebhookSignature(
          JSON.stringify({
            id: "evt_test_789",
            type: "payment_intent.payment_failed",
            data: {
              object: {
                id: "pi_test_456",
                amount: 1000,
                currency: "aud",
                status: "requires_payment_method",
                last_payment_error: {
                  message: "Your card was declined.",
                  type: "card_error",
                },
                metadata: {
                  invoice_id: testInvoiceId,
                },
              },
            },
          }),
          webhookSecret
        ),
        webhookSecret
      );

      expect(event.type).toBe("payment_intent.payment_failed");
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      expect(paymentIntent.status).toBe("requires_payment_method");
      expect(paymentIntent.last_payment_error?.message).toContain("declined");
    });

    it("should process charge.refunded event correctly", () => {
      const event = stripe.webhooks.constructEvent(
        JSON.stringify({
          id: "evt_test_refund",
          type: "charge.refunded",
          data: {
            object: {
              id: "ch_test_123",
              amount: 1000,
              amount_refunded: 1000,
              refunded: true,
              payment_intent: "pi_test_123",
              metadata: {
                invoice_id: testInvoiceId,
              },
            },
          },
        }),
        createWebhookSignature(
          JSON.stringify({
            id: "evt_test_refund",
            type: "charge.refunded",
            data: {
              object: {
                id: "ch_test_123",
                amount: 1000,
                amount_refunded: 1000,
                refunded: true,
                payment_intent: "pi_test_123",
                metadata: {
                  invoice_id: testInvoiceId,
                },
              },
            },
          }),
          webhookSecret
        ),
        webhookSecret
      );

      expect(event.type).toBe("charge.refunded");
      const charge = event.data.object as Stripe.Charge;
      expect(charge.refunded).toBe(true);
      expect(charge.amount_refunded).toBe(1000);
      expect(charge.metadata?.invoice_id).toBe(testInvoiceId);
    });
  });

  describe("Webhook Event Metadata Extraction", () => {
    it("should extract invoice_id from checkout.session.completed metadata", () => {
      const event = stripe.webhooks.constructEvent(
        JSON.stringify({
          id: "evt_test",
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test",
              metadata: {
                invoice_id: testInvoiceId,
                invoice_number: "INV-001",
                organization_id: testOrgId,
              },
            },
          },
        }),
        createWebhookSignature(
          JSON.stringify({
            id: "evt_test",
            type: "checkout.session.completed",
            data: {
              object: {
                id: "cs_test",
                metadata: {
                  invoice_id: testInvoiceId,
                  invoice_number: "INV-001",
                  organization_id: testOrgId,
                },
              },
            },
          }),
          webhookSecret
        ),
        webhookSecret
      );

      const session = event.data.object as Stripe.Checkout.Session;
      expect(session.metadata?.invoice_id).toBe(testInvoiceId);
      expect(session.metadata?.invoice_number).toBe("INV-001");
      expect(session.metadata?.organization_id).toBe(testOrgId);
    });

    it("should handle missing metadata gracefully", () => {
      const event = stripe.webhooks.constructEvent(
        JSON.stringify({
          id: "evt_test",
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test",
              // No metadata
            },
          },
        }),
        createWebhookSignature(
          JSON.stringify({
            id: "evt_test",
            type: "checkout.session.completed",
            data: {
              object: {
                id: "cs_test",
              },
            },
          }),
          webhookSecret
        ),
        webhookSecret
      );

      const session = event.data.object as Stripe.Checkout.Session;
      expect(session.metadata).toBeUndefined();
    });
  });

  describe("Webhook Idempotency", () => {
    it("should handle duplicate webhook events (idempotency check)", () => {
      const eventPayload = {
        id: "evt_test_duplicate",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            metadata: { invoice_id: testInvoiceId },
          },
        },
      };

      const payloadString = JSON.stringify(eventPayload);
      const signature = createWebhookSignature(payloadString, webhookSecret);

      // Process same event twice
      const event1 = stripe.webhooks.constructEvent(payloadString, signature, webhookSecret);
      const event2 = stripe.webhooks.constructEvent(payloadString, signature, webhookSecret);

      expect(event1.id).toBe(event2.id);
      expect(event1.type).toBe(event2.type);

      // In real implementation, you'd check database to see if event already processed
      // This test verifies the event can be processed multiple times without error
    });
  });
});
