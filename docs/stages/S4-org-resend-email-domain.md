# S4 — Detailed Action Plan: Per-organization sending domain (Resend)

| Field                  | Value                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**              | S4 — Detailed Action Plan (execution-ready; S5 build)                                                                                           |
| **From**               | `S0` → `S1` → `S2` → [`S3`](./S3-org-resend-email-domain.md) (HLP), **§14** Resend alignment, `docs/research/resend-official-alignment-2026.md` |
| **Created**            | 2026-04-22                                                                                                                                      |
| **Gold review**        | 2026-04-12 — §14                                                                                                                                |
| **Adversarial review** | 2026-04-12 — §15                                                                                                                                |
| **Product**            | Clean Log                                                                                                                                       |

**Scope lock:** This DAP implements **v1** per S2 §2 / §5. **Out of scope:** per-org Supabase Auth `From`, BYO SMTP, multiple domains per org, optional **§14.3** webhooks/tags (listed as **Phase 1b** unless product pulls forward). _§8 is an optional **tangential** cleanup (`worker_payment_allocation` in `calculate-worker-payment`) only if that dead code exists — not part of core mail deliverables._

**Verify discipline:** After each major step, run the listed **verify** command before the next step. Do not skip rollback notes on DB steps.

---

## 0. Prerequisites

