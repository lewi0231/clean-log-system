# S2 — Features & Functions: Dashboard email-domain onboarding & entitlement clarity

| Field                    | Value                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------- |
| **Stage**                | S2 — Features & Functions (scope lock before S3 HLP / S4 DAP)                          |
| **From S0**              | [`S0-dashboard-email-domain-onboarding.md`](./S0-dashboard-email-domain-onboarding.md) |
| **Parent S2 (baseline)** | [`S2-org-resend-email-domain.md`](./S2-org-resend-email-domain.md)                     |
| **Created**              | 2026-05-06                                                                             |
| **Updated**              | 2026-05-06 (adversarial review §13 expansion)                                          |
| **Gold review**          | 2026-05-06 — §12                                                                       |
| **Adversarial review**   | 2026-05-06 — §13 (expanded)                                                            |
| **Product**              | Tally Runner                                                                           |

---

## 1. Purpose & separation from parent S2

**[`S2-org-resend-email-domain.md`](./S2-org-resend-email-domain.md)** already locks **technical** behaviour: per-org Resend domain, **`organization_sending_domain`**, **`register-org-sending-domain`** / **`refresh-org-sending-domain-status`** / **`remove-org-sending-domain`**, **`resolveOrgMailFrom`**, entitlement column **`organization.custom_email_domain_enabled`**, and **Settings → Email** hosting **`OrgSendingDomainCard`**.

**Verified (2026-05-06):** For **admins** with **`custom_email_domain_enabled === true`**, the card exposes:

- **Register domain** / **Update / sync domain** (same control; idempotent via Edge),
- **Check DNS** (refresh status + snapshot),
- **Remove domain** (confirm; clears Resend + DB row),
- **DNS snapshot** display and **status** badges (`pending_*`, `verified`, `error`, `disabled`).

**This S2** scopes **product-facing gaps only**:

1. **Honest copy** when entitlement is false (no fake “plan” language until billing maps to the flag).
2. **Discoverability:** optional **Getting Started** step (+ optional **banner**) so admins find Email & domain early.
3. **Developer operations:** documented path to set entitlement locally (**README-first**; repo has **no** checked-in `seed.sql` at capture — **F3** may add seed **or** document-only).
4. **Future billing hook:** Stripe **subscription** lifecycle → **`custom_email_domain_enabled`** (phase **C**, gated).

---

## 2. Locked assumptions (from S0 — carry forward)

| ID     | Assumption                                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1** | Mail **never blocked** solely due to missing DNS; platform **`RESEND_FROM_DOMAIN`** fallback remains authoritative — parent S2.                                                                 |
| **L2** | **`register-org-sending-domain`** remains **403** when **`custom_email_domain_enabled`** is false. **`remove-org-sending-domain`** may run when false — downgrade cleanup — **do not regress.** |
| **L3** | Onboarding email-domain step is **optional**; completion when **`verified`** or **explicit dismiss** (persistence model locked in **S3** — session vs `sessionStorage` vs server preference).   |
| **L4** | Landing-page pricing remains **marketing** until Stripe Billing wires **SKU/metadata → flag.**                                                                                                  |

---

## 3. Product boundaries

| In scope (this S2)                                                                                                            | Out of scope                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copy & CTAs on **`OrgSendingDomainCard`** (`!entitled` path and headings/helpers if needed)                                   | New Edge provider beyond Resend; schema changes to **`organization_sending_domain`**                                                                          |
| **`OnboardingChecklist`** optional step + deep link **`/dashboard/settings?tab=email`** (tab allow-list includes **`email`**) | Re-implementing register / refresh / remove UX                                                                                                                |
| **README** (and optional future **`seed.sql`**) for **`custom_email_domain_enabled`** in dev                                  | Production entitlement **self-service** UI for ops (manual SQL acceptable until admin console)                                                                |
| Optional **banner**: entitled ∧ ¬verified ∧ **admin**                                                                         | Changing **`resolveOrgMailFrom`** precedence matrix                                                                                                           |
| **Stripe** subscription webhook handlers + **`organization`** updates — **phase C**                                           | Mapping **marketing pricing CTAs** alone to entitlement without Stripe; conflating **`checkout.session.completed`** (invoice payments) with SaaS subscription |

---

## 4. Personas & user stories

