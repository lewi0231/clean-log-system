# S4 — Detailed Action Plan: Configurable customer feedback & review requests

| Field           | Value                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **Stage**       | S4 — Detailed Action Plan (execution-ready for S5)                                                              |
| **From**        | [`S2`](./S2-configurable-customer-feedback-reviews.md) · [`S3`](./S3-configurable-customer-feedback-reviews.md) |
| **Created**     | 2026-07-21                                                                                                      |
| **Gold review** | **2026-07-21 — complete** (see §16)                                                                             |
| **Adversarial** | **2026-07-21 — complete** (see §17)                                                                             |
| **Product**     | Tally Runner (Dashboard + Edge; **not** Mobile UI)                                                              |

**Scope lock:** Implements S2 v1 + S3 A1–A14. **Out:** Mobile UI, per-location public URLs, HTML editor, frequency cap, dual-read legacy flag, tightening **all** settings to admin-only.

**Verify discipline:** Run each step’s **Verify** before the next. Do not skip PRESERVE or rollback notes on DB steps.

**Complexity:** S = small · M = medium · L = large. **Priority:** P0 = Slice A · P1 = Slice B/C.

**Migration naming:** Proposed timestamps `2026072112xxxx` are free as of latest `20260717140000`. If another branch lands first, **bump** timestamps — do not collide.

---

## 0. Prerequisites

| #   | Prerequisite                                                           | Verify                                                                                            |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| P0  | Read S2 §§3–10, 16; skim S3 §§3–5, 9                                   | N/A                                                                                               |
| P1  | Local Supabase + Deno + pnpm workspace working                         | `pnpm --filter dashboard typecheck` (baseline)                                                    |
| P2  | Secrets plan: `FEEDBACK_REVIEW_BASE_URL`, `CRON_SHARED_SECRET`, Resend | §13                                                                                               |
| P3  | Job edit path is `update-job` (not `edit-job`)                         | `database/supabase/functions/update-job/index.ts` exists                                          |
| P4  | Staging: confirm whether `pg_cron` + `pg_net` are available            | `SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pg_net');` — drives M6 path (§2.6) |

---

## 1. PRESERVE (Article 1 — do not regress)

| ID             | Preserve                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PRESERVE-1** | Job **create** never fails because feedback email/outbox fails (log + continue).                                                                       |
| **PRESERVE-2** | `rating_config` + Ratings list/charts for **internal/both** submissions unchanged.                                                                     |
| **PRESERVE-3** | Invoice recipient resolution (`getInvoiceEmailRecipient`) semantics unchanged; feedback continues to call it.                                          |
| **PRESERVE-4** | `RESEND_TEST_MODE` / `SKIP_EMAIL_SENDING` / `resolveOrgMailFrom` for other mail kinds unchanged.                                                       |
| **PRESERVE-5** | Non-feedback fields on `update-organization-settings` keep today’s membership rules (only **feedback fields** + test-send become admin-only — S3 A10). |
| **PRESERVE-6** | Worker names still shown on `/review` (S2 L18); do not expand naming into email.                                                                       |
| **PRESERVE-7** | Never `ON DELETE CASCADE` from `job` → **`feedback`** (CSAT). **Outbox** may CASCADE from `job` (intentional).                                         |
| **PRESERVE-8** | `withdraw-job` remains hard delete for pending + edit window; only improve error copy if FK blocks.                                                    |
| **PRESERVE-9** | Do not invent a second Resend HTML builder; one path via `_utils/feedback-email.ts` + `_utils/feedback-send.ts`.                                       |

---

## 2. Deploy phasing (adversarial lock — was unsafe)

Do **not** run M5 (drop legacy column) or enable cron until Edge is live.

| Phase                       | Migrations / code                                                                | Gate before next                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Phase 1 — Schema + code** | M1–M4; W2–W4 code; C1–C3 (switch callers to `feedback_auto_send`)                | `rg 'feedback_email_send_immediately' --glob '!**/migrations/**' --glob '!docs/**' --glob '!**/*.md'` = **0** |
| **Phase 2 — Drop legacy**   | M5                                                                               | Staging Edge already reading `feedback_auto_send` only                                                        |
| **Phase 3 — Schedule**      | M6 (or Dashboard cron) **after** poller Edge deployed + `CRON_SHARED_SECRET` set | Poller curl with secret succeeds; without secret → 401/403                                                    |

---

## 3. W1 — Schema

