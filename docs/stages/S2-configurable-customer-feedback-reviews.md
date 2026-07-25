# S2 — Features & Functions: Configurable customer feedback & review requests

| Field              | Value                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Stage**          | S2 — Features & Functions (scope lock before S3 HLP / S4 DAP)                                                            |
| **From S1**        | [`S1-configurable-customer-feedback-reviews.md`](./S1-configurable-customer-feedback-reviews.md) (gold + adversarial ×2) |
| **From S0**        | [`S0-configurable-customer-feedback-reviews.md`](./S0-configurable-customer-feedback-reviews.md)                         |
| **Created**        | 2026-07-21                                                                                                               |
| **Gold review**    | **2026-07-21 — complete** (see §15)                                                                                      |
| **Adversarial**    | **2026-07-21 — complete** (RBAC, mid-flight outbox, send snapshots, cron auth — see §16)                                 |
| **Product**        | Tally Runner (Dashboard Settings + Locations + edge send path + public `/review`)                                        |
| **Not in product** | Mobile App UI                                                                                                            |

---

## 0. Gate status

| Gate             | Status                                      | Notes                                                                                            |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **G1 (S1)**      | **Assumed accepted with S2 defaults below** | Stakeholder may override any **D\*** default before G2                                           |
| **G2 (this S2)** | **Accepted (proceed-to-S3)**                | 2026-07-21 — stakeholder directed S3                                                             |
| **G3 (S3)**      | **Accepted (proceed-to-S4)**                | [`S3-configurable-customer-feedback-reviews.md`](./S3-configurable-customer-feedback-reviews.md) |
| **G4 (S4)**      | **Pending**                                 | [`S4-configurable-customer-feedback-reviews.md`](./S4-configurable-customer-feedback-reviews.md) |
| **Build (S5)**   | **Blocked** until G4                        | Explicit build go-ahead                                                                          |

**Why S2 is required:** S1 locks _what_ and _why_ under adversarial constraints. S2 locks _user-visible behaviour_, _state machines_, _API contracts_, and _copy_ so S3/S4/S5 do not invent product decisions. Outbox, dual create paths, Settings IA, and soft-cancel UX are too large to jump straight to code.

---

## 1. S1 locked decisions (carry forward)

| ID  | Decision                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Modes: `internal` \| `public` \| `both` (not `google`)                                                                                                                      |
| L2  | Org-wide `public_review_url` (HTTPS); per-location URLs → v1.1                                                                                                              |
| L3  | `both` → `/review/[token]` landing with **two equal CTAs**; no review gating; keep public CTA after private submit                                                          |
| L4  | Timing: `feedback_send_delay_hours` 0–168 + hard edit-window invariant                                                                                                      |
| L5  | Split `feedback_requests_enabled` vs `feedback_auto_send`                                                                                                                   |
| L6  | Plain-text subject/body + product CTAs; escape placeholders                                                                                                                 |
| L7  | Per-location mute; null location = mute N/A                                                                                                                                 |
| L8  | Recipients = invoice `email_recipient_config` (document in UI)                                                                                                              |
| L9  | Token only when queue/send + recipient exists                                                                                                                               |
| L10 | Withdraw = hard delete; missing-job UX; outbox `ON DELETE CASCADE`                                                                                                          |
| L11 | Soft-cancel (`cancelled`) exists — reject form; skip send                                                                                                                   |
| L12 | Do **not** CASCADE-delete `feedback` rows to unblock withdraw                                                                                                               |
| L13 | Block manual send while edit window open                                                                                                                                    |
| L14 | Skip auto-send for `is_test`, `flagged`, `cancelled`                                                                                                                        |
| L15 | API enforces resend / already-submitted rules                                                                                                                               |
| L16 | Shared send helper — delete `admin-create-job` inlined copy                                                                                                                 |
| L17 | **Dedicated feedback outbox + dedicated poller** (table shape inspired by `invoice_send_outbox`; **do not** assume invoice auto-send reads that outbox — it does not today) |
| L18 | Worker names in email out of v1; `/review` worker names unchanged                                                                                                           |
| L19 | Review gating forbidden                                                                                                                                                     |

---

## 2. S2 defaults for open G1 items (override before G2 if needed)

