# S0 — Idea Intake: Configurable customer feedback & review requests

| Field        | Value                                                               |
| ------------ | ------------------------------------------------------------------- |
| **Stage**    | S0 — Idea capture (not triage; no build commitment)                 |
| **Captured** | 2026-07-21                                                          |
| **Product**  | Tally Runner (post-job customer feedback / ratings)                 |
| **Source**   | Product owner — conversational requirement (session with GIMBAL-34) |

---

## 1. Idea (submitter language)

After a job is submitted, the **business / yard** should receive a **review link email**. This should happen **whether or not** the job needs colleague confirmation — confirmation is a worker workflow; the customer still experienced the visit.

Admins should be able to:

- **Configure** feedback emails in Settings (today there is little beyond a simple on/off).
- **Enter custom text** they want sent to every yard — e.g. “We have finished the work — if you’d like to leave any feedback, you can do so via the link.”
- **Turn the feature off** for a while, or **limit emails for certain locations**.
- Decide whether reviews are **internal** (Tally’s private form), **Google** (public), or **both** — after discussing that Google reviews may be more valuable for reputation while internal reviews are better for ops.

Optionally explore whether naming the **employee who performed the work** in feedback helps rapport (uncertain; needs care for privacy and multi-worker jobs).

---

## 2. Problem / opportunity (why this matters)

- **Partial product today:** Orgs already have `feedback_email_send_immediately` and `rating_config`, plus a hardcoded Resend template and `/review/[token]` form. Admins cannot brand the ask, mute specific yards, or choose public vs private reputation channels.
- **Ops vs marketing:** Internal CSAT supports coaching and complaint handling; Google reviews support discovery and trust. Commercial yards may prefer private feedback; mixed businesses may want both.
- **Trust & compliance:** Any dual-path design must avoid **review gating** (only sending happy customers to Google), which violates Google Business Profile guidelines.
- **Control:** Temporary global pause and per-location mute prevent spam during disputes, onboarding, or internal-only sites.

---

## 3. Success (what “good” looks like — draft)

- An admin can configure **mode** (internal / Google / both), **custom subject + body**, **org kill switch**, and **per-location opt-out**.
- Eligible jobs trigger a feedback request on **submission** (independent of `approval_status`), unless muted.
- Manual send from completed jobs remains available when auto-send is off.
- Email failures never block job submission.
- Google asks are **compliant** (no star-based filtering before showing the Google link).

_(Exact acceptance tests belong in S1/S2.)_

---

## 4. Context already in the product

| Capability                    | Status today                                                        |
| ----------------------------- | ------------------------------------------------------------------- |
| Org toggle auto-send          | Exists — Settings “Send Feedback Requests Immediately”              |
| Rating form shape             | Exists — `rating_config` (single / three_dimensions / rater)        |
| Email template copy           | Hardcoded in `feedback-email.ts`                                    |
| Send timing vs confirmation   | Sends on job create when toggle on (does **not** wait for approval) |
| Recipient resolution          | Reuses invoice email recipient config                               |
| Manual send                   | Exists — completed jobs → send feedback email                       |
| Per-location mute             | **Missing**                                                         |
| Custom subject/body           | **Missing**                                                         |
| Google review URL / dual mode | **Missing**                                                         |
| Worker names in email / form  | **Missing** (optional; deferred preference)                         |

---

## 5. Stakeholder preferences (captured)

| Preference           | Direction                                                                 |
| -------------------- | ------------------------------------------------------------------------- |
| Send vs confirmation | Send on **job submission**; do not wait for colleague confirmation        |
| Custom copy          | Org-level template admins can edit                                        |
| Pause / limit        | Org off switch + ability to limit certain locations                       |
| Internal vs Google   | Admin chooses **internal only**, **Google only**, or **both** (equal UX)  |
| Review gating        | **Do not** implement “only happy → Google”                                |
| Naming workers       | Interesting for rapport; prefer **optional / careful**, not email default |

---

## 6. Open questions for S1

1. Google URL: one org-wide GBP link, or per-location Google place URLs?
2. Template variables: minimum set (`{{org}}`, `{{location}}`, `{{date}}`, link placeholders)?
3. Delay option (immediate vs N hours) in v1, or only immediate + manual?
4. When mode is **both**, is the landing experience one email with two CTAs, or internal page that also offers Google?
5. Worker naming: v1 out of scope, or optional form question only?

---

## 7. Related docs / code

- `database/supabase/functions/_utils/feedback-email.ts`
- `database/supabase/functions/create-job/handlers/maybe-send-job-feedback-email.ts`
- `dashboard/app/dashboard/settings/page.tsx` (Feedback & Rating Settings)
- `docs/research/feedback-email-implementation-recommendations.md`
- Org email domain work: `S0-org-resend-email-domain.md` / `S1-org-resend-email-domain.md` (from-address branding; complementary)

---

## 8. Post-stage gate

A reader in six months can understand: expand post-job review requests from a hardcoded internal email into a **configurable, location-aware, compliance-safe** system supporting **internal CSAT and/or Google reviews**.

---

_End of S0 — proceed to S1 triage._
