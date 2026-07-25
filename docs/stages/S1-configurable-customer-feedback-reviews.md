# S1 — Triage: Configurable customer feedback & review requests

| Field           | Value                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| **Stage**       | S1 — Triage (feasibility, risk, phased scope)                                                                  |
| **From S0**     | [`S0-configurable-customer-feedback-reviews.md`](./S0-configurable-customer-feedback-reviews.md) (2026-07-21)  |
| **Triaged**     | 2026-07-21                                                                                                     |
| **Gold review** | **2026-07-21 — complete** (see §15)                                                                            |
| **Adversarial** | **2026-07-21 — pass 2 complete** (soft-cancel, feedback FK, invoice-outbox reuse — see §16.4)                  |
| **Product**     | Tally Runner (post-job customer feedback / ratings)                                                            |
| **Owns**        | Dashboard Settings + Locations + feedback email edge path + public `/review` experience; **not** Mobile App UI |

---

## 1. S0 recap

Admins need richer control over post-job review asks: **custom email copy**, **org pause**, **per-location mute**, and a choice of **internal CSAT**, **public (Google-first) reviews**, or **both** — without review gating. Feedback should not be blocked by colleague confirmation. Naming individual workers is optional and sensitive.

---

## 2. Research summary (industry practice)

| Finding                                                                                                                                                                                                                                                                       | Implication for Tally                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Field services often send a **short** follow-up same day / within a few hours while the visit is fresh                                                                                                                                                                        | Support **soon-after** sends; not only “instant on insert”                                                                            |
| **Internal CSAT** and **public Google** reviews serve different jobs (ops vs reputation)                                                                                                                                                                                      | Support **modes**, not a forced single channel                                                                                        |
| Platforms (e.g. Birdeye-class tools) commonly combine public review generation with private feedback                                                                                                                                                                          | “Both” is a first-class product mode                                                                                                  |
| **Review gating** (only happy customers see Google) violates Google Business Profile guidelines ([BrightLocal](https://www.brightlocal.com/learn/review-gating/), [Sterling Sky](https://www.sterlingsky.ca/review-gating-is-now-against-the-google-my-business-guidelines/)) | **Forbidden**: never filter public CTA by prior star rating                                                                           |
| Compliant dual ask: same customers see **private** and **public** options **equally**                                                                                                                                                                                         | Mode **both** = equal CTAs (prefer shared landing page — §3.1)                                                                        |
| Australian Spam Act / commercial email norms: identifiable sender, unsubscribe path for marketing-like mail                                                                                                                                                                   | Feedback is transactional/service follow-up; still need clear **from**, accurate **org identity**, and stop controls (org + location) |

---

## 3. S1 decisions (resolved / amended after gold + adversarial review)

### 3.1 Destination mode

| Decision                      | Choice                                                                                                                                                                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modes**                     | `internal` \| `public` \| `both` (org-level). **Do not** name the enum `google` — the field is a generic public URL.                                                                                                                                                             |
| **Default for existing orgs** | `internal` (preserves current behaviour when auto-send is on)                                                                                                                                                                                                                    |
| **Public review URL (v1)**    | Single org field `public_review_url` (HTTPS). UI label: **“Google review link (or other public review URL)”** — Google primarily; Facebook/Trustpilot etc. allowed. **Per-location URLs → v1.1**                                                                                 |
| **Both UX**                   | **Preferred:** email CTA → Tally `/review/[token]` landing with **two equal buttons** (Private feedback \| Public review). Email may include both links as text fallback. **No** star gate. After private submit, **keep** the public CTA visible (equal options, not a funnel). |
| **Public-only**               | Email primary CTA → `public_review_url`. Optional thin Tally interstitial only if we need click tracking (S2 may choose direct link for simplicity).                                                                                                                             |
| **Why landing for both**      | One tracked entrypoint; consistent branding; harder for admins to accidentally build gating in custom HTML; better mobile layout than two competing buttons in raw email HTML.                                                                                                   |

### 3.2 When to send (adversarial amend — critical)

| Decision                       | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Colleague confirmation**     | **Independent** of confirmation for _eligibility_ — a `pending` job can still generate a review ask per timing below (after the edit-window gate). **Exceptions:** do **not** auto-send when `approval_status ∈ {flagged, cancelled}`. Manual: flagged = confirm; cancelled = **block**.                                                                                                                                                                                                                    |
| **Timing model (v1)**          | **Single control:** `feedback_send_delay_hours` integer **0–168** (absolute hours from `job.completed_at` / create timestamp used as completed). **0** = send as soon as allowed. Drop the three-way enum `immediate` / `after_edit_window` / `delay_hours` — it was redundant once the safety invariant exists.                                                                                                                                                                                            |
| **Hard safety invariant**      | **Never send (auto or manual without hard confirm) while the submitter can still withdraw the job.** Compute `send_after = max(completed_at + delay_hours, edit_window_expires_at ?? completed_at)` where `completed_at` is the job completion timestamp used at create (same clock as today). If edit window is null, `send_after = completed_at + delay`. **Manual send** while window open: **block** in v1 (tooltip: wait until edit window ends) — prevents feedback-row FK from breaking withdraw.    |
| **Default for new orgs**       | Auto-send **on**, `feedback_send_delay_hours = 0` (ASAP after invariant). Safer than today’s blind immediate send because of the edit-window gate.                                                                                                                                                                                                                                                                                                                                                          |
| **Default for existing**       | Map current “auto-send on” → auto-send on + delay `0` (behaviour becomes **safer**: multi-worker jobs wait for edit window). Document in migration notes; Settings tip explains the change.                                                                                                                                                                                                                                                                                                                 |
| **Delay clock**                | Absolute hours from `completed_at` (UTC storage; display in org timezone in Settings help). Not wall-clock “next business day”.                                                                                                                                                                                                                                                                                                                                                                             |
| **Withdraw semantics**         | **`withdraw-job` hard-deletes the job** when `approval_status = pending` and the edit window is open. Implications: (1) pending outbox rows **must `ON DELETE CASCADE`** from `job`; (2) already-sent emails → missing job → clear **“This review link is no longer available”** (not a cancelled-status check); (3) **do not** treat withdraw as soft-cancel.                                                                                                                                              |
| **Soft cancel (exists today)** | **`resolve-flagged-job` with `action: cancel`** sets `approval_status = 'cancelled'` and **keeps the job row**. v1 must: skip auto-send for `cancelled`; cancel/skip pending outbox; **`get-job-by-token` / `submit-feedback` reject** cancelled jobs (today they still accept — gap).                                                                                                                                                                                                                      |
| **Feedback FK vs withdraw**    | `feedback.job_id → job(id)` has **no `ON DELETE CASCADE`** today. If a customer submits feedback then a delete is attempted, **withdraw fails at the DB**. With the edit-window send invariant, auto-send should not race withdraw. Still required: (a) **block manual send while edit window is open** (same safety invariant), or require a hard confirm; (b) if withdraw fails because feedback exists, return a clear API/UI error — do **not** CASCADE-delete CSAT rows just to make withdraw succeed. |
| **Org auto-send**              | Label: **“Automatically send feedback requests”**. Prefer column `feedback_auto_send` (migrate from `feedback_email_send_immediately`). **Note:** DB default today is `false`; “new orgs auto-send on” is a **product default change** — confirm at G1.                                                                                                                                                                                                                                                     |

> **Gold assumption refined:** “Always send on job submission” conflicts with the edit/withdraw window. Adversarial review goes further: a **three-way timing enum is unnecessary** if every auto-send respects the edit window and admins only set an optional delay. Pass 2: soft-cancel already exists; feedback FK can block delete; extend the safety invariant to **manual** send.

### 3.3 Feature enablement

| Decision              | Choice                                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Split concerns**    | Today one flag (`feedback_email_send_immediately`) conflates “feature on” with “auto-send”. **v1:** org-level **`feedback_requests_enabled`** (default `true`) + **`feedback_auto_send`** (migrated from existing flag). |
| **When org disabled** | No auto-send; manual send disabled org-wide; Settings explains how to re-enable.                                                                                                                                         |
| **Interaction**       | Auto-send requires `feedback_requests_enabled = true`. Location mute still applies when org enabled.                                                                                                                     |

### 3.4 Custom copy

| Decision                    | Choice                                                                                                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Editable fields**         | `feedback_email_subject`, `feedback_email_body`                                                                                                                                                                                                                         |
| **Body format (v1)**        | **Plain text** (+ newlines). Product injects **structured CTA button(s)** below the body based on mode. **Reject free-form HTML in v1** (XSS, broken clients, accidental gating). Escape placeholder substitution (no HTML injection via `{{organization_name}}` etc.). |
| **Placeholders**            | `{{organization_name}}`, `{{location_name}}`, `{{job_date}}`, `{{contact_name}}`, `{{internal_review_url}}`, `{{public_review_url}}`                                                                                                                                    |
| **Mode-aware placeholders** | If mode is `public`, `{{internal_review_url}}` resolves empty (preview warns). If mode is `internal`, `{{public_review_url}}` resolves empty. Product CTAs remain the source of truth for buttons.                                                                      |
| **Date formatting**         | Use org `locale` (fallback `en-AU` / org setting) — do not hardcode `en-US` in renderer                                                                                                                                                                                 |
| **Empty template**          | Fall back to current product default strings                                                                                                                                                                                                                            |
| **Preview**                 | Settings live preview with sample data                                                                                                                                                                                                                                  |
| **Reset to default**        | Button clears custom subject/body back to product defaults                                                                                                                                                                                                              |
| **Send test email**         | Settings action: send to the **signed-in admin’s email** (or optional override field) with `[TEST]` subject prefix — admins will demand this before enabling auto-send                                                                                                  |

### 3.5 Per-location mute

| Decision                         | Choice                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Storage**                      | `location.feedback_requests_enabled BOOLEAN NOT NULL DEFAULT true`                                            |
| **Behaviour**                    | If `false`: skip auto-send **and** disable manual send for jobs at that location (tooltip explains why)       |
| **Jobs with null `location_id`** | Mute does not apply (no location to mute). Recipient resolution still runs; if no email → no-recipient state. |
| **UI**                           | Location create/edit toggle; locations list **badge** “Feedback off”                                          |
| **Hierarchy**                    | **Out of v1** — mute is per location row only (hierarchy-level mute → backlog)                                |

### 3.6 Recipient resolution

| Decision         | Choice                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **v1**           | Continue reusing **invoice** `email_recipient_config` (hierarchy / location / form field / default) — already understood by admins            |
| **Settings UX**  | Explicit copy: “Feedback emails use the same recipient rules as invoices.” Link to invoice template recipient settings                        |
| **No recipient** | Do not fail job create; **do not** create `feedback_token` or outbox row; surface on job detail: **“Feedback not sent — no recipient email”** |
| **v1.1 backlog** | Optional separate feedback recipient config if invoice≠feedback contacts diverge                                                              |

### 3.7 Tracking, resend, test jobs, tokens

| Decision                        | Choice                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Token lifecycle**             | Create/persist `feedback_token` only when a send is **queued or sent** and a recipient exists. **Today’s bug:** auto-send mints a token even when there is no recipient or Resend fails — v1 must stop that.            |
| **Token after withdraw**        | Job delete removes the row; token lookup → “link no longer available”.                                                                                                                                                  |
| **Token after soft cancel**     | Job row remains; **reject** get/submit with clear copy (“This job is no longer accepting feedback”).                                                                                                                    |
| **Already submitted**           | Landing thank-you; for **both** keep public CTA; **block** resend of private-feedback email (v1).                                                                                                                       |
| **Sent flags**                  | Set `feedback_email_sent` / `feedback_email_sent_at` only on **successful** Resend delivery                                                                                                                             |
| **Resend (manual)**             | UI confirm if already sent and no private feedback yet. **API must enforce the same rules** — today `send-feedback-email` ignores `feedback_email_sent` (UI hides the button; API can still double-send).               |
| **Test jobs**                   | **Never** auto-send for `job.is_test = true` (contrast: test invoices already block send). Manual send on test jobs: explicit confirm only. Note: worker `create-job` does not set `is_test` today — only admin-create. |
| **Flagged / cancelled on form** | `get-job-by-token` / `submit-feedback` **reject** when `approval_status ∈ {flagged, cancelled}` (today: no status check).                                                                                               |
| **Idempotency**                 | Partial unique index: one **pending** outbox row per `job_id`. Job updates must not double-enqueue.                                                                                                                     |
| **Token expiry**                | **Out of v1** (tokens live with the job). Backlog if long-lived links become a concern.                                                                                                                                 |
| **Public-only analytics**       | Settings warns: public-only mode will not populate Tally Ratings charts from that CTA path                                                                                                                              |
| **Worker names on `/review`**   | Form already exposes worker names today. **v1: no change** (rapport-in-email remains out of scope). Do not expand naming in email.                                                                                      |

### 3.8 Worker naming (rapport)

| Decision      | Choice                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| **v1**        | **Out of scope**                                                                        |
| **Backlog**   | Optional **private form** question / first names only — never default in outbound email |
| **Rationale** | Privacy/safety, multi-worker ambiguity, keeps email short                               |

### 3.9 Reply-To / from identity

| Decision          | Choice                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **From**          | Keep `resolveOrgMailFrom` (org domain when verified)                                                                                                      |
| **Reply-To (v1)** | Optional org setting `feedback_email_reply_to` (validated email). Empty → no Reply-To header (current behaviour). Admins often want replies to ops inbox. |

### 3.10 Product boundary (UP-10)

| Surface                                                                            | Owns                         |
| ---------------------------------------------------------------------------------- | ---------------------------- |
| **Dashboard Settings + Locations**                                                 | Configuration                |
| **Edge `create-job`, `admin-create-job`, `send-feedback-email`, scheduled sender** | Send path                    |
| **Dashboard `/review/[token]` + submit/get-job-by-token**                          | Internal form + dual landing |
| **Mobile**                                                                         | No new screens               |

### 3.11 Outbox (adversarial: mandatory, not optional)

| Decision                     | Choice                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Required when**            | `send_after > now()` (delay > 0 **or** edit window still open). Inline send **only if** `send_after <= now()`.                                                                           |
| **Pattern to reuse**         | Prefer mirroring **`invoice_send_outbox` + cron poller** (`auto-send-invoices` / scheduling helpers) — production-proven. `auto-approve-jobs` is a secondary reference for cadence only. |
| **On withdraw / job delete** | Outbox: `ON DELETE CASCADE` from `job`. **Do not** CASCADE-delete `feedback` rows to unblock withdraw.                                                                                   |
| **On soft cancel / flag**    | Mark pending outbox `cancelled` / skip; do not send.                                                                                                                                     |
| **Retries**                  | Bounded attempts; terminal `failed`; job detail **Queued / Failed**; failures never fail job create.                                                                                     |
| **Scheduler**                | Cron edge function; cadence in S2 (suggest 1–5 min).                                                                                                                                     |

---

## 4. Current-state verification (codebase)

| Path                                           | Role                                          | Gap                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `organization.feedback_email_send_immediately` | Auto-send flag (DB default **false**)         | Conflates enable vs auto; rename → `feedback_auto_send`                                                              |
| `organization.rating_config`                   | Internal form dimensions                      | N/A for public-only                                                                                                  |
| `maybe-send-job-feedback-email.ts`             | Post-create send                              | Immediate only; ignores edit window, `is_test`, flagged, mute; **mints token even with no recipient / send failure** |
| `admin-create-job`                             | **Inlined** ~200-line duplicate of send logic | Must call shared helper — drift is already a latent bug                                                              |
| `send-feedback-email`                          | Manual send                                   | No mute/mode/template; **does not enforce** `feedback_email_sent` (UI hides button only)                             |
| `feedback-email.ts`                            | Hardcoded copy; `en-US` dates                 | No templates; reuses `getInvoiceEmailRecipient`                                                                      |
| `invoice_send_outbox` + auto-send cron         | Proven deferred-send pattern                  | **Not used** for feedback — reuse for v1 outbox                                                                      |
| `feedback.job_id` FK                           | No `ON DELETE CASCADE`                        | Withdraw **fails** if feedback row exists; do not “fix” by deleting CSAT                                             |
| `resolve-flagged-job` cancel                   | Soft `approval_status = cancelled`            | Form still accepts tokens today — must reject in v1                                                                  |
| `get-job-by-token` / `submit-feedback`         | Token-only auth                               | No check for cancelled / flagged; generic 404 copy for missing job                                                   |
| `/review/[token]`                              | Public form                                   | Exposes worker names; already-submitted blocks private form                                                          |
| Completed jobs UI                              | Manual send                                   | No no-recipient / muted / queued / failed; hides resend when sent                                                    |

---

## 5. Technical feasibility

### 5.1 Data model (draft)

```sql
-- organization
ALTER TABLE organization
  ADD COLUMN IF NOT EXISTS feedback_requests_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feedback_request_mode TEXT NOT NULL DEFAULT 'internal'
    CHECK (feedback_request_mode IN ('internal', 'public', 'both')),
  ADD COLUMN IF NOT EXISTS public_review_url TEXT,
  ADD COLUMN IF NOT EXISTS feedback_email_subject TEXT,
  ADD COLUMN IF NOT EXISTS feedback_email_body TEXT,
  ADD COLUMN IF NOT EXISTS feedback_email_reply_to TEXT,
  ADD COLUMN IF NOT EXISTS feedback_send_delay_hours INTEGER NOT NULL DEFAULT 0
    CHECK (feedback_send_delay_hours >= 0 AND feedback_send_delay_hours <= 168);
-- Rename / dual-write: feedback_email_send_immediately → feedback_auto_send (migration plan in S3)

-- location mute
ALTER TABLE location
  ADD COLUMN IF NOT EXISTS feedback_requests_enabled BOOLEAN NOT NULL DEFAULT true;

-- required for deferred sends (delay or open edit window)
-- feedback_email_outbox (
--   job_id PK/UNIQUE pending, organization_id, send_after, status,
--   attempts, last_error, created_at, updated_at
-- ) REFERENCES job(id) ON DELETE CASCADE
```

**Migration note:** Existing orgs with `feedback_email_send_immediately = true` → `feedback_requests_enabled = true`, `feedback_auto_send = true`, `feedback_send_delay_hours = 0`. Multi-worker jobs become safer (wait for edit window) — call out in release notes.

**Validation:**

- Mode ∈ `{public, both}` ⇒ `public_review_url` required, `https:` only.
- Reply-To: valid email or null.
- Subject ≤ 200; body ≤ 10k; unknown placeholders left unreplaced + preview warning.
- Escape all substituted placeholder values (plain text).

### 5.2 Send path

```
Job created (create-job / admin-create-job)  // both MUST call shared helper
  → skip if is_test
  → skip if !org.feedback_requests_enabled
  → skip if location muted (when location_id present)
  → skip if !org.feedback_auto_send (auto path only)
  → skip if approval_status ∈ {flagged, cancelled}
  → resolve recipient; if none → “no recipient” state; stop (NO token)
  → compute send_after = max(completed_at + delay, edit_window_expires_at ?? completed_at)
  → if send_after <= now → send now; mint token only on queue/successful send path
  → else enqueue outbox (mint token when queued); partial UNIQUE pending per job
Scheduled worker (invoice-outbox-style cron)
  → dequeue due; skip if job gone / flagged / cancelled; send; stamp flags; retry/fail
Manual send-feedback-email (API enforces)
  → honour org enable + location mute
  → block if edit window still open
  → block if private feedback already submitted
  → confirm if already sent / test / flagged
  → render template + mode CTAs; optional Reply-To
```

`/review/[token]` + `get-job-by-token` / `submit-feedback`:

- Job missing (withdrawn/deleted) → **link unavailable**.
- `approval_status ∈ {flagged, cancelled}` → **not accepting feedback**.
- Private feedback already present → thank-you; keep public CTA if mode is `both`.

### 5.3 Settings UI (draft IA)

**Feedback & review requests** (expand current card):

1. **Enable feedback requests** (org master)
2. **Auto-send** toggle
3. **Delay (hours):** 0–168, help: “0 = as soon as allowed. Requests never send while the submitter can still withdraw the job.”
4. **Destination:** Internal / Public review / Both + compliance note
5. **Public review URL** (shown unless Internal)
6. **Reply-To** (optional)
7. **Email subject + body** (plain text) + placeholders + **Reset defaults** + **Preview**
8. **Send test email**
9. Link: recipient rules (= invoices)
10. Link: Locations for per-yard mute
11. **Rating configuration** (internal form; helper when mode = public-only)

### 5.4 Compliance copy (must ship)

> If you offer a public review link together with private feedback, show both options to every customer. Do not only send happy customers to Google — that violates Google’s rules.

---

## 6. Risk assessment

| Risk                                                            | Likelihood                | Impact | Mitigation                                                           |
| --------------------------------------------------------------- | ------------------------- | ------ | -------------------------------------------------------------------- |
| Review ask sent then job withdrawn                              | Medium (after invariant)  | High   | Edit-window gate; outbox CASCADE on delete; missing-job landing copy |
| Admin builds gating in custom HTML                              | Medium                    | High   | Plain-text body + product CTAs; compliance note                      |
| Invalid public URL                                              | Medium                    | Medium | HTTPS validation; “Open link” in Settings                            |
| Public-only orgs expect Ratings charts                          | Medium                    | Medium | Helper text                                                          |
| Delayed send reliability                                        | Medium                    | Medium | **Mandatory** outbox + retries + job-detail Queued/Failed            |
| Orphaned outbox after withdraw                                  | High (if CASCADE omitted) | Medium | `ON DELETE CASCADE` + withdraw tests                                 |
| Auto-send while job flagged                                     | Medium                    | Medium | Skip auto-send when flagged                                          |
| Mute forgotten                                                  | Medium                    | Low    | Location badge                                                       |
| Duplicate spam (resend / multi-job day)                         | Medium                    | Medium | Resend confirm; block after response; **frequency cap → v1.1**       |
| XSS via HTML templates / placeholders                           | Low                       | High   | Plain text only; escape substitutions                                |
| `admin-create-job` drift                                        | Medium                    | Medium | Shared send helper used by both paths                                |
| Reply-To deliverability quirks                                  | Low                       | Low    | Optional; validate email format                                      |
| Existing orgs notice “slower” send on multi-worker jobs         | Medium                    | Low    | Release note: waits for edit window by design                        |
| Soft-cancelled jobs still accept review tokens                  | **High** (today)          | High   | Reject cancelled/flagged on get/submit; skip outbox                  |
| Manual send during edit window → feedback then withdraw FK fail | Medium                    | High   | Block manual send while window open                                  |
| API double-send bypassing UI                                    | Medium                    | Medium | Enforce sent/feedback rules in `send-feedback-email`                 |
| `admin-create-job` drift from shared helper                     | **High** (today)          | High   | Delete inlined copy; one helper only                                 |
| New-org default auto-send on vs DB false today                  | Medium                    | Medium | Explicit G1; migration must not flip existing orgs                   |

---

## 7. Scope definition

### 7.1 Admin options matrix (what v1 must expose)

| Option                                        | v1  | Notes                                              |
| --------------------------------------------- | --- | -------------------------------------------------- |
| Enable / disable feedback requests (org)      | ✓   | Master switch                                      |
| Auto-send on/off                              | ✓   | Migrated clear flag                                |
| Delay hours (0–168) + edit-window safety gate | ✓   | **Adversarial amend** (replaces 3-way timing enum) |
| Destination: internal / public / both         | ✓   | Enum value `public`, not `google`                  |
| Public review URL (Google-first, any HTTPS)   | ✓   | Org-wide                                           |
| Custom subject + body (plain text)            | ✓   | Escaped placeholders                               |
| Placeholders + preview                        | ✓   | Mode-aware empty URLs                              |
| Reset template to defaults                    | ✓   |                                                    |
| Send test email                               | ✓   |                                                    |
| Optional Reply-To                             | ✓   |                                                    |
| Per-location mute                             | ✓   | Null location = mute N/A                           |
| Manual send + resend confirm                  | ✓   | Block after private feedback submitted             |
| Skip test jobs (auto)                         | ✓   |                                                    |
| Skip flagged / cancelled jobs (auto)          | ✓   | Manual flagged: confirm; cancelled: block          |
| Block manual send while edit window open      | ✓   | Same safety invariant as auto                      |
| Reject form when flagged / cancelled          | ✓   | Soft-cancel path exists today                      |
| Missing-job / withdrawn link UX               | ✓   | Delete semantics for withdraw                      |
| API-enforced resend / already-submitted rules | ✓   | Not UI-only                                        |
| Shared send helper (no admin-create inline)   | ✓   | **Required** — drift exists today                  |
| Outbox + scheduler (invoice-outbox pattern)   | ✓   | **Required**, not optional                         |
| “No recipient” job status affordance          | ✓   | No token minted                                    |
| Queued / Failed job status affordance         | ✓   |                                                    |
| Per-location public URLs                      | ✗   | v1.1                                               |
| Separate feedback recipient rules             | ✗   | v1.1                                               |
| Frequency cap (max N emails/location/day)     | ✗   | v1.1                                               |
| Worker names in email/form                    | ✗   | Backlog                                            |
| Review gating                                 | ✗   | Forbidden                                          |
| SMS                                           | ✗   | Out                                                |
| Free-form HTML email body                     | ✗   | v1 reject                                          |
| Hierarchy-level mute                          | ✗   | Backlog                                            |
| Three-way timing enum                         | ✗   | **Dropped** — superseded by delay + invariant      |

### 7.2 In scope (v1) — engineering

| Area                   | Deliverable                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema**             | Org enable/mode/URL/template/reply-to/delay; auto-send rename; location mute; **outbox with CASCADE**                                                                                                                       |
| **Shared send helper** | Used by `create-job`, `admin-create-job`, `send-feedback-email`, scheduler                                                                                                                                                  |
| **Settings UI**        | Full matrix in §7.1                                                                                                                                                                                                         |
| **Locations UI**       | Toggle + list badge                                                                                                                                                                                                         |
| **Review landing**     | Missing-job UX; **both** mode dual CTA; keep public CTA after private submit                                                                                                                                                |
| **Completed jobs UI**  | Muted / no-recipient / queued / failed / sent states; resend rules                                                                                                                                                          |
| **Tests**              | Delay + edit-window `max`; outbox CASCADE on job delete; soft-cancel reject; flagged skip; manual blocked in window; no token without recipient; API resend rules; admin-create parity; template escape; idempotent enqueue |
| **Docs / Help**        | Short admin blurb + compliance + migration note (safer multi-worker timing)                                                                                                                                                 |

### 7.3 Out of scope (v1)

Per §7.1 ✗ rows; plus native Google API posting; changing rating dimension schemas beyond UX disable for public-only.

### 7.4 Future phases

- **v1.1:** Per-location public URLs; separate feedback recipients; frequency cap; richer “queued/failed” admin tools
- **v1.2:** Optional private-form crew question
- **v2:** Rich template blocks; digests; multi-language templates

---

## 8. Effort estimate (revised)

| Component                            | Estimate      | Notes                                                                     |
| ------------------------------------ | ------------- | ------------------------------------------------------------------------- |
| Migrations + types + outbox CASCADE  | 1 day         | Delay + auto-send rename                                                  |
| Shared send helper + scheduler       | 1.5 days      | create-job / admin-create-job / manual parity; flagged/mute/test gates    |
| Template renderer + tests            | 1 day         | Placeholders, escape, locale dates, CTA injection                         |
| Settings UI (incl. test send, reset) | 2 days        | Simpler timing control than 3-way enum                                    |
| Locations UI + badges                | 0.5 day       |                                                                           |
| Review landing + missing-job UX      | 0.5 day       |                                                                           |
| Completed jobs status / resend UX    | 0.5 day       |                                                                           |
| Integration / regression tests       | 1.5 days      | Withdraw delete race + deferred send                                      |
| Copy / Help / migration notes        | 0.5 day       |                                                                           |
| **Total**                            | **~9.5 days** | +soft-cancel/form gates + API resend enforce; still one outbox workstream |

---

## 9. Acceptance criteria (draft)

1. **Enable:** Org can disable all feedback requests; auto and manual stop.
2. **Mode:** Internal / Public / Both; Public/Both require valid HTTPS `public_review_url`.
3. **Timing:** Admin sets delay hours 0–168; auto-send never fires before `edit_window_expires_at` when set; `send_after = max(completed + delay, edit_window_end)`.
4. **Withdraw race:** Job withdrawn before send → no email (outbox gone with job); after send → review link shows unavailable (job deleted).
5. **Flagged / cancelled:** Auto-send skips both; form rejects both; cancelled blocks manual; flagged manual requires confirm.
6. **Edit window:** Auto and manual do not send while `edit_window_expires_at > now()`.
7. **Template:** Custom plain-text subject/body + escaped placeholders; empty → defaults; Reset restores defaults.
8. **Preview + test send:** Settings preview works; test email arrives to admin with `[TEST]` marker.
9. **Both:** Landing shows **both** CTAs with no rating precondition; public CTA remains after private submit.
10. **Mute:** Location off → no auto/manual send; list shows badge.
11. **Test jobs:** Never auto-sent; manual only with confirm.
12. **Resend:** Confirm if already sent and no private feedback yet; **blocked** after private feedback; **enforced in API**.
13. **No recipient:** Job UI indicates feedback not sent; **no token** minted.
14. **Queued / Failed:** Deferred sends visible on job; failures do not fail job create.
15. **Reply-To:** Optional header when configured.
16. **Compliance:** Notice visible for Public/Both modes.
17. **Preserve:** `feedback` rows are never CASCADE-deleted to unblock withdraw; `rating_config` + Ratings for Internal/Both.
18. **Parity:** `admin-create-job` and `create-job` call the **same** send helper (no inlined duplicate).
19. **Idempotency:** At most one pending outbox row per job.

---

## 10. Dependencies

| Dependency                                     | Status            | Notes                                                              |
| ---------------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| Resend + `FEEDBACK_REVIEW_BASE_URL`            | Exists            | Internal link                                                      |
| Org mail from-domain                           | Exists / evolving | Align with org-resend work                                         |
| Invoice email recipient config                 | Exists            | Documented reuse                                                   |
| Edit window on jobs                            | Exists            | Feeds safety invariant                                             |
| `invoice_send_outbox` + invoice auto-send cron | Exists            | **Primary** pattern to reuse for feedback outbox                   |
| Scheduled functions (auto-approve cadence)     | Exists            | Secondary reference for poll interval                              |
| Location CRUD                                  | Exists            | Add toggle                                                         |
| `withdraw-job` hard delete                     | Exists            | Drives CASCADE + missing-job UX                                    |
| G1 stakeholder approval                        | **Required**      | Especially on **delay + edit-window gate** and migration behaviour |

---

## 11. Decision log

| Date                 | Decision                                                       | Rationale                                        |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| 2026-07-21           | Modes: internal / public / both                                | Ops vs reputation; admin choice                  |
| 2026-07-21           | Forbid review gating                                           | Google policy                                    |
| 2026-07-21           | Org-wide public URL in v1                                      | Simpler; per-location later                      |
| 2026-07-21           | Per-location mute in v1                                        | Stakeholder need                                 |
| 2026-07-21           | Custom subject/body in v1                                      | Core configurability                             |
| 2026-07-21           | Worker naming out of v1                                        | Privacy / multi-worker                           |
| **2026-07-21 Gold**  | **Timing control in v1** (not blind immediate-only)            | Withdraw window makes immediate-only unsafe      |
| **2026-07-21 Gold**  | **Plain text body + product CTAs**                             | Avoid HTML XSS / accidental gating               |
| **2026-07-21 Gold**  | **Both → landing with dual CTA**                               | Tracking + compliance-friendly                   |
| **2026-07-21 Gold**  | **Org enable ≠ auto-send**                                     | Admins want manual-only mode                     |
| **2026-07-21 Gold**  | **Test send + reset defaults**                                 | Expected admin tooling                           |
| **2026-07-21 Gold**  | **Skip test jobs**                                             | Data integrity                                   |
| **2026-07-21 Gold**  | **Optional Reply-To**                                          | Ops inbox routing                                |
| **2026-07-21 Gold**  | **Public URL not Google-only field**                           | Trustpilot/Facebook without new modes            |
| **2026-07-21 Adv.**  | **Mode enum `public` not `google`**                            | Align with `public_review_url`                   |
| **2026-07-21 Adv.**  | **Delay hours + hard edit-window invariant** (drop 3-way enum) | One control; withdraw-safe by default            |
| **2026-07-21 Adv.**  | **Withdraw = delete** (not soft-cancel ACs)                    | Matches `withdraw-job` today                     |
| **2026-07-21 Adv.**  | **Outbox mandatory + CASCADE**                                 | Deferred sends are not optional                  |
| **2026-07-21 Adv.**  | **Skip auto-send when flagged**                                | Don’t ask for reviews on disputed jobs           |
| **2026-07-21 Adv.**  | **Token only when queue/send + recipient**                     | No orphan tokens                                 |
| **2026-07-21 Adv.**  | **Block resend after private feedback**                        | Avoid confusing second ask                       |
| **2026-07-21 Adv.**  | **Migrate to `feedback_auto_send`**                            | Kill misleading column name                      |
| **2026-07-21 Adv.2** | **Soft-cancel already exists — reject on form**                | `resolve-flagged-job` cancel keeps the row       |
| **2026-07-21 Adv.2** | **Do not CASCADE-delete `feedback` for withdraw**              | Preserve CSAT; clear withdraw error if FK blocks |
| **2026-07-21 Adv.2** | **Block manual send during edit window**                       | Prevent feedback→withdraw FK deadlock            |
| **2026-07-21 Adv.2** | **Reuse `invoice_send_outbox` pattern**                        | Proven deferred send, not invent a third queue   |
| **2026-07-21 Adv.2** | **API enforces resend / submitted rules**                      | UI-only hide is bypassable today                 |
| **2026-07-21 Adv.2** | **Delete admin-create inlined send**                           | Shared helper only                               |

---

## 12. Open items for S2 (design lock)

**S2 created:** [`S2-configurable-customer-feedback-reviews.md`](./S2-configurable-customer-feedback-reviews.md) (2026-07-21). Items below are **locked there** (D1–D6 + F1–F8) unless stakeholder overrides at G2.

- [x] Outbox table vs extending queue → **new `feedback_email_outbox`** mirroring invoice outbox
- [x] Scheduler cadence → **every 5 minutes** (S2 gold)
- [x] Public-only link → **direct `public_review_url`** (no thin redirect required in v1)
- [x] Existing-org migration → delay `0` + edit-window gate
- [x] Job-detail status copy → S2 §7 F6 / §9
- [x] Product strings → **Feedback requests** (S2 §9)
- [x] Max Resend retries → **5** with exponential backoff cap
- [x] Flagged-after-send → reject submit; no unsend
- [x] New-org auto-send default → **`false`** (D5)
- [x] Legacy flag → **single cutover** (no dual-read; S2 gold)
- [ ] Help article polish → S3/S4
- [ ] Cron SQL + migration filenames → S3

---

## 13. Recommendation (G1)

**GO** — S2 Features & Functions is written. Next gate is **G2** on the S2 (defaults D1–D6).

**Stakeholder confirm (carried into S2 defaults):**

1. Delay hours + edit window for auto **and** manual → **Yes (D1)**
2. Existing auto-send orgs get safer multi-worker timing → **Yes (D2)**
3. Plain-text templates → **Yes (D3)**
4. Org-wide public URL → **Yes (D4)**
5. New-org auto-send default → **`false` (D5)** — override if you want new orgs opt-in auto
6. Cancelled / flagged stop accepting review links → **Yes (D6)**

---

## 14. Next steps

- [x] S2 F&F written — [`S2-configurable-customer-feedback-reviews.md`](./S2-configurable-customer-feedback-reviews.md)
- [x] Stakeholder **G2** (proceed-to-S3)
- [x] S3 HLP — [`S3-configurable-customer-feedback-reviews.md`](./S3-configurable-customer-feedback-reviews.md)
- [x] S4 DAP — [`S4-configurable-customer-feedback-reviews.md`](./S4-configurable-customer-feedback-reviews.md)
- [ ] S5 Build — **not before** G4 / explicit go-ahead

---

## 15. Gold review record (2026-07-21)

### 15.1 Assumptions challenged

| #   | Original assumption                     | Challenge                                       | Resolution                                                                    |
| --- | --------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| A1  | Send on submission is always correct    | Collides with **edit/withdraw window**          | Timing control in v1; safer default                                           |
| A2  | “Google URL” field                      | Multi-platform orgs use Trustpilot/Facebook too | **Public review URL** (Google-first copy)                                     |
| A3  | Two CTAs in the email for “both”        | Weak tracking; easy to misuse in HTML           | **Landing page dual CTA** preferred                                           |
| A4  | Free HTML body is fine to defer         | XSS + deliverability + gating risk              | **Plain text + product CTAs in v1**                                           |
| A5  | One toggle is enough                    | Admins want **manual-only**                     | Split **enable** vs **auto-send**                                             |
| A6  | Org-wide Google URL is enough forever   | Multi-GBP franchises need per-yard links        | Org-wide v1; **explicit v1.1**                                                |
| A7  | Invoice recipient reuse is invisible OK | Support tickets when feedback≠invoice contact   | Document in UI; separate config **v1.1**                                      |
| A8  | Token/form works after cancel           | Integrity hole                                  | Withdraw → missing-job UX; soft-cancel → **reject cancelled** (see §16.4 H14) |
| A9  | Delay can wait                          | Admins want “2h later”                          | **`feedback_send_delay_hours`** in v1                                         |
| A10 | Test jobs behave like real jobs         | Pollutes customer inboxes / analytics           | **Never auto-send test jobs**                                                 |

### 15.2 Best-practice checklist (admin)

- [x] Kill switch (org)
- [x] Auto vs manual
- [x] Timing control
- [x] Destination mode (internal / public / both)
- [x] Custom copy + preview + reset + test send
- [x] Per-location mute + visibility
- [x] Reply-To
- [x] Resend with confirm
- [x] No-recipient visibility
- [x] Compliance notice (no gating)
- [ ] Frequency cap (deferred v1.1)
- [ ] Per-location public URLs (deferred v1.1)
- [ ] Separate feedback recipients (deferred v1.1)

### 15.3 Hostile questions (answered)

- **“What if they withdraw after send?”** → Job is deleted; link shows unavailable.
- **“What if there’s no location email?”** → No send; no token; job UI explains.
- **“What if admin pastes a Google maps place URL instead of write-a-review?”** → HTTPS check only in v1; helper text; S2 may add soft warning.
- **“Does this replace Ratings?”** → No; Ratings remain for internal submissions.

---

## 16. Adversarial review record (2026-07-21)

Hostile pass against codebase reality and over-scoped design. Amendments applied above.

### 16.1 Findings → amendments

| #   | Finding                                                                            | Severity     | Amendment                                                             |
| --- | ---------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------- |
| H1  | **`withdraw-job` hard-deletes** the job; S1 spoke of `approval_status = cancelled` | **Critical** | Rewrite withdraw ACs around **delete + CASCADE + missing-job UX**     |
| H2  | Mode enum `google` vs field `public_review_url`                                    | High         | Rename mode to **`public`**                                           |
| H3  | Outbox called “optional” while delay/window **require** durable scheduling         | **Critical** | Outbox **mandatory** when `send_after > now()`; CASCADE on job delete |
| H4  | Three timing modes overlap once edit window is respected                           | High         | Collapse to **`feedback_send_delay_hours` (0–168) + hard invariant**  |
| H5  | “Independent of confirmation” ignored **flagged** jobs                             | High         | **Skip auto-send when flagged**; manual with confirm                  |
| H6  | Token minted even when no recipient                                                | Medium       | Token **only** on queue/send with recipient                           |
| H7  | Resend after customer already submitted private feedback                           | Medium       | **Block** resend after private feedback (v1)                          |
| H8  | `feedback_email_send_immediately` name survives forever                            | Medium       | Migrate toward **`feedback_auto_send`**                               |
| H9  | Null `location_id` + mute undefined                                                | Low          | Mute N/A; recipient path still applies                                |
| H10 | Placeholder / XSS via admin-controlled names in “plain text”                       | Medium       | **Escape** substitutions; mode-aware empty URL placeholders           |
| H11 | Dual CTA: hide public after private submit                                         | Medium       | **Keep** public CTA after private submit in `both`                    |
| H12 | Idempotent enqueue unspecified                                                     | Medium       | **UNIQUE** pending outbox per `job_id`                                |
| H13 | Effort ~9d still tight if outbox + dual create paths + Settings                    | Note         | Revised to **~9.5d** after pass 2; do not cut outbox                  |

### 16.2 Hostile questions (pass 1)

- **“Is soft-cancel even a thing?”** → **Not for withdraw** (hard delete). Pass 2 corrected: soft-cancel **does** exist via `resolve-flagged-job` — see H14.
- **“Why keep three radios?”** → Admins care about delay; safety should be **product invariant**, not an optional mode they can forget.
- **“Should we ask for a review while the job is flagged?”** → No for auto-send.
- **“What happens to a queued email if the job is withdrawn?”** → Outbox row must disappear with the job; scheduler must not error-loop.

### 16.3 Scope pressure (accepted)

Deferred (still out): frequency cap, per-location public URLs, separate recipients, HTML templates, worker naming in email, token expiry. **Not** deferred: outbox, edit-window gate (auto+manual), withdraw/delete UX, soft-cancel reject, shared send helper, API-enforced resend rules.

### 16.4 Adversarial pass 2 (2026-07-21) — codebase-backed

Second hostile pass after re-reading edge functions, FKs, and invoice outbox. Amendments applied above.

| #   | Finding                                                                                | Severity     | Amendment                                                                          |
| --- | -------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| H14 | **`resolve-flagged-job` soft-cancels** (`cancelled`); S1 treated soft-cancel as future | **Critical** | Reject cancelled/flagged on form; skip outbox; block cancelled manual              |
| H15 | **`feedback.job_id` has no `ON DELETE CASCADE`** — withdraw fails if feedback exists   | **Critical** | Do not CASCADE-delete CSAT; block manual send in edit window; clear withdraw error |
| H16 | Auto-send **mints token with no recipient / on Resend failure**                        | High         | Token only on queue/successful send                                                |
| H17 | **`send-feedback-email` ignores `feedback_email_sent`** — UI hide is not security      | High         | Enforce in API                                                                     |
| H18 | **`admin-create-job` inlines** send logic instead of shared helper                     | High         | One helper; delete duplicate                                                       |
| H19 | Best reuse target is **`invoice_send_outbox`**, not only auto-approve-jobs             | Medium       | Document as primary pattern                                                        |
| H20 | Safety invariant applied only to auto-send left a **manual** hole                      | High         | Block manual while edit window open                                                |
| H21 | New-org “auto-send on” conflicts with DB default **false**                             | Medium       | Explicit G1 question                                                               |
| H22 | Public `/review` already shows **worker names**                                        | Low          | Leave as-is in v1; do not expand into email                                        |
| H23 | Flagged-after-send cannot unsend email                                                 | Note         | v1 rejects further submit; unsend is out of scope                                  |

#### Hostile questions (pass 2)

- **“Is soft-cancel real?”** → Yes — admin cancel of flagged jobs. Designing only for delete **misses** a live path.
- **“Should we CASCADE feedback so withdraw always works?”** → **No** — that destroys CSAT to paper over a race the edit-window invariant should prevent.
- **“Why not invent a new queue?”** → Invoice outbox already solved deferred Resend + retries in this codebase.
- **“Is the Settings toggle enough for resend policy?”** → No — the edge function must refuse illegal resends.

---

_End of S1 — gold + adversarial (pass 2) reviewed; ready for G1 on amended scope / S2 after approval._
