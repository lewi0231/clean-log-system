# S4 — Detailed Action Plan: Dashboard email-domain onboarding & entitlement clarity

| Field                  | Value                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**              | S4 — Detailed Action Plan (execution-ready; S5 build)                                                                                                                                              |
| **From**               | [`S2-dashboard-email-domain-onboarding.md`](./S2-dashboard-email-domain-onboarding.md) · Parent baseline [`S2-org-resend-email-domain.md`](./S2-org-resend-email-domain.md)                        |
| **S3 HLP**             | **Skipped for phases A–B** (per triage: decisions are small enough to lock in this DAP). **`F5` (Stripe)** remains blocked until a separate **S3 subscription / binding** doc exists — see **§6**. |
| **Created**            | 2026-05-06                                                                                                                                                                                         |
| **Gold review**        | —                                                                                                                                                                                                  |
| **Adversarial review** | —                                                                                                                                                                                                  |
| **Product**            | Tally Runner                                                                                                                                                                                       |

**Scope lock (this DAP):** **Phase A** (**F1**, **F3**) + **Phase B** (**F2**, optional **F4**). **Out of scope:** **`F5`** Stripe subscription → entitlement (**phase C**); schema changes to **`organization_sending_domain`**; changes to **`resolveOrgMailFrom`** / Edge register-refresh-remove semantics beyond copy-preserving UI.

**Verify discipline:** Run the listed **verify** command after each numbered step group before merging.

---

## 0. Prerequisites

| #   | Prerequisite                                                                                                                                                                | Verify                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| P0  | Read [`S2-dashboard-email-domain-onboarding.md`](./S2-dashboard-email-domain-onboarding.md) in full (**§5**, **§11** gate, **§13** adversarial).                            | N/A                          |
| P1  | Confirm parent feature ships: **`OrgSendingDomainCard`**, **`organization_sending_domain`**, **`custom_email_domain_enabled`** via settings API, Email tab **`tab=email`**. | Manual: Settings → Email tab |
| P2  | Confirm **`get-organization-id`** returns **`role`** (`admin` \| `viewer`) for dashboard users — **`useOrganization().userRole`**.                                          | Log / network in dev         |

---

## 1. PRESERVE (Article 1 — do not regress)

- **PRESERVE-1:** For **`entitled === true`** admins, **`OrgSendingDomainCard`** must keep **Register / Update**, **Check DNS**, **Remove**, DNS snapshot, and existing loading / error behaviour — only **`!entitled`** copy and **optional** banner (**F4**) change surface.
- **PRESERVE-2:** Edge **`register-org-sending-domain`** remains **403** when **`custom_email_domain_enabled`** is false; **`remove-org-sending-domain`** downgrade cleanup behaviour unchanged (**S2 L2**).
- **PRESERVE-3:** Mail fallback (**platform `RESEND_FROM_DOMAIN`**) unchanged — onboarding is discovery / copy only (**S2 L1**).
- **PRESERVE-4:** Settings tab deep link **`/dashboard/settings?tab=email`** must remain valid; allow-list already includes **`email`** in `dashboard/app/dashboard/settings/page.tsx` (**~1209**).

---

## 2. Phase A — **F1** Entitlement-aware copy (`OrgSendingDomainCard`)

**Complexity:** LOW (~20 LOC)  
**Dependencies:** None (can run in parallel with §3)

