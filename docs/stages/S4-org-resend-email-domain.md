# S4 — Detailed Action Plan: Per-organization sending domain (Resend)

| Field       | Value                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**   | S4 — Detailed Action Plan (execution-ready; S5 build)                                                                                         |
| **From**    | `S0` → `S1` → `S2` (`docs/stages/S2-org-resend-email-domain.md`), **§14** Resend alignment, `docs/research/resend-official-alignment-2026.md` |
| **Created** | 2026-04-22                                                                                                                                    |
| **Product** | Clean Log                                                                                                                                     |

**Scope lock:** This DAP implements **v1** per S2 §2 / §5. **Out of scope:** per-org Supabase Auth `From`, `worker_payment_allocation` for mail, BYO SMTP, multiple domains per org, optional **§14.3** webhooks/tags (listed as **Phase 1b** unless product pulls forward).

**Verify discipline:** After each major step, run the listed **verify** command before the next step. Do not skip rollback notes on DB steps.

---

## 0. Prerequisites

| #   | Prerequisite                                                                                                                                                                                                                                         | Verify                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| P0  | Read S2 in full, especially **§4** (from matrix, precedence), **§5**, **§6**, **§14**                                                                                                                                                                | N/A                            |
| P1  | Resend [Create Domain](https://resend.com/docs/api-reference/domains/create-domain), [Get Domain](https://resend.com/docs/api-reference/domains/get-domain), [Delete Domain](https://resend.com/docs/api-reference/domains/remove-domain) API shapes | OpenAPI matches implementation |
| P2  | Platform on Resend plan that supports **N** org domains (see [pricing](https://resend.com/pricing))                                                                                                                                                  | Ops confirmation               |
| P3  | `RESEND_API_KEY` has permissions to create/list/delete **domains** (not `sending_access`-only) for register/remove Edge functions                                                                                                                    | Staging test key               |

---

## 1. PRESERVE (constitution — do not regress)

- **PRESERVE-1:** When org has **no** verified custom domain, all sends behave as **today** (platform `RESEND_FROM_DOMAIN` + existing display names per mail kind), except where S2 **explicitly** changes copy (e.g. feedback `from` gains org display name).
- **PRESERVE-2:** `validateEmailConfig()`, `RESEND_TEST_MODE`, `SKIP_EMAIL_SENDING` behavior for **invoice/payment/feedback** paths that already honor them — keep semantics; only change **`from` construction** and add **`resolveOrgMailFrom`** where needed.
- **PRESERVE-3:** `RESEND_ADMIN_INVITES_FROM_DOMAIN` **precedence** over org domain for **admin invitation** mail only — see S2 **§4.4** steps **2–3**; lock with unit tests.
- **PRESERVE-4:** **Org signup verification** mail stays **platform** domain + **Clean Log** display name (S2 **§4.4** step **1**).

---

## 2. Data model & migration

| Step | ID  | Action                                                                                                                                                                                                                                                                                                                                                                               | File(s)                                                                           | Notes                                                | Verify                                                              |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| 2.1  | M1  | Add table **`organization_sending_domain`** per S1 §3.2 / S2 §5.1. Columns: `id`, `organization_id` (FK, ON DELETE CASCADE), `resend_domain_id`, `domain_name` (unique globally), `resend_status`, `display_status` (check), `dns_records_snapshot` (JSONB nullable), `sending_region` (text), `enabled` (bool default true), `created_at`, `updated_at`. `UNIQUE(organization_id)`. | `database/supabase/migrations/YYYYMMDDHHMMSS_add_organization_sending_domain.sql` | Add `updated_at` trigger if project pattern uses it. | `supabase db reset` (local) or `supabase migration up` — no errors. |
| 2.2  | M2  | **RLS:** `SELECT` for authenticated users where `organization_id` in (`SELECT organization_id FROM organization_user WHERE auth_user_id = auth.uid()` and role = admin) — align with S2 §5.1 and existing `organization` RLS patterns. **No** broad `INSERT`/`UPDATE` to client; mutations via Edge only.                                                                            | Same migration (or follow-up)                                                     | Least privilege; follow gold review.                 | Policy smoke test with test JWT (or integration doc).               |
| 2.3  | M3  | **Entitlement (pick one — S2 §5.7):** Add **`custom_email_domain_enabled BOOLEAN NOT NULL DEFAULT false`** on **`organization`** (Option A) **or** JSON flag in `organization_settings` (Option B). DAP default: **Option A** for clarity.                                                                                                                                           | Same or adjacent migration                                                        | Blocks register Edge when false.                     | Migration applies cleanly.                                          |
| 2.4  | M4  | Rollback: document `down` drop order (child table, then column if added) or manual SQL in migration comment.                                                                                                                                                                                                                                                                         | Migration file footer                                                             |                                                      | Reviewer can reverse in staging.                                    |

**Dependency:** 2.1 before all Edge work that reads the table.

---

## 3. Shared types & mail resolution (Deno)

| Step | ID  | Action                                                                                                                                                                                                                                                                                                                                                                   | File(s)                                                                       | Notes                                                    | Verify                                                                         |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 3.1  | T1  | Define **`MailKind`** enum / union matching S2 **§4.4** (`org_signup_verification`, `admin_user_invitation`, `worker_invitation`, `invoice`, … all distinct kinds used in `email.ts`).                                                                                                                                                                                   | `database/supabase/functions/_utils/org-mail-from.ts` (new) and/or `types.ts` | Export for tests.                                        | `deno check` on new file.                                                      |
| 3.2  | T2  | Implement **`resolveOrgMailFrom({ supabase, organizationId, organizationName, mailKind })`** per **S2 §4.4** precedence and **§4** local-part matrix. Return `{ from: string, fromDomainSource: 'org' \| 'platform' }`. Load `organization_sending_domain` with **service-role** client pattern used in other senders. Constants for Resend `verified` status string(s). | `database/supabase/functions/_utils/org-mail-from.ts`                         | On DB read error: **fallback** platform + log (S1 §3.7). | `deno test database/supabase/functions/_utils/__tests__/org-mail-from.test.ts` |
| 3.3  | T3  | Unit tests: matrix — verified org domain; pending; no row; `enabled=false`; `org_signup_verification` always platform; `admin_user_invitation` with/without `RESEND_ADMIN_INVITES_FROM_DOMAIN`; DB throws.                                                                                                                                                               | `database/supabase/functions/_utils/__tests__/org-mail-from.test.ts` (new)    | **Must** lock §4.4 order.                                | `deno test` passes.                                                            |
| 3.4  | T4  | (Optional **Phase 1b**) Add **`buildEmailTags({ organizationId, mailKind })`** for Resend **tags** array — S2 **§14.3**; can ship after core.                                                                                                                                                                                                                            | `org-mail-from.ts` or `email.ts`                                              | Sanitize values per Resend tag rules.                    | Tests optional in v1.                                                          |

---

## 4. Refactor `email.ts`

| Step | ID  | Action                                                                                                                                    | File(s)                                       | Notes                                                                              | Verify                                                                                                         |
| ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 4.1  | E1  | Replace each inline `from: …@${config.resendFromDomain}` (and variants) with **`resolveOrgMailFrom`** + **`mailKind`** at each send site. | `database/supabase/functions/_utils/email.ts` | **PRESERVE** §1. Inventory all `fetch("https://api.resend.com/emails"` call sites. | `deno test` for existing `email` tests; grep shows no raw `resendFromDomain` in `from` except inside resolver. |
| 4.2  | E2  | Add structured log fields: `organization_id` (where available), `mail_kind`, `from_domain_source`.                                        | `email.ts`                                    | No recipient PII at info level (S2 §6).                                            | Log review in staging.                                                                                         |
| 4.3  | E3  | **429:** ensure existing or new bounded retry on Resend `fetch` (S2 §5.3).                                                                | `email.ts`                                    | Cap attempts.                                                                      | Unit or integration with mock.                                                                                 |

---

## 5. Refactor `feedback-email.ts` & callers

| Step | ID  | Action                                                                                                                                                            | File(s)                                                | Notes | Verify                                                |
| ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----- | ----------------------------------------------------- |
| 5.1  | F1  | Add **`organizationId: string`** to **`FeedbackEmailData`**.                                                                                                      | `database/supabase/functions/_utils/feedback-email.ts` |       | Typecheck.                                            |
| 5.2  | F2  | Use **`resolveOrgMailFrom`** for feedback send; set **`from`** to **`{organizationName} <noreply@…>`** (S2 §4 matrix).                                            | `feedback-email.ts`                                    |       | `deno test` `_utils/__tests__/feedback-email.test.ts` |
| 5.3  | F3  | **create-job:** pass **`organizationId`** from `job` / request context into `FeedbackEmailData`.                                                                  | `create-job/index.ts`                                  |       | Integration test or manual.                           |
| 5.4  | F4  | **admin-create-job:** same.                                                                                                                                       | `admin-create-job/index.ts`                            |       |                                                       |
| 5.5  | F5  | **send-feedback-email:** load job by `job_id` with service role, set **`organizationId` = job.organization_id**; **reject** if body org mismatches (S2 **§4.5**). | `send-feedback-email/index.ts`                         |       | Adversarial test.                                     |
| 5.6  | F6  | Update fixtures in **`feedback-email.test.ts`**, **integration** tests.                                                                                           | `__tests__/**`                                         |       | All `deno test` for feedback pass.                    |

---

## 6. New Edge Functions (domain lifecycle)

| Step | ID  | Action                                                                                                                                                                                                                                                                                                    | File(s)                                                                          | Notes                                                                      | Verify                                 |
| ---- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| 6.1  | G1  | **`register-org-sending-domain`:** Auth JWT; assert org **admin** + **`custom_email_domain_enabled`**; idempotent create/upsert; `POST` Resend create domain; store `resend_domain_id`, snapshot records; handle Resend “domain exists” (GET/list); enforce **`UNIQUE(domain_name)`** and friendly error. | `database/supabase/functions/register-org-sending-domain/index.ts` + `deno.json` | Rate-limit (per-IP / per-org) — e.g. middleware or counter table; S2 §5.2. | `curl` / integration with mock Resend. |
| 6.2  | G2  | **`refresh-org-sending-domain-status`:** GET domain from Resend; update `resend_status`, `display_status`, `dns_records_snapshot`.                                                                                                                                                                        | `database/supabase/functions/refresh-org-sending-domain-status/index.ts`         | Cooldown for “Check DNS” abuse.                                            |                                        |
| 6.3  | G3  | **`remove-org-sending-domain`:** Resend delete domain; delete or soft-disable row; **entitlement** check.                                                                                                                                                                                                 | `database/supabase/functions/remove-org-sending-domain/index.ts`                 |                                                                            |                                        |
| 6.4  | G4  | Register functions in **Supabase** (`config.toml` if local explicit list) and deploy.                                                                                                                                                                                                                     | `database/supabase/config.toml` if needed                                        |                                                                            | `supabase functions serve` / deploy.   |
| 6.5  | G5  | **Secrets:** document **`RESEND_SENDING_REGION`** (or use env default in code) for create-domain body.                                                                                                                                                                                                    | `docs/…` or `.env.example`                                                       | S2 §5.2.                                                                   | Staging.                               |

**Orphan domain:** if Resend create succeeds and DB write fails, log + ops playbook (S2 §6); DAP: **try** `DELETE` domain on Resend in `catch` after failed upsert, or open incident idempotency.

---

## 7. Dashboard

| Step | ID  | Action                                                                                                               | File(s)                                                  | Notes                 | Verify       |
| ---- | --- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------- | ------------ |
| 7.1  | D1  | New section **Settings → Email & domain** (or sub-route) gated by **`custom_email_domain_enabled`** (read from org). | `dashboard/app/dashboard/settings/page.tsx` or new route | States: S2 §5.5.      | Manual E2E.  |
| 7.2  | D2  | UI: list DNS records (from refresh API), **Copy** buttons, **Check DNS**, **Remove**, **Add domain** wizard.         | New components under `dashboard/components/…`            | Debounce “Check DNS”. |              |
| 7.3  | D3  | Call Edge functions via `supabase.functions.invoke` with session.                                                    | Hook or service                                          |                       |              |
| 7.4  | D4  | **AU disclaimer** snippet (S1 §2.7) for worker payments / email settings area.                                       | Settings or `rate-card` adjacent                         |                       | Copy review. |
| 7.5  | D5  | **Optional** banner when entitled but not verified (S2 §5.5).                                                        | Layout or settings                                       |                       |              |

**Shared types:** Update dashboard **`ModifierType`** / API types only if this feature adds TS contracts for domain DTOs — new types file `lib/types/org-sending-domain.ts` if needed.

---

## 8. `worker_payment_allocation` in calculate-worker-payment

S2 / S1: **remove** `worker_payment_allocation` query and wiring from **`calculate-worker-payment`** if still present (S2 F&F v1), to avoid dead code. **PRESERVE** calculator outputs for existing jobs — only remove **fetch + unused variable**; do not change **math** in same PR unless S2 says so. If removal is **not** in repo, mark step **N/A** in S5 and skip.

| Step | ID  | Action                                                                                          | Verify                       |
| ---- | --- | ----------------------------------------------------------------------------------------------- | ---------------------------- |
| 8.1  | C0  | Grep `worker_payment_allocation` in `calculate-worker-payment`. Remove unused fetch if present. | `deno test` calculator tests |

_Note: S2 `org-resend` doc also references worker payment split work — this step is **only** the allocation **dead-code removal** called out in S2; do **not** conflate with **split_weight** (separate DAP)._

---

## 9. Documentation & operations

| Step | ID  | Action                                                                                                                               | File(s)                                    | Verify        |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------- |
| 9.1  | O1  | Admin help: DNS steps, propagation times, DMARC optional, troubleshooting.                                                           | `docs/admin/` or `docs/user-guides/` (new) | Human review. |
| 9.2  | O2  | Internal: bounce/spam runbook, Resend team suspension risk (S2 §14.3).                                                               | `docs/operations/` (new)                   |               |
| 9.3  | O3  | Update **`docs/research/email-resend-implementation-review.md`** with link to S4 + per-org from resolution (optional one paragraph). |                                            |               |

---

## 10. Phase 1b (optional, post-MVP or parallel track)

| Step | ID  | Action                                                                                         | Source       |
| ---- | --- | ---------------------------------------------------------------------------------------------- | ------------ |
| 10.1 | P1  | Resend **webhook** handler for `domain.verified` → update `organization_sending_domain`.       | S2 **§14.3** |
| 10.2 | P2  | **Tags** on every `emails.send` (`organization_id`, `mail_kind`).                              | S2 **§14.3** |
| 10.3 | P3  | Webhooks: `email.bounced` / `email.complained` → tenant-scoped handling; **`svix-id`** dedupe. | S2 **§14.3** |

---

## 11. Test matrix (acceptance — S2 §7 + §9 gate)

- [ ] `resolveOrgMailFrom` — all §4.4 permutations.
- [ ] `sendFeedbackRequestEmail` — includes `organizationId`; `from` shape.
- [ ] Unauthorized `register` (wrong org JWT).
- [ ] `domain_name` already used by another org.
- [ ] `register` idempotency (double submit).
- [ ] `send-feedback-email` rejects org mismatch vs job.
- [ ] E2E (optional): happy path add domain → verify (staging) → send invoice.
- [ ] `pnpm` dashboard lint/test for new components.

**Commands (batch before merge):**

```bash
# From repo root
cd database/supabase/functions && deno test _utils/__tests__/org-mail-from.test.ts _utils/__tests__/feedback-email.test.ts
# Plus any email unit tests
pnpm --filter dashboard lint
pnpm --filter dashboard test
```

---

## 12. Rollback

1. Revert PR / disable feature flag: **`custom_email_domain_enabled`** false for all orgs.
2. Edge functions: resolver **always** falls back to platform domain if table missing (defensive) — **PRESERVE** already covered.
3. DB: migration down in staging only if **no** org rows depend on it; production rollback needs data backup if verified domains exist.

---

## 13. Order of execution (summary)

1. Migrations **2.1–2.3**
2. **`org-mail-from`** + tests **3.1–3.3**
3. **Email + feedback** refactors **4.1, 5.1–5.6**
4. Edge **register / refresh / remove 6.1–6.4**
5. Dashboard **7.1–7.3** + disclaimer **7.4**
6. Dead-code **8.1** if applicable
7. Docs **9**
8. Optional **10**

---

_End of S4 — S5 build: execute in order with Article 1 (PRESERVE) and verification after each step._
