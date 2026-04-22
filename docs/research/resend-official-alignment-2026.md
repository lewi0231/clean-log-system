# Resend — official multi-tenant alignment (research note)

**Date:** 2026-04-22  
**Canonical spec:** `docs/stages/S2-org-resend-email-domain.md` **§14**

This file exists so search and “research” discoverability point at the same decisions without duplicating the full matrix.

## Summary

Cross-reviewed Clean Log’s per-organization sending domain plan (S0–S2) against Resend’s published guidance:

- **[Setting up Resend for Multi-Tenant Applications](https://resend.com/docs/knowledge-base/setting-up-resend-for-multi-tenants)** — Option A (single team, many domains) matches our direction; Option B (BYOK / separate accounts) is deferred.
- **Webhooks** — `domain.verified` can reduce polling; `email.bounced` / `email.complained` + **tags** (`organization_id`, etc.) support tenant-scoped operations with one Resend team.
- **Domain-scoped API keys** — Resend’s pattern for per-tenant isolation when keys are distributed; our v1 is **server-only** shared key + `resolveOrgMailFrom` — acceptable; per-org keys = optional later hardening.
- **Shared reputation** — document operational response (ToS, monitoring, possible suspension of custom domain).

## Links

| Topic                | URL                                                                        |
| -------------------- | -------------------------------------------------------------------------- |
| Multi-tenant KB      | https://resend.com/docs/knowledge-base/setting-up-resend-for-multi-tenants |
| Webhooks             | https://resend.com/docs/dashboard/webhooks/introduction                    |
| Domains (dashboard)  | https://resend.com/docs/dashboard/domains/introduction                     |
| Create domain (API)  | https://resend.com/docs/api-reference/domains/create-domain                |
| Pricing              | https://resend.com/pricing                                                 |
| Warming up (sending) | https://resend.com/knowledge-base/warming-up                               |

## When this doc was updated

Align with **§14** in S2; if they diverge, **S2 wins**.
