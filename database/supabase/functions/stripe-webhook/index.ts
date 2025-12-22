import { serve } from "server";
import {
  getOrganizationName,
  sendPaymentConfirmationEmail,
} from "../_utils/email.ts";
import { loadEnvIfLocal } from "../_utils/env.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import {
  getInvoiceEmailRecipients,
  type InvoiceEmailRecipientConfig,
  type JobContext,
} from "../_utils/invoice-email.ts";
import { createLogger } from "../_utils/logger.ts";
import type { Stripe } from "../_utils/stripe.ts";
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

  // Declare variables in outer scope for error handling
  let event: Stripe.Event | undefined;
  const supabase = createServiceRoleClient();
  const logger = createLogger(req, { functionName: "stripe-webhook" });

  try {
    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return errorResponse("Missing Stripe-Signature header", 400);
    }

    // Verify webhook signature
    // Note: In local development with `stripe listen`, use the webhook secret shown by the CLI
    // In production, use the webhook secret from your Stripe Dashboard webhook endpoint
    try {
      const webhookSecret = getStripeWebhookSecret();
      event = verifyWebhookSignature(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      logger.error("Webhook signature verification failed", err, {
        hint:
          "For local dev: Use webhook secret from 'stripe listen' output. Disable remote webhook endpoints in Stripe Dashboard.",
      });
      return errorResponse(
        `Webhook signature verification failed: ${errorMessage}`,
        400,
      );
    }

    const stripe = createStripeClient();

    logger.info(`Processing Stripe webhook event: ${event.type}`, {
      event_id: event.id,
      type: event.type,
    });

    // Check if this event has already been processed (idempotency protection)
    const { data: existingEvent, error: checkError } = await supabase
      .from("webhook_event")
      .select("id, status, processed_at")
      .eq("event_id", event.id)
      .maybeSingle();

    if (checkError) {
      logger.error("Error checking webhook event idempotency", checkError);
      // Continue processing - don't fail on check error
    } else if (existingEvent) {
      logger.info(`Webhook event ${event.id} already processed`, {
        status: existingEvent.status,
        processed_at: existingEvent.processed_at,
      });
      // Return success to prevent Stripe from retrying
      return jsonResponse({
        received: true,
        message: "Event already processed",
        event_id: event.id,
      });
    }

    // Record that we're processing this event
    const { error: insertError } = await supabase
      .from("webhook_event")
      .insert({
        event_id: event.id,
        event_type: event.type,
        status: "processed",
        metadata: {
          livemode: event.livemode,
          api_version: event.api_version,
        },
      });

    if (insertError) {
      logger.error("Error recording webhook event", insertError);
      // Continue processing - don't fail on insert error
    }

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Get invoice_id from metadata
        const invoiceId = session.metadata?.invoice_id;
        if (!invoiceId) {
          logger.error(
            "No invoice_id in checkout session metadata",
            undefined,
            {
              session_id: session.id,
            },
          );
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

              logger.info("Payment processed successfully", {
                payment_id: payment.id,
                invoice_id: invoiceId,
                amount,
              });

              // Send payment confirmation email
              try {
                // Fetch invoice with full details for email
                const { data: invoiceForEmail } = await supabase
                  .from("invoice")
                  .select(
                    `
                    id,
                    invoice_number,
                    organization_id,
                    currency,
                    invoice_job:invoice_job (
                      job:job_id (
                        id,
                        location_id,
                        submission_data,
                        location:location_id (
                          id,
                          email,
                          contact_person,
                          hierarchy_parent_id
                        )
                      )
                    )
                  `,
                  )
                  .eq("id", invoiceId)
                  .single();

                if (invoiceForEmail) {
                  // Get invoice template config for email recipient configuration
                  const { data: templateConfig } = await supabase
                    .from("invoice_template_config")
                    .select("email_recipient_config")
                    .eq("organization_id", invoiceForEmail.organization_id)
                    .single();

                  const emailConfig: InvoiceEmailRecipientConfig =
                    (templateConfig
                      ?.email_recipient_config as InvoiceEmailRecipientConfig) ||
                    {
                      location_email_source: "location_email",
                      form_field_email: null,
                      default_email: null,
                    };

                  // Get field configs for form field email mapping
                  const { data: fieldConfigs } = await supabase
                    .from("organization_field_configs")
                    .select("id, name")
                    .eq("organization_id", invoiceForEmail.organization_id)
                    .eq("active", true);

                  const fieldConfigMap = new Map<string, { name: string }>(
                    (fieldConfigs || []).map(
                      (fc: { id: string; name: string }) => [
                        fc.id,
                        { name: fc.name },
                      ],
                    ),
                  );

                  // Build job contexts for email recipient determination
                  const jobContexts: JobContext[] = [];
                  if (
                    invoiceForEmail.invoice_job &&
                    Array.isArray(invoiceForEmail.invoice_job)
                  ) {
                    for (const invoiceJob of invoiceForEmail.invoice_job) {
                      // Handle Supabase query result - job might be returned as array or object
                      const jobRaw = invoiceJob.job as unknown;
                      const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;

                      if (job && typeof job === "object" && job !== null) {
                        const jobObj = job as {
                          id?: string;
                          location_id?: string | null;
                          submission_data?: Record<string, unknown> | null;
                          location?:
                            | {
                              id?: string;
                              email?: string | null;
                              contact_person?: string | null;
                              hierarchy_parent_id?: string | null;
                            }
                            | null
                            | Array<{
                              id?: string;
                              email?: string | null;
                              contact_person?: string | null;
                              hierarchy_parent_id?: string | null;
                            }>;
                        };

                        // Handle location - might be array or object
                        const locationRaw = jobObj.location;
                        const location = Array.isArray(locationRaw)
                          ? locationRaw[0]
                          : locationRaw;

                        jobContexts.push({
                          location_id: jobObj.location_id || null,
                          location: location && typeof location === "object"
                            ? {
                              id: location.id || "",
                              email: location.email || null,
                              contact_person: location.contact_person || null,
                              hierarchy_parent_id:
                                location.hierarchy_parent_id || null,
                            }
                            : null,
                          submission_data: jobObj.submission_data || null,
                        });
                      }
                    }
                  }

                  // Get email recipients
                  const emailRecipients = await getInvoiceEmailRecipients(
                    supabase,
                    jobContexts,
                    emailConfig,
                    fieldConfigMap,
                  );

                  if (emailRecipients.length > 0) {
                    // Get organization name
                    let organizationName: string;
                    try {
                      organizationName = await getOrganizationName(
                        supabase,
                        invoiceForEmail.organization_id,
                      );
                    } catch (err) {
                      console.error(
                        `Failed to get organization name for org ${invoiceForEmail.organization_id}:`,
                        err,
                      );
                      organizationName = "Organization";
                    }

                    // Get payment method details from Stripe
                    let paymentMethodDisplay = "Card";
                    if (paymentIntent.payment_method) {
                      const pmId = typeof paymentIntent.payment_method ===
                          "string"
                        ? paymentIntent.payment_method
                        : paymentIntent.payment_method.id;
                      try {
                        const pm = await stripe.paymentMethods.retrieve(pmId);
                        if (pm.type === "card" && pm.card) {
                          const brand = pm.card.brand || "Card";
                          const last4 = pm.card.last4 || "****";
                          paymentMethodDisplay = `${
                            brand.charAt(0).toUpperCase() + brand.slice(1)
                          } ending in ${last4}`;
                        } else if (pm.type === "us_bank_account") {
                          paymentMethodDisplay = "Bank Account";
                        } else if (pm.type === "link") {
                          paymentMethodDisplay = "Link";
                        }
                      } catch (pmError) {
                        console.warn(
                          "Failed to retrieve payment method details:",
                          pmError,
                        );
                      }
                    }

                    // Determine the base URL for the invoice view
                    const baseUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") ||
                      "http://localhost:3000";
                    const invoiceUrl = `${baseUrl}/invoice/${invoiceId}`;

                    // Send payment confirmation email
                    const emailResult = await sendPaymentConfirmationEmail({
                      invoiceNumber: invoiceForEmail.invoice_number,
                      organizationName,
                      recipientEmails: emailRecipients,
                      paymentAmount: amount,
                      currency: currency,
                      paymentMethod: paymentMethodDisplay,
                      transactionId: paymentIntent.id,
                      paymentDate: new Date().toISOString(),
                      invoiceUrl: invoiceUrl,
                    });

                    if (emailResult.success) {
                      console.log(
                        `Payment confirmation email sent successfully for invoice ${invoiceForEmail.invoice_number} (Email ID: ${
                          emailResult.emailId || "unknown"
                        })`,
                      );
                    } else {
                      console.error(
                        `Failed to send payment confirmation email for invoice ${invoiceForEmail.invoice_number}:`,
                        emailResult.error,
                      );
                      // Don't fail webhook processing if email fails
                    }
                  } else {
                    console.warn(
                      `No email recipients found for payment confirmation for invoice ${invoiceForEmail.invoice_number}`,
                    );
                  }
                }
              } catch (emailError) {
                console.error(
                  "Error sending payment confirmation email:",
                  emailError,
                );
                // Don't fail webhook processing if email fails
              }
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

        logger.warn("Payment failed", {
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

        logger.warn("Payment disputed", {
          dispute_id: dispute.id,
          charge_id: dispute.charge,
        });
        break;
      }

      default:
        logger.warn(`Unhandled event type: ${event.type}`, {
          event_id: event.id,
        });
    }

    // Mark event as successfully processed (if we inserted it earlier)
    // Note: If insert failed earlier, this update will also fail silently
    await supabase
      .from("webhook_event")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", event.id)
      .then(({ error }) => {
        if (error) {
          console.error("Error updating webhook event status:", error);
        }
      });

    // Always return 200 to acknowledge receipt
    return jsonResponse({ received: true });
  } catch (error) {
    logger.error("Webhook processing error", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Webhook processing failed";

    // Mark event as failed (if we inserted it earlier)
    // Note: event may not be available if error occurred before signature verification
    try {
      if (event?.id) {
        await supabase
          .from("webhook_event")
          .update({
            status: "failed",
            error_message: errorMessage,
          })
          .eq("event_id", event.id);
      }
    } catch (updateError) {
      console.error("Error updating webhook event status:", updateError);
      // Don't fail the response if we can't update the status
    }

    return errorResponse(errorMessage, 500);
  }
});