| #   | Prerequisite                                                                                                                                                                                                                                         | Verify                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| P0  | Read S2; skim [`S3`](./S3-org-resend-email-domain.md) for workstream order; deep-read **§4** (from matrix, precedence), **§5**, **§6**, **§14**                                                                                                      | N/A                            |
| P1  | Resend [Create Domain](https://resend.com/docs/api-reference/domains/create-domain), [Get Domain](https://resend.com/docs/api-reference/domains/get-domain), [Delete Domain](https://resend.com/docs/api-reference/domains/remove-domain) API shapes | OpenAPI matches implementation |
| P2  | Platform on Resend plan that supports **N** org domains (see [pricing](https://resend.com/pricing))                                                                                                                                                  | Ops confirmation               |
| P3  | `RESEND_API_KEY` has permissions to create/list/delete **domains** (not `sending_access`-only) for register/remove Edge functions                                                                                                                    | Staging test key               |

---

## 1. PRESERVE (constitution — do not regress)

- **PRESERVE-1:** When org has **no** verified custom domain, all sends behave as **today** (platform `RESEND_FROM_DOMAIN` + existing display names per mail kind), except where S2 **explicitly** changes copy (e.g. feedback `from` gains org display name).
- **PRESERVE-2:** `validateEmailConfig()`, `RESEND_TEST_MODE`, `SKIP_EMAIL_SENDING` behavior for **invoice/payment/feedback** paths that already honor them — keep semantics; only change **`from` construction** and add **`resolveOrgMailFrom`** where needed.
- **PRESERVE-3:** `RESEND_ADMIN_INVITES_FROM_DOMAIN` **precedence** over org domain for **admin invitation** mail only — see S2 **§4.4** steps **2–3**; lock with unit tests.
- **PRESERVE-4:** **Org signup verification** mail stays **platform** domain + **Clean Log** display name (S2 **§4.4** step **1**).
- **PRESERVE-5:** **Display name** and **`From`**-building inputs are safe for **RFC 5322** / Resend: no raw **CR/LF** or control characters from `organizationName` (or other user-influenced labels) in envelope fields (see **§3.2** / **§15**).

---

## 2. Data model & migration

| Step | ID  | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | File(s)                                                                           | Notes                                                            | Verify                                                              |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| 2.1  | M1  | Add table **`organization_sending_domain`** per S1 §3.2 / S2 §5.1. Columns: `id`, `organization_id` (FK, ON DELETE CASCADE), `resend_domain_id`, `domain_name` (unique globally), `resend_status`, `display_status` (check), `dns_records_snapshot` (JSONB nullable), `sending_region` (text), `enabled` (bool default true), `created_at`, `updated_at`. `UNIQUE(organization_id)`.                                                                                           | `database/supabase/migrations/YYYYMMDDHHMMSS_add_organization_sending_domain.sql` | Add `updated_at` trigger if project pattern uses it.             | `supabase db reset` (local) or `supabase migration up` — no errors. |
| 2.2  | M2  | **RLS:** `SELECT` allowed for rows where `organization_id` belongs to the caller’s org **and** the caller is an **active org admin** (e.g. `EXISTS (SELECT 1 FROM organization_user ou WHERE ou.organization_id = organization_sending_domain.organization_id AND ou.auth_user_id = auth.uid() AND ou.role = 'admin' AND ou.status = 'active')`) — align with S2 §5.1 and existing patterns. **No** client `INSERT`/`UPDATE`/`DELETE`; mutations via Edge + service role only. | Same migration (or follow-up)                                                     | Adjust column names to match `organization_user` if they differ. | Policy smoke test with test JWT (or integration doc).               |
| 2.3  | M3  | **Entitlement (pick one — S2 §5.7):** Add **`custom_email_domain_enabled BOOLEAN NOT NULL DEFAULT false`** on **`organization`** (Option A) **or** JSON flag in `organization_settings` (Option B). DAP default: **Option A** for clarity.                                                                                                                                                                                                                                     | Same or adjacent migration                                                        | Blocks register Edge when false.                                 | Migration applies cleanly.                                          |
| 2.3b | M3b | **S2 §5.8 (entitlement lapse):** Document in code + admin notes: on downgrade, set **`custom_email_domain_enabled = false`** (or equivalent) **and/or** `organization_sending_domain.enabled = false` so **`resolveOrgMailFrom`** immediately stops using org `from` (S2). Optional: keep Resend domain record for **N** days vs delete in **`remove-org-sending-domain`** — **product/ops** locks one approach; DAP must match.                                               | Resolver + `remove` Edge + `docs/operations`                                      | Prevents “free” custom domain after churn.                       | Unit test: entitled false → platform `from`.                        |
| 2.4  | M4  | Rollback: document `down` drop order (child table, then column if added) or manual SQL in migration comment.                                                                                                                                                                                                                                                                                                                                                                   | Migration file footer                                                             |                                                                  | Reviewer can reverse in staging.                                    |

**Dependency:** 2.1 before all Edge work that reads the table.

---

## 3. Shared types & mail resolution (Deno)

| Step | ID  | Action                                                                                                                                                                                                                                                                                                                                                                   | File(s)                                                                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Verify                                                                         |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 3.1  | T1  | Define **`MailKind`** enum / union matching S2 **§4.4** (`org_signup_verification`, `admin_user_invitation`, `worker_invitation`, `invoice`, … all distinct kinds used in `email.ts`).                                                                                                                                                                                   | `database/supabase/functions/_utils/org-mail-from.ts` (new) and/or `types.ts` | Export for tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `deno check` on new file.                                                      |
| 3.2  | T2  | Implement **`resolveOrgMailFrom({ supabase, organizationId, organizationName, mailKind })`** per **S2 §4.4** precedence and **§4** local-part matrix. Return `{ from: string, fromDomainSource: 'org' \| 'platform' }`. Load `organization_sending_domain` with **service-role** client pattern used in other senders. Constants for Resend `verified` status string(s). | `database/supabase/functions/_utils/org-mail-from.ts`                         | On DB read error: **fallback** platform + log (S1 §3.7). **S2 §5.8:** if org **`custom_email_domain_enabled`** is false or row **`enabled`** is false, use platform domain for `@` (still apply §4.4 for display name / signup exception). **Header injection:** strip **CR / LF** (and other control chars) from **`organizationName`** (and any display segment) before building **`From`** — adversarial org names must not break headers or smuggle second headers. | `deno test database/supabase/functions/_utils/__tests__/org-mail-from.test.ts` |
| 3.3  | T3  | Unit tests: matrix — verified org domain; pending; no row; `enabled=false`; `org_signup_verification` always platform; `admin_user_invitation` with/without `RESEND_ADMIN_INVITES_FROM_DOMAIN`; DB throws; **CRLF** / control chars in `organizationName` (see **§3.2**).                                                                                                | `database/supabase/functions/_utils/__tests__/org-mail-from.test.ts` (new)    | **Must** lock §4.4 order.                                                                                                                                                                                                                                                                                                                                                                                                                                               | `deno test` passes.                                                            |
| 3.4  | T4  | (Optional **Phase 1b**) Add **`buildEmailTags({ organizationId, mailKind })`** for Resend **tags** array — S2 **§14.3**; can ship after core.                                                                                                                                                                                                                            | `org-mail-from.ts` or `email.ts`                                              | Sanitize values per Resend tag rules.                                                                                                                                                                                                                                                                                                                                                                                                                                   | Tests optional in v1.                                                          |

---

## 4. Refactor `email.ts`

| Step | ID  | Action                                                                                                                                                                                                                                                          | File(s)                                       | Notes                                                                              | Verify                                                                                                         |
| ---- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 4.1  | E1  | Replace each inline `from: …@${config.resendFromDomain}` (and variants) with **`resolveOrgMailFrom`** + **`mailKind`** at each send site.                                                                                                                       | `database/supabase/functions/_utils/email.ts` | **PRESERVE** §1. Inventory all `fetch("https://api.resend.com/emails"` call sites. | `deno test` for existing `email` tests; grep shows no raw `resendFromDomain` in `from` except inside resolver. |
| 4.2  | E2  | Add structured log fields: `organization_id` (where available), `mail_kind`, `from_domain_source`.                                                                                                                                                              | `email.ts`                                    | No recipient PII at info level (S2 §6).                                            | Log review in staging.                                                                                         |
| 4.2b | E2b | **S2 §6 state drift:** if send returns **4xx** from Resend and DB still says “verified,” log + **optional** best-effort refresh of `organization_sending_domain` or single retry with platform `from` — full **periodic job / webhook** is Phase 1b (S2 §14.3). | `email.ts` or caller                          | Do not block job completion on refresh.                                            | Staging: delete domain in Resend UI → next send still succeeds (fallback).                                     |
| 4.3  | E3  | **429:** ensure existing or new bounded retry on Resend `fetch` (S2 §5.3).                                                                                                                                                                                      | `email.ts`                                    | Cap attempts.                                                                      | Unit or integration with mock.                                                                                 |

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

| Step | ID  | Action                                                                                                                                                                                                                                                                                                                                                                                             | File(s)                                                                          | Notes                                                                                       | Verify                                       |
| ---- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 6.0  | G0  | **IDOR / trust boundary:** **Never** take **`organization_id`** (or target row id) from request body as authoritative. Derive org from **JWT** + **`organization_user`** membership; scope **every** query/mutation to that org. Reject (403/400) if body omits or mismatches when a body field is for UX only.                                                                                    | All three domain Edge functions                                                  | Prevents **cross-tenant** register/refresh/remove. Same pattern as S2 **§5.2** / **§13.1**. | Negative tests in §11.                       |
| 6.1  | G1  | **`register-org-sending-domain`:** Auth JWT; assert org **admin** + **`custom_email_domain_enabled`**; idempotent create/upsert; `POST` Resend create domain; store `resend_domain_id`, snapshot records; handle Resend “domain exists” (GET/list); enforce **`UNIQUE(domain_name)`** and friendly error.                                                                                          | `database/supabase/functions/register-org-sending-domain/index.ts` + `deno.json` | Rate-limit (per-IP / per-org) — e.g. middleware or counter table; S2 §5.2.                  | `curl` / integration with mock Resend.       |
| 6.1b | G1b | **Change domain (same org):** If row exists with **different** `domain_name`, define **one** sequence, e.g.: **create** new domain in Resend → on **DB upsert** success, **DELETE** the previous domain in Resend (or use Resend’s documented update flow if it replaces in place) — avoid **permanently** running **two** verified domains for one org on quota, and avoid Resend/DB **orphans**. | `register-org-sending-domain`                                                    | If **delete old** fails after **new** is live, log + retry playbook (**O2**).               | Staging: switch `mail.a.com` → `mail.b.com`. |
| 6.2  | G2  | **`refresh-org-sending-domain-status`:** GET domain from Resend; update `resend_status`, `display_status`, `dns_records_snapshot` **only** for the caller’s org row (see **G0**).                                                                                                                                                                                                                  | `database/supabase/functions/refresh-org-sending-domain-status/index.ts`         | Cooldown for “Check DNS” abuse.                                                             |                                              |
| 6.3  | G3  | **`remove-org-sending-domain`:** Resend delete domain; delete or soft-disable row; **entitlement** + admin JWT (see **G0**). Behavior on **S2 §5.8** “keep N days in Resend” vs immediate delete must match **2.3b** product choice.                                                                                                                                                               | `database/supabase/functions/remove-org-sending-domain/index.ts`                 | Document chosen policy in O2.                                                               |                                              |
| 6.3b | G3b | **Resend account limits:** If Resend returns **4xx** “limit” / “plan” (wording TBD in OpenAPI), return **clear** JSON for ops (`retry_after` / upgrade copy); do **not** loop create.                                                                                                                                                                                                              | `register` / `refresh` as applicable                                             | S2 **§5.1** / pricing; may surface in dashboard banner.                                     | Mock 402/429 from Resend in test.            |
| 6.4  | G4  | Register functions in **Supabase** (`config.toml` if local explicit list) and deploy.                                                                                                                                                                                                                                                                                                              | `database/supabase/config.toml` if needed                                        |                                                                                             | `supabase functions serve` / deploy.         |
| 6.5  | G5  | **Secrets:** document **`RESEND_SENDING_REGION`** (or use env default in code) for create-domain body.                                                                                                                                                                                                                                                                                             | `docs/…` or `.env.example`                                                       | S2 §5.2.                                                                                    | Staging.                                     |

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

- [ ] `resolveOrgMailFrom` — all **§4.4** permutations (incl. **`RESEND_ADMIN_INVITES_FROM_DOMAIN`** on/off for admin invite).
- [ ] `RESEND_TEST_MODE` — same **`from`** resolution as production (S2 **§4.3**; no special-case bypass of verified org domain).
- [ ] `sendFeedbackRequestEmail` — includes `organizationId`; `from` shape **`{organizationName} <noreply@…>`**.
- [ ] **Regression:** spot-check each **S2 §4** matrix row (worker invite, invoice, payment, org signup, admin invite, feedback, etc.) for expected local part + domain source.
- [ ] Unauthorized `register` (wrong org JWT).
- [ ] `domain_name` already used by another org (DB + Resend conflict path).
- [ ] `register` idempotency (double submit).
- [ ] `send-feedback-email` rejects org mismatch vs job.
- [ ] **Entitlement:** `custom_email_domain_enabled` false → register **403/4xx**; resolver uses platform `from` (may combine 2.3b test).
- [ ] **IDOR / JWT (§6.0):** `refresh` / `remove` / `register` with **valid** user but **wrong** org in implicit scope, or **spoofed** `organization_id` in body (if any) → **rejected**; no cross-tenant row access.
- [ ] **Domain change (§6.1b):** org replaces domain A with B — no **orphan** Resend domains (or document acceptable transient state + cleanup); DB remains **`UNIQUE(organization_id)`**.
- [ ] **Resend plan / quota (§6.3b):** friendly error when Resend rejects for account limits.
- [ ] **Header injection:** `organizationName` containing **CR/LF** (and similar) is sanitized; **`From`** is still a single well-formed address (see **§3.2**).
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

1. Migrations **2.1–2.3** (+ **2.3b** policy notes as applicable)
2. **`org-mail-from`** + tests **3.1–3.3**
3. **Email + feedback** refactors **4.1, 4.2b, 5.1–5.6** (include **4.2** logging, **4.3** 429)
4. Edge **register / refresh / remove** **6.0**, **6.1–6.1b** / **6.2** / **6.3–6.3b**, **6.4–6.5** (G3 aligned with **2.3b**)
5. Dashboard **7.1–7.3** + disclaimer **7.4**
6. Dead-code **8.1** if applicable
7. Docs **9**
8. Optional **10**

---

## 14. Gold review (2026-04-12)

Independent pass: S4 vs **S2** acceptance and **S3** workstreams. Findings below were addressed in this doc where noted; any **residual** item is an explicit S5 check.

| Finding                                                                                                        | Severity | Resolution in S4                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RLS §2.2** used ambiguous / invalid pseudo-SQL (`IN (` … `and role = admin)`) and omitted **`status`**.      | High     | Replaced with **`EXISTS`** pattern using **`role = 'admin'`** and **`status = 'active'`** (see schema `organization_user`).                                                                             |
| **S2 §5.8** (entitlement lapse) had no DAP step — resolver could drift from product on downgrade.              | High     | **§2.3b** + **§6.3** cross-link; resolver must read entitlement + row **`enabled`**.                                                                                                                    |
| **S2 §6** “state drift” (Resend UI delete vs DB verified) not actionable in send path.                         | Medium   | **§4.2b** — log + light-touch fallback/refresh; full automation deferred to **§10** / §14.3.                                                                                                            |
| **S2 §4.3** `RESEND_TEST_MODE` not in test matrix.                                                             | Medium   | **§11** checkbox added.                                                                                                                                                                                 |
| **S2 §4** matrix: DAP only said “all permutations” — easy to under-test rare kinds.                            | Medium   | **§11** “spot-check each matrix row.”                                                                                                                                                                   |
| **Scope lock** listed `worker_payment_allocation` “for mail” while **§8** is calculator dead code — confusing. | Low      | **Scope lock** clarified; **§8** kept as optional tangential.                                                                                                                                           |
| **S2 §8 rollout** (dark / internal / beta) not reflected as explicit DAP steps.                                | Low      | _Residual:_ use **`custom_email_domain_enabled`** (and optional UI flag) to gate dashboard section per product; not duplicated as extra rows — add in S5 if a separate `NEXT_PUBLIC_` flag is required. |
| **Verify commands** assume `cd database/supabase/functions` — monorepo may expose `pnpm`/script wrappers.      | Low      | _Residual:_ align with `package.json` scripts in S5.                                                                                                                                                    |

**Gate:** S5 may proceed when **§11** (updated), the full **§1 PRESERVE** list, and **§15.5** adversarial checkboxes are satisfied for the same commit series.

---

## 15. Adversarial review (2026-04-12)

Red-team pass on this DAP: **trust boundaries**, **abuse**, and **edge cases** not obvious from happy-path steps. Aligned with S2 **§13**; mitigations are **in-DAP** (§6.0, §3.2, **§6.1b/6.3b**, **§11**) unless noted _residual_.

### 15.1 Attacker model (who are we stopping?)

| Actor                                      | Capability                                                                               | Design response                                                                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User with valid JWT, wrong org in mind** | Call Edge with **another** org’s id in body or try to **guess** row ids                  | **§6.0** — org from JWT + membership only; no trust in body `organization_id` for authorization.                                                                                    |
| **Org admin insider**                      | **Burn** Resend domain slots, **spam** “Check DNS,” **typosquat**-adjacent display names | Rate limits (§6.1, §6.2), **entitlement** (§2.3), support tooling in **O2**; display-name **strip** (§3.2) for header safety, not for phishing _content_ (S2 **§13.3** _accepted_). |
| **Unauthenticated client**                 | Call domain Edge                                                                         | **401**; no service role in browser.                                                                                                                                                |
| **Feedback API caller**                    | **Spoof** `organizationId` to blame another org                                          | **§5.5** — `organizationId` from **job** re-query only; compare to caller or job.                                                                                                   |

### 15.2 Abuse cases and DAP coverage

| Attack / failure                                     | How it hurts                                                          | Mitigation in S4                                                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **IDOR** on refresh/remove                           | Read/update **another** tenant’s DNS / status                         | **§6.0** + tests §11.                                                                                                            |
| **Domain swap** / **double** Resend create           | **Quota** + orphan domains; inconsistent DB                           | **§6.1b** + **Orphan** paragraph after **§6**.                                                                                   |
| **CRLF in `organizationName`**                       | **Header split**, second **From**, log injection                      | **§3.2** note + **PRESERVE-5** + §11.                                                                                            |
| **Resend** account **domain cap**                    | All **registers** fail; support storm                                 | **§6.3b**; ops **P2**; dashboard message.                                                                                        |
| **“Domain in use”** error                            | **Intelligence** to attackers (“someone in Clean Log uses this name”) | _Residual:_ use **neutral** copy if product wants; S2 **§4.2** already requires clear failure — don’t list **other org’s** name. |
| **Concurrent** two admins, **register** + **remove** | Last op wins; odd transient state                                     | S3 **§7**; **§6.1b**; _residual_ rare — document support “**refresh** and retry.”                                                |
| **Service role in resolver**                         | If **`organizationId`** is **forged** by caller of `email.ts`         | Callers must pass **org from job/invoice** only — **S2 §4.5**; add **code review** gate on every `resolveOrgMailFrom` callsite.  |
| **Stolen JWT** (short-lived)                         | Attacker is **legit** admin for that org — **cannot** other org       | **§6.0** still prevents **cross-tenant**; _accepted_ S2 **§13.1** compromised admin.                                             |

### 15.3 Supply chain / config

| Risk                                        | Note                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| **`RESEND_API_KEY`** in client bundle       | **Never**; Edge-only (S2 **§5.2**). DAP: dashboard only **`functions.invoke`**. |
| **Wrong** `RESEND_SENDING_REGION` on create | Domain created in **unexpected** region; may fail or surprise ops               | **§6.5**; validate env at cold start in register. |

### 15.4 Residual risks (explicit)

| Risk                                                                       | Why not “fix” in v1 DAP                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Phishing** via **legit** verified domain (customer trusts **wrong** org) | Product/training; S2 **§13.3**; out of v1.                                                                    |
| **Resend** **compromise** of platform key                                  | Catastrophic; key rotation + monitoring — **O2**, not a code branch in DAP.                                   |
| **Punycode / IDN** homoglyph domains                                       | _Residual:_ if product requires, add **normalization/validation** in **G1** in S5; not blocked by current S2. |

### 15.5 Gate (adversarial)

- [ ] **§6.0** implemented and covered by **§11** IDOR cases.
- [ ] **§3.2** / **PRESERVE-5** + **§11** header-injection test.
- [ ] **§6.1b** domain-change path decided and tested or explicitly deferred with **no** double-live-domain **permanent** state.

---

_End of S4 — S5 build: execute in order with Article 1 (PRESERVE) and verification after each step._