| ID     | Question                                                   | **S2 locked default** | Rationale                                                                                                         |
| ------ | ---------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **D1** | Delay + edit-window for auto **and** manual?               | **Yes**               | Prevents feedback→withdraw FK deadlock                                                                            |
| **D2** | Existing auto-send orgs wait for edit window at delay `0`? | **Yes**               | Safer; release-note the behaviour change                                                                          |
| **D3** | Plain-text templates in v1?                                | **Yes**               | XSS / gating risk                                                                                                 |
| **D4** | Org-wide public URL?                                       | **Yes**               | Per-yard → v1.1                                                                                                   |
| **D5** | New-org auto-send default?                                 | **`false`**           | Matches DB default + `register-organization` today. **Overrides** any S1 wording that said new orgs auto-send on. |
| **D6** | Cancelled / flagged jobs stop accepting review links?      | **Yes**               | Integrity                                                                                                         |

---

## 3. Product boundaries

| In scope                                               | Out of scope                             |
| ------------------------------------------------------ | ---------------------------------------- |
| Org Settings → Feedback & review requests card         | Mobile screens                           |
| Location mute toggle + list badge                      | Hierarchy-level mute                     |
| Shared edge send helper + **new** outbox poller + cron | Native Google API posting                |
| `/review/[token]` dual-CTA landing + status rejects    | Free-form HTML email body                |
| Completed-job feedback status + manual send UX         | Separate feedback recipient rules (v1.1) |
| Help copy update for new toggle names                  | Frequency cap (v1.1); SMS; review gating |
| Server-side HTTPS validation for `public_review_url`   | Client-only URL validation               |

### 3.1 RBAC matrix (adversarial lock — was under-specified)

| Action                                                                         | Role           | Notes                                                                                                                                                |
| ------------------------------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Update feedback settings (enable, auto, mode, URL, templates, delay, Reply-To) | **admin only** | Today `update-organization-settings` allows any “member” including workers — **must tighten** for these fields (prefer `requireOrgAdminFromRequest`) |
| F9 test send                                                                   | **admin only** |                                                                                                                                                      |
| Manual / resend feedback email on a job                                        | **admin only** | Matches completed-jobs UI `isAdmin` gate                                                                                                             |
| View job feedback status chips                                                 | admin + viewer | Read-only for viewers                                                                                                                                |
| Location mute toggle                                                           | **admin only** | Same as other location mutations                                                                                                                     |

**Auth rewrite (P0):** `send-feedback-email` today queries `organization_user.user_id` — column is **`auth_user_id`**. S5 must use the shared membership helpers and scope by `job.organization_id`. Reject client-supplied `organization_id` if it disagrees with the job.

**Mobile:** Feedback settings remain **dashboard-only** (no mobile-config surface).

---

## 4. Personas & user stories

| Persona       | Story                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Org admin** | I configure whether we ask for private feedback, a public review, or both — with my own copy — without writing HTML.                                                   |
| **Org admin** | I turn feedback off for one yard that should not get review emails.                                                                                                    |
| **Org admin** | I delay sends or rely on “as soon as allowed” knowing we never email while a worker can still withdraw the job.                                                        |
| **Org admin** | I send a test email to myself before enabling auto-send.                                                                                                               |
| **Org admin** | On a completed job I see why feedback was not sent (muted / no recipient / queued / failed) and can resend when allowed. **Viewers** may see status; they cannot send. |
| **Customer**  | I get a clear ask; for “both” I see private and public options equally; if the job was cancelled or withdrawn, the link explains itself.                               |
| **Worker**    | I can still withdraw inside the edit window without creating a customer review for a deleted job (product invariant).                                                  |

---

## 5. Domain model (v1 lock)

### 5.1 `organization` columns

All new feedback config lives on **`organization`** (same as `rating_config` / legacy `feedback_email_send_immediately`) — **not** `organization_settings` JSON blobs.

| Column                      | Type                                  | Default                                          | Notes                                                 |
| --------------------------- | ------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `feedback_requests_enabled` | `BOOLEAN NOT NULL`                    | `true`                                           | Master kill switch (**new** — no master switch today) |
| `feedback_auto_send`        | `BOOLEAN NOT NULL`                    | backfill from legacy; column default **`false`** | New orgs inherit `false` (D5)                         |
| `feedback_request_mode`     | `TEXT` check ∈ `internal,public,both` | `internal`                                       |                                                       |
| `public_review_url`         | `TEXT` nullable                       | null                                             | Required when mode ∈ `{public,both}`                  |
| `feedback_email_subject`    | `TEXT` nullable                       | null → product default                           | ≤ 200                                                 |
| `feedback_email_body`       | `TEXT` nullable                       | null → product default                           | ≤ 10k; plain text                                     |
| `feedback_email_reply_to`   | `TEXT` nullable                       | null                                             | Valid email or null                                   |
| `feedback_send_delay_hours` | `INTEGER NOT NULL`                    | `0`                                              | 0–168                                                 |