| Step | ID  | Action                                                                                                                                                                                                                                                                                                                                                      | File(s)                                                                   | Cx  | Pri | Depends             | Verify                                                                   |
| ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --- | --- | ------------------- | ------------------------------------------------------------------------ |
| 3.1  | M1  | Add org columns per S2 §5.1; backfill `feedback_auto_send` from `feedback_email_send_immediately`                                                                                                                                                                                                                                                           | `database/supabase/migrations/20260721120000_feedback_request_config.sql` | M   | P0  | —                   | `cd database && supabase db reset` (or CI-equivalent) clean              |
| 3.2  | M2  | `location.feedback_requests_enabled BOOLEAN NOT NULL DEFAULT true`                                                                                                                                                                                                                                                                                          | `…/20260721120100_location_feedback_mute.sql`                             | S   | P0  | M1                  | Reset clean                                                              |
| 3.3  | M3  | Job: `feedback_mode_at_send`, `public_review_url_at_send` (nullable text)                                                                                                                                                                                                                                                                                   | `…/20260721120200_job_feedback_send_snapshots.sql`                        | S   | P0  | M1                  | Reset clean                                                              |
| 3.4  | M4  | Create `feedback_email_outbox` (S2 §5.3) + partial unique pending `job_id` + poller index + **`ENABLE ROW LEVEL SECURITY` + service-role-only policy in same file** (invoice outbox RLS was a **later** migration — do not assume) + `job_id ON DELETE CASCADE`                                                                                             | `…/20260721120300_feedback_email_outbox.sql`                              | L   | P0  | M1                  | Table + policy present; linter OK                                        |
| 3.5  | M5  | **Phase 2 only:** `DROP COLUMN feedback_email_send_immediately`                                                                                                                                                                                                                                                                                             | `…/20260721121000_drop_feedback_email_send_immediately.sql`               | S   | P0  | Phase 1 gate        | Grep gate above = 0                                                      |
| 3.6  | M6  | **Phase 3 only — pick one path after P4:**                                                                                                                                                                                                                                                                                                                  |                                                                           | M   | P0  | Phase 1 poller live | See below                                                                |
|      |     | **Path A (preferred if extensions exist):** migration schedules `cron.schedule('process-feedback-email-outbox', '*/5 * * * *', net.http_post(…))` with `Authorization` + `x-cron-secret`. May need `CREATE EXTENSION IF NOT EXISTS pg_cron` / `pg_net` if staging lacks them (Supabase-hosted often has them; bare local may not — **M6 must not assume**). | `…/20260721120400_schedule_feedback_email_outbox.sql`                     |     |     |                     | `SELECT * FROM cron.job WHERE jobname = 'process-feedback-email-outbox'` |
|      |     | **Path B (if extensions unavailable):** Document **Supabase Dashboard → Edge Functions → Schedules** (or ops runbook) every 5 min with same headers; migration file becomes a **commented template + runbook** only — still required deliverable.                                                                                                           | same path as runbook                                                      |     |     |                     | Staging schedule visible in Dashboard                                    |
| 3.7  | M7  | Rollback comments on each migration (order: unschedule → drop outbox → job cols → location → org / restore legacy)                                                                                                                                                                                                                                          | Footers                                                                   | S   | P0  | —                   | Reviewer can reverse                                                     |
| 3.8  | M8  | Sync `database/schema.sql` after migrations land (repo convention)                                                                                                                                                                                                                                                                                          | `database/schema.sql`                                                     | M   | P0  | M4+                 | Diff includes new objects                                                |

---

## 4. W2 — Template + send helper

| Step | ID  | Action                                                                                                                     | File(s)                                                                                                                                                 | Cx  | Pri | Depends | Verify                                                      |
| ---- | --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | ------- | ----------------------------------------------------------- |
| 4.1  | T1  | Escape all substitutions; plain body → escaped + `<br>`; `text/plain`; three CTA shapes; org `locale` (fallback `en-AU`)   | `database/supabase/functions/_utils/feedback-email.ts`                                                                                                  | L   | P0  | M1      | `pnpm test:edge-unit` — XSS case in feedback-email tests    |
| 4.2  | T2  | New `enqueueOrSendFeedback(…)` per S2 §5.3 / §6.2 (outbox upsert + claim + final gate)                                     | `database/supabase/functions/_utils/feedback-send.ts` (**new**)                                                                                         | L   | P0  | M4, T1  | New unit file green                                         |
| 4.3  | T3  | Unit tests: edit window; no recipient → no token; flagged/cancelled; mute; `is_test`; idempotent enqueue; public-only; XSS | `…/_utils/__tests__/feedback-send.test.ts`; update `…/_utils/__tests__/feedback-email.test.ts` **and** `…/__tests__/feedback-email-integration.test.ts` | M   | P0  | T2      | `pnpm test:edge-unit`                                       |
| 4.4  | T4  | Thin-wrap or replace `maybe-send-job-feedback-email.ts` → helper only                                                      | `…/create-job/handlers/maybe-send-job-feedback-email.ts`                                                                                                | S   | P0  | T2      | `rg maybeSendJobFeedbackEmail` → persistence (+ tests) only |

