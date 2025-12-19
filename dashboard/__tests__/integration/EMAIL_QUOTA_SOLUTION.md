# Email Quota Issue - Solution

## Problem

Even with `RESEND_TEST_MODE=true`, Resend still sends emails (to test addresses like `delivered+invoice-{id}@resend.dev`) and counts them towards your daily quota. Running multiple integration tests can quickly exhaust this quota.

## Solution

Set `SKIP_EMAIL_SENDING=true` in your `.env.development` file. This will:

1. **Skip actual email sending** - No API calls to Resend
2. **Still test email logic** - All email recipient lookup, formatting, and flow logic is still tested
3. **Return mock success** - Functions return `{ success: true, emailId: "mock-email-{timestamp}" }`
4. **Avoid rate limits** - No quota consumption during testing

## How It Works

The Edge Functions check for `SKIP_EMAIL_SENDING=true` before making API calls to Resend:

```typescript
const skipEmailSending = Deno.env.get("SKIP_EMAIL_SENDING") === "true";

if (skipEmailSending) {
  console.log("[SKIP EMAIL] Email sending skipped for integration tests");
  return { success: true, emailId: `mock-email-${Date.now()}` };
}
```

## Setup

Add to `.env.development`:

```env
RESEND_TEST_MODE=true
SKIP_EMAIL_SENDING=true  # Add this line
```

## Environment Variable Loading

Edge Functions load environment variables from:

1. `.env.development` (loaded first)
2. `.env` (loaded second, overrides .env.development if both exist)

The `loadEnvIfLocal()` function in `database/supabase/functions/_utils/env.ts` handles this automatically.

## When to Use

- **Integration tests**: Always use `SKIP_EMAIL_SENDING=true` to avoid quota issues
- **Manual testing**: Use `RESEND_TEST_MODE=true` without `SKIP_EMAIL_SENDING` to see actual test emails
- **Production**: Neither flag should be set

## Testing Email Logic

Even with `SKIP_EMAIL_SENDING=true`, the following is still tested:

- ✅ Email recipient lookup (location email, form field email, default email)
- ✅ Email validation
- ✅ Email formatting and HTML generation
- ✅ Error handling when no recipients found
- ✅ Test mode recipient redirection logic

Only the actual API call to Resend is skipped.