| Step | ID         | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | File(s)                                                                               | Verify                                                                                                                     |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A1   | **DA-F1a** | Replace **`!entitled`** body copy: remove misleading **“plan includes it”** / tier implication; align with **S2 L4** (qualifying accounts / not enabled / contact). Default guardrail: avoid substring **`plan`** tied to subscription tiers in **`!entitled`** UI (RTL or grep in PR).                                                                                                                                                                                                                     | `dashboard/components/settings/org-sending-domain-card.tsx`                           | **`pnpm --filter dashboard test`** (add/update test if RTL exists) **or** grep + manual snapshot                           |
| A2   | **DA-F1b** | Add **one** actionable CTA **only if** target exists: **(i)** Implement **`dashboard/app/contact/page.tsx`** (and layout if needed) **if** marketing links **`/contact`** and product wants parity; **or (ii)** **`mailto:`** using **`NEXT_PUBLIC_SUPPORT_EMAIL`** (optional) added to **`dashboard/lib/env.ts`** + **`dashboard/.env.example`** with docs; **or (iii)** plain text “ask your administrator” **without** dead link. **Do not** ship **`href="/contact"`** until route exists (**S2 §12**). | `org-sending-domain-card.tsx`, optional `app/contact/page.tsx`, optional `lib/env.ts` | Manual: **`!entitled`** card shows working CTA or text-only; **`curl -I`** or browser `/contact` returns **200** if linked |
| A3   | **DA-F1c** | Ensure **`entitled === true`** branch has **no** unintended copy drift except any explicitly listed tweaks in PR description.                                                                                                                                                                                                                                                                                                                                                                               | Same                                                                                  | Visual compare entitled vs main                                                                                            |

**Draft copy (A1) — Pro tier framing:**

```tsx
// Current (~line 153):
"Custom sending domain is not enabled for this organization. When your plan includes it, an administrator can add DNS records and verify the domain here.";

// Proposed (option A — direct):
"Custom email domain is a Pro feature. Contact us to upgrade your account.";

// Proposed (option B — softer, beta-friendly):
"Custom email domain is available on Pro accounts. Interested? Contact support.";
```

Product picks final wording; key constraint: **reference "Pro"** so copy is future-true when billing ships.

**Rollback:** Revert **`org-sending-domain-card.tsx`** (and contact/env files if added).

---

## 3. Phase A — **F3** Dev entitlement bootstrap (README)

**Complexity:** LOW (~15 LOC docs)  
**Dependencies:** None (can run in parallel with §2)

| Step | ID         | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | File(s)               | Verify                          |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------- |
| B1   | **DA-F3a** | Add subsection **“Local development — custom email domain entitlement”** to **`dashboard/README.md`** (preferred; repo root has no top-level README). Include: guarded SQL **`UPDATE public.organization SET custom_email_domain_enabled = true WHERE id = '<your-org-id>'::uuid;`** — **mandatory `WHERE id = …`** (**S2 §13.7**); how to find **`organization.id`** (Supabase Studio / SQL); reminder that **register** still needs **Resend** keys (**parent S2**). | `dashboard/README.md` | New contributor dry-run (human) |
| B2   | **DA-F3b** | Optionally mention same snippet in **`database`** or root docs **only if** project standards prefer DB README — **not required** if **`dashboard/README.md`** is sufficient.                                                                                                                                                                                                                                                                                           | Optional              | —                               |

**Rollback:** Remove README section.

---

## 4. Phase B — **F2** Onboarding checklist step

**Complexity:** MEDIUM (~60 LOC)  
**Dependencies:** Requires §2 + §3 merged first (or at least P1 parent feature live)

**Completion rule (lock in implementation):**

- **Completed** when **`organization_sending_domain.display_status === 'verified'`** **OR** user taps **Skip** (persist **`sessionStorage`** key **`onboarding-email-domain-skipped:${organizationId}`** = **`1`**).
- **Incomplete** when entitled admin has **no row** and has not skipped — do **not** fake complete (**S2 §11** residual).

**Skip vs dismiss clarification:**

| Mechanism                                    | Scope             | Storage                                                         | Clears              |
| -------------------------------------------- | ----------------- | --------------------------------------------------------------- | ------------------- |
| **Global dismiss** (existing **`X`** button) | Entire checklist  | `localStorage` **`onboarding-checklist-dismissed`**             | Manual / never      |
| **Per-step skip** (new, this step only)      | Email domain step | `sessionStorage` **`onboarding-email-domain-skipped:${orgId}`** | Per browser session |

This allows admins to skip the email step without hiding the entire checklist, and the skip resets each session so they can reconsider.