---

## 5. W3 — Create-path + legacy cutover

| Step | ID  | Action                                                                                       | File(s)                                                 | Cx  | Pri | Depends         | Verify                                                                        |
| ---- | --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --- | --- | --------------- | ----------------------------------------------------------------------------- |
| 5.1  | C1  | Persistence calls helper; swallow/log errors (PRESERVE-1)                                    | `…/create-job/handlers/run-create-job-persistence.ts`   | S   | P0  | T2              | `pnpm test:edge-unit`; smoke create-job (no dedicated create-job suite today) |
| 5.2  | C2  | **Delete** inlined feedback block **lines ~357–567** in `admin-create-job`; call helper      | `database/supabase/functions/admin-create-job/index.ts` | M   | P0  | T2              | Diff: no local Resend HTML; smoke admin create                                |
| 5.3  | C3  | Switch **full caller inventory** to `feedback_auto_send` (same PR as Phase 1 Edge deploy):   |                                                         | M   | P0  | M1              | `rg` gate in §2 Phase 1                                                       |
|      |     | • `maybe-send-job-feedback-email.ts`                                                         |                                                         |     |     |                 |                                                                               |
|      |     | • `admin-create-job/index.ts`                                                                |                                                         |     |     |                 |                                                                               |
|      |     | • `get-organization-settings/index.ts`                                                       |                                                         |     |     |                 |                                                                               |
|      |     | • `update-organization-settings/index.ts`                                                    |                                                         |     |     |                 |                                                                               |
|      |     | • `dashboard/app/dashboard/settings/page.tsx` (rename binding even if full F1 UI is Slice B) |                                                         |     |     |                 |                                                                               |
|      |     | • `dashboard/hooks/use-organization-settings.ts`                                             |                                                         |     |     |                 |                                                                               |
|      |     | • `dashboard/lib/types.ts` + `dashboard/lib/types/edge-contracts.ts`                         |                                                         |     |     |                 |                                                                               |
|      |     | • `dashboard/__tests__/components/settings/ratings-settings.test.tsx`                        |                                                         |     |     |                 |                                                                               |
|      |     | • `database/supabase/functions/__tests__/feedback-email-integration.test.ts`                 |                                                         |     |     |                 |                                                                               |
| 5.4  | C4  | Apply M5 (Phase 2)                                                                           | migration M5                                            | S   | P0  | §2 Phase 1 gate | Staging migrate                                                               |

**Slice A note:** Ships deferred send + outbox + auto-flag rename + safer gates. Full mode/template/mute **UI** is Slice B — backend uses DB defaults (`mode=internal`, `delay=0`, `feedback_requests_enabled=true`) until W5/W6.

---

## 6. W4 — Poller + registration

| Step | ID  | Action                                                                                                                                                                                              | File(s)                                                                            | Cx  | Pri | Depends | Verify                                                                |
| ---- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --- | --- | ------- | --------------------------------------------------------------------- |
| 6.1  | P1  | New `process-feedback-email-outbox`: require `x-cron-secret` === `Deno.env.get('CRON_SHARED_SECRET')`; claim loop S2 §6.4; reuse T2 send core. Copy `deno.json` from `auto-send-invoices/deno.json` | `database/supabase/functions/process-feedback-email-outbox/index.ts` + `deno.json` | L   | P0  | T2, M4  | `curl` without secret → 401/403; with secret → 200                    |
| 6.2  | P2  | `config.toml` (`verify_jwt = false`) + `functions-inventory.yaml` → **`privileged_batch`**                                                                                                          | `database/supabase/config.toml`, `…/functions-inventory.yaml`                      | S   | P0  | P1      | `pnpm validate:functions-inventory`                                   |
| 6.3  | P3  | Document `CRON_SHARED_SECRET` in ops (`database/README.md` and/or `e2e/.env.example` comment). **No** `database/supabase/functions/.env.example` exists — do not invent a silent no-op              | docs                                                                               | S   | P0  | P1      | Doc lists var                                                         |
| 6.4  | P4  | Phase 3: enable M6 Path A or B; insert deferred outbox row; wait ≤5 min                                                                                                                             | staging                                                                            | M   | P0  | P1, M6  | `SELECT status FROM feedback_email_outbox WHERE id = …` → `succeeded` |

