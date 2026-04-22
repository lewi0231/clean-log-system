# S0 — Idea Intake: Per-organization sending domain for Resend (invitations, invoices, client rating links & transactional email)

| Field        | Value                                                   |
| ------------ | ------------------------------------------------------- |
| **Stage**    | S0 — Idea capture (not triage; no build commitment)     |
| **Captured** | 2026-04-12                                              |
| **Updated**  | 2026-04-12 (scope + stakeholder resolutions + research) |
| **Product**  | Tally Runner (organization / worker job logging)        |
| **Source**   | Product owner — conversational requirement              |

---

## 1. Idea (submitter language)

**Organizations (and their admins)** should be able to **configure a domain** used for **sending email via the Resend API**, so that messages appear to come from **their own brand**: typically a **subdomain** of a domain they control (for example `mail.theircompany.com` or `notifications.theircompany.com`), rather than a **single global “from” domain** shared by all tenants.

**In scope for sender identity (examples):**

- **Worker invitations** (and similar onboarding mail)
- **Invoices** and related billing/notification email
- **Rating / feedback links** sent to **clients or customers** (e.g. post-job review requests — today implemented via feedback/rating flows and Resend-backed mail in Edge Functions)

The configuration should be **org-scoped**: each organization sets up **its** domain; recipients see **that org’s** sender identity in the inbox.

---

## 2. Problem / opportunity (why this matters)

- **Trust and recognition:** Workers **and end customers** are more likely to open mail that clearly comes from **the business’s domain** — especially for **rating links**, where phishing skepticism is high.
- **Deliverability:** Email providers judge **domain reputation**. Isolating sending on a **customer-controlled subdomain** (with correct SPF/DKIM) aligns with **industry guidance** and avoids one bad actor on a shared pool harming everyone.
- **Branding:** Consistent sender domain across invitations, invoices, and **client-facing review requests** reinforces the org’s identity.
- **Gap today:** The codebase uses environment-level configuration such as **`RESEND_FROM_DOMAIN`** for all orgs (see `database/supabase/functions/_utils/email.ts`, feedback email utilities, related docs). That does **not** express per-tenant sender identity.

---

## 3. Success (what “good” looks like — draft)

- An **org admin** can start **domain setup**, receive **clear DNS instructions** (records Resend requires), complete verification, and have **outbound mail** for that org use **`from` addresses on the verified subdomain** for the **agreed mail classes** (invitations, invoices, rating/feedback-to-client mail, etc.).
- **Unverified** orgs still get reliable delivery: **fallback** to the **platform default** domain (see §5.3 and §6) with clear product behavior — **not** undefined failure modes.
- **Secrets** and API usage follow **GUARD** patterns: not exposed in the client; stored safely server-side.
- **Commercially:** The capability may be offered as a **paid add-on** (see §4.7); implementation stays **loosely coupled** to any single provider where practical (see §4.8).

_(Exact KPIs, acceptance tests, and Settings placement belong in S1/S2.)_

---

## 4. Research summary (implementation landscape — not a decision yet)

### 4.1 Resend: custom domains and subdomains

