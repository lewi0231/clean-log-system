# S1 — Triage: Per-organization sending domain for Resend (invitations, invoices, client rating links)

| Field           | Value                                                  |
| --------------- | ------------------------------------------------------ |
| **Stage**       | S1 — Triage (feasibility, risk, phased scope)          |
| **From S0**     | 2026-04-12                                             |
| **Triaged**     | 2026-04-12                                             |
| **Gold review** | 2026-04-12 — findings integrated below (§3.7, §4, §11) |
| **Product**     | Tally Runner (organization / worker job logging)       |

---

## 1. S0 Recap

Organizations want **worker invitations, invoices, rating/feedback-to-client email**, and similar **Resend-powered** transactional mail to send from an **org-verified subdomain** (e.g. `mail.customer.com`) instead of a **single global** `RESEND_FROM_DOMAIN`. When verification is incomplete, mail should **fall back** to the **platform default** domain. The feature may be a **paid add-on**; implementation should stay **loosely coupled** to Resend via clear boundaries. **Supabase Auth** email branding is desired **if not overly difficult**.

---

## 2. Open Questions — S1 Resolution

### 2.1 Mail scope (Edge Functions vs Supabase Auth)

| Surface                                                                                                  | Per-org From domain in v1?            | Rationale                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Edge Functions + Resend HTTP API** (`email.ts`, feedback-email, invitations, invoices, payments, etc.) | **Yes** (primary build)               | Full control over `from`; org context already available in call chain; Resend supports many verified domains per API key (plan-limited).                                                                                                                                      |
| **Supabase Auth** (verify email, reset password, magic link)                                             | **No — template-level branding only** | Auth uses **one SMTP config per Supabase project**. Native GoTrue does **not** support a different SMTP `from` per end-user organization. Achieving true per-org Auth From would imply **custom SMTP per org** (BYO or proxy), **high complexity**, and ongoing support cost. |

**Recommendation:**

- **v1:** Implement **org sending domain** for **all Edge-sent transactional mail** listed in S0.
- **v1 Auth:** Keep Auth on the **platform** Resend/SMTP identity; **improve templates** (subject/body) to include **organization name** and consistent voice so Auth mail feels branded without a custom From domain. Optionally set **Reply-To** to an org contact only if product adds a **single** verified support address later (not required for v1).
- **Future (Phase 2+):** Revisit only if product invests in **Auth hooks**, **custom SMTP routing**, or **Enterprise** requirements — out of scope for initial delivery.

This matches “factor in Auth if not overly difficult” by **shipping real value** on Edge mail while **avoiding** a multi-month Auth architecture detour.

### 2.2 Fallback when org domain missing or unverified

**Decision:** **Send using platform default domain** (`RESEND_FROM_DOMAIN` or equivalent env), **never block** invitations, invoices, or rating emails solely due to DNS.

**UX:**

- Dashboard shows **banner or Settings callout** when custom domain is **disabled**, **pending**, or **failed**: “Complete DNS setup to send from your domain.”
- **From** line continues to use **organization name in display name** where already supported (e.g. `Acme Co <noreply@platform.domain>`) so fallback mail remains recognizable.

**Edge case:** If an org **had** a verified domain and **Revoke** or **Resend** marks it invalid, treat as **fallback** + **admin notification** in-app (optional v1.1).

### 2.3 Resend coupling, plans, and paid add-on

**Resend transactional domain limits (public pricing — reconfirm before contracts):**

| Plan       | Domains (per team) |
| ---------- | ------------------ |
| Free       | 1                  |
| Pro        | 10                 |
| Scale      | 1,000              |
| Enterprise | Flexible           |