**Legacy flag cutover (locked — not optional dual-read):**

Caller inventory that must flip in the **same PR** as the migration:

| Caller                                                          | Today                                   |
| --------------------------------------------------------------- | --------------------------------------- |
| `maybe-send-job-feedback-email.ts`                              | reads `feedback_email_send_immediately` |
| `admin-create-job/index.ts`                                     | reads same (inline)                     |
| `get-organization-settings` / `update-organization-settings`    | get/set same                            |
| `dashboard/.../settings/page.tsx` + `ratings-settings.test.tsx` | UI + tests                              |
| `dashboard/lib/types.ts` + `edge-contracts.ts` + settings hooks | types                                   |

**Steps:** add `feedback_auto_send` → backfill → switch all callers → stop writing legacy column → drop legacy in same or immediate follow-up migration (S3 names files). **No dual-read period.**

### 5.2 `location`

| Column                      | Type               | Default |
| --------------------------- | ------------------ | ------- |
| `feedback_requests_enabled` | `BOOLEAN NOT NULL` | `true`  |

**Wiring note (gold):** `create-location` / `update-location` use **explicit** insert/update objects (not passthrough). DAP must add the field to both edge handlers **and** `CreateLocationRequest` / `UpdateLocationRequest` / `Location` types / `location-form.tsx` / list badge. `list-locations` uses `select('*')` so reads work once the column exists — still update dashboard types. Avoid the existing `pricing_mode` drift pattern (typed in dashboard, missing from edge).

### 5.3 `feedback_email_outbox` (new)

| Column                                       | Type                                      | Notes                                                               |
| -------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| `id`                                         | `UUID` PK                                 |                                                                     |
| `job_id`                                     | `UUID` → `job(id)` **ON DELETE CASCADE**  |                                                                     |
| `organization_id`                            | `UUID` → `organization` ON DELETE CASCADE |                                                                     |
| `send_after`                                 | `TIMESTAMPTZ NOT NULL`                    |                                                                     |
| `status`                                     | `TEXT`                                    | `pending` \| `processing` \| `succeeded` \| `failed` \| `cancelled` |
| `attempts`                                   | `INT NOT NULL DEFAULT 0`                  |                                                                     |
| `last_error`                                 | `TEXT`                                    |                                                                     |
| `email_id`                                   | `TEXT`                                    | Resend id when sent                                                 |
| `mode_at_send`                               | `TEXT` nullable                           | Snapshot when send succeeds (or when queued for deferred)           |
| `public_review_url_at_send`                  | `TEXT` nullable                           | Snapshot for public/both                                            |
| `is_resend`                                  | `BOOLEAN NOT NULL DEFAULT false`          | Manual resend attempts                                              |
| `created_at` / `updated_at` / `processed_at` | timestamptz                               |                                                                     |
| `next_retry_at`                              | timestamptz nullable                      |                                                                     |

**Indexes:**

- Partial unique: **one `pending` row per `job_id`** (intentionally **stricter** than invoice outbox).
- Poller index on `(status, send_after, next_retry_at)`.

**RLS (locked):** Enable RLS; **service_role only**. Job-detail status via **edge payload only**.

**Enqueue idempotency (adversarial lock):** Single helper `enqueueOrSendFeedback(job)`:

1. Compute `send_after` + gates.
2. `INSERT … ON CONFLICT` on pending unique → no-op / refresh `send_after` if still pending.
3. If `send_after <= now()`: **claim the outbox row in-process** (set `processing`) and send — do **not** maintain a separate “inline only” code path that can race the poller.
4. Concurrent create-job / admin-create-job / manual must share this helper.

**Retries:** Max **5** → `failed`; backoff `min(2^attempts, 60)` minutes; optimistic `pending|failed → processing` claim.

**Resend after succeeded:** Allowed with confirm; creates a **new** outbox row (`is_resend=true`) or immediate claim — prior `succeeded` rows stay immutable. Still at most one `pending` per job.

### 5.4 Job fields (existing + display)

| Field                                                             | Role                                                                          |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `completed_at`                                                    | **Canonical** clock for delay math and `{{job_date}}` (matches today’s email) |
| `created_at`                                                      | Fallback only if `completed_at` null (should not happen on normal create)     |
| `feedback_token`, `feedback_email_sent`, `feedback_email_sent_at` | Tracking                                                                      |
| `feedback_mode_at_send`, `public_review_url_at_send`              | Snapshots written on successful send (for `/review` + audit)                  |
| `edit_window_expires_at`, `is_test`, `approval_status`            | Gates                                                                         |