| Step | ID         | Action                                                                                                                                                                                                                                                                                                                                                                                                                                             | File(s)                                                                                   | Verify                                                            |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| C1   | **DA-F2a** | **Gate rendering:** Inject step **only** when **`settings.custom_email_domain_enabled === true`** **and** **`userRole === 'admin'`** **and** **`useOrganization().loading === false`** **and** **`settingsLoading === false`** (same composite **`loading`** as existing checklist or explicitly extend it). **Viewers** and **`!entitled`**: step absent (**S2 §13.1** flicker).                                                                  | `dashboard/components/onboarding/onboarding-checklist.tsx`                                | Manual: viewer vs admin; throttle network and confirm no flash    |
| C2   | **DA-F2b** | **Ordering:** Insert **`SetupStep`** **after** **`invoice-config`**, **before** **`payment`** (optional Stripe step) — matches **S2 §5.2**.                                                                                                                                                                                                                                                                                                        | Same                                                                                      | Order matches spec                                                |
| C3   | **DA-F2c** | **Data:** **`maybeSingle`** on **`organization_sending_domain`** for **`organization_id`** (same columns needed as card for status: at least **`display_status`**). Prefer **inline query** in **`useEffect`** keyed by **`organizationId`** if duplication stays small; **or** extract **`useOrgSendingDomainRow(orgId)`** if **\> ~15 LOC** duplicated (**S2 §5.2**). **Fetch only** when gate (**C1**) passes to avoid extra reads for viewers. | `onboarding-checklist.tsx` and optionally `dashboard/hooks/use-org-sending-domain-row.ts` | React Query DevTools / network: no fetch when viewer              |
| C4   | **DA-F2d** | **`href`:** **`/dashboard/settings?tab=email`**. **`required`:** **`false`** (optional onboarding step per **S2 L3**) **or** **`true`** if product promotes — **default `false`** to match **DNS optional** narrative; document final choice in PR.                                                                                                                                                                                                | Same                                                                                      | Click navigates to Email tab + card visible                       |
| C5   | **DA-F2e** | **Skip:** For incomplete non-verified states, show **`Skip for now`** (button or text control) that sets **`sessionStorage`** key above and marks step **completed** in UI. **A11y:** keyboard-reachable (**S2 §6**).                                                                                                                                                                                                                              | Same                                                                                      | Skip persists per browser session; clear storage → step reappears |
| C6   | **DA-F2f** | **Icon / copy:** e.g. **`Mail`** from **`lucide-react`**; title/description aligned with “custom sending domain / DNS” without promising same-day verification (**S2 §13.8**).                                                                                                                                                                                                                                                                     | Same                                                                                      | Copy review                                                       |

**Accepted residual (document in PR if unchanged):** Global **`localStorage`** **`onboarding-checklist-dismissed`** hides **entire** checklist including this step (**S2 §13.9**) — v1 OK.

**Rollback:** Revert checklist changes (+ hook file if added).

---

## 5. Phase B — **F4** Optional “finish DNS” banner (stretch)

| Step | ID         | Action                                                                                                                                                                                                                                                                                                                                          | File(s)                                                                           | Verify                                                              |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| D1   | **DA-F4a** | **Only if product approves stretch:** Banner when **admin** ∧ **entitled** ∧ **domain row exists** ∧ **`display_status !== 'verified'`**. **Placement:** inside **`TabsContent value="email"`** region in **`settings/page.tsx`** (above or below **`OrgSendingDomainCard`**) — **not** global layout (**S2 §5.4**). Dismissible; non-blocking. | `dashboard/app/dashboard/settings/page.tsx` (and small component file if cleaner) | **`!admin`**, **`!entitled`**, **`verified`**: banner never renders |
| D2   | **DA-F4b** | If **F4** ships with **F2**, ensure single primary nag: either omit banner v1 **or** show banner **only** after checklist dismissed — note in PR (**S2 §13.7**).                                                                                                                                                                                | —                                                                                 | Product sign-off                                                    |

**Rollback:** Delete banner component / JSX.

---

## 5.1 Phase B — **F6** DNS Records UX (implemented)

