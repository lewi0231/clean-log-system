import { serve } from "server";
import type Stripe from "stripe";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import {
  createStripeClient,
  getStripeWebhookSecret,
  verifyWebhookSignature,
} from "../_utils/stripe.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

serve(async (req) => {
  // Load environment variables for local development
  await loadEnvIfLocal();

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return errorResponse("Missing Stripe-Signature header", 400);
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      const webhookSecret = getStripeWebhookSecret();
      event = verifyWebhookSignature(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return errorResponse(
        `Webhook signature verification failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
        400,
      );
    }

    const supabase = createServiceRoleClient();
    const stripe = createStripeClient();

    console.log(`Processing Stripe webhook event: ${event.type}`, {
      event_id: event.id,
      type: event.type,
    });

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Get invoice_id from metadata
        const invoiceId = session.metadata?.invoice_id;
        if (!invoiceId) {
          console.error("No invoice_id in checkout session metadata");
          break;
        }

        // Get payment intent details
        let paymentIntent: Stripe.PaymentIntent | null = null;
        if (session.payment_intent) {
          if (typeof session.payment_intent === "string") {
            paymentIntent = await stripe.paymentIntents.retrieve(
              session.payment_intent,
            );
          } else {
            paymentIntent = session.payment_intent as Stripe.PaymentIntent;
          }
        }

        // Update payment_link status
        const { error: linkUpdateError } = await supabase
          .from("payment_link")
          .update({
            status: "complete",
            payment_completed_at: new Date().toISOString(),
          })
          .eq("stripe_checkout_session_id", session.id);

        if (linkUpdateError) {
          console.error("Error updating payment_link:", linkUpdateError);
        }

        // Create payment record
        if (paymentIntent && paymentIntent.status === "succeeded") {
          const amount = paymentIntent.amount / 100; // Convert from cents
          const currency = paymentIntent.currency.toUpperCase();

          // Get charge details for fees
          let fees = 0;
          let netAmount = amount;
          if (paymentIntent.latest_charge) {
            const chargeId = typeof paymentIntent.latest_charge === "string"
              ? paymentIntent.latest_charge
              : paymentIntent.latest_charge.id;
            const charge = await stripe.charges.retrieve(chargeId);
            fees = charge.balance_transaction
              ? (charge.balance_transaction as Stripe.BalanceTransaction).fee /
                100
              : 0;
            netAmount = amount - fees;
          }

          // Determine payment method
          let paymentMethod = "stripe_checkout_card";
          if (paymentIntent.payment_method) {
            const pmId = typeof paymentIntent.payment_method === "string"
              ? paymentIntent.payment_method
              : paymentIntent.payment_method.id;
            const pm = await stripe.paymentMethods.retrieve(pmId);
            if (pm.type === "us_bank_account") {
              paymentMethod = "stripe_checkout_bank";
            } else if (pm.type === "link" || pm.type === "card") {
              paymentMethod = pm.card?.wallet?.type
                ? "stripe_checkout_wallet"
                : "stripe_checkout_card";
            }
          }

          // Get invoice to get organization_id and total
          const { data: invoice } = await supabase
            .from("invoice")
            .select(
              "id, organization_id, total, total_paid, payment_count, status",
            )
            .eq("id", invoiceId)
            .single();

          if (invoice) {
            // Create payment record
            const { data: payment, error: paymentError } = await supabase
              .from("payment")
              .insert({
                organization_id: invoice.organization_id,
                invoice_id: invoiceId,
                amount,
                currency,
                payment_method: paymentMethod,
                stripe_payment_intent_id: paymentIntent.id,
                stripe_checkout_session_id: session.id,
                stripe_customer_id: session.customer as string | null,
                stripe_charge_id:
                  typeof paymentIntent.latest_charge === "string"
                    ? paymentIntent.latest_charge
                    : paymentIntent.latest_charge?.id || null,
                status: "succeeded",
                received_at: new Date().toISOString(),
                fees,
                net_amount: netAmount,
                metadata: {
                  event_id: event.id,
                  event_type: event.type,
                  session_id: session.id,
                },
              })
              .select()
              .single();

            if (paymentError) {
              console.error("Error creating payment record:", paymentError);
            } else {
              // Update invoice total_paid and payment_count
              const newTotalPaid = (invoice.total_paid || 0) + amount;
              const newPaymentCount = (invoice.payment_count || 0) + 1;

              const { error: invoiceUpdateError } = await supabase
                .from("invoice")
                .update({
                  total_paid: newTotalPaid,
                  payment_count: newPaymentCount,
                  payment_method_used: "stripe_checkout",
                  status: newTotalPaid >= invoice.total
                    ? "paid"
                    : invoice.status,
                  paid_at: newTotalPaid >= invoice.total
                    ? new Date().toISOString()
                    : null,
                })
                .eq("id", invoiceId);

              if (invoiceUpdateError) {
                console.error("Error updating invoice:", invoiceUpdateError);
              }

              console.log("Payment processed successfully", {
                payment_id: payment.id,
                invoice_id: invoiceId,
                amount,
              });
            }
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        // Update payment status if exists
        const { error: updateError } = await supabase
          .from("payment")
          .update({
            status: "succeeded",
            received_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (updateError) {
          console.error("Error updating payment status:", updateError);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        // Create or update payment record with failed status
        const { data: existingPayment } = await supabase
          .from("payment")
          .select("id")
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .maybeSingle();

        if (existingPayment) {
          await supabase
            .from("payment")
            .update({
              status: "failed",
              metadata: {
                failure_code: paymentIntent.last_payment_error?.code,
                failure_message: paymentIntent.last_payment_error?.message,
              },
            })
            .eq("id", existingPayment.id);
        }

        console.log("Payment failed", {
          payment_intent_id: paymentIntent.id,
          error: paymentIntent.last_payment_error,
        });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;

        // Update payment status to refunded
        const { data: payment } = await supabase
          .from("payment")
          .select("id, invoice_id, amount")
          .eq("stripe_charge_id", charge.id)
          .single();

        // Get invoice total separately
        let invoiceTotal = 0;
        if (payment?.invoice_id) {
          const { data: invoice } = await supabase
            .from("invoice")
            .select("total")
            .eq("id", payment.invoice_id)
            .single();
          invoiceTotal = invoice?.total || 0;
        }

        if (payment) {
          const refundAmount = charge.amount_refunded / 100;
          const isPartialRefund = refundAmount < payment.amount;

          await supabase
            .from("payment")
            .update({
              status: isPartialRefund ? "partially_refunded" : "refunded",
              metadata: {
                refund_amount: refundAmount,
                refunded_at: new Date().toISOString(),
              },
            })
            .eq("id", payment.id);

          // Update invoice if fully refunded
          if (!isPartialRefund && payment.invoice_id) {
            await supabase
              .from("invoice")
              .update({
                status: "sent",
                total_paid: invoiceTotal - refundAmount,
              })
              .eq("id", payment.invoice_id);
          }
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;

        // Update payment status to disputed
        await supabase
          .from("payment")
          .update({
            status: "disputed",
            metadata: {
              dispute_id: dispute.id,
              dispute_reason: dispute.reason,
              dispute_status: dispute.status,
            },
          })
          .eq("stripe_charge_id", dispute.charge as string);

        console.log("Payment disputed", {
          dispute_id: dispute.id,
          charge_id: dispute.charge,
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Always return 200 to acknowledge receipt
    return jsonResponse({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Webhook processing failed",
      500,
    );
  }
});