**Do not** add CASCADE from `job` → `feedback`. Preserve CSAT.

---

## 6. Send eligibility & timing (state machine)

### 6.1 `send_after` formula

```
base = job.completed_at   // required; fallback created_at only if null
window_end = job.edit_window_expires_at  // may be null
delay_end = base + org.feedback_send_delay_hours hours
send_after = max(delay_end, window_end ?? base)
```

### 6.2 Auto-send gate (all must pass)

1. `org.feedback_requests_enabled`
2. `org.feedback_auto_send`
3. Location mute: if `location_id` set → `location.feedback_requests_enabled`
4. `!job.is_test`
5. `job.approval_status ∉ {flagged, cancelled}`
6. Recipient resolves to a non-empty email
7. No existing private `feedback` row for job
8. No terminal outbox success / already `feedback_email_sent` (idempotent)
9. Mode ∈ `{public, both}` ⇒ org has valid `public_review_url` (else skip auto + surface config error on job / logs — do not send broken public CTA)

Then: enqueue/claim via §5.3 helper (never a separate fire-and-forget path). Mint token **only** when queue/send needs an internal URL (L9; public-only may omit).

**Snapshot at queue/send:** Persist `mode_at_send` + `public_review_url_at_send` on the outbox row (and mirror onto job when send succeeds) so landing/email semantics survive later Settings edits.

### 6.3 Manual send gate (`send-feedback-email`) — P0 API enforce

1. **Admin only** (§3.1)
2. Org enabled + location not muted
3. **Block** if `edit_window_expires_at > now()` (today missing — P0)
4. **Block** if `cancelled`
5. **Block** if private feedback already submitted
6. **Block** if no recipient
7. If `flagged` → require `confirm_flagged: true`; else 400 + `error_code`
8. If `is_test` → require `confirm_test: true`
9. If `feedback_email_sent` → require `confirm_resend: true`
10. Mode public/both ⇒ valid `public_review_url`
11. Load job by id; membership via **`auth_user_id`** helpers; reject mismatched client `organization_id`

### 6.4 Scheduler (`process-feedback-email-outbox`)

**Registration:**

1. Edge function `verify_jwt = false` **plus mandatory shared cron secret** (header e.g. `x-cron-secret` / platform convention) — **not deferred**. Bare open URL is a G2 reject (today’s `auto-send-invoices` gap must not be copied).
2. `[functions.process-feedback-email-outbox]` in `config.toml`
3. `functions-inventory.yaml` → `privileged_batch`
4. Active `cron.schedule` migration with secret

**Cadence:** **every 5 minutes**.

**Claim loop (mid-flight rules):**

| Event                                                    | Behaviour                                                                                                                                                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Due pending/failed                                       | Claim → `processing`                                                                                                                                                                                                                |
| Re-check: job deleted                                    | Row already CASCADE-gone                                                                                                                                                                                                            |
| Re-check: `flagged` / `cancelled`                        | → outbox `cancelled` (no Resend)                                                                                                                                                                                                    |
| Re-check: `!feedback_requests_enabled` or location muted | → outbox `cancelled`                                                                                                                                                                                                                |
| Re-check: missing public URL when mode needs it          | → `failed` or `cancelled` + last_error (no broken CTA)                                                                                                                                                                              |
| **Final gate immediately before Resend**                 | Re-read job + org; if kill switch / flagged / cancelled / muted → abort → `cancelled`                                                                                                                                               |
| After Resend success then flag                           | Email already sent (no unsend — S1 H23); form rejects further submit                                                                                                                                                                |
| Job edit while pending                                   | Poller **always** uses live job; on `edit-job` that changes `completed_at` / `location_id` / approval → **recompute `send_after` or cancel+re-enqueue** pending row (DAP implements; product: never send with stale mute/recipient) |
| Success                                                  | `succeeded` + job sent flags + snapshots                                                                                                                                                                                            |
| Retryable fail                                           | attempts++ + backoff; max → `failed`                                                                                                                                                                                                |

Failures never fail job create.

---

## 7. Features (v1 scope lock)

### F1 — Org Settings: Feedback & review requests

**Surface:** Expand current Settings feedback card (`dashboard/app/dashboard/settings/page.tsx`).

**UI RBAC:** Disable all feedback controls for non-admins (today the “Immediately” switch is ungated — fix). Viewers see read-only or nothing.

**Controls (order):**

