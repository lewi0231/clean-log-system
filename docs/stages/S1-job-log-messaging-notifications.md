# S1 — Triage: Job log → team chat notifications (WhatsApp-first, channel-agnostic)

| Field       | Value                                         |
| ----------- | --------------------------------------------- |
| **Stage**   | S1 — Triage (feasibility, risk, phased scope) |
| **From S0** | 2026-04-11                                    |
| **Triaged** | 2026-04-12                                    |
| **Product** | Clean Log (organization / worker job logging) |

---

## 1. S0 Recap

Organizations want job submissions to trigger short summaries into one org-configured WhatsApp group (admin-managed membership), at modest daily volume (~30 jobs/day), with silent retry and WhatsApp-first scope. Settings will hold the destination configuration.

---

## 2. Open Questions Resolution

### 2.1 Platform Fit (Q1) — CRITICAL FINDING

**Research conclusion:** The official WhatsApp Business API **does not support posting to existing consumer WhatsApp groups**.

| Capability                     | Supported? | Notes                                                   |
| ------------------------------ | ---------- | ------------------------------------------------------- |
| Post to existing group chats   | **No**     | API designed for 1:1 business-to-customer communication |
| Create business-managed groups | Limited    | Groups created via API, not integration with existing   |
| Third-party unofficial tools   | Risk       | QR-based/unofficial APIs violate ToS, risk account bans |

**Implication:** The original requirement ("post to an existing WhatsApp group the org already uses") is **not achievable** via official, compliant APIs.

**Recommended pivot options:**

| Option                               | Description                                                                 | Pros                                                  | Cons                                              |
| ------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| **A. Broadcast to opted-in numbers** | Send individual template messages to each team member                       | Officially supported, compliant                       | Not a shared thread; each person sees 1:1 message |
| **B. Webhook-first**                 | Generic webhook adapter; org uses Zapier/n8n/Make to bridge to any platform | Fully flexible; no Meta dependency                    | Requires org to configure external automation     |
| **C. Slack/Teams connector**         | Native integration with business chat platforms                             | Many orgs already use; official APIs support channels | Not WhatsApp                                      |
| **D. Email fallback**                | Send job summaries to a distribution list                                   | Universal; no API restrictions                        | Not real-time chat UX                             |

**Recommendation for v1:** Implement **Option B (Webhook-first)** as the primary architecture. This:

- Keeps the system channel-agnostic from day one
- Lets advanced orgs bridge to WhatsApp via tools like Zapier (which handle the unofficial complexity at their risk)
- Provides a compliant, low-risk foundation
- Can add native Slack/Teams adapters in future phases

### 2.2 Audience / PII (Q2) — RESOLVED

**Confirmed:** Summaries may include:

- **Workers** — names of workers who participated
- **Site names** — location/site identifiers
- **Job information** — key numbers, timestamps, summary fields

**Scope:** Internal staff only (ops group, not customer-facing).

**Action:** No additional consent flow required for v1; standard employment context. Document in Settings UI that "job details will be shared with configured destination."

### 2.3 Observability / Failed-Send Queue (Q3) — RESEARCHED

**Research findings on best practices:**

| Pattern                          | Purpose                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------- |
| **Dead Letter Queue (DLQ)**      | Never silently drop failed messages; move to DLQ after max retries for inspection |
| **Exponential backoff + jitter** | Avoid thundering herd; delays: 1s → 2s → 4s → 8s with randomization               |
| **Error categorization**         | Retryable (429, 503, timeout) vs permanent (400, 401, 422)                        |
| **Idempotency keys**             | Prevent duplicate sends; use `job_id + event_version`                             |

**Recommended v1 implementation:**

1. **Outbox table** (`notification_outbox`) — stores pending webhook deliveries
2. **Background worker** (Edge Function on schedule or pg_cron) — processes outbox with retries
3. **DLQ table** (`notification_dlq`) — failed items after max retries (default: 5 attempts)
4. **Admin visibility** — simple "Failed Notifications" section in Settings showing DLQ count with ability to retry/dismiss

**Not required for v1:**

- Email alerts to admin (logging + dashboard visibility sufficient)
- Complex queue infrastructure (Supabase Queues/pgmq could be future optimization)

### 2.4 Deep Link (Q4) — RESOLVED

