# Stripe Webhooks: Local Development vs Production

**Created:** January 2025  
**Purpose:** Clarify webhook setup for local development vs production

---

## The Challenge

- **Local Supabase:** Runs on `http://localhost:54321` (not publicly accessible)
- **Production Supabase:** `https://YOUR_PROJECT_REF.supabase.co` (publicly accessible)
- **Stripe Webhooks:** Need a publicly accessible URL to send events to

**Problem:** Stripe can't send webhooks to `localhost` URLs.

---

## Solution: Two Different Approaches

### For Production/Staging (What You Just Set Up)

✅ **Keep the webhook endpoint you just created** in Stripe Dashboard pointing to your production Supabase URL:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

**This works when:**

- Your webhook handler code is deployed to production Supabase
- You're testing in staging/production environment
- Processing real payments

**Webhook Secret:** Use the secret from Stripe Dashboard (starts with `whsec_...`)

---

### For Local Development (Use Stripe CLI)

Use **Stripe CLI** to forward webhooks from Stripe to your local Supabase.

**Setup:**

1. **Install Stripe CLI:**

   ```bash
   brew install stripe/stripe-cli/stripe  # macOS
   ```

2. **Login:**

   ```bash
   stripe login
   ```

3. **Start Local Supabase:**

   ```bash
   cd database
   supabase start
   ```

4. **Forward Webhooks:**

   ```bash
   stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
   ```

   This command:

   - Creates a temporary public URL that Stripe can reach
   - Forwards all webhooks to your local Supabase
   - Outputs a **different** webhook secret (use this for local dev)

5. **Use the CLI Secret Locally:**
   - Copy the `whsec_...` secret from the CLI output
   - Use this in your local `.env.local` or Supabase local secrets
   - This is **different** from your production webhook secret

---

## Workflow

### During Local Development:

```bash
# Terminal 1: Start local Supabase
cd database
supabase start

# Terminal 2: Forward webhooks
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
# (Keep this running)

# Terminal 3: Develop and test
# Make test payments, trigger events, etc.
```

### When Deploying to Production:

1. Deploy your webhook handler to production Supabase
2. The production webhook endpoint (already configured in Stripe) will work
3. Use the production webhook secret from Stripe Dashboard
4. Test with real Stripe events

---

## Environment Variables Setup

### Local Development (`dashboard/.env.local`):

```bash
# Stripe API Keys (same for both)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook Secret (from Stripe CLI output when running `stripe listen`)
STRIPE_WEBHOOK_SECRET=whsec_...  # From CLI
```

### Production (Supabase Secrets):

```bash
# Stripe API Keys (same)
STRIPE_SECRET_KEY=sk_test_...  # or sk_live_... for production
STRIPE_WEBHOOK_SECRET=whsec_...  # From Stripe Dashboard webhook settings
```

**Note:** You'll need to add these to Supabase secrets for edge functions to access them:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Testing

### Local Testing:

```bash
# With Stripe CLI running
stripe trigger checkout.session.completed
stripe trigger payment_intent.succeeded
```

### Production Testing:

- Use Stripe Dashboard → Webhooks → [Your Endpoint] → "Send test webhook"
- Or make real test payments using test cards

---

## Summary

✅ **Go ahead and save the webhook endpoint** you're creating - it's correct for production!

✅ **For local development**, use Stripe CLI to forward webhooks - it's the recommended approach.

✅ **You can have both** - the production endpoint for deployed code, and CLI forwarding for local dev.

✅ **Use different webhook secrets** - one from CLI for local, one from Dashboard for production.

---

## Resources

- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Webhooks Guide](https://docs.stripe.com/webhooks)
- [Local Supabase Development](https://supabase.com/docs/guides/cli/local-development)