1. Enable feedback requests (master)
2. Auto-send toggle (**Automatically send feedback requests**)
3. Delay hours (0–168) + edit-window help
4. Destination: Internal / Public review / Both + compliance notice
5. Public review URL (unless Internal) + “Open link”
6. Reply-To (optional)
7. Subject + body + placeholders + Preview + Reset defaults
8. Send test email → signed-in admin; subject prefix `[TEST]`
9. Helper: same recipient rules as invoices + link
10. Link to Locations for mute
11. Rating configuration (helper/disable when mode = `public`)
12. When mode = `public`: warn Ratings charts won’t fill from that CTA path
13. Before saving mode/URL changes: warn that **already-sent emails keep their original links/copy**; new landing behaviour uses send-time snapshots for new sends (see F5)

**Server validation (`update-organization-settings` — no HTTPS precedent today):**

- **Admin-only** for feedback field writes (§3.1)

- Destructure new fields explicitly (same pattern as existing settings)
- `public_review_url`: must match `^https://` (reject `http:`, `javascript:`, etc.) when provided
- Mode ∈ `{public, both}` ⇒ URL required and valid; else 400
- `feedback_email_reply_to`: email regex or null
- Subject ≤ 200; body ≤ 10k; delay 0–168
- **Client validation is UX only — server is authoritative**

**get/update checklist:** organization `.select` list, response object, `edge-contracts.ts`, dashboard types, hooks, settings tests (replace “Immediately” copy).

**Acceptance:** S1 AC 1–2, 7–8, 15–16 + HTTPS reject cases.

### F2 — Per-location mute

**Surface:** `location-form.tsx` toggle; `location-list.tsx` badge **“Feedback off”**.

**Edge:** `create-location` + `update-location` explicit fields (see §5.2).

**Acceptance:** Muted → auto + manual blocked with tooltip; null `location_id` unaffected.

### F3 — Shared send helper + admin-create parity

**Deliverable:** One module used by create-job, admin-create-job (**delete ~200-line inline**), `send-feedback-email`, outbox processor.

**Acceptance:** No duplicated Resend/template logic; unit tests for gates including edit window + no token without recipient.

**Must-fix (today):** `maybe-send-job-feedback-email.ts` still mints `feedback_token` when there is no recipient / send fails — remove that path (S1 H16 / L9).

### F4 — Template renderer + three email CTA shapes

**Placeholders:** `{{organization_name}}`, `{{location_name}}`, `{{job_date}}`, `{{contact_name}}`, `{{internal_review_url}}`, `{{public_review_url}}`.

**Rules:**

1. HTML-escape **every** substituted value before interpolation (today `feedback-email.ts` interpolates org/location/contact **unescaped** — P0 fix).
2. Admin body is **never** interpreted as HTML — escape, then convert newlines to `<br>` for the HTML part; also send `text/plain` with raw newlines.
3. CTA hrefs built only from validated HTTPS public URL or `FEEDBACK_REVIEW_BASE_URL` + token — never from free-form admin HTML.
4. Mode-aware empty URL placeholders; `job_date` from `completed_at` + org **`locale`** (fallback `en-AU`).

**Internal review URL:** `${FEEDBACK_REVIEW_BASE_URL}/review/${token}` (env required for internal/both; deploy checklist).

**CTA shapes (locked):**

| Mode       | Primary email CTA                                                             | Body placeholders                                                                   |
| ---------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `internal` | Button → internal `/review/{token}`                                           | `public_review_url` empty                                                           |
| `public`   | Button → **naked** `public_review_url`                                        | `internal_review_url` empty; **no** requirement to mint token unless thin page used |
| `both`     | Prefer button → internal landing (dual CTA); text fallback may list both URLs | both populated                                                                      |

**Public-only token policy (gold lock):** Auto/manual **public** mode may send **without** minting `feedback_token` (email goes straight to public URL). If a token already exists and user opens `/review/{token}`, show single public CTA (F5).

### F5 — Public `/review/[token]` + `get-job-by-token` contract

**Today:** API returns `rating_config`, workers, location, `hasFeedback` only — **no mode, no public URL, no approval_status**.

**Required response fields (additive):**

| Field                   | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `feedback_request_mode` | Prefer **`mode_at_send`** on job if set, else live org mode      |
| `public_review_url`     | Prefer **`public_review_url_at_send`** if set, else live org URL |
| `approval_status`       | Reject flagged/cancelled                                         |
| `reject_reason`         | `not_found` \| `flagged` \| `cancelled` \| `ok`                  |
| existing fields         | Preserve `rating_config`, `hasFeedback`, etc.                    |