**Confirmed:** No link required for v1. Summaries contain information only; users can reference dashboard separately if needed.

---

## 3. Technical Feasibility

### 3.1 Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Job Submitted  │────▶│ notification_    │────▶│  Webhook Worker │
│  (Edge Fn)      │     │ outbox (table)   │     │  (scheduled)    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              │
                        │ notification_dlq │◀─────────────┤ (after max retries)
                        │ (dead letter)    │              │
                        └──────────────────┘              │
                                                          ▼
                                              ┌─────────────────────┐
                                              │ Configured Webhook  │
                                              │ (org's endpoint)    │
                                              └─────────────────────┘
```

### 3.2 Domain Separation

| Layer                   | Responsibility                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------- |
| **Job domain**          | Submit job, persist, return success — **no awareness** of notifications               |
| **Event emission**      | After job commit, insert row into `notification_outbox` (same transaction or trigger) |
| **Notification worker** | Separate Edge Function; reads outbox, attempts delivery, handles retries              |
| **Adapters**            | v1: Generic webhook. Future: Slack, Teams, email adapters                             |

### 3.3 Database Schema (Draft)

```sql
-- Organization webhook configuration
CREATE TABLE organization_webhook_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  webhook_url TEXT,  -- Encrypted at rest
  secret_token TEXT, -- For HMAC signing (encrypted)
  message_template JSONB, -- Optional field selection
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Notification outbox (transactional outbox pattern)
CREATE TABLE notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization(id),
  job_id UUID NOT NULL REFERENCES job(id),
  payload JSONB NOT NULL,  -- Canonical job summary
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Dead letter queue for failed notifications
CREATE TABLE notification_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_outbox_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organization(id),
  job_id UUID NOT NULL REFERENCES job(id),
  payload JSONB NOT NULL,
  total_attempts INTEGER NOT NULL,
  final_error TEXT,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT CHECK (resolution IN ('retried', 'dismissed', NULL))
);

