# S2 — Features & Functions: Per-organization sending domain (Resend)

| Field                  | Value                                                           |
| ---------------------- | --------------------------------------------------------------- |
| **Stage**              | S2 — Features & Functions (scope lock before S3 HLP/DAP detail) |
| **From S1**            | `docs/stages/S1-org-resend-email-domain.md`                     |
| **Created**            | 2026-04-12                                                      |
| **Gold review**        | 2026-04-12 — §12                                                |
| **Adversarial review** | 2026-04-12 — §13                                                |
| **Product**            | Clean Log                                                       |

---

## 1. S1 recap (locked decisions)

- **Edge-sent mail only** for custom domain **`From`**; **Supabase Auth** stays platform SMTP + template branding.
- **Fallback:** platform **`RESEND_FROM_DOMAIN`** when org domain missing, disabled, or not verified — **never** block transactional sends for DNS alone.
- **Paid / tier entitlement** for registering a custom domain; **Resend** plan must support **N** domains (see [pricing](https://resend.com/pricing)).
- **Dual status storage:** Resend **`resend_status`** + UX **`display_status`**.
- **Idempotent** domain registration; **feedback/rating** mail must resolve **`organization_id`** before **`resolveOrgMailFrom`**.

---

## 2. Product boundaries

| In product (Clean Log)                                                              | Out of product                                     |
| ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| Org admin configures **one** verified subdomain for **API/Edge** transactional mail | Per-org **Auth** `From` domain (GoTrue limitation) |
| Dashboard UX + Edge APIs for DNS lifecycle                                          | **BYO SMTP**                                       |
| **Loosely coupled** mail resolution helper                                          | Full second email provider implementation          |

---

## 3. Personas & user stories

| Persona                   | Story                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Org admin (paid tier)** | As an admin, I want to add **my** subdomain (e.g. `mail.acme.com`) so customers and workers see email from **our** domain.            |
| **Org admin**             | I want to see **exact DNS records** and a **Check DNS** action so I can complete verification without support.                        |
| **Org admin**             | If I have not finished setup, email should **still send** from the platform domain and I should see a **clear prompt** to finish DNS. |
| **Platform operator**     | I need **entitlements** so only paying orgs consume **Resend domain quota**.                                                          |

---

## 4. From-address matrix (build inventory)

**Source:** `database/supabase/functions/_utils/email.ts`, `feedback-email.ts` (line refs approximate; verify during DAP).

| Mail kind                        | Function / area     | Local part    | Display name (today)    | `organization_id` in context?                        | S2 policy for custom domain                                                                                                                   |
| -------------------------------- | ------------------- | ------------- | ----------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker invitation                | `email.ts`          | `onboarding`  | `{organizationName}`    | Yes                                                  | **Org domain when verified**                                                                                                                  |
| Invoice send                     | `email.ts`          | `invoices`    | `{organizationName}`    | Yes                                                  | **Org domain when verified**                                                                                                                  |
| Payment confirmation             | `email.ts`          | `payments`    | `{organizationName}`    | Yes                                                  | **Org domain when verified**                                                                                                                  |
| Admin invoice batch notification | `email.ts`          | `noreply`     | `{organizationName}`    | Yes                                                  | **Org domain when verified**                                                                                                                  |
| Invoice reminder                 | `email.ts`          | `invoices`    | `{organizationName}`    | Yes                                                  | **Org domain when verified**                                                                                                                  |
| Org signup email verification    | `email.ts`          | `noreply`     | **`Clean Log`** (fixed) | Org may be partial                                   | **Platform domain only** for v1 — signup is cross-tenant; keep **`Clean Log`** display name unless product reopens                            |
| Admin user invitation            | `email.ts`          | `invitations` | `{organizationName}`    | Yes                                                  | **Org domain**; respect existing **`RESEND_ADMIN_INVITES_FROM_DOMAIN`** override as **platform** domain escape hatch (env-level), not per-org |
| Feedback / rating to client      | `feedback-email.ts` | `noreply`     | **None** (address only) | **`jobId` present; add `organizationId`** (see §4.1) | **`{organizationName} <noreply@…>`** + org domain when verified — **align with other noreply mail**                                           |

**Rules:**

1. **`resolveOrgMailFrom`** takes **`mailKind`** (enum) to pick **local part** and **whether** display name is org vs platform.
2. **Signup verification** keeps **platform** branding for **v1** (clear trust for “who is emailing me” during registration).
3. **Feedback** gains **`{organizationName} <noreply@…>`** for parity with admin notifications.

### 4.1 Call sites to update for `FeedbackEmailData` / `organizationId`

`organization_id` is available on **`job`** at feedback send time; today it is **not** passed into **`FeedbackEmailData`**. **DAP must** add **`organizationId: string`** and set it in:

- `database/supabase/functions/create-job/index.ts`
- `database/supabase/functions/admin-create-job/index.ts`
- `database/supabase/functions/send-feedback-email/index.ts`

Update **`_utils/__tests__/feedback-email.test.ts`** and integration tests accordingly.

### 4.2 Cross-tenant domain collision

**Global unique `domain_name`:** Only **one** DNS owner can control `mail.acme.com`. If **Org B** attempts to register a domain **already** attached to **Org A** (in Clean Log or already in the platform Resend team), **`register-org-sending-domain`** must **fail** with a clear error (“domain already in use”) after checking DB **and** handling Resend API conflicts.

### 4.3 `RESEND_TEST_MODE` and `from`

In **test mode**, recipients are redirected to **`@resend.dev`** addresses, but Resend still validates the **`from`** domain. **Policy for v1:** Use the **same** `resolveOrgMailFrom` result as production — the org’s custom domain must be **verified in Resend** before it appears in `from`. If product ever needs to force platform `from` in test only, document as an **env flag**; default is **no special case**.

### 4.4 `From` resolution precedence (must be coded exactly — adversarial clarity)

Multiple rules can apply. **`resolveOrgMailFrom`** (or equivalent) **must** evaluate in **this order**:

| Step  | Condition                                                                                                       | Effective mail domain (`@` host part)                | Display name                                           |
| ----- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| **1** | **`mailKind === org_signup_verification`** (or equivalent)                                                      | **Always** `RESEND_FROM_DOMAIN`                      | **`Clean Log`** (fixed) — **ignore** org custom domain |
| **2** | **`mailKind === admin_user_invitation`** **and** `RESEND_ADMIN_INVITES_FROM_DOMAIN` is set                      | **Env domain** (platform operator control)           | `{organizationName}`                                   |
| **3** | **`mailKind === admin_user_invitation`** **and** env **not** set                                                | Org custom if verified **else** `RESEND_FROM_DOMAIN` | `{organizationName}`                                   |
| **4** | All other mail kinds (e.g. worker onboarding, invoice, payment, feedback, admin invoice notification, reminder) | Org custom if verified **else** `RESEND_FROM_DOMAIN` | `{organizationName}` (see §4 matrix for local-part)    |

**Why:** Without this, **`RESEND_ADMIN_INVITES_FROM_DOMAIN`** (legal/compliance routing) could silently fight **org custom domain** and behavior would depend on refactor order. **DAP:** unit tests **must** lock precedence.

### 4.5 Trust: `organizationId` and feedback

**Adversarial:** Callers must set **`organizationId`** from **server-side** data (`job.organization_id` or equivalent), **never** from client-supplied JSON without verifying the job belongs to that org. **`send-feedback-email`** (if it accepts external input) must **re-query** job by id under **RLS/service role** and compare org before sending.

---

## 5. Features (v1)

### 5.1 Database

- Table **`organization_sending_domain`** per S1 §3.2 (columns: `resend_domain_id`, `domain_name`, `resend_status`, `display_status`, `dns_records_snapshot`, `sending_region`, `enabled`, timestamps).
- **RLS:** Authenticated users **SELECT** only rows where **`organization_id`** matches their org membership; **INSERT/UPDATE/DELETE** only via **Edge Functions** (service role) or **security definer RPC** with explicit admin checks — **avoid** duplicating overly permissive grants from legacy tables.
- **Index / constraints:** `UNIQUE (organization_id)`; **`UNIQUE (domain_name)`** globally — see §4.2.
- **Migration rollback:** Single `down` migration or manual revert plan for DAP.

### 5.2 Edge Functions

| Function                                | Auth                    | Behavior                                                                                                                                                                  |
| --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`register-org-sending-domain`**       | Org admin + entitlement | **Idempotent:** if row exists for org with same `domain_name`, refresh from Resend; if new name, create Resend domain + upsert. Handle Resend “already exists” by lookup. |
| **`refresh-org-sending-domain-status`** | Org admin               | GET domain from Resend; update `resend_status`, `display_status`, snapshot.                                                                                               |
| **`remove-org-sending-domain`**         | Org admin               | DELETE in Resend + delete row (or soft-disable first — product choice).                                                                                                   |

**Authorization (adversarial):** Every function **must** assert JWT **`organization_id`** (or membership) matches the row being mutated — **no** trusting client body alone. **Entitlement** checked **server-side** on every register/remove.

**Abuse / griefing:** **Rate-limit** `register` + `refresh` **per org** and **per user** (e.g. cooldown on “Check DNS”) to prevent Resend API hammering and **domain-name squatting** attempts (many pending names). **v1:** One **active** domain slot per org already limits blast radius; document **max** DNS check frequency.

**Resend API:** Create domain, get domain, delete domain — confirm paths in [API reference](https://resend.com/docs/api-reference/domains/create-domain).

**Region:** **v1** — single **`RESEND_SENDING_REGION`** env (e.g. `us-east-1`) passed on create; document in admin setup.

### 5.3 Mail resolution module

- **New module**, e.g. `_utils/org-mail-from.ts`:
  - Input: `{ organizationId, mailKind, organizationName?, supabase }`
  - Load **`organization_sending_domain`** using the **same Supabase client semantics** as other Edge mail (typically **service role** in functions that already use admin client — avoids RLS blocking reads during send).
  - If **`resend_status`** indicates **verified** (match Resend’s exact string in code constants) and **`enabled`**, build **`From`** per §4 matrix.
  - Else use **`RESEND_FROM_DOMAIN`**.
  - On **DB error**, log and **fallback** to platform domain (S1 §3.7).
  - **Caching (v1):** One read per outbound email is acceptable; **do not** add cross-request cache until profiling shows need.
- **429 on Resend send:** retry with **exponential backoff** (small, bounded); log. **Do not** retry indefinitely — cap attempts so job creation cannot hang.

### 5.4 Call-site refactors

- Replace inline **`…@${config.resendFromDomain}`** in **`email.ts`** with **`resolveOrgMailFrom`** for each mail kind in §4. **Inventory (2026-04-12):** production Resend HTTP calls exist only in **`email.ts`** (7× `fetch`) and **`feedback-email.ts`** (1×); no other Edge modules call `api.resend.com`.
- **`feedback-email.ts`:** Add **`organizationId`** to **`FeedbackEmailData`**; use resolver; set **`from`** to **`{organizationName} <noreply@…>`** per §4. See **§4.1** for all callers.

### 5.5 Dashboard

- **Settings → Email** (or **Organization → Email & domain**): entitlement-gated section.
- States: **no domain** | **pending DNS** | **verified** | **error** | **disabled**.
- Actions: **Add / change domain** (wizard), **Copy** DNS rows, **Check DNS**, **Remove** (with confirm).
- **Banner** when entitlement on but not verified (optional).

### 5.6 Documentation

- Admin: DNS propagation, DMARC **optional** after verify, troubleshooting.
- Internal: runbook for **Resend** bounce/spam pauses.

### 5.7 Entitlements (must name source)

**Placeholder until billing wiring exists — pick one for DAP:**

| Option | Mechanism                                                                |
| ------ | ------------------------------------------------------------------------ |
| **A**  | Column on **`organization`**, e.g. `custom_email_domain_enabled BOOLEAN` |
| **B**  | **`organization_settings`** JSON flag                                    |
| **C**  | Stripe feature / price metadata → sync to org                            |

**S2 recommendation:** **A or B** for fastest v1; migrate to **C** when subscriptions mature. **Block** `register-org-sending-domain` if not entitled.

### 5.8 Entitlement lapse and upgrades (adversarial product question)

| Event                                                 | Required behavior (pick one in DAP — default recommended)                                                                                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Subscription downgrades** / entitlement **removed** | **Stop using** org custom domain for **`from`** immediately (resolver sees `enabled=false` or entitlement flag); **optional:** keep Resend domain record for **N days** to allow resubscribe without re-DNS, or **delete** to reclaim quota — **product + ops** decision. |
| **Entitlement granted**                               | Existing **pending** row may proceed to verification; no auto-verify without DNS.                                                                                                                                                                                         |

---

## 6. Non-functional requirements

| NFR                     | Target                                                                                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Availability**        | Email send succeeds with **fallback** if org domain row unreadable                                                                                                                                                                                         |
| **Rate limits**         | Handle Resend **429**; throttle “Check DNS” / refresh (debounce UI; cap cron frequency)                                                                                                                                                                    |
| **Security**            | No secrets in browser; DNS snapshot is non-secret                                                                                                                                                                                                          |
| **Privacy**             | Logs: **no** full email body; **no** recipient PII in info-level logs                                                                                                                                                                                      |
| **Observability**       | Structured logs: `organization_id`, `mail_kind`, `from_domain_source` (`org` \| `platform`)                                                                                                                                                                |
| **Consistency**         | **Register** flow uses transaction or ordered steps: DB row + Resend create — define **cleanup** if Resend succeeds and DB fails (orphan domain on Resend team — rare; ops playbook)                                                                       |
| **Honest availability** | “**Never block** on DNS” means **fallback to platform `from`** when org domain is unavailable — **not** a guarantee email delivers if **`RESEND_FROM_DOMAIN`** is invalid, Resend is down, or API returns **4xx** for other reasons. Document for support. |
| **State drift**         | If an operator **deletes** the domain in **Resend dashboard** but DB still says **verified**, mail may **fail** at send time — mitigate with **refresh** on send failure, **periodic** refresh job, or **webhook** (future).                               |

---

## 7. Testing strategy (S5 preview)

- **Unit:** `resolveOrgMailFrom` — matrix permutations (verified, pending, missing row, DB error).
- **Integration:** Edge register + refresh with Resend **test** API key / mock.
- **Regression:** Existing **`email.ts`** tests updated; **feedback-email** tests assert new `from` shape and `organizationId`.
- **Adversarial / negative:** Unauthorized **register** (wrong org); **cross-org** domain collision; **precedence** unit tests for §4.4; **spoof** `organizationId` on feedback path rejected.
- **E2E (optional):** Dashboard happy path with **test subdomain**.

---

## 8. Rollout

1. Ship **dark** (feature flag off) → migrate DB → deploy Edge → deploy dashboard behind flag.
2. Enable for **internal** org → **beta** customers → GA with entitlement.

---

## 9. Post–S2 gate (quality)

- [ ] Could an agent write a **DAP** from §4 + §5 without guessing **`from`** rules?
- [ ] Is **every** send path in §4 assigned an owner in the DAP?
- [ ] Is **entitlement** source explicit?
- [ ] Are **feedback** callers (**§4.1**) listed in the DAP with file paths?
- [ ] **Orphan Resend domain** failure mode documented for ops?
- [ ] **Cross-tenant domain** conflict behavior specified (API error + copy)?
- [ ] **`From` precedence** (§4.4) has **locked** test vectors?
- [ ] **Entitlement lapse** behavior chosen (§5.8)?
- [ ] **Rate limits** on register/refresh specified?
- [ ] **§14.3** items triaged: `domain.verified` webhook, send **tags**, bounce/complaint webhooks, `svix-id` idempotency, warm-up admin copy?

---

## 10. Handoff to S3 (HLP) and S4 (DAP)

| Artifact                      | Path                                        | Notes                                                                               |
| ----------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| **S3 — High-Level Plan**      | `docs/stages/S3-org-resend-email-domain.md` | System context, workstreams, mermaid sequences, **§7** concurrency, risks, rollout. |
| **S4 — Detailed Action Plan** | `docs/stages/S4-org-resend-email-domain.md` | File paths, PRESERVE, verify commands, rollback.                                    |

**Before S5 build:** confirm Resend **DELETE** / **get domain** response shapes in OpenAPI against the Edge implementation.

---

## 11. References

- S0: `docs/stages/S0-org-resend-email-domain.md`
- S1: `docs/stages/S1-org-resend-email-domain.md`
- S3: `docs/stages/S3-org-resend-email-domain.md` (High-Level Plan)
- S4: `docs/stages/S4-org-resend-email-domain.md` (Detailed Action Plan)
- Resend: [Domains](https://resend.com/docs/dashboard/domains/introduction), [Create domain](https://resend.com/docs/api-reference/domains/create-domain), [Multi-tenant (official)](https://resend.com/docs/knowledge-base/setting-up-resend-for-multi-tenants), [Webhooks](https://resend.com/docs/dashboard/webhooks/introduction), [Pricing](https://resend.com/pricing)
- Code: `database/supabase/functions/_utils/email.ts`, `feedback-email.ts`

---

## 12. Gold review summary (2026-04-12)

See **§13** for the **adversarial (red-team)** pass (abuse cases, precedence, honest limits).

| Finding                                                 | Action taken in this doc                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Typo / malformed rule** in §4 (feedback display name) | Fixed rule text to **`{organizationName} <noreply@…>`**.                                           |
| **Feedback callers implicit**                           | Added **§4.1** explicit list: `create-job`, `admin-create-job`, `send-feedback-email` + tests.     |
| **`organization_id` source**                            | Clarified: add **`organizationId`** to **`FeedbackEmailData`** (job already has org in callers).   |
| **Cross-org same domain**                               | Added **§4.2** + DB constraint narrative.                                                          |
| **`RESEND_TEST_MODE`**                                  | Added **§4.3** — `from` still must use verified domain; no silent shortcut unless future env flag. |
| **Resolver implementation detail**                      | **§5.3:** service-role read pattern, verified string constants, no v1 cache, **cap** 429 retries.  |
| **Resend call-site count**                              | **§5.4** locked to **7 + 1** fetches (grep 2026-04-12).                                            |
| **NFR gaps**                                            | **§6:** privacy for logs; **orphan domain** if DB fails after Resend create.                       |
| **Post–S2 gate**                                        | Expanded checklist for feedback paths, cross-tenant, orphan domain.                                |

**Residual risks for S3/DAP:** Map each of the **seven** `email.ts` send functions to a **§4 matrix row** (some rows may map to multiple HTTP call sites). Repo grep (2026-04-12) shows **no** additional production `api.resend.com` callers beyond **`email.ts`** + **`feedback-email.ts`**.

---

## 13. Adversarial review (2026-04-12)

Independent **red-team** pass: assumptions challenged, failure modes and abuse cases recorded.

### 13.1 Attacker model

| Actor                         | Capability                 | What we care about                                                                                                             |
| ----------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Compromised org admin JWT** | Call Edge as one org       | **Cannot** register domain for **another** org; **cannot** exceed **Resend** quota without rate limits.                        |
| **Malicious org insider**     | Add DNS for their employer | **Cannot** verify **third-party** domain without DNS control; **can** burn **Resend** domain slots — **entitlement + quotas**. |
| **Anonymous API client**      | No JWT                     | **Cannot** call register/refresh (**401**).                                                                                    |

### 13.2 Abuse cases mitigated in design

| Abuse                                                      | Mitigation in doc                                                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Domain squatting** (claim `mail.victim.com` without DNS) | Stays **pending**; **unique `domain_name`** blocks real owner until row released; **rate limits** (§5.2). |
| **API hammering** (refresh loop)                           | **Cooldown** / per-org limits (§5.2, §6).                                                                 |
| **Cross-tenant domain claim**                              | **UNIQUE(domain_name)** + Resend conflict handling (§4.2).                                                |
| **Wrong `organizationId` on feedback**                     | Server-side job fetch + match (§4.5).                                                                     |
| **Conflicting rules** (env vs org domain)                  | **Explicit precedence** (§4.4).                                                                           |
| **Subscription fraud** (use custom domain without paying)  | **Entitlement** server-side (§5.7, §5.8).                                                                 |

### 13.3 Accepted residual risks (document for support / v2)

| Risk                                                             | Why not “fix” in v1                                                                                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Display-name phishing** (`organizationName` looks like a bank) | General **trust** problem; mitigated by mailbox providers + user education; optional **verified badge** in app — **out of scope**. |
| **Stale “verified”** after manual Resend delete                  | **Drift** — mitigate with refresh strategies (§6).                                                                                 |
| **Platform `RESEND_FROM_DOMAIN` misconfigured**                  | All sends fail — **ops** checklist, not app logic.                                                                                 |
| **Race** (two admins edit domain)                                | Rare; **last-write-wins** or row lock — **DAP** decides (§10).                                                                     |

### 13.4 Matrix vs implementation — adversarial note

The **§4 table** is **logical** mail kinds; **`email.ts`** maps **one row to multiple HTTP paths**. **DAP** must implement **§4.4** in **one** place so **no** path accidentally bypasses precedence.

---

## 14. Resend official alignment (external review, 2026-04-22)

Cross-check of this feature set against Resend’s published **multi-tenant** guidance and webhook docs. **Reconfirm** [pricing / domain limits](https://resend.com/pricing) and API details before production contracts.

### 14.1 What matches Resend’s “Option A” (single team, many domains)

| Our design (S1–S2)                                                                                    | Resend documentation                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One platform **`RESEND_API_KEY`**; add each org’s domain via API; send with `from` on verified domain | [Setting up Resend for Multi-Tenant Applications](https://resend.com/docs/knowledge-base/setting-up-resend-for-multi-tenants) — single account, create/verify domains per tenant |
| Subdomain for sending (e.g. `mail.customer.com`)                                                      | Same KB: subdomain recommended to isolate reputation                                                                                                                             |
| Edge-only sending; `resolveOrgMailFrom` builds **`from`**                                             | Acceptable when **only the server** holds the key; not the same as giving each tenant an API key (see §14.2)                                                                     |
| **BYOK** / separate Resend accounts per org deferred                                                  | Resend “Option B” — higher isolation, more onboarding friction; explicitly out of v1 (S1 §5.2)                                                                                   |

### 14.2 Domain-scoped API keys (optional hardening, not a v1 blocker)

Resend documents **per-domain API keys** so a key can only send from that domain. That pattern matters most when **tenants** or services hold keys.

Clean Log v1: **all** HTTP calls use the **shared** key in Edge Functions; **clients never** set `from`. Hardening is **correct `resolveOrgMailFrom`** + **no** user-controlled envelope fields. Storing a **separate** Resend key per org (returned only once at creation) is **optional** and **high operational cost** — treat as a **future** enterprise hardening, not a G1 gap.

### 14.3 Recommended adds (improve on “good enough” v1)

| Recommendation                                                           | Rationale                                                                                                                                                                                            | S3/DAP home                                                                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **`domain.verified` webhook**                                            | Resend: verification is async; webhooks can replace or supplement **poll-only** “Check DNS” (see multi-tenant KB)                                                                                    | New Edge `resend-webhook` (or Next route) + update `organization_sending_domain`               |
| **Tags on every `emails.send`** (e.g. `organization_id`, `mail_kind`)    | Same KB: route **bounces/complaints** to the right tenant when using a single Resend team                                                                                                            | `email.ts` / `feedback-email.ts` + [tags rules](https://resend.com/docs/dashboard/emails/tags) |
| **Webhooks: `email.bounced`, `email.complained` (and others as needed)** | Multi-tenant risk: **shared reputation** — one bad tenant can affect the whole team; [deliverability section](https://resend.com/docs/knowledge-base/setting-up-resend-for-multi-tenants) in same KB | Ops + optional `org` alerts / suppression                                                      |
| **Webhook idempotency**                                                  | [Webhooks](https://resend.com/docs/dashboard/webhooks/introduction): **at-least-once** delivery; dedupe with **`svix-id`**                                                                           | Handler stores processed IDs                                                                   |
| **Admin doc: warm-up** for new domains                                   | Resend [warm-up guidance](https://resend.com/knowledge-base/warming-up) (linked from [multi-tenant KB](https://resend.com/docs/knowledge-base/setting-up-resend-for-multi-tenants))                  | `docs/admin/` or public help, not a code gate for v1                                           |
| **Reconfirm pricing**                                                    | Domain counts and rates change — S1 already flags                                                                                                                                                    | Commercial / ops                                                                               |

### 14.4 Explicit non-goals (still aligned with Resend)

- **Per-org Supabase Auth `From` domain** — not Resend-only; **GoTrue** single-SMTP limitation (S1 §2.1).
- **Domain-scoped keys for every org in v1** — optional; see §14.2.

### 14.5 Pointer

Longer narrative version of the same review: `docs/research/resend-official-alignment-2026.md` (kept in research for easy discovery; **§14 is canonical** for S2).

---

_End of S2 — S3 HLP: `docs/stages/S3-org-resend-email-domain.md` · S4 DAP: `docs/stages/S4-org-resend-email-domain.md`_
