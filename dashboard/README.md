# Admin Dashboard

## Operator guides

- [Worker payments CSV handoff (payroll / bank entry)](../docs/operator/worker-payments-handoff.md)

## Local development — custom email domain entitlement

To exercise **Settings → Email** custom sending domain (Resend) for a specific tenant:

1. Find your organization id in Supabase (**Table Editor → `organization`** or SQL).
2. Run **only** this scoped update (never omit the `WHERE` — an unscoped `UPDATE` would affect every tenant):

```sql
UPDATE public.organization
SET custom_email_domain_enabled = true
WHERE id = '<your-org-id>'::uuid;
```

3. Registering a domain still requires valid **Resend** API keys and Edge configuration (see repository docs for the per-org sending domain feature).

Optional: set `NEXT_PUBLIC_SUPPORT_EMAIL` in `.env.local` so the **Email & domain** card shows a mailto CTA for orgs without entitlement.

# Testing

Run edge