**Retroactive Settings (adversarial lock):** Emails are immutable. Landing for a token uses **send-time snapshots** when present so a later both→public flip does not rewrite what the customer was offered. Pre-feature tokens (no snapshot) fall back to live org settings.

| Condition                         | UX                                          |
| --------------------------------- | ------------------------------------------- |
| Job missing / bad token           | “This review link is no longer available.”  |
| `flagged` / `cancelled`           | “This job is no longer accepting feedback.” |
| Already submitted + internal/both | Thank-you; if `both`, keep public CTA       |
| Mode `both` (pre-submit)          | Two equal buttons                           |
| Mode `internal`                   | Existing form                               |
| Mode `public`                     | Single public CTA (thin page)               |

`submit-feedback`: reject flagged/cancelled; preserve 409 already submitted.

### F6 — Completed jobs status + manual send

**Surface:** `job-detail-dialog.tsx` (+ list if cheap).

**Data:** Edge must expose enough to render chips (org flags, location mute, resolved-recipient hint, outbox status, sent flags, has feedback) — **not** direct outbox RLS reads.

**Status chips (priority):** Feedback off (org) → Muted → No recipient → Queued → Failed → Sent → Responded.

**Actions:** Manual send/resend with confirms per §6.3; disable with reason when blocked (including edit window).

### F7 — Integrity rejects end-to-end

Wire L11/L13/L14/L15 across edge + UI (P0 for manual edit-window + API resend).

### F8 — Help / migration notes

Update Help FAQ; release note: multi-worker jobs wait for edit window when auto-send is on; new master enable + rename of immediate toggle.

### F9 — Test send edge path

Dedicated edge action (preferred) or strictly gated `test_send: true` path:

- **Admin only**
- Recipient = signed-in admin email only (no free-form override to arbitrary addresses in v1)
- Prefixes `[TEST]`
- **Synthetic fixture only** — never load a real job or invoice recipient (no customer PII)
- Does not stamp any job’s `feedback_email_sent`
- Renders template + mode CTAs with sample placeholders
- Distinct from env `RESEND_TEST_MODE` (global redirect) — document both in Help

---

## 8. Edge / API inventory

| Function / path                                              | Change                                             |
| ------------------------------------------------------------ | -------------------------------------------------- |
| Shared feedback send helper                                  | Gates + enqueue + template + CTA shapes            |
| `create-job` persistence                                     | Call helper                                        |
| `admin-create-job`                                           | Call helper; **remove inline**                     |
| `send-feedback-email`                                        | Manual gates + confirms + template                 |
| **New** `process-feedback-email-outbox`                      | Poller + config.toml + inventory + cron SQL        |
| `get-organization-settings` / `update-organization-settings` | New fields + HTTPS validation                      |
| **New or extend** test-send path                             | F9                                                 |
| `create-location` / `update-location`                        | Mute field                                         |
| Job list/detail edge (or equivalent)                         | Status fields for F6                               |
| `get-job-by-token`                                           | Mode, public URL, status, `reject_reason`          |
| `submit-feedback`                                            | Reject flagged/cancelled                           |
| `withdraw-job`                                               | Clearer FK error message if feedback blocks delete |
| `get-job-by-token` / `submit-feedback`                       | **Retain** IP rate limits; add status rejects      |

**Public endpoint NFRs:** Keep existing rate limits on token get/submit regardless of mode. Worker names on `/review` remain (L18) — accepted v1 privacy boundary.

---

## 9. Copy lock (product strings)

| Context               | String                                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature name          | **Feedback requests**                                                                                                                                                             |
| Master toggle         | Enable feedback requests                                                                                                                                                          |
| Auto toggle           | Automatically send feedback requests                                                                                                                                              |
| Mode labels           | Internal feedback / Public review / Both                                                                                                                                          |
| Public URL label      | Google review link (or other public review URL)                                                                                                                                   |
| Compliance            | If you offer a public review link together with private feedback, show both options to every customer. Do not only send happy customers to Google — that violates Google’s rules. |
| Missing job           | This review link is no longer available.                                                                                                                                          |
| Cancelled/flagged     | This job is no longer accepting feedback.                                                                                                                                         |
| No recipient          | Feedback not sent — no recipient email                                                                                                                                            |
| Edit window block     | Feedback can’t be sent until the edit window ends                                                                                                                                 |
| Public-only analytics | Public review links don’t add ratings in Tally — use Internal or Both for CSAT charts.                                                                                            |

---

## 10. Acceptance criteria (G2 checklist)