---

## 7. W5 — Settings API + UI + test send

| Step | ID  | Action                                                                                                                                                                                                 | File(s)                                                          | Cx  | Pri | Depends | Verify                                                                                            |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | --- | --- | ------- | ------------------------------------------------------------------------------------------------- |
| 7.1  | S1  | GET returns new fields                                                                                                                                                                                 | `…/get-organization-settings/index.ts`                           | M   | P1  | M1      | GET JSON includes fields                                                                          |
| 7.2  | S2  | UPDATE: destructure feedback fields; if any feedback field present → `requireOrgAdminFromRequest` from `../_utils/org-sending-domain-edge.ts`; HTTPS `^https://`; mode/URL rules; lengths; delay 0–168 | `…/update-organization-settings/index.ts`                        | L   | P1  | M1      | Non-admin 403; `http://` URL 400                                                                  |
| 7.3  | S3  | Types/contracts/hooks (complete beyond C3 rename)                                                                                                                                                      | `dashboard/lib/types.ts`, `edge-contracts.ts`, `api.ts`, hooks   | M   | P1  | S1      | `pnpm --filter dashboard typecheck`                                                               |
| 7.4  | S4  | Settings UI per S2 F1; non-admin disabled                                                                                                                                                              | `dashboard/app/dashboard/settings/page.tsx` (+ optional extract) | L   | P1  | S3      | `pnpm --filter dashboard exec vitest run __tests__/components/settings/ratings-settings.test.tsx` |
| 7.5  | S5  | New `send-feedback-test-email` (+ `deno.json`, config.toml, inventory `secured` or admin-gated)                                                                                                        | `database/supabase/functions/send-feedback-test-email/`          | M   | P1  | T1      | Admin → email; viewer 403                                                                         |
| 7.6  | S6  | Wire test button; update edge-contracts invoke map                                                                                                                                                     | settings page + `edge-contracts.ts`                              | S   | P1  | S5      | Manual                                                                                            |

---

## 8. W6 — Location mute

| Step | ID  | Action                                                                                                | File(s)                                                    | Cx  | Pri | Depends | Verify             |
| ---- | --- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --- | --- | ------- | ------------------ |
| 8.1  | L1  | Explicit field on create/update (not passthrough) — avoid `pricing_mode` drift pattern                | `…/create-location/index.ts`, `…/update-location/index.ts` | M   | P1  | M2      | Persist round-trip |
| 8.2  | L2  | `Location` + `CreateLocationRequest` / `UpdateLocationRequest` in `dashboard/lib/types.ts` + `api.ts` | types                                                      | S   | P1  | M2      | typecheck          |
| 8.3  | L3  | Form toggle + list badge                                                                              | `location-form.tsx`, `location-list.tsx`                   | M   | P1  | L2      | Manual UI          |

---

## 9. W7 — Public review

| Step | ID  | Action                                                                                   | File(s)                                 | Cx  | Pri | Depends | Verify                            |
| ---- | --- | ---------------------------------------------------------------------------------------- | --------------------------------------- | --- | --- | ------- | --------------------------------- |
| 9.1  | R1  | `get-job-by-token`: snapshots + `approval_status` + `reject_reason`; keep IP rate limits | `…/get-job-by-token/index.ts`           | M   | P1  | M3      | Cancelled/flagged → reject_reason |
| 9.2  | R2  | `submit-feedback`: reject flagged/cancelled; keep 409; keep rate limits                  | `…/submit-feedback/index.ts`            | M   | P1  | —       | Tests / manual                    |
| 9.3  | R3  | `/review/[token]` dual CTA + copy                                                        | `dashboard/app/review/[token]/page.tsx` | L   | P1  | R1      | Manual                            |
| 9.4  | R4  | `withdraw-job` clearer FK error                                                          | `…/withdraw-job/index.ts`               | S   | P1  | —       | Documented message                |

---

## 10. W8 — Completed jobs + list-jobs + manual send