| Persona                      | Story                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Org admin (entitled)**     | I discover email-domain setup **without hunting Settings**, finish DNS when convenient, and still rely on **platform fallback** until verified. |
| **Org admin (not entitled)** | I understand **why** I cannot register a domain — **without** implying tiers we do not sell yet — and I see a **real** next step (link / mail). |
| **Org viewer (entitled)**    | I am **not** steered into a checklist step that only admins can complete (**§13.1**).                                                           |
| **Platform engineer**        | I enable entitlement on **local/staging orgs** via **documented SQL** (and optional seed later).                                                |
| **Billing engineer (later)** | Subscription lifecycle updates **`custom_email_domain_enabled`** idempotently with existing **`webhook_event`** dedup.                          |

---

## 5. Features (v1 scope lock)

### 5.1 F1 — Entitlement-aware copy (`OrgSendingDomainCard`)

**Requirement:**

- Replace “when your plan includes it” with copy aligned with **L4** (e.g. _not enabled for your organisation_, _contact us_, _available for qualifying accounts_).
- Add **at least one** actionable CTA whose target **exists in production routing** — **verify before merge:**
  - **`mailto:`** support address from env or brand constants **if** already used elsewhere; **or**
  - **Marketing routes:** codebase links to **`/contact`** from landing components (**`footer.tsx`**, **`faq-section.tsx`**, **`pricing-section.tsx`**) — **gold finding:** **no** `app/contact/page.tsx` located at capture — **either implement `/contact`** or **do not** promise that href in dashboard copy until route exists.
- **`entitled === true`:** preserve register / Check DNS / remove behaviours (**Article 1**).

**Acceptance:**

- RTL or snapshot: **`!entitled`** body avoids misleading **subscription “plan”** wording (**default:** no substring **`plan`** tied to tiers).
- **`entitled === true`:** UI unchanged except explicitly listed copy/link tweaks in PR.

### 5.2 F2 — Onboarding checklist step

**Requirement:**

- **Gate:** Show step **only** when **`custom_email_domain_enabled`** **and** **`userRole === 'admin'`** — use **`useOrganization()`** (or equivalent single source for dashboard role). Viewers must not get a **dead-end** “complete domain” step they cannot execute.
- Inject **`SetupStep`** after **Configure Invoice Settings**, before optional **Stripe** (matches S0 recommendation).
- **`completed`:** `organization_sending_domain.display_status === 'verified'` **OR** explicit **Skip** (persistence: **S3** picks **`sessionStorage`** vs dismiss flag — document in DAP).
- **`href`:** **`/dashboard/settings?tab=email`** — **verified:** `settings/page.tsx` allow-list includes **`email`** for **`searchParams.get("tab")`**.

**Data loading:** Checklist today does **not** query **`organization_sending_domain`**. **Either** (a) **`maybeSingle`** read keyed by **`organization_id`** (mirror **`OrgSendingDomainCard`** fields needed for completion only), **or** (b) small **`useOrgSendingDomainStatus`** hook shared with card **if** duplication cost exceeds ~15 LOC — **S4 chooses**.

**Acceptance:**

- Entitled **admin:** step appears; link opens **Email** tab; card visible.
- Entitled **viewer:** step **absent**.
- **`!entitled`:** step absent.
- Loading states do not flash incorrect completion.
- **`userRole`** / org **`loading`:** step **not** inserted until stable (**§13.1** flicker).

### 5.3 F3 — Dev entitlement bootstrap

**Requirement:**

- Add **`README.md`** subsection **Local development — custom email domain entitlement** with guarded **`UPDATE public.organization SET custom_email_domain_enabled = true WHERE id = '<your-org-id>';`** and pointer to finding org id (**Studio / SQL**).
- **Optional follow-up:** introduce **`database/supabase/seed.sql`** (or documented **`supabase seed`** path) if product standardizes seeded orgs — **not required** for G1 if README suffices.

**Acceptance:**

- New contributor can enable entitlement **without** reading Edge source.
- Doc warns: **register** still requires **Resend** + valid API keys (parent S2).
- **Adversarial (§13.7):** README SQL **must** show **`WHERE id = …`** (scoped predicate); **never** document bare **`UPDATE organization SET …`** without a filter — catastrophic cross-tenant mistake.

### 5.4 F4 — Optional “finish DNS” banner (stretch)

**Requirement:**

- Render only when **admin** ∧ **entitled** ∧ domain row exists ∧ **`display_status !== 'verified'`**.
- **Placement:** **Email tab** mount preferred over global layout (reduces noise for workers / viewers).
- Dismissible; **never** blocks navigation.
- **[Stretch]** Omit from first ship unless product approves — call out in DAP.

**Acceptance:**

- Never renders for **`verified`**, **`!entitled`**, **`!admin`**.

### 5.5 F5 — Stripe → entitlement (phase **C** — optional gate)

**Requirement:**

