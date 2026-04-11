# Email & Resend Implementation Review

**Date:** 2026-02-16  
**Status:** ✅ Unified — All emails now route through Resend  
**Context:** Worker activation emails not received; earlier received emails not visible in Resend dashboard.

## Executive Summary

**All emails now go through Resend** (unified system):

1. **Edge Functions → Resend API** – Worker invitations, org verification, activation links, invoices, feedback. Sent via `https://api.resend.com/emails`.

2. **Supabase Auth → Resend SMTP** – Password reset, magic links, any Auth-triggered email. Configured to use Resend SMTP (`smtp.resend.com`) in `config.toml`.

All emails appear in the Resend dashboard under the same project.

---

## Configuration Applied

### Local Development (`config.toml`)

```toml
[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 465
user = "resend"
pass = "env(RESEND_API_KEY)"
admin_email = "noreply@feedback.flowerhead.dev"
sender_name = "Clean Log"
```

### Hosted Supabase (Manual Configuration Required)

Go to **Supabase Dashboard → Authentication → Email → SMTP Settings**:

- **Sender email:** `noreply@feedback.flowerhead.dev`
- **Sender name:** `Clean Log`
- **Host:** `smtp.resend.com`
- **Port:** `465`
- **Username:** `resend`
- **Password:** Your `RESEND_API_KEY` (same key used in Edge Functions)

---

## Email Flows in This Project

| Flow | Trigger | Sender | Where it shows |
|------|---------|--------|----------------|
| Supabase Auth (password reset, magic links) | Auth events | Resend SMTP | ✅ Resend dashboard |
| Worker invitation | `create-worker` Edge Function | Resend API | ✅ Resend dashboard |
| Org signup verification | `register-organization` | Resend API | ✅ Resend dashboard |
| Resend activation link | `resend-activation-link` | Resend API | ✅ Resend dashboard |
| Invoices, feedback, payments | Various Edge Functions | Resend API | ✅ Resend dashboard |

---

## Root Causes: Why Worker Invitation May Not Arrive

### 1. Hosted Supabase – Missing or Incorrect Secrets

Edge Functions running on Supabase Cloud do not read local `.env`. They only use Supabase project secrets.

**Required secrets (Supabase → Project Settings → Edge Functions → Secrets):**

- `RESEND_API_KEY`
- `RESEND_FROM_DOMAIN`
- `WORKER_INVITATION_BASE_URL`

If any of these are missing or wrong, `validateEmailConfig()` fails and no email is sent.

### 2. Domain Not Verified in Resend

Resend requires verified domains. The `from` address uses `feedback.flowerhead.dev`.

**Check:** Resend Dashboard → Domains → `feedback.flowerhead.dev` must be **verified** (SPF + DKIM).

Without verification, emails may be rejected or blocked, and Resend's behavior can differ (e.g. not listing them or returning errors).

**References:**

- [Managing Domains - Resend](https://resend.com/docs/dashboard/domains/introduction)
- [Send with Supabase SMTP - Resend](https://resend.com/docs/send-with-supabase-smtp)

### 3. RESEND_TEST_MODE

When `RESEND_TEST_MODE=true`, recipient is overridden to `delivered+invitation-<token>@resend.dev`. The real recipient address never receives the email.

**Check:** Ensure `RESEND_TEST_MODE=false` when you expect real delivery.

### 4. SKIP_EMAIL_SENDING (Different Emails)

- `sendWorkerInvitationEmail` and `sendEmailVerificationEmail` **do not** check `SKIP_EMAIL_SENDING`.
- Invoice, payment, reminder, and feedback flows **do** check `SKIP_EMAIL_SENDING`.

So worker invitations are unaffected by this flag. If SKIP were ever used for those flows, it would be a bug; currently it isn't used for worker/verification emails.

### 5. API Key Mismatch Across Environments

`dashboard/.env.development` and `database/supabase/functions/.env` may use different `RESEND_API_KEY` values. Different keys can point to different Resend projects; emails would appear in the project of the key that was actually used.

**Action:** Use a single Resend project (and API key) for development and production, or ensure you look at the right dashboard for each environment.

### 6. Emails Sent to Spam

Verify the recipient's spam folder if the sending path is correct. Unverified domains and poor deliverability signals increase spam probability.

---

## Best Practices (Resend Docs)

1. **Domain verification** – Verify sending domain (SPF + DKIM) before production use.
2. **Subdomains** – Prefer subdomains (e.g. `feedback.flowerhead.dev`) over root for reputation isolation.
3. **Test addresses** – Use `delivered@resend.dev` or `delivered+label@resend.dev` for safe testing.
4. **Unified SMTP** – Configure Supabase Auth SMTP with Resend so Auth emails go through Resend and appear in the same dashboard. ✅ Done.
5. **From address** – `from` must use a verified domain (e.g. `Clean Log <noreply@feedback.flowerhead.dev>`).

---

## Implementation Notes

### env loading

`loadEnvIfLocal()` tries, in order:

1. `functions/.env`
2. `database/.env`
3. `database/../.env`
4. `dashboard/.env.development`

`WORKER_INVITATION_BASE_URL` is required by `validateEmailConfig()`. It exists in `functions/.env` (e.g. `http://localhost:3000`) and now also in `dashboard/.env.development`. For hosted Supabase, this must be set as a secret.

### create-worker now surfaces email errors

`create-worker` now logs when `sendWorkerInvitationEmail` fails and returns `email_sent` and `email_error` in the response for debugging.

---

## Checklist for Debugging

- [ ] **Supabase hosted:** Confirm `RESEND_API_KEY`, `RESEND_FROM_DOMAIN`, `WORKER_INVITATION_BASE_URL` in Project Settings → Edge Functions → Secrets.
- [ ] **Supabase Auth SMTP:** Configure SMTP settings in Authentication → Email → SMTP Settings with Resend credentials.
- [ ] **Resend dashboard:** Confirm `feedback.flowerhead.dev` (or the actual `RESEND_FROM_DOMAIN`) is verified (SPF + DKIM).
- [ ] **RESEND_TEST_MODE:** Set to `false` when expecting real recipient delivery.
- [ ] **API key:** Use the same Resend project/API key across local and hosted environments where possible.
- [ ] **Edge function logs:** Check Supabase logs for `create-worker` and `resend-activation-link`; look for Resend errors and validation failures.
- [ ] **Resend logs:** Check Resend Dashboard → Emails for recent sends and any error states.

---

## Changes Made (2026-02-16)

1. ✅ Configured Supabase Auth SMTP to use Resend in `config.toml` (local development)
2. ✅ Added `WORKER_INVITATION_BASE_URL` to `dashboard/.env.development`
3. ✅ `create-worker` now logs and returns email sending status
4. ✅ Workers service logs warnings when email fails

## Manual Steps Required

1. **Hosted Supabase:** Configure SMTP in Authentication → Email → SMTP Settings
2. **Hosted Supabase:** Ensure Edge Function secrets are set (`RESEND_API_KEY`, `RESEND_FROM_DOMAIN`, `WORKER_INVITATION_BASE_URL`)
3. **Resend:** Verify domain `feedback.flowerhead.dev` has SPF + DKIM configured