| Step | ID  | Action                                                                                                                                                                                                                                                                                        | File(s)                                          | Cx  | Pri  | Depends | Verify                                                        |
| ---- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --- | ---- | ------- | ------------------------------------------------------------- |
| 10.1 | J1  | Batch-enrich `feedback_request_status` on `list-jobs` (same pattern as existing `has_feedback` enrichment ~L259–277); update `Job` type                                                                                                                                                       | `…/list-jobs/index.ts`, `dashboard/lib/types.ts` | L   | P1   | M4      | List payload includes status                                  |
| 10.2 | J2  | **P0 if Slice A needs working manual send; else P1:** Rewrite `send-feedback-email`: `.eq('auth_user_id', …)` (today wrongly uses `user_id` — **broken**); `requireOrgAdminFromRequest`; S2 §6.3 gates; call helper; keep `verify_jwt = true` unless ES256 forces otherwise — document choice | `…/send-feedback-email/index.ts`                 | L   | P0\* | T2      | Non-admin 403; edit window 400; confirm flags                 |
| 10.3 | J3  | Job detail chips/confirms — service already `jobs.service.ts` → `send-feedback-email`; **no new service file**                                                                                                                                                                                | `job-detail-dialog.tsx`                          | M   | P1   | J1, J2  | Manual                                                        |
| 10.4 | J4  | After successful `update-job` (near existing `autoGenerateInvoiceForJob` ~499–526): if pending outbox, recompute `send_after` or cancel. Scope: `completed_at` / `location_id` (handler does **not** update `approval_status` today)                                                          | `…/update-job/index.ts`                          | M   | P1   | M4, T2  | SQL: pending `send_after` changes when `completed_at` updates |

\*Promote J2 to Slice A if product needs manual send before Slice C.

---

## 11. W9 — Help & types hygiene

| Step | ID  | Action                                                                                                        | File(s)                                 | Cx  | Pri | Depends | Verify                             |
| ---- | --- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --- | --- | ------- | ---------------------------------- |
| 11.1 | H1  | Help FAQ rename                                                                                               | `dashboard/app/dashboard/help/page.tsx` | S   | P1  | S4      | Copy review                        |
| 11.2 | H2  | Release note in PR body (edit-window behaviour)                                                               | PR                                      | S   | P1  | —       | In PR                              |
| 11.3 | H3  | Env checklist §13                                                                                             | —                                       | S   | P0  | —       | Ops                                |
| 11.4 | H4  | Register new functions in `edge-contracts.ts` invoke map                                                      | `dashboard/lib/types/edge-contracts.ts` | S   | P1  | S5, P1  | typecheck                          |
| 11.5 | H5  | Mobile: **no UI**; shared org-settings types may ignore extra GET fields — optional sync only if build breaks | `@clean-log/shared` if needed           | S   | P1  | —       | Mobile typecheck if shared touched |

---

## 12. Test matrix (must pass before ship)

| #   | Scenario                                        | Command / method                                              |
| --- | ----------------------------------------------- | ------------------------------------------------------------- |
| V1  | XSS org name escaped in HTML                    | `pnpm test:edge-unit` (feedback-email)                        |
| V2  | Edit-window gate                                | feedback-send unit                                            |
| V3  | Withdraw before send → outbox CASCADE           | SQL + helper / integration                                    |
| V4  | Soft-cancel form reject                         | get-job-by-token / submit                                     |
| V5  | Kill switch cancels pending                     | poller unit                                                   |
| V6  | admin-create no inline send                     | `rg` + smoke                                                  |
| V7  | Cron/poller without secret → 401/403            | `curl`                                                        |
| V8  | Settings non-admin cannot write feedback fields | edge test                                                     |
| V9  | Manual send: auth_user_id + admin + edit window | send-feedback-email tests                                     |
| V10 | No token without recipient                      | feedback-send unit                                            |
| V11 | Dashboard                                       | `pnpm --filter dashboard typecheck` + ratings-settings vitest |
| V12 | Inventory                                       | `pnpm validate:functions-inventory`                           |
| V13 | Legacy column gone only after Phase 2           | Phase gates §2                                                |
| V14 | Extensions / Path B cron                        | P4 + M6 path chosen                                           |

---

## 13. Env & ops checklist