- Extend **`dispatch-stripe-event.ts`** for **subscription** lifecycle — **at minimum:** **`customer.subscription.created`**, **`customer.subscription.updated`**, **`customer.subscription.deleted`** (exact set aligned with Stripe Billing design).
- **Do not** reuse **`checkout.session.completed`** today — that path is **invoice payment** checkout (**verified** `dispatch-stripe-event.ts`); SaaS subscription checkout (if any) **must** be a **separate** mapping decided in **S3**.
- Resolve **`organization_id`** from **`subscription.metadata`** **or** **`customer.metadata`** — **locked in S3**; reject update if missing (**log + skip**, no cross-org write).
- **Adversarial (§13.6):** If **`organization_id`** is present, **must** validate it matches the **Stripe Customer** already linked to that tenant (e.g. **`organization.stripe_customer_id`** or equivalent system-of-record column — **S3/DAP names source**). **Never** grant entitlement from metadata alone if customer can set arbitrary metadata via Checkout without binding verification.
- Set **`organization.custom_email_domain_enabled`** from **active** subscription items / price metadata (**boolean rule locked in S3**).
- **Idempotent:** reuse **`webhook_event`** dedup (**existing** pattern).
- **Downgrade / delete:** set **`false`** per parent **§5.8**; **`remove-org-sending-domain`** remains available for cleanup (**orgs retain autonomy**).

**Acceptance:**

- Fixture tests **if** phase **C** ships; otherwise **document deferral** in DAP.

---

## 6. Non-functional requirements

| NFR                      | Target                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Article 1 (Preserve)** | No regression on **`register`**, **`refresh`**, **`remove`**, RLS policies                                                  |
| **GUARD**                | No secrets in copy; Stripe verification unchanged                                                                           |
| **A11y**                 | Skip control / banner dismiss keyboard-reachable                                                                            |
| **Perf**                 | Avoid redundant **`organization_sending_domain`** fetches — batch or hook **if** checklist + card double-fetch in same view |
| **Honest routing**       | No broken internal links (**§12** **`/contact`** gap)                                                                       |

---

## 7. Testing strategy (S5 preview)

| Layer                | Cases                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Unit / RTL**       | **`OrgSendingDomainCard`** `!entitled` copy; optional **`contact`** link behind feature flag if route delayed                                    |
| **RTL/integration**  | Checklist: step **only** for entitled **admin**; absent for viewer                                                                               |
| **Manual**           | **`/dashboard/settings?tab=email`** opens Email panel                                                                                            |
| **E2E (optional)**   | Admin skips or completes DNS step                                                                                                                |
| **Stripe (phase C)** | Subscription webhook fixtures → **`custom_email_domain_enabled`** flip; **negative:** spoof metadata / wrong **`customer_id`** → **no DB write** |
| **Adversarial §13**  | Role **`loading`** does not flash step; **`organization_id`** transition mid-session; README SQL safety                                          |

---

## 8. Dependencies & sequencing

| Phase | Delivery                                                                |
| ----- | ----------------------------------------------------------------------- |
| **A** | **F1 + F3** — honest UX + dev docs (**fix `/contact` or omit link**)    |
| **B** | **F2** (+ **F4** if approved)                                           |
| **C** | **F5** after Stripe **subscription** products + metadata contract exist |

---

## 9. Out of scope (explicit)

- **`resolveOrgMailFrom`** matrix — parent S2 / DAP.
- **Supabase Auth** `From` — parent S2.
- Internal **admin console** for entitlements — unless promoted elsewhere.
- **`resend-webhook`** domain verification push — parent S2 **§14.3** residual.

---

## 10. Handoff

| Next       | Content                                                                                                                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S3 HLP** | Checklist ordering; skip persistence; **`/contact`** vs **`mailto`**; Stripe metadata schema; subscription vs payment checkout separation; **§13.6** customer ↔ org binding; **`past_due` / paused** entitlement; **plan tier model** (Free/Pro → entitlement flags cascade)      |
| **S4 DAP** | **[`S4-dashboard-email-domain-onboarding.md`](./S4-dashboard-email-domain-onboarding.md)** — phases A–B: `org-sending-domain-card.tsx`, `onboarding-checklist.tsx`, `useOrganization` / settings loading, optional hook, README; **not** `dispatch-stripe-event.ts` until phase C |

---

## 11. Post–S2 gate (quality)

Use before locking **S3**.

