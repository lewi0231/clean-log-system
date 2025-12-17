# Stripe Webhooks for Local Development

## Understanding the Issue

When developing locally with Stripe, you may see errors for `checkout.session.completed` and `payment_intent.succeeded` events even though you're using `stripe listen` to forward webhooks.

### Why This Happens

Stripe sends webhooks to **ALL configured webhook endpoints**:

1. **Stripe CLI Forwarding** (`stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`)

   - Creates a temporary forwarding endpoint
   - Works perfectly for local development
   - Provides a webhook secret (starts with `whsec_`)

2. **Stripe Dashboard Webhook Endpoints**
   - Any endpoints you've configured in your Stripe Dashboard
   - These point to your **remote/production** Supabase URL
   - Stripe sends events to these **in addition to** the forwarded endpoint
   - These fail locally because they can't reach your remote URL

### The Result

- ✅ Events forwarded via `stripe listen` → Work perfectly
- ❌ Events sent to Dashboard endpoints → Fail (can't reach remote URL)

## Solution: Disable Remote Webhooks During Local Development

### Option 1: Temporarily Disable Dashboard Webhooks (Recommended)

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. For each webhook endpoint pointing to your remote Supabase URL:
   - Click on the endpoint
   - Click "Disable" or delete it temporarily
3. Re-enable them when deploying to production

### Option 2: Use a Separate Stripe Test Account

Create a separate Stripe test account for local development that has no webhook endpoints configured.

### Option 3: Ignore the Errors (Not Recommended)

The errors in Stripe CLI are harmless - your local webhook handler still receives and processes events correctly. However, this clutters your logs and can be confusing.

## Setting Up Local Webhook Secret

When you run `stripe listen`, you'll see output like:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

1. Copy this webhook secret
2. Set it in your local environment:

```bash
# In your .env.local or supabase/.env.local
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

3. Restart your Supabase local instance:

```bash
cd database
supabase stop
supabase start
```

## Verifying It's Working

1. Start Stripe CLI forwarding:

   ```bash
   stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
   ```

2. Make a test payment

3. Check Stripe CLI output - you should see:

   ```
   ✓ checkout.session.completed [200]
   ✓ payment_intent.succeeded [200]
   ```

4. Check your Supabase logs - you should see:
   ```
   Processing Stripe webhook event: checkout.session.completed
   Payment processed successfully
   ```

## Production Setup

When deploying to production:

1. **Re-enable webhook endpoints** in Stripe Dashboard pointing to your production Supabase URL
2. **Update webhook secret** to the one from your Dashboard endpoint (not the CLI one)
3. **Set the secret** in your production environment:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_production_secret
   ```

## Quick Reference

| Environment | Webhook Secret Source  | Endpoint                                      |
| ----------- | ---------------------- | --------------------------------------------- |
| Local Dev   | `stripe listen` output | `localhost:54321/functions/v1/stripe-webhook` |
| Production  | Stripe Dashboard       | Your production Supabase URL                  |

## Troubleshooting

### "Webhook signature verification failed"

- ✅ Check you're using the correct webhook secret (from `stripe listen` for local)
- ✅ Ensure `STRIPE_WEBHOOK_SECRET` is set in your environment
- ✅ Restart Supabase after setting the secret

### Events not being received locally

- ✅ Check `stripe listen` is running
- ✅ Verify the forwarding URL is correct
- ✅ Check Supabase Edge Functions are running (`supabase functions serve`)

### Events being sent to remote URL

- ✅ Disable remote webhook endpoints in Stripe Dashboard
- ✅ Or use a separate test account for local development