**Complexity:** MEDIUM (~120 LOC)  
**Dependencies:** Parent feature (P1)

**Objective:** Transform raw JSON DNS records into a guided, copy-friendly interface for non-technical small business owners.

| Step | ID         | Action                                                                                                                                                                                                                                            | File(s)                                                     | Verify                                             |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| E1   | **DA-F6a** | Replace `DnsRecordsList` (raw JSON) with `DnsRecordsGuide` component: step-by-step instructions (numbered list in blue callout), individual `DnsRecordRow` for each record with status icons, explanations (DKIM/SPF/MX), copy buttons per field. | `dashboard/components/settings/org-sending-domain-card.tsx` | Manual: DNS records render as cards, not JSON dump |
| E2   | **DA-F6b** | Add `CopyButton` component with clipboard API, visual feedback ("Copied" for 2s).                                                                                                                                                                 | Same                                                        | Click Copy → value in clipboard, icon changes      |
| E3   | **DA-F6c** | Add provider guide links (Cloudflare, GoDaddy, Namecheap, Route 53) with external link icons.                                                                                                                                                     | Same                                                        | Links open correct provider docs in new tab        |
| E4   | **DA-F6d** | Update `CardDescription` to mention automatic verification ("we check automatically every few hours and will notify you").                                                                                                                        | Same                                                        | Card description matches new behaviour             |

**Rollback:** Revert `org-sending-domain-card.tsx` to `DnsRecordsList`.

---

## 5.2 Phase B — **F7** Auto-refresh pending domains + notification (implemented)

**Complexity:** MEDIUM (~170 LOC Edge function + migration)  
**Dependencies:** Notification infrastructure (existing `createNotification`)

**Objective:** Periodically check pending domain verifications with Resend; notify admins when verified so they don't need to manually check.

| Step | ID         | Action                                                                                                                                                                                                                                                                                                                      | File(s)                                                                            | Verify                                                                    |
| ---- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| F1   | **DA-F7a** | Create `auto-refresh-pending-domains` Edge function: query `organization_sending_domain` where `display_status IN ('pending_setup', 'pending_dns')` and `enabled = true`; for each, call Resend GET `/domains/{id}`; update DB; if status transitions to `verified`, call `createNotification` with type `domain_verified`. | `database/supabase/functions/auto-refresh-pending-domains/index.ts`                | Deploy locally, invoke via POST; check logs for processed/verified counts |
| F2   | **DA-F7b** | Add `domain_verified` to `NotificationType` union in `_utils/notifications.ts`.                                                                                                                                                                                                                                             | `database/supabase/functions/_utils/notifications.ts`                              | TypeScript compiles without error                                         |
| F3   | **DA-F7c** | Create migration `20260505100000_add_domain_verified_notification.sql` to add `domain_verified` to `notification_type_check` constraint.                                                                                                                                                                                    | `database/supabase/migrations/20260505100000_add_domain_verified_notification.sql` | `supabase db reset` succeeds; insert with type `domain_verified` succeeds |
| F4   | **DA-F7d** | Add `deno.json` for new function (copy from `auto-approve-jobs`).                                                                                                                                                                                                                                                           | `database/supabase/functions/auto-refresh-pending-domains/deno.json`               | `deno lint` passes                                                        |

**Cron setup (production):**

```sql
SELECT cron.schedule(
  'auto-refresh-pending-domains',
  '0 0,4,8,12,16,20 * * *',  -- every 4 hours at minute 0
  $$ SELECT extensions.http_post(
       'https://<project-ref>.supabase.co/functions/v1/auto-refresh-pending-domains',
       '{}',
       'application/json'
     ) $$
);
```

**Notification content:**

| Field                 | Value                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `type`                | `domain_verified`                                                                                  |
| `title`               | "Email domain verified"                                                                            |
| `message`             | "Your custom email domain {domain_name} has been verified and is ready to use for sending emails." |
| `related_entity_type` | `organization_sending_domain`                                                                      |
| `related_entity_id`   | `{domain.id}`                                                                                      |