Source: [Resend Pricing](https://resend.com/pricing).

**Implications:**

- **Product:** Treat **custom sending domain** as a **paid (or higher-tier) entitlement** so domain count and email volume stay aligned with **Resend** costs.
- **Engineering:** Implement **provider-shaped** modules:
  - **`resolveOrgMailFrom(organizationId, mailKind)`** → effective `from` string + metadata.
  - **`ResendDomainsClient`** (create domain, get domain, list records) — wraps Resend REST only.
  - **`sendTransactionalEmail`** — already centralized in `email.ts`; refactor to consume resolved `from` from above.

Swapping Resend for another HTTP provider later means replacing the **adapter** and **domain verification** steps, not every call site.

**Operations:** Platform must monitor **team-wide** bounce/spam limits (Resend documents account-level enforcement). Document in runbooks.

### 2.4 Local-part strategy (`invoices@` vs configurable)

**Decision for v1:**

- **Fixed local-parts** per mail category, same as today’s mental model: e.g. `onboarding@`, `invoices@`, `noreply@`, `payments@` — but on **verified org subdomain** when active.
- **Display name** remains **`{OrganizationName} <local-part@domain>`** for trust.
- **Configurable Reply-To** — **not** in v1 unless quick win; **S2** optional.

### 2.5 Staging vs production

**Decision:** **Same product flow** everywhere. Orgs may register **test subdomains** (e.g. `mail-staging.acme.com`) in non-prod; no separate app behavior.

---

## 3. Technical Feasibility

### 3.1 High-level flow

```
┌────────────────────┐     ┌─────────────────────────┐     ┌──────────────────┐
│ Admin: add domain  │────▶│ Edge: Resend POST       │────▶│ Resend: domain   │
│ (e.g. mail.acme)   │     │ /domains + store id     │     │ pending → verified│
└────────────────────┘     └─────────────────────────┘     └────────┬─────────┘
                                                                      │
┌────────────────────┐     ┌─────────────────────────┐              │
│ Admin: DNS at host │────▶│ Edge or UI: refresh     │◀─────────────┘
│ (TXT/CNAME/MX)     │     │ verification status     │
└────────────────────┘     └─────────────────────────┘

┌────────────────────┐     ┌─────────────────────────┐
│ Job: send email    │────▶│ resolveOrgMailFrom()    │
│ (invitation, etc.) │     │ → org domain or fallback│
└────────────────────┘     └─────────────────────────┘
```

### 3.2 Data model (draft)

Prefer a **dedicated table** (cleaner than stuffing JSON into `organization_settings` alone — audit + Resend IDs):

```sql
-- Draft — S2/HLP finalize columns and RLS
CREATE TABLE organization_sending_domain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  -- Resend domain id from API (string UUID in Resend responses)
  resend_domain_id TEXT,
  domain_name TEXT NOT NULL, -- e.g. mail.acme.com
  -- Store Resend API status verbatim (e.g. not_started, pending, verified, failed, temporary_failure)
  resend_status TEXT NOT NULL DEFAULT 'not_started',
  -- Normalized UX-facing status for dashboard (updated on refresh)
  display_status TEXT NOT NULL DEFAULT 'pending_setup'
    CHECK (display_status IN ('pending_setup', 'pending_dns', 'verified', 'error', 'disabled')),
  dns_records_snapshot JSONB, -- last known records for UI display (optional cache)
  sending_region TEXT, -- e.g. us-east-1 — must match Resend domain create; see §3.7
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id) -- v1: one custom domain per org
);

CREATE INDEX idx_org_sending_domain_org ON organization_sending_domain(organization_id);
CREATE UNIQUE INDEX idx_org_sending_domain_name ON organization_sending_domain(domain_name);
```

**Notes:**

- **One row per org** for v1; multi-domain per org is **out of scope**.
- **Secrets:** No API keys in this table — only **Resend domain id** and **public** DNS data.
- **Status fields:** Resend’s API uses values such as **`not_started`**, **`pending`**, **`verified`**, **`failed`**, **`temporary_failure`** — store **`resend_status`** (raw) plus a stable **`display_status`** for UI (gold review).
- **Uniqueness on `domain_name`:** Prevents duplicate DB rows for the same hostname; align with Resend “domain already exists” behavior on create.

### 3.3 Edge Functions (draft names)

| Function                                | Responsibility                                                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`register-org-sending-domain`**       | Authenticated org admin; validates entitlement; **idempotent** `POST` Resend create domain (see §3.7); upserts row; returns DNS records for UI.                                             |
| **`refresh-org-sending-domain-status`** | Poll Resend domain by id; updates **`resend_status`**, **`display_status`**, snapshot. Callable from dashboard “Check DNS” and optionally **pg_cron** for non-verified rows (rate-limited). |
| **`remove-org-sending-domain`**         | `DELETE /domains/:id` in Resend when supported; clears row; reverts to fallback.                                                                                                            |

All use **`RESEND_API_KEY`** server-side only (existing pattern).

### 3.4 Sending path changes

- **`database/supabase/functions/_utils/email.ts`** (and **`feedback-email.ts`**): Before building `from`, resolve **effective domain** using **`organization_id`**:
  - If `organization_sending_domain.resend_status === 'verified'` (or equivalent) **and** `enabled` → `localPart@domain_name`.
  - Else → `localPart@${Deno.env.get("RESEND_FROM_DOMAIN")}` (current behavior).
- **Centralize** in one helper, e.g. **`resolveOrgMailFrom({ organizationId, mailKind, organizationName, localPart })`**, returning the full **`From`** string (display name + address).
- **Feedback / rating email (critical):** Today **`sendFeedbackRequestEmail`** uses **`FeedbackEmailData`** without **`organization_id`** and builds `from: noreply@…` **without** org display name. **Must** add **`organization_id`** (or resolve from **`job_id`** before send) so **AC6** holds and branding matches other mail — see **§3.7**.
- **Display name policy:** Prefer **`{OrganizationName} <local@domain>`** for org-scoped product mail. **Exception (intentional):** **Org signup verification** (`Tally Runner <noreply@…>`) may remain **platform-branded** — confirm in S2 **from-address matrix**.

### 3.5 Dashboard

- **Settings → Email / Domain** (exact nav in S2): show status, DNS records (from snapshot + refresh), **Copy** buttons, **Verify** / **Check DNS**.
- Gate UI behind **entitlement** (feature flag or billing tier).

### 3.6 Security & RLS

- **Only org admins** (existing role checks) can register domains for **their** `organization_id`.
- **RLS:** Authenticated users read **their org’s** row; writes via **Edge Functions** using **service role** or **elevated** RPC — **do not** copy overly broad `GRANT` patterns; follow a **least-privilege** precedent (gold review).
- **Do not** expose `RESEND_API_KEY` to the client.

### 3.7 Gold review — implementation and operations (integrated)

| Finding                                    | Resolution in design                                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`organization_id` not on feedback path** | Plumb **`organization_id`** into feedback send (or load by **`job_id`**) before **`resolveOrgMailFrom`**.                                                                               |
| **Resend status enum**                     | Dual fields: **`resend_status`** (API verbatim) + **`display_status`** (UI).                                                                                                            |
| **Register idempotency**                   | Same org + same **`domain_name`**: upsert; if Resend returns “exists”, **GET** domain by id or list and attach **`resend_domain_id`**. Prevent double **POST** from double-clicks.      |
| **Region**                                 | Persist **`sending_region`** on create; **v1 default** = single platform default (e.g. `us-east-1`) unless product adds **org region** selector in S2+.                                 |
| **429 / rate limit (5 req/s team-wide)**   | Retry with backoff on **`429`** in send helpers; document **batch** for bursts; optional **queue** = backlog.                                                                           |
| **Resend outage / API failure**            | **Fail open:** use **platform domain** fallback for `from` resolution when **read** of org domain state fails (log error); do not block sends if policy is “never block transactional.” |
| **DMARC**                                  | Optional **admin doc** recommending DMARC after SPF/DKIM; not a code gate for v1.                                                                                                       |
| **`from` inventory**                       | Full matrix in **S2** — includes **`Tally Runner`** vs **`OrganizationName`** decisions per mail kind.                                                                                  |

---

## 4. Risk Assessment

| Risk                                                   | Likelihood        | Impact | Mitigation                                                                                                                |
| ------------------------------------------------------ | ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Resend domain quota** exceeded vs plan               | Medium            | High   | Paid gating + monitor domain count; upgrade to Scale/Enterprise as customer base grows                                    |
| **DNS misconfiguration**                               | High (user error) | Low    | Clear UI, copy-paste records, **Check DNS** button, link to docs                                                          |
| **Reputation** — one bad org hurts team                | Low–Medium        | High   | Monitor bounces/spam; terms of use; optional suspend custom domain for abuse                                              |
| **Auth confusion** (“why isn’t reset from my domain?”) | Medium            | Low    | In-product copy: “Custom domain applies to job and invoice email; account emails use Tally Runner until a future update.” |
| **HTTP 429** (team rate limit)                         | Medium            | Medium | Backoff/retry; batch API where applicable; monitor spikes                                                                 |
| **Resend API unavailable**                             | Low               | Medium | Fallback **`from`** to platform domain; log; optional alert                                                               |
| **Migration / enum mismatch** with Resend              | Medium            | Low    | Raw **`resend_status`** + mapped **`display_status`** (§3.2)                                                              |

---

## 5. Scope Definition

### 5.1 In scope (v1)

| Area                 | Deliverable                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Database**         | `organization_sending_domain` (or equivalent) + RLS / policies                                                                     |
| **Edge**             | Register + refresh domain; integrate `resolveOrgMailFrom` into mail senders                                                        |
| **Mail types**       | Worker invitations, invoices, payments, feedback/rating-to-client, onboarding-related sends that use `email.ts` / feedback helpers |
| **Dashboard**        | Settings UI for domain setup, DNS display, verification status                                                                     |
| **Fallback**         | Platform domain when not verified                                                                                                  |
| **Entitlement hook** | Feature flag or tier check on register endpoint + UI                                                                               |
| **Docs**             | Admin guide: DNS, propagation, troubleshooting                                                                                     |

### 5.2 Out of scope (v1)

| Item                                  | Notes                                     |
| ------------------------------------- | ----------------------------------------- |
| Per-org **Supabase Auth** From domain | See §2.1 — template branding only         |
| Multiple domains per org              | Single subdomain per org                  |
| **BYO SMTP** (non-Resend)             | Future adapter                            |
| **Inbound** mail (receiving)          | Resend receiving not required for sending |
| Custom **Reply-To** per org           | S2 candidate                              |

### 5.3 Future phases (backlog)

- Auth From domain (only if architecture for SMTP routing is justified)
- Multiple local-part / brand aliases
- Automated periodic re-verification health checks
- Webhook from Resend for bounce events tied to org analytics

---

## 6. Effort Estimate (indicative)

| Component                                                                                      | Estimate       | Notes                                      |
| ---------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------ |
| Migration + RLS                                                                                | 0.5–1 day      | Align with existing org admin patterns     |
| Resend domain API wrapper + org resolution helper                                              | 1 day          | Tested with mocks                          |
| Edge: register + refresh                                                                       | 1 day          | Auth + entitlement                         |
| Refactor `email.ts` / feedback paths to use resolver + **plumb `organization_id` in feedback** | 1.5–2.5 days   | Inventory in S2 §4                         |
| Dashboard Settings UI                                                                          | 1–2 days       | DNS table, states, empty/error             |
| Entitlement wiring (named source of truth)                                                     | 0.5–1 day      | If not existing                            |
| QA + docs                                                                                      | 1 day          |                                            |
| **Total**                                                                                      | **~6–10 days** | Resolver + feedback plumbing + entitlement |

---

## 7. Acceptance Criteria (draft for S2 / build)

1. Org admin with entitlement can **submit** a subdomain; system returns **exact DNS records** from Resend.
2. After verification, **Edge-sent** mail for that org uses **`from`** addresses on the **verified** domain (fixed local-parts).
3. If not verified, mail sends from **platform** domain; **no** silent failure of core flows.
4. Non-admin users **cannot** register domains for orgs they do not administer.
5. Removing or disabling custom domain **reverts** to platform `from` without code deploy.
6. **Rating/feedback** client emails use the **same** resolution rules as invoices/invitations.

---

## 8. Dependencies

| Dependency                                       | Status                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| Resend API key with permission to manage domains | Platform-controlled secret                                       |
| Resend plan supports **N** customer domains      | **Scale** or appropriate tier before wide rollout                |
| **`organization_id` on all send paths**          | **Required** for feedback/rating — **implement** per §3.4 / §3.7 |
| **Entitlement source of truth**                  | Named in S2 (feature flag, billing, or column)                   |

---

## 9. Decision Log

| Date       | Decision                                                                      | Rationale                                                      |
| ---------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 2026-04-12 | **Edge mail only** for per-org From; **Auth** stays platform From + templates | GoTrue single SMTP; per-org Auth From is disproportionate cost |
| 2026-04-12 | **Fallback = platform domain**, never block sends                             | Stakeholder preference + transactional reliability             |
| 2026-04-12 | **Dedicated table** for domain state                                          | Auditability and clear lifecycle vs blob in settings           |
| 2026-04-12 | **Fixed local-parts** on org domain                                           | Predictable deliverability; simpler than configurable Reply-To |
| 2026-04-12 | **Paid / tier entitlement** for feature                                       | Aligns with Resend per-domain economics                        |
| 2026-04-12 | **Adapter-shaped** Resend domain + send resolution                            | Loose coupling for future providers                            |
| 2026-04-12 | **Dual status fields** (`resend_status` + `display_status`)                   | Align with Resend API evolution                                |
| 2026-04-12 | **Idempotent** domain registration                                            | Prevent duplicate Resend domains / double-submit               |
| 2026-04-12 | **429 / outage** handling                                                     | Documented in §3.7 and §4                                      |

---

## 10. Next Steps (handed to S2)

See **`docs/stages/S2-org-resend-email-domain.md`** for features & functions, **from-address matrix**, APIs, and DAP prep.

---

## 11. Gold review summary (2026-04-12)

Independent review integrated: **feedback path needs `organization_id`**; **Resend-aligned statuses**; **idempotency** on register; **region** persistence; **429/outage** mitigations; **RLS least-privilege**; **full `from` inventory** deferred to S2 §4; **DMARC** as optional admin guidance. Effort range revised to **~6–10 days** to reflect entitlement and feedback plumbing.

---

_End of S1 — superseded for detail by S2 (Features & Functions / HLP)._