1. Org disable stops auto + manual.
2. Modes + **server-enforced** HTTPS `public_review_url` for public/both.
3. Delay 0–168; `send_after = max(completed_at+delay, edit_window_end)`.
4. Withdraw before send → no email; after send → unavailable copy.
5. Flagged/cancelled: auto skip; form reject; cancelled manual block; flagged manual confirm.
6. Manual blocked while edit window open (**API**).
7. Templates + escape + locale dates + reset + preview + `[TEST]` send (**F9**).
8. Both landing: equal CTAs; public CTA after private submit.
9. Location mute + badge; edge create/update wired.
10. Test jobs never auto-sent.
11. Resend / already-submitted rules enforced in **API**.
12. No recipient → no token; public-only may omit token.
13. Queued/Failed visible via edge-exposed status; create-job never fails on email errors.
14. Reply-To when set.
15. Compliance + public-only analytics notice.
16. No CASCADE delete of `feedback` for withdraw.
17. `admin-create-job` / `create-job` same helper.
18. One pending outbox row per job; poller claims idempotently.
19. Existing orgs: auto-send mapping preserved; delay `0`; edit-window gate (D2).
20. New orgs: `feedback_auto_send = false` (D5).
21. Outbox RLS service-role only; no direct client outbox reads.
22. Single cutover from `feedback_email_send_immediately` (no dual-read).
23. Cron: config.toml + inventory + **active** `cron.schedule` migration + **shared cron secret**.
24. `get-job-by-token` returns mode / public URL / status / `reject_reason` (prefer send-time snapshots).
25. **Admin-only** settings writes, test send, and manual/resend.
26. Kill switch / mute / flag / cancel cancels pending outbox; final gate before Resend.
27. Enqueue idempotent; no dual inline/poller race.
28. HTML escape + plain-text body never interpreted as HTML (regression: malicious org name).
29. F9 synthetic-only, no customer PII.
30. Mode/URL change warning; landing uses snapshots when present.
31. `send-feedback-email` uses `auth_user_id` membership helpers (fix broken `user_id` query).

---

## 11. Non-goals / v1.1+

Per S1 §7.1 ✗ rows: per-location public URLs, separate recipients, frequency cap, HTML body, hierarchy mute, worker names in email, token expiry, unsend-after-flag, thin tracked redirect for public-only (naked URL locked).

---

## 12. Open items for S3 (HLP)

- [ ] Migration filenames + order (org columns, location mute, job snapshots, outbox, drop legacy, cron SQL + secret)
- [ ] Exact job list/detail payload shape for F6 status chips
- [ ] Cron secret env name + rotation runbook
- [ ] `edit-job` hook implementation detail (recompute vs cancel+re-enqueue) — **product behaviour locked in §6.4**
- [ ] Deploy checklist: `FEEDBACK_REVIEW_BASE_URL` + cron secret on all envs
- [ ] Whether to tighten **all** `update-organization-settings` to admin-only or **feedback fields only** (prefer all-admin; may be larger PRESERVE discussion)

---

## 13. Recommendation (G2)

**GO** — Proceed to **S3 High-Level Plan** after stakeholder accepts this gold + **adversarial**-amended S2 (or overrides **D1–D6** / RBAC in writing).

**Do not start S5** until S3 + S4 exist with verify commands (withdraw-before-send, soft-cancel reject, outbox CASCADE, admin-create parity, HTTPS validation, cron **auth** smoke, HTML escape regression, kill-switch mid-flight).

---

## 14. Next steps

- [x] Stakeholder **G2** (proceed-to-S3)
- [x] S3 HLP — [`S3-configurable-customer-feedback-reviews.md`](./S3-configurable-customer-feedback-reviews.md)
- [x] S4 DAP — [`S4-configurable-customer-feedback-reviews.md`](./S4-configurable-customer-feedback-reviews.md)
- [ ] S5 Build (after G4)

---

## 15. Gold review record (2026-07-21)

Assumptions challenged against the live codebase; amendments applied above.

