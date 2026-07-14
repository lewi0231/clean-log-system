# S0 — Idea Intake: Dashboard email-domain onboarding & entitlement clarity

| Field        | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| **Stage**    | S0 — Idea capture (not triage; no build commitment)                |
| **Captured** | 2026-05-06                                                         |
| **Updated**  | 2026-05-06 (admin lifecycle verification + S2 spin-out)            |
| **Product**  | Tally Runner (dashboard — org settings, onboarding, outbound mail) |
| **Source**   | Product owner — setup journey + dev testing + "plan" messaging     |

---

## 1. Idea (submitter language)

When an **administrator** first enters the **dashboard** (as part of **setup / getting started**), they should be **prompted** to **configure outgoing email** using **their own domain** (typically a **subdomain** they control), so that **invoices, invitations, and system mail** can send **From** addresses on **their brand** rather than only the platform default.

Separately, the product should **not imply subscription tiers** that do **not** exist yet: today the UI says custom sending domain is **not enabled** until **"your plan includes it"** (`dashboard/components/settings/org-sending-domain-card.tsx:153`), while **no billing → entitlement mapping** is implemented—only a **database flag** on the organization.

In **development**, owners want to **exercise** the full **domain registration / DNS / verification** flow **without** a fake "plan," using a **clear, documented path** to enable entitlement for test organizations.

---

## 2. Problem / opportunity (why this matters)

| Problem                    | Impact                                                                                          | Evidence                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Trust & deliverability** | Recipients more likely to open mail from a recognized brand domain; reduces spam filtering risk | Industry consensus; see **§6.1**                                                                                                      |
| **Discoverability gap**    | Admin may complete "getting started" without ever seeing email domain setup                     | **`OnboardingChecklist`** has 6 steps (workers, locations, mobile forms, pricing, invoice config, Stripe) — **none** for email domain |
| **Misleading "plan" copy** | Creates expectation debt ("what tiers?") and internal confusion                                 | **`OrgSendingDomainCard`** references "plan" at line 153; no tier engine exists                                                       |
| **Dev/staging friction**   | Engineers must manually SQL-flip entitlement without documentation                              | No seed or README snippet covers `custom_email_domain_enabled`                                                                        |

---

## 3. Success (what "good" looks like — draft)

| Outcome               | Measurement                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Surfacing**         | Within first admin sessions, a **clear, skippable** checklist step (when entitled) links to **Settings → Email & domain**                        |
| **Admin operations**  | **Already satisfied** when entitled: register/sync, Check DNS, remove, view snapshot — see **§4.6**; this track **must not** regress those flows |
| **Completion signal** | Checklist marks step complete when `organization_sending_domain.display_status = 'verified'` **or** explicit dismiss                             |
| **Honest copy**       | No reference to "plan" until billing tiers are wired; neutral language ("feature not enabled — contact support")                                 |
| **Dev ergonomics**    | One-line SQL snippet in **README** / seed script sets `custom_email_domain_enabled = true` for local orgs                                        |

_(Routing priority vs other steps, analytics events, and A/B copy belong in S1/S2.)_

---

## 4. Current product & codebase snapshot (verified)

### 4.1 Entitlement model

| Layer             | Location                                                                      | Behavior                                                                     |
| ----------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **DB column**     | `organization.custom_email_domain_enabled` (`BOOLEAN NOT NULL DEFAULT false`) | Migration `20260422130000_add_organization_sending_domain.sql`               |
| **Edge read**     | `get-organization-settings`                                                   | Returns flag in `OrganizationSettings`; line 38 & 100                        |
| **UI gate**       | `OrgSendingDomainCard`                                                        | Prop `entitled` controls render path; line 52, 59, 142–158                   |
| **Edge enforce**  | `register-org-sending-domain`                                                 | Returns **403** when flag false; line 57–60                                  |
| **Mail fallback** | `_utils/org-mail-from.ts`                                                     | Uses platform `RESEND_FROM_DOMAIN` when org domain unavailable; line 101–112 |

**No automated mapping** from Stripe, landing-page pricing, or SKU to this flag.

### 4.2 Stripe integration (current)