- **Sending from a custom domain** requires **domain verification** in Resend by publishing **DNS records** (typically **SPF** and **DKIM**; **DMARC** recommended once the basics work).
- Resend recommends a **subdomain** for sending to **isolate sending reputation** from the org’s main site.
- **Official references:**
  - [Managing Domains — Resend](https://resend.com/docs/dashboard/domains/introduction)
  - [Create Domain (API)](https://resend.com/docs/api-reference/domains/create-domain)
  - [Account quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits) (volume, rate limits)

### 4.2 Programmatic domain creation and verification

- **`POST https://api.resend.com/domains`** creates a domain under the **Resend team** tied to the **API key**.
- Response includes **`records`** the customer must add at their DNS host; status moves toward **`verified`** after propagation (often minutes; up to **24–48 hours** in edge cases).
- **Multi-tenant SaaS:** One **platform API key** can manage **many** domains **subject to plan domain limits** (§4.7).

### 4.3 Return path and advanced options

- Optional **`custom_return_path`**, **region**, **capabilities** (sending vs receiving) — see Resend domain API. **Receiving** is separate from transactional **sending**; v1 likely **sending only**.

### 4.4 Relationship to current Tally Runner implementation

- **`RESEND_FROM_DOMAIN`** drives `from` addresses across `email.ts` (invitations, invoices, payments, feedback, etc.).
- **Feedback / rating links to clients:** Implemented via feedback email utilities and related Edge Functions (e.g. `database/supabase/functions/_utils/feedback-email.ts`); these should **use the same org sending domain** once verified, so **client-facing** review mail matches **worker-facing** mail branding.
- **Supabase Auth** (verify email, password reset, magic links) typically uses **one SMTP configuration per Supabase project** (see `docs/research/email-resend-implementation-review.md`). **Per-org From domain for Auth** is **not** a single toggle: it requires either **staying on the platform domain** for Auth, or **advanced** patterns (e.g. custom SMTP per org — high complexity). **Stakeholder preference:** include Auth **if not overly difficult** — **S1** must score options (§6.2).

### 4.5 Security and abuse prevention

- **Proof of domain control** via DNS verification.
- **Product controls:** roles allowed to start verification, **one primary sending domain per org** (typical), audit logs, optional **entitlement** gating for paid tiers.

### 4.6 Fallback when verification is incomplete — best practice (draft)

| Approach                                 | Pros                                          | Cons                                                    |
| ---------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| **A. Send from platform default domain** | No blocked transactional mail; predictable UX | Inbox shows platform domain until verified              |
| **B. Block sends until verified**        | Strongest brand guarantee                     | Poor UX; invitations/invoices/rating requests may stall |
| **C. Queue until verified**              | Brand-safe                                    | Delays time-sensitive mail; operational complexity      |

**Recommendation (aligns with stakeholder input):** **A** — **send from the platform default** when the org has not completed (or has lost) verification, and surface **in-dashboard prompts** to finish DNS. Optionally strengthen **display name** / **subject** with **organization name** so even default-domain mail is recognizable (**common SaaS pattern**).

### 4.7 Resend plans, domain limits, and “add-on” fit

Official **feature highlights** (transactional plans) include domain counts:

| Plan           | Domains (per Resend team) |
| -------------- | ------------------------- |
| **Free**       | 1                         |
| **Pro**        | 10                        |
| **Scale**      | 1,000                     |
| **Enterprise** | Flexible                  |

Source: [Resend Pricing](https://resend.com/pricing) — _confirm on live pricing page before commercial commitments._

**Implications:**

- A **multi-tenant product** with **one Resend team** and **one verified domain per customer org** quickly exceeds **Free** (1 domain) and **Pro** (10 domains) if many orgs adopt the feature.
- **Scale** (or **Enterprise**) aligns with **many customer domains** on a single platform key.
- **Product “add-on”** (paid customers unlock custom domain) aligns with **cost recovery**: more domains + volume may require **Resend plan upgrades**; **S1** should map **expected org count** × **domains** to **Resend tier** and **unit economics**.

**Rate limits (all plans):** Resend documents **5 requests per second** per **team** (shared across API keys); batch API can mitigate. See [account quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

### 4.8 Loose coupling to Resend (recommended direction)

To avoid vendor lock-in and keep testing simple:

| Pattern                 | Purpose                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Port / adapter**      | Internal interface, e.g. `EmailSendProvider` / `OrgMailContext`: “send transactional mail with org-scoped from + body.”                                 |
| **Resend adapter**      | One implementation calling `https://api.resend.com/emails` (and domain APIs for setup).                                                                 |
| **Future adapters**     | SMTP, SendGrid, Postmark, etc., could implement the same port if requirements change.                                                                   |
| **Domain verification** | Separate small port, e.g. `CustomDomainProvisioner`, if non-Resend providers are ever supported; v1 can implement **only Resend** behind that boundary. |

**Note:** “Loosely coupled” does **not** require multiple vendors on day one — it means **boundaries** so swapping or augmenting the provider is feasible.

### 4.9 Alternatives (if Resend-specific constraints emerge)

- **Bring-your-own SMTP** — org supplies credentials; different support burden.
- **Platform subdomain per org** (no customer DNS) — weaker branding; possible **free tier** path.

---

## 5. Stakeholder preferences (captured)

### 5.1 Product direction

| Topic                      | Preference                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sender identity**        | Org’s **subdomain** for API-sent mail.                                                                                                                                                                                                                                                |
| **Mail classes**           | **Invitations, invoices, rating / feedback links to clients**, and similar transactional mail — **not** only worker invitations.                                                                                                                                                      |
| **Scope (open Q1)**        | **Limit** branded sending to those product surfaces **and** **factor in Supabase Auth** if implementation is **not overly difficult**.                                                                                                                                                |
| **Fallback (open Q2)**     | If verification incomplete: **send from platform default** (see §4.6); **research** refinements in S1.                                                                                                                                                                                |
| **Commercial (open Q3)**   | **Loosely coupled** where possible; likely **paid add-on**; align with **Resend** plan/domain reality (§4.7).                                                                                                                                                                         |
| **Local-parts (open Q4)**  | TBD in S1 (fixed labels vs display-name-only).                                                                                                                                                                                                                                        |
| **Environments (open Q5)** | **Clarification:** Question 5 asked whether **staging** should use **different** Resend domains vs **production**. **Stakeholder:** same approach is fine for **staging vs production testing** (i.e. no special multi-environment rule beyond normal DNS/test subdomains if needed). |

### 5.2 Open questions — status

| #   | Topic                     | Resolution / next step                                                                                                                                                                                                                 |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scope incl. Auth          | **Captured:** invitations, invoices, rating links, etc., **plus Auth if feasible**. **S1:** options analysis — Auth likely stays on **platform SMTP** with **branded templates**, or **deferred** if per-org Auth From is prohibitive. |
| 2   | Fallback                  | **Captured:** default/platform domain + **S1** validates copy and whether to emphasize **org display name**.                                                                                                                           |
| 3   | Resend coupling & pricing | **Captured:** adapter pattern (§4.8); **paid add-on** sensible; **S1** maps org count → **Resend domain limits** (Pro 10 vs Scale 1000).                                                                                               |
| 4   | Local-part strategy       | **Open for S1** (fixed `invoices@`, `noreply@` vs configurable **reply-to**).                                                                                                                                                          |
| 5   | Staging vs production     | **Resolved:** same verification flow acceptable; use **test subdomains** as needed (e.g. `mail-staging.customer.com`) without a separate product rule.                                                                                 |

---

## 6. Additional recommendations (from research — for S1)

1. **Entitlements:** Gate **custom domain UI + API** behind **subscription tier** (or feature flag) so **domain count** stays within **budgeted** Resend plan.
2. **Operational alerts:** Monitor **bounce/spam** thresholds (Resend enforces **bounce &lt; 4%**, **spam &lt; 0.08%** per docs); bad customer lists could affect **whole team** reputation.
3. **Idempotency / retries:** Domain verification polling should be **rate-limited**; sending path should **not** double-send on retries (existing mail patterns apply).
4. **Customer comms:** Document that **rating-link emails** may contain **sensitive context** (job, site) — consistent with org’s **privacy** stance.
5. **Supabase Auth detail:** Project-level **SMTP** means **one** set of credentials; **true** per-org From on Auth may require **GoTrue limitations** review or **keeping Auth on platform domain** with strong **template** branding — **S1 decision**.

---

## 7. Out of scope for S0 (explicit)

- Final Settings UI and copy.
- Exact schema and Edge Function contracts.
- Commercial quotes beyond **public** Resend pricing references.
- **Inbound** email (receiving) unless product expands later.

---

## 8. Post–gate check (S0 quality)

> If someone reads this idea in 6 months with no other context, will they understand what was meant?

**Reader should take away:** Tally Runner should let **each org** verify a **subdomain** so **Resend-sent** mail — **worker invitations, invoices, client rating/feedback links**, and related transactional email — can use **that org’s domain**, with **platform default fallback** when not verified, **optional paid gating**, **provider-shaped boundaries** for maintainability, and **S1** handling **Auth** branding feasibility and **Resend plan** fit for **many domains**.

---

## 9. References (external)

- Resend — [Pricing](https://resend.com/pricing) (domain counts per plan)
- Resend — [Account quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- Resend — [Managing Domains](https://resend.com/docs/dashboard/domains/introduction)
- Resend — [Create Domain API](https://resend.com/docs/api-reference/domains/create-domain)

### Internal (codebase context)

- `database/supabase/functions/_utils/email.ts` — Resend send helpers, `RESEND_FROM_DOMAIN`
- `database/supabase/functions/_utils/feedback-email.ts` — feedback / rating link email path
- `docs/research/email-resend-implementation-review.md` — Resend + Supabase Auth SMTP

---

_End of S0 — ready for S1 triage (feasibility, product fit, risk, and phased scope)._