| Env var                    | Where                             | Notes               |
| -------------------------- | --------------------------------- | ------------------- |
| `FEEDBACK_REVIEW_BASE_URL` | Edge                              | Existing            |
| `CRON_SHARED_SECRET`       | Edge secrets + scheduler headers  | New; per-env rotate |
| Resend                     | Existing                          | Unchanged           |
| Scheduler                  | pg_cron **or** Dashboard schedule | After poller deploy |

---

## 14. Suggested commit / PR slicing

| Slice   | Steps                                        | Note                                        |
| ------- | -------------------------------------------- | ------------------------------------------- |
| **A**   | §§3–6 Phase 1 (+ J2 if manual send required) | Safer auto-send; rename flag; outbox+poller |
| **B**   | §§7–8                                        | Settings + locations + test send            |
| **C**   | §§9–11                                       | Public review + completed jobs + help       |
| **A.2** | M5 then M6                                   | After Edge live                             |

Prefer one staging promote for A+B+C when possible; never M5 before C3 deploy.

---

## 15. S4 completion gate (before S5)

- [x] Gold + adversarial amendments applied
- [ ] Every S3 workstream W1–W9 has steps
- [ ] PRESERVE-1…9 acknowledged
- [ ] Deploy phasing §2 understood
- [ ] M6 Path A vs B chosen from P4
- [ ] Stakeholder **G4** / proceed-to-S5

---

## 16. Gold review record (2026-07-21)

| #   | Assumption                            | Challenge                                              | Resolution                           |
| --- | ------------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| G1  | Mirror invoice outbox RLS in one step | Invoice RLS was a **later** migration                  | M4 includes RLS in-file              |
| G2  | `supabase migration up`               | Project/CI use `db reset` / `start`                    | Verify = `supabase db reset`         |
| G3  | `.env.example` under functions/       | **Missing**                                            | Document in README / e2e example     |
| G4  | create-job test suite exists          | **None**                                               | Smoke + edge-unit; optional new test |
| G5  | Vague “edit-job”                      | Real handler is `update-job`                           | J4 scoped to actual fields           |
| G6  | New Edge needs only index.ts          | Need `deno.json` + config + inventory + edge-contracts | P1/S5/H4                             |
| G7  | jobs.service missing for send         | **Exists**                                             | J3 UI-only                           |
| G8  | list-jobs hard to enrich              | Already has `has_feedback` batch pattern               | J1 feasible                          |
| G9  | admin-create “~200 lines”             | **~357–567**                                           | C2 cites range                       |
| G10 | Timestamps 20260721\*                 | Free after `20260717140000`                            | Note bump-if-needed                  |

---

## 17. Adversarial review record (2026-07-21)

| #   | Finding                                         | Severity     | Amendment                              |
| --- | ----------------------------------------------- | ------------ | -------------------------------------- |
| A1  | M6 assumes `pg_cron`/`pg_net` without provision | **Critical** | P4 + Path A/B; no blind schedule       |
| A2  | M5 can drop column before Edge deploy           | **Critical** | Deploy phasing §2                      |
| A3  | C3 incomplete caller list                       | **Critical** | Full inventory + `rg` gate             |
| A4  | `send-feedback-email` uses `user_id` (broken)   | **Critical** | J2 rewrite; P0 if Slice A needs manual |
| A5  | Cron secret doc pointed at nonexistent file     | **High**     | README / e2e example                   |
| A6  | CASCADE confusion outbox vs feedback            | **High**     | PRESERVE-7 clarified                   |
| A7  | schema.sql sync omitted                         | **Medium**   | M8                                     |
| A8  | integration test file omitted from C3/T3        | **Medium**   | Explicit paths                         |
| A9  | Slice A over-promised full configurability      | **High**     | Slice A note under §5                  |
| A10 | `update-job` “status-affecting” overclaim       | **Medium**   | J4 only `completed_at` / `location_id` |

### Hostile questions

- **“Will M6 apply on a fresh local DB?”** → Only if extensions exist or Path B is used.
- **“Can we migrate and deploy Edge separately?”** → Yes — that is why Phase 1/2/3 exist.
- **“Is manual send already working?”** → No — `user_id` bug; J2 is not optional polish.

---

## 18. Handoff

| Next           | Action                                                     |
| -------------- | ---------------------------------------------------------- |
| **S5 Build**   | Execute in order; stop on failed Verify; respect §2 phases |
| **Acceptance** | S2 §10 ACs 1–31                                            |
| **Copy**       | S2 §9                                                      |

---

_End of S4 — gold + adversarial reviewed. Proceed to S5 only after G4 / explicit build go-ahead._