- **`stripe-webhook`** handles **payment events only**: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`.
- **No subscription lifecycle events** (`customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`) are handled.
- **Implication:** Tying entitlement to Stripe subscriptions requires **new** webhook branches **and** metadata/product mapping—**non-trivial** work.

### 4.3 Onboarding checklist (current)

| File                                                       | Pattern                                                                                                  | Extensibility                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `dashboard/components/onboarding/onboarding-checklist.tsx` | `SetupStep[]` array; each step has `id`, `title`, `description`, `href`, `icon`, `required`, `completed` | **High** — adding a step is ~15 LOC; completion logic can query any hook/service |

**Current steps (6):** workers, locations, mobile forms, pricing, invoice config, Stripe — **no email domain step**.

### 4.4 Feature-flag pattern (existing)

- `NEXT_PUBLIC_CONDITIONAL_PRICING_ENABLED` and `NEXT_PUBLIC_PRICING_RULE` (env-based, dashboard) — used in `dashboard/lib/utils.ts`.
- `enableAddressAutocomplete` (runtime, mobile) — checked in `mobile-app/components/ui/address-autocomplete.tsx`.

**Pattern exists**; can be reused for showing/hiding Email step before entitlement logic ships.

### 4.5 Existing customer-facing copy (gap)

```tsx
// dashboard/components/settings/org-sending-domain-card.tsx:153
Custom sending domain is not enabled for this organization.
When your plan includes it, an administrator can add DNS records
and verify the domain here.
```

This copy implies **subscription tiers** that are **not wired**.

### 4.6 Admin domain lifecycle — **verified implemented** (this initiative does not rebuild)

For **organization administrators** (`userRole === "admin"` from `get-organization-id`), **when entitled** (`custom_email_domain_enabled === true`), the dashboard already exposes full **register → DNS → verify → update/remove** flows in **`OrgSendingDomainCard`** (`dashboard/components/settings/org-sending-domain-card.tsx`):

| Capability                      | UI                                                                                             | Edge / data                                                                                                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Register or sync domain**     | Domain input + **Register domain** / **Update / sync domain**                                  | **`register-org-sending-domain`** — idempotent (same name refreshes from Resend); **403** if not entitled                                                                            |
| **Poll verification after DNS** | **Check DNS**                                                                                  | **`refresh-org-sending-domain-status`** — GET Resend domain; updates `resend_status`, `display_status`, `dns_records_snapshot`                                                       |
| **Remove domain**               | **Remove domain** (confirm)                                                                    | **`remove-org-sending-domain`** — DELETE Resend domain + DB row; **allowed even if entitlement is false** (cleanup after downgrade — see `remove-org-sending-domain/index.ts:37–38`) |
| **View DNS records**            | Read-only snapshot (`DnsRecordsList`)                                                          | From `organization_sending_domain.dns_records_snapshot` (RLS: admin SELECT)                                                                                                          |
| **Status UX**                   | Labels for `pending_setup`, `pending_dns`, `verified`, `error`, `disabled` + raw Resend status | Matches **`display_status`** / **`resend_status`**                                                                                                                                   |

**Non-admin users** see an explanatory card only (no mutations).

**Gap relative to this S0 (product, not missing CRUD):** **Discoverability** (onboarding), **honest copy** when `!entitled`, **dev seed** for entitlement, and **future billing → flag** mapping. **Optional:** in-dashboard **banner** when entitled but not verified (already suggested in **`S2-org-resend-email-domain.md`** §5.5).

---

## 5. Open questions — with recommendations

| #     | Question                                                                                  | Recommendation                                                                                                                                                                                          | Rationale                                                                                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1** | **When** to prompt (first login vs after questionnaire vs after N visits)?                | **After onboarding questionnaire completes** — add as **optional** checklist step, positioned **after** invoice config and **before** Stripe (or last).                                                 | Aligns with existing checklist UX; avoids blocking core setup; DNS verification is async anyway. Industry pattern: Intercom, Mailchimp surface custom domain **after** basic config. |
| **2** | **Required vs optional** step — block sends vs informational only?                        | **Optional** (non-blocking). Mark complete when `display_status = 'verified'` **or** user explicitly skips.                                                                                             | Platform-domain fallback already exists (`org-mail-from.ts`); blocking sends would hurt activation. Progressive disclosure FTW.                                                      |
| **3** | **Entitled false:** hide Email tab section vs show **explain + CTA**?                     | **Show section** with neutral copy: _"Custom sending domain is a premium feature. Contact support to enable."_ + link to pricing/contact page. Keep UI discoverable; don't hide capability.             | Hiding creates "where did it go?" confusion; showing creates upgrade awareness. SaaS best practice: show locked features with clear unlock path.                                     |
| **4** | **Until billing exists:** manual ops toggle vs **all dev orgs true** vs feature-flag doc? | **Seed script + README snippet.** Dev orgs seeded with `custom_email_domain_enabled = true` by default; production orgs remain `false` until ops manually enables or billing ships.                     | Clear separation; no "magic" env flags; engineers can test full flow; prod is protected.                                                                                             |
| **5** | **Stripe later:** single source of truth for entitlement (webhook vs periodic sync)?      | **Webhook** (`customer.subscription.created`/`updated`/`deleted`) → update `custom_email_domain_enabled` in handler. Store **Stripe product/price metadata** mapping in `organization_settings` or env. | Webhooks are idempotent, near-real-time, and the Stripe-recommended pattern. Periodic sync adds latency and complexity.                                                              |

---

## 6. Industry context & best practice

### 6.1 Why custom sending domains matter

- **Deliverability:** Google, Microsoft, and Yahoo enforce **DMARC/DKIM** alignment; sending from a verified subdomain improves inbox placement.
- **Trust:** B2B recipients (the end customers receiving invoices) are more likely to open mail from `invoices@mail.acme.com` than `noreply@tallyrunner.com`.
- **Reputation isolation:** Per-org subdomain prevents one tenant's bad list from harming others.

### 6.2 SaaS onboarding patterns

| Pattern                         | Examples                           | Applicability                                                                 |
| ------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| **Progressive setup**           | Intercom, HubSpot, Mailchimp       | Show advanced config (email domain) **after** core setup (team, integrations) |
| **Locked feature preview**      | Notion, Figma                      | Show UI with "upgrade" badge; don't hide the feature                          |
| **Webhook-driven entitlements** | Stripe Billing docs, Clerk, WorkOS | Subscription events → DB flag → UI gate                                       |

### 6.3 Resend-specific constraints (unchanged from S0-org-resend-email-domain)

- **Domain limits per plan:** Free (1), Pro (10), Scale (1,000).
- **Verification:** DNS propagation typically minutes; up to 48h edge cases.
- **Fallback:** Platform domain when unverified is Resend-supported and recommended.

---

## 7. Phased implementation path (recommendation)

| Phase                   | Scope                                                                                                               | Gating                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **A (dev unblock)**     | Seed + README snippet for `custom_email_domain_enabled`; update copy to remove "plan" reference                     | None — immediate              |
| **B (onboarding step)** | Add optional "Verify outgoing email domain" step to `OnboardingChecklist` when entitled                             | `custom_email_domain_enabled` |
| **C (billing)**         | Handle `customer.subscription.created/updated/deleted` in `stripe-webhook`; map product metadata → entitlement flag | Stripe products configured    |

---

## 8. Out of scope for this S0 (explicit)

- Final DNS UX, Resend API error matrices, or **`organization_sending_domain`** schema changes (covered in **`S0-org-resend-email-domain.md`** → **`S2`**/**`S4`**).
- Implementing **subscription tiers** or full Stripe Billing integration (separate S0).
- Replacing **platform default** `From` behavior (`RESEND_FROM_DOMAIN`) — already handled by `org-mail-from.ts` fallback.
- Multi-provider support (SendGrid, Postmark, etc.) — deferred; loose coupling already exists via `resolveOrgMailFrom`.

---

## 9. Post–gate check (S0 quality)

> If someone reads this idea in 6 months with no other context, will they understand what was meant?

**Reader should take away:**

1. **Discoverability:** Email domain setup belongs in onboarding checklist (optional step, after invoice config).
2. **Honesty:** Remove "plan" copy until billing is wired; show locked state with upgrade CTA.
3. **Dev ergonomics:** Seed/README snippet for local entitlement; production stays false until ops/billing.
4. **Future billing:** Webhook-driven entitlement from Stripe subscriptions is the target architecture.
5. **Baseline:** Admin **register / sync, Check DNS, remove** is **already implemented** when entitled — this initiative adds **surfacing and honesty**, not replacement of that UI.

---

## 10. References

### Related intake (technical / provider landscape)

- **[`S0-org-resend-email-domain.md`](./S0-org-resend-email-domain.md)** — Per-org Resend domain, fallback, commercial assumptions.
- **[`S2-org-resend-email-domain.md`](./S2-org-resend-email-domain.md)** — Features & Functions (From-address matrix, Edge APIs, precedence rules).
- **[`S4-org-resend-email-domain.md`](./S4-org-resend-email-domain.md)** — DAP (entitlement lapse, downgrade handling).

### Implementation pointers (starting points for build — see **`S2-dashboard-email-domain-onboarding.md`**)

| Area                        | File                                                                           | Notes                                                                |
| --------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| UI copy                     | `dashboard/components/settings/org-sending-domain-card.tsx`                    | Replace "plan" copy when `!entitled`; optional upgrade/support links |
| Onboarding                  | `dashboard/components/onboarding/onboarding-checklist.tsx`                     | Optional email-domain step when entitled                             |
| Settings wiring             | `dashboard/app/dashboard/settings/page.tsx`                                    | Email tab already hosts **`OrgSendingDomainCard`**                   |
| Entitlement (register only) | `database/supabase/functions/register-org-sending-domain/index.ts`             | 403 when false                                                       |
| Stripe webhook              | `database/supabase/functions/stripe-webhook/handlers/dispatch-stripe-event.ts` | Subscription events → `custom_email_domain_enabled` (phase C)        |
| Seed/README                 | `database/supabase/seed.sql` or root `README.md`                               | Dev entitlement snippet                                              |

### Stage linkage

- **Parent technical scope (already locked):** **[`S2-org-resend-email-domain.md`](./S2-org-resend-email-domain.md)** — Resend domain APIs, `resolveOrgMailFrom`, RLS, Edge inventory.
- **This track (onboarding + entitlement honesty + ops):** **[`S2-dashboard-email-domain-onboarding.md`](./S2-dashboard-email-domain-onboarding.md)**.

### External

- [Stripe Billing webhooks guide](https://stripe.com/docs/billing/subscriptions/webhooks)
- [Resend — Managing Domains](https://resend.com/docs/dashboard/domains/introduction)

---

_End of S0 — scope promoted to **[`S2-dashboard-email-domain-onboarding.md`](./S2-dashboard-email-domain-onboarding.md)** (Features & Functions for onboarding / copy / dev entitlement / billing hooks). **S1 triage** remains optional if governance requires a formal gate before build._
