# Stripe Webhook Setup - Quick Reference

**Created:** January 2025  
**Purpose:** Step-by-step guide for setting up Stripe webhooks

---

## Key Concepts

### API Keys vs Webhook Secrets

**They are DIFFERENT:**

- **API Secret Key** (`sk_test_...` or `sk_live_...`)

  - Used to make API calls TO Stripe
  - Found in: Dashboard → Developers → API keys
  - Used in: Your backend code to create checkout sessions, etc.

- **Webhook Signing Secret** (`whsec_...`)
  - Used to VERIFY webhooks FROM Stripe
  - Found in: Dashboard → Developers → Webhooks → [Your Endpoint] → Signing secret
  - Used in: Your webhook handler to verify the request came from Stripe
  - **You get this AFTER creating the webhook endpoint**

---

## Step-by-Step: Setting Up Webhook Endpoint

### Step 1: Find Your Supabase Project URL

1. Go to your Supabase Dashboard
2. Click **Project Settings** (gear icon in sidebar)
3. Click **API** in the left menu
4. Find **Project URL** - it looks like: `https://abcdefghijklmnop.supabase.co`
5. Your webhook endpoint will be: `https://abcdefghijklmnop.supabase.co/functions/v1/stripe-webhook`
   - Replace `abcdefghijklmnop` with your actual project reference

### Step 2: Create Webhook Endpoint in Stripe

1. **Go to Stripe Dashboard:**

   - Make sure you're in the correct account/Sandbox
   - Click **Developers** in the left sidebar
   - Click **Webhooks**

2. **Add New Endpoint:**

   - Click **"+ Add endpoint"** button (top right)
   - **Endpoint URL:** Paste your Supabase function URL:
     ```
     https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
     ```
   - **Description:** (Optional) "Clean Log System - Invoice Payments"

3. **Select Events:**

   - Click **"Select events"** button
   - **DO NOT** select "Send all events" (we only want specific ones)
   - Search and select these events one by one:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
     - `charge.dispute.created`
   - Click **"Add events"** when done

4. **Save:**
   - Click **"Add endpoint"** at the bottom
   - Stripe will try to send a test event (it will fail - that's OK, we haven't created the function yet)

### Step 3: Get the Webhook Signing Secret

1. After creating the endpoint, you'll see it in the webhooks list
2. Click on the endpoint name
3. Scroll down to **"Signing secret"** section
4. Click **"Reveal"** button
5. Copy the secret (starts with `whsec_...`)
6. This is your `STRIPE_WEBHOOK_SECRET` - add it to your environment variables

---

## Visual Guide: Where to Find Things

### Finding API Keys:

```
Stripe Dashboard
  → Developers (left sidebar)
    → API keys
      → Reveal test key (sk_test_...)
      → Reveal test key token (pk_test_...)
```

### Finding/Creating Webhooks:

```
Stripe Dashboard
  → Developers (left sidebar)
    → Webhooks
      → + Add destination (purple button, top right)
        → Choose "Webhook endpoint" as destination type
        → Enter URL
        → Select events
        → Add destination / Save
      → [Click on endpoint name]
        → Signing secret (whsec_...)
```

---

## Testing Your Webhook

### Before Your Function Exists:

Stripe will show webhook delivery failures - that's expected! Once you create the webhook handler function, it will start working.

### After Your Function Exists:

1. **Check Webhook Logs:**

   - Go to: Developers → Webhooks → [Your Endpoint]
   - Click **"Events"** tab
   - You'll see all webhook attempts and their status

2. **Test with Stripe CLI (Local):**

   ```bash
   stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
   stripe trigger checkout.session.completed
   ```

3. **Test with Real Payment:**
   - Create a test checkout session
   - Complete a test payment
   - Check webhook logs in Stripe Dashboard

---

## Common Issues

### "Webhook endpoint returned an error"

**If you haven't created the function yet:**

- This is normal! Create the webhook handler function first.

**If you have created the function:**

- Check that the URL is correct
- Verify the function is deployed
- Check function logs in Supabase Dashboard

### "Invalid signature" errors

- Make sure you're using the correct webhook signing secret
- The secret from Stripe CLI is different from Dashboard secret
- Use CLI secret for local testing, Dashboard secret for production

### "Event not received"

- Check that you selected the correct events when creating the endpoint
- Verify the event actually occurred (check Stripe Dashboard → Payments)
- Check webhook logs in Stripe Dashboard

---

## Environment Variables Checklist

Make sure you have all three:

```bash
# ✅ API Secret Key (from Developers → API keys)
STRIPE_SECRET_KEY=sk_test_...

# ✅ Publishable Key (from Developers → API keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# ✅ Webhook Signing Secret (from Developers → Webhooks → [Endpoint] → Signing secret)
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Remember:** The webhook secret is different from the API secret key!

---

## Next Steps

Once you've:

1. ✅ Created the webhook endpoint in Stripe
2. ✅ Copied the webhook signing secret
3. ✅ Added all environment variables

You're ready to:

- Create the webhook handler function (see implementation guide)
- Test webhook delivery
- Start processing payments!

---

## Resources

- [Stripe Webhooks Quickstart](https://docs.stripe.com/webhooks/quickstart?lang=node)
- [Stripe Webhook Events Reference](https://stripe.com/docs/api/events/types)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