-- Indexes for worker efficiency
CREATE INDEX idx_outbox_pending ON notification_outbox(status, next_retry_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX idx_outbox_org ON notification_outbox(organization_id);
CREATE INDEX idx_dlq_org ON notification_dlq(organization_id) WHERE resolved_at IS NULL;
```

### 3.4 Webhook Payload (v1)

```json
{
  "event": "job.submitted",
  "timestamp": "2026-04-12T10:30:00Z",
  "organization_id": "uuid",
  "job": {
    "id": "uuid",
    "submitted_at": "2026-04-12T10:30:00Z",
    "completed_at": "2026-04-12T10:15:00Z",
    "location": {
      "name": "Site Alpha",
      "address": "123 Main St"
    },
    "workers": [
      { "name": "John Smith" },
      { "name": "Jane Doe" }
    ],
    "summary": {
      "start_time": "08:00",
      "finish_time": "10:15",
      "custom_fields": { ... }
    }
  },
  "idempotency_key": "job_uuid_v1"
}
```

### 3.5 Security Considerations

| Concern                 | Mitigation                                           |
| ----------------------- | ---------------------------------------------------- |
| **Webhook URL storage** | Encrypt at rest; never log full URL                  |
| **Request signing**     | HMAC-SHA256 signature in header; org provides secret |
| **Rate limiting**       | Max 1 notification per job; backoff on failures      |
| **PII in transit**      | HTTPS required; warn admin about data exposure       |

---

## 4. Risk Assessment

| Risk                          | Likelihood | Impact | Mitigation                                                                      |
| ----------------------------- | ---------- | ------ | ------------------------------------------------------------------------------- |
| WhatsApp expectation mismatch | Medium     | High   | Clear documentation that v1 is webhook-based; WhatsApp requires external bridge |
| Webhook endpoint unreliable   | Medium     | Low    | DLQ + retry pattern; silent failure doesn't affect jobs                         |
| Configuration complexity      | Low        | Medium | Simple UI; single webhook URL + optional secret                                 |
| Secret exposure               | Low        | High   | Encrypted storage; audit logs; rotation support                                 |

---

## 5. Scope Definition

### 5.1 In Scope (v1)

| Area                 | Deliverable                                                                     |
| -------------------- | ------------------------------------------------------------------------------- |
| **Database**         | `organization_webhook_config`, `notification_outbox`, `notification_dlq` tables |
| **Settings UI**      | "Integrations" section with webhook configuration (URL, secret, enable/disable) |
| **Edge Function**    | `process-notification-outbox` — scheduled worker (every 1 min or on-demand)     |
| **Job integration**  | Trigger outbox insert after successful job creation                             |
| **Admin visibility** | Badge/count showing failed notifications; simple list view of DLQ               |
| **Documentation**    | Webhook payload spec; setup guide for Zapier/n8n integration                    |

### 5.2 Out of Scope (v1)

| Item                           | Rationale                                       |
| ------------------------------ | ----------------------------------------------- |
| Native WhatsApp integration    | Official API doesn't support group posting      |
| Native Slack/Teams adapters    | Future phase; webhook covers advanced users now |
| Email notifications            | Different UX; can add as separate adapter later |
| Per-location webhook config    | Start simple; org-level only for v1             |
| Message template customization | Default payload; custom templates in v2         |
| Dashboard link in payload      | Not required per stakeholder                    |

### 5.3 Future Phases (Backlog)

- **Phase 2:** Native Slack adapter (incoming webhook + rich formatting)
- **Phase 2:** Native Microsoft Teams adapter
- **Phase 3:** Per-location webhook configuration
- **Phase 3:** Message template builder in UI
- **Phase 4:** WhatsApp broadcast (1:1 to opted-in numbers) if demand exists

---

## 6. Effort Estimate

| Component                     | Estimate   | Notes                            |
| ----------------------------- | ---------- | -------------------------------- |
| Database migrations           | 0.5 day    | 3 tables + indexes               |
| Edge Function (outbox worker) | 1 day      | Retry logic, error handling, DLQ |
| Job submission integration    | 0.5 day    | Trigger/insert after job commit  |
| Settings UI (webhook config)  | 1 day      | Form, validation, test button    |
| Settings UI (DLQ view)        | 0.5 day    | List + retry/dismiss actions     |
| Testing                       | 1 day      | Unit + integration tests         |
| Documentation                 | 0.5 day    | Webhook spec, Zapier guide       |
| **Total**                     | **5 days** |                                  |

---

## 7. Acceptance Criteria (Draft)

1. **Configuration:** Admin can enable webhook integration and provide URL + optional secret in Settings
2. **Delivery:** When a job is submitted, a webhook POST is sent to the configured URL within 2 minutes
3. **Payload:** Webhook contains job ID, location, workers, timestamps, and summary fields
4. **Signing:** If secret is configured, request includes `X-Webhook-Signature` header (HMAC-SHA256)
5. **Retry:** Failed deliveries retry with exponential backoff (up to 5 attempts over ~30 minutes)
6. **DLQ:** After max retries, notification moves to DLQ; visible in Settings with retry/dismiss options
7. **Isolation:** Webhook failures do not block or affect job submission success
8. **Test:** Settings UI includes "Send Test" button to verify webhook configuration

---

## 8. Dependencies

| Dependency                    | Status    | Owner                                         |
| ----------------------------- | --------- | --------------------------------------------- |
| Job submission Edge Function  | Exists    | —                                             |
| Settings page infrastructure  | Exists    | —                                             |
| pg_cron or scheduled function | Available | Supabase                                      |
| Encrypted column support      | TBD       | May use vault or application-level encryption |

---

## 9. Decision Log

| Date       | Decision                            | Rationale                                                        |
| ---------- | ----------------------------------- | ---------------------------------------------------------------- |
| 2026-04-12 | Webhook-first (not native WhatsApp) | Official WhatsApp API doesn't support posting to existing groups |
| 2026-04-12 | Transactional outbox pattern        | Reliable delivery without blocking job submission                |
| 2026-04-12 | DLQ with admin visibility           | Balance between silent retry and operational awareness           |
| 2026-04-12 | No deep links in v1                 | Stakeholder confirmed information-only sufficient                |

---

## 10. Next Steps (S2)

- [ ] Finalize database schema with encryption approach
- [ ] Design Settings UI wireframes
- [ ] Define webhook signature algorithm (HMAC-SHA256 recommended)
- [ ] Create Zapier/n8n integration guide template
- [ ] Identify test organization for pilot

---

_End of S1 — ready for S2 design and implementation planning._