| #   | Assumption                                   | Challenge (code)                                                                                         | Resolution                                                                                          |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| G1  | “Mirror invoice outbox + auto-send cron”     | `auto-send-invoices` polls **draft invoices**, **not** `invoice_send_outbox`; outbox has **no poller**   | L17 rewritten; feedback poller is **net-new complete** design; table shape only inspired by invoice |
| G2  | Cron “alongside auto-approve in config.toml” | Only `auto-send-invoices` + `mark-overdue-invoices` registered; **no** active `cron.schedule` migrations | Lock config.toml + inventory + **active cron SQL** deliverables; cadence **5 min**                  |
| G3  | Dual-read vs cutover left open               | Only ~4 callers of legacy flag                                                                           | **Single cutover** locked + caller inventory                                                        |
| G4  | `/review` can branch on mode                 | `get-job-by-token` returns no mode / public URL / status                                                 | F5 API contract required                                                                            |
| G5  | HTTPS validation on settings save            | No URL scheme checks in `update-organization-settings`                                                   | Server-side `^https://` + mode-conditional required                                                 |
| G6  | `completed_at ?? created_at` vague           | Both exist; email already uses `completed_at`                                                            | **`completed_at` canonical**                                                                        |
| G7  | Location mute is “add column + UI”           | create/update edges use explicit field lists                                                             | Explicit edge + type wiring; avoid `pricing_mode` drift                                             |
| G8  | Outbox readable for job chips                | Invoice outbox is service-role RLS only                                                                  | Same RLS; expose status via edge                                                                    |
| G9  | Test send is “just a button”                 | No API that sends template without mutating a job                                                        | **F9** test-send path                                                                               |
| G10 | S1 “new orgs auto-send on”                   | DB default + register-org already **false**                                                              | **D5 = false**; document S1 override                                                                |
| G11 | Public-only still mints tokens               | Unnecessary for naked URL CTA                                                                            | Public-only may omit token                                                                          |
| G12 | Locale in templates                          | Hardcoded `en-US` today                                                                                  | Org `locale`, fallback `en-AU`                                                                      |
| G13 | 2-minute cron                                | Ops comments use 5 min for similar jobs                                                                  | Default **5 minutes**                                                                               |

### Hostile questions (gold)

- **“Can we copy invoice retry?”** → No complete poller to copy; specify claim/backoff fully in S4.
- **“Is soft-cancel in get-job-by-token?”** → Not today — F5 is not UI-only.
- **“Will list-locations need changes?”** → Not for read; create/update **will**.
- **“Is G2 enough to code?”** → No — still need S3/S4 for migration order, cron SQL, and PRESERVE blocks.

---

## 16. Adversarial review record (2026-07-21)

Hostile pass after gold. Focus: under-specified RBAC, mid-flight races, stale Settings, cron abuse, XSS. Amendments applied above.

| #   | Finding                                                                  | Severity     | Amendment                                |
| --- | ------------------------------------------------------------------------ | ------------ | ---------------------------------------- |
| A1  | Settings/manual send RBAC undefined; members include workers; UI ungated | **Critical** | §3.1 admin-only matrix; UI disable       |
| A2  | `send-feedback-email` uses nonexistent `user_id`                         | **Critical** | AC #31 — `auth_user_id` helpers          |
| A3  | Mode/URL change after send silent                                        | **High**     | Send-time snapshots + Settings warning   |
| A4  | Enqueue race vs dual create + “inline send”                              | **High**     | Always outbox claim path; ON CONFLICT    |
| A5  | Kill switch / mute mid-flight unspecified                                | **High**     | Cancel pending; final gate before Resend |
| A6  | Flag during `processing` unspecified                                     | **Critical** | Final gate; unsend out of scope          |
| A7  | Job edit while queued deferred to S3 only                                | **High**     | §6.4 product lock; S3 = mechanism        |
| A8  | Cron `verify_jwt=false` deferred secret                                  | **Critical** | **Mandatory** cron secret at G2          |
| A9  | F9 could leak real job/PII                                               | **High**     | Synthetic fixture; admin recipient only  |
| A10 | HTML builder unescaped today                                             | **Critical** | F4 escape + nl2br + regression test      |
| A11 | “Office user” can resend vs admin UI                                     | **High**     | Persona + admin-only send                |
| A12 | Resend vs unique pending unclear                                         | **Medium**   | New attempt; prior succeeded immutable   |
| A13 | Rate limits omitted                                                      | **Medium**   | Retain on public endpoints               |
| A14 | S1 “new org auto-on” vs D5                                               | **Medium**   | D5 wins; G2 must acknowledge             |

### Hostile questions (adversarial)

- **“Who can flip the kill switch?”** → Admin only — API and UI.
- **“Can anyone hit the poller URL?”** → Not acceptable; shared secret required.
- **“What if Settings change after the email?”** → Emails immutable; landing uses snapshots.
- **“Is ‘org member’ good enough?”** → No — broken column + worker membership today.

---

_End of S2 — gold + adversarial reviewed; ready for G2 on amended contracts / S3 after approval._