- [ ] **F2 admin gate** explicit — no viewer dead-end?
- [ ] **CTA URLs** verified or flagged as follow-up (**`/contact`**)?
- [ ] **Stripe phase C** uses **subscription** events, not invoice **`checkout.session.completed`** alone?
- [ ] **Article 1:** preservation of register / refresh / remove called out in DAP **PRESERVE** blocks?
- [ ] **Completion rule** for checklist documented when **no row** in **`organization_sending_domain`** (not started vs pending)?
- [ ] **Duplicate fetch** decision recorded if checklist adds domain read?
- [ ] **§13 adversarial** accepted risks acknowledged or mitigated in DAP?
- [ ] **F5:** Metadata **`organization_id`** validated against **Stripe customer ↔ org** binding (not metadata alone)?
- [ ] **F3 README:** SQL examples use **mandatory `WHERE id = …`** (no unscoped **`UPDATE`**)?
- [ ] **F2:** **`userRole`** / settings **`loading`** — step hidden until stable (no flicker)?
- [ ] **F4 vs F2:** If both ship, nag fatigue documented (banner + checklist)?

---

## 12. Gold review summary (2026-05-06)

| Finding                                                                                 | Action taken in this doc                                                                                                                                        |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/contact`** linked from marketing but **no** `app/contact/page.tsx` found at capture | **F1** requires **verify route** or **implement page** before promising link; **§6 NFR** “honest routing”                                                       |
| **Onboarding checklist** has **no** role filter today                                   | **F2** locks **`userRole === 'admin'`** so viewers are not misled                                                                                               |
| **F5** listed only **`updated` \| `deleted`**                                           | Added **`customer.subscription.created`**; clarified **invoice checkout** webhook ≠ SaaS subscription entitlement                                               |
| **No `seed.sql`** in repo at capture                                                    | **F3** **README-first**; optional seed deferred                                                                                                                 |
| **`refresh`** does **not** re-check entitlement (by design)                             | Left unchanged; **not** in scope — documented implicitly via **L2** (register gated only)                                                                       |
| **Typo** “`**remove`\*\* Flow”                                                          | Fixed prose in **F5**                                                                                                                                           |
| **Post–S2 gate** missing                                                                | Added **§11** checklist                                                                                                                                         |
| **Adversarial §13 expansion**                                                           | **§13.5–§13.9** (attacker model, Stripe metadata spoofing, README SQL blast radius, nag fatigue, multi-session); **F3/F5/F2** tightened; **§11** gates extended |

**Residual for S3/DAP:** Define **`completed`** when entitled admin **never started** (no row): treat as **incomplete** until verified **or** skip — product choice.

### Adversarial review — accepted residual (explicit)

Carry into **S4** triage comment unless mitigated:

- Global checklist dismiss hides email step (**§13.9**).
- **Stripe Customer ↔ org binding** — **S3** names canonical column/table/rule; **§13.6** “prefer customer row” is pattern language, not **`organization.stripe_customer_id`** as-implemented today (**§13.6** schema note).

---

## 13. Adversarial review (2026-05-06)

Independent **red-team** pass: abuse cases, authorization, and honest limits. **§13.1–§13.4** retained; **§13.5–§13.9** added on second pass.

### 13.1 UX dead ends

| Risk                                       | Mitigation                                                                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viewer sees “Set up domain” but cannot act | **F2** admin-only step                                                                                                                                     |
| Link to **`/contact`** 404                 | **F1** route audit                                                                                                                                         |
| Skip persists incorrectly                  | **S3** picks persistence; default **`sessionStorage`** clears per tab                                                                                      |
| **`userRole`** / **`loading`** flicker     | Do **not** render the new step until **`orgLoading === false`** (and settings loaded if entitlement read there) — avoids flashing admin-only UI to viewers |

### 13.2 Data & perf

| Risk                                | Mitigation                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Double fetch domain row             | Shared hook or lazy read **only** for entitled admin checklist                                                                                               |
| Race: user verifies in another tab  | **`visibilitychange`** / focus refetch **optional**; minimum: revisiting dashboard reflects **`verified`** on next checklist mount                           |
| Stale entitlement after ops/webhook | **`useOrganizationSettings`** / org query should **invalidate** on session focus **or** live with TTL — document if checklist stays stale until hard refresh |

### 13.3 Stripe (phase C)

| Risk                                            | Mitigation                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing **`organization_id`** metadata          | **Do not** guess org; **log** + **skip**                                                                                                       |
| Replay / duplicate events                       | **`webhook_event`** dedup                                                                                                                      |
| Payment vs subscription confusion               | **Explicit** non-goal in **§3**                                                                                                                |
| **Metadata spoofing**                           | Customer **`metadata.organization_id`** writable in some flows — **§13.6** binds subscription events to **verified Stripe Customer ↔ org** row |
| **`customer.subscription.paused` / `past_due`** | **S3** defines whether entitlement flips **false** on non-active states — avoid leaving **`true`** on unpaid subscriptions                     |

### 13.4 Accepted residual

| Risk                                                 | Note                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Admin skips domain forever                           | Acceptable — platform fallback (**L1**)                                                         |
| Marketing “plans” copy elsewhere                     | Out of scope — **F1** scoped to **`OrgSendingDomainCard`**; landing pricing separate governance |
| Entitled admin stuck “pending DNS” (provider outage) | Checklist stays incomplete — acceptable; **no** fake “complete”; support playbook optional      |

### 13.5 Attacker model (dashboard / checklist scope)

| Actor                           | Capability                    | Threat                                                                                                                                                                          |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Non-admin JWT**               | Browse dashboard              | **Cannot** complete domain step — mitigated by **F2** omission (step absent).                                                                                                   |
| **Viewer JWT**                  | Same                          | Same; **must not** infer **`organization_sending_domain`** via alternative client — RLS already restricts SELECT to admins (**parent S2**).                                     |
| **Malicious admin JWT (org A)** | Call Edge with body org **B** | **Already** mitigated by **`requireOrgAdminFromRequest`** / org gate on Edge — **out of scope** to weaken; **DAP** regression test if checklist adds client-side prefetch only. |

### 13.6 Integrity — Stripe → **`organization_id`** (phase **C**)

**Threat:** Attacker or misconfigured Checkout writes **`subscription.metadata.organization_id = victim-uuid`** while paying with an unrelated card.

**Mitigations (stack — pick minimum bar in S3):**

1. **Prefer** resolving org from the **canonical Customer ↔ org mapping** **S3** defines (e.g. org-level SaaS customer column, mapping table, or auditable join — see schema note below) when **`subscription.customer`** matches — webhook **`metadata.organization_id`** only **fills gaps** when that mapping is authoritative.
2. If metadata is the only link, **require** that **`subscription.customer`** was created **by our** signup/checkout flow (known **`customer` ↔ org** mapping table or column).
3. **Never** **`UPDATE organization`** when **`organization_id`** from webhook cannot be matched to **`subscription.customer`** under application rules.

**Schema reality at capture (verify before DAP):** **`organization`** exposes **`stripe_account_id`** (payment processing context); **`stripe_customer_id`** exists on **`invoice`** / **`payment`**, not as an org-level column today. **S3** must name the authoritative **`subscription.customer` ↔ org** mapping — may require a **new column**, a **lookup table**, or a defined rule via **`payment`** history — not assumed **`organization.stripe_customer_id`**.

### 13.7 Operational / human error

| Failure                                                                     | Consequence                 | Mitigation                                                                                  |
| --------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| README **`UPDATE`** without **`WHERE`**                                     | All tenants get entitlement | **F3** — mandatory scoped predicate in docs; code review checklist                          |
| Ops sets **`custom_email_domain_enabled = true`** then forgets Resend quota | Domain creates fail at Edge | Runbook: monitor **`register-org-sending-domain`** errors (**parent S2**)                   |
| Product ships **F2** + **F4** together                                      | Duplicate nagging           | **S3** chooses **one** primary nag per surface **or** banner only after checklist dismissed |

### 13.8 Privacy & communication

| Topic                               | Note                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **`mailto:`** in **`!entitled`** UI | Harvestable by scrapers if ever SSR’d as plain mailto — acceptable for support; avoid embedding secrets       |
| **Honest copy**                     | Avoid promising **“same day”** DNS verification — Resend/docs allow **up to 48h** propagation (**parent S0**) |

### 13.9 Multi-session / product edge cases

| Case                                              | Behaviour                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| User promoted **viewer → admin** mid-session      | Checklist should appear on **next** load when **`userRole`** updates — **React Query** / auth listener refresh **if** step missing today         |
| User switches **organization** (future multi-org) | **`useOrganization`** must key checklist step by **current** **`organizationId`** — document if product adds multi-org later                     |
| Global checklist **dismiss**                      | If dismiss hides **entire** checklist, email step disappears with it — **accepted** unless product splits dismiss per-step (**out of scope v1**) |

---

_Related: [`S0-dashboard-email-domain-onboarding.md`](./S0-dashboard-email-domain-onboarding.md) · [`S2-org-resend-email-domain.md`](./S2-org-resend-email-domain.md) · [`S4-org-resend-email-domain.md`](./S4-org-resend-email-domain.md)_

_Next: **`S3-dashboard-email-domain-onboarding.md`** (create when promoting Stripe **F5**) · **[`S4-dashboard-email-domain-onboarding.md`](./S4-dashboard-email-domain-onboarding.md)** (DAP — phases A–B)_