**Rollback:** Delete Edge function folder, revert notifications.ts, drop migration.

---

## 6. Deferred — **F5** Phase C (Stripe → entitlement)

**Do not implement in this DAP.** Requires:

- **S3** (or equivalent) locking **`subscription.customer` ↔ org** mapping (**§13.6** schema note: not **`organization.stripe_customer_id`** as-is),
- Metadata contract, **`past_due` / paused** rules,
- **`dispatch-stripe-event.ts`** subscription handlers + **`webhook_event`** dedup tests.

Track as **`S3-dashboard-email-domain-onboarding.md`** (future) + **`S4-dashboard-email-domain-onboarding-phase-C.md`** or an appendix when billing is ready.

### 6.1 Plan tier model (lock for F5)

| Tier     | Price | Key entitlements                                            |
| -------- | ----- | ----------------------------------------------------------- |
| **Free** | $0    | Core job logging, invoicing, workers, platform email domain |
| **Pro**  | $X/mo | Custom email domain, higher limits (TBD), priority support  |

**Entitlement cascade (F5 implementation):**

```
Stripe subscription.created / updated
  → resolve organization via customer ↔ org binding
  → set organization.plan = 'pro' | 'free'
  → set organization.custom_email_domain_enabled = (plan === 'pro')
```

**Hybrid model:** `plan` drives baseline entitlements; standalone flags (e.g. `custom_email_domain_enabled`) remain for beta overrides and ops flexibility. Runtime checks use the **flag**, not the plan directly — this keeps existing code (8+ files) unchanged while allowing Stripe to cascade automatically.

---

## 7. Test matrix (acceptance)

- [ ] **`OrgSendingDomainCard`**: **`!entitled`** — references **Pro** tier (future-true per §6.1); CTA not 404 (**§12**).
- [ ] **`OrgSendingDomainCard`**: **`entitled`** admin — register / refresh / remove still work (**PRESERVE-1**).
- [ ] **Checklist**: step **only** for **entitled** **admin**; absent for **viewer** and **`!entitled`**.
- [ ] **Loading**: no admin-only step flash while **`useOrganization.loading`** / settings loading (**§13.1**).
- [ ] **Skip**: **`sessionStorage`** marks complete; verified marks complete; neither → incomplete with **no row**.
- [ ] **Deep link**: **`/dashboard/settings?tab=email`** opens Email tab.
- [ ] **F4 (if shipped)**: never on **`verified`** / **`!entitled`** / **`!admin`**.
- [ ] **README**: SQL includes **`WHERE id = …`** only — no unscoped **`UPDATE`**.
- [ ] **F6 DNS UX**: DNS records display as guided cards with Copy buttons, not raw JSON.
- [ ] **F6 DNS UX**: Provider guide links (Cloudflare, GoDaddy, etc.) open correct docs.
- [ ] **F7 auto-refresh**: Edge function processes pending domains and updates status.
- [ ] **F7 notification**: `domain_verified` notification created when domain transitions to verified.

**Commands (batch before merge):**

```bash
pnpm --filter dashboard lint
pnpm --filter dashboard typecheck
pnpm --filter dashboard test
```

Optional: add **`vitest`** RTL tests for **`!entitled`** copy and checklist gating if coverage gaps appear.

---

## 8. Handover notes for S5 agent

1. Complete **§11 Post–S2 gate** in [`S2-dashboard-email-domain-onboarding.md`](./S2-dashboard-email-domain-onboarding.md) when accepting PR (checkboxes).
2. **`/contact`**: if still missing, either implement **DA-F1b (i)** or **do not** use **`/contact`** href.
3. **`F5`**: do not touch **`stripe-webhook`** / **`dispatch-stripe-event.ts`** for entitlement until **§6** prerequisites exist.

---

_Related:_ [`S0-dashboard-email-domain-onboarding.md`](./S0-dashboard-email-domain-onboarding.md) · [`S4-org-resend-email-domain.md`](./S4-org-resend-email-domain.md)
