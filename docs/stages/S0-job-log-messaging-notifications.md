# S0 — Idea Intake: Job log → team chat notifications (WhatsApp-first, channel-agnostic)

| Field        | Value                                               |
| ------------ | --------------------------------------------------- |
| **Stage**    | S0 — Idea capture (not triage; no build commitment) |
| **Captured** | 2026-04-11                                          |
| **Product**  | Clean Log (organization / worker job logging)       |
| **Source**   | Product owner — conversational requirement          |

---

## 1. Idea (submitter language)

Organizations should be able to configure the product so that **when workers log jobs**, **job information is posted into one specific WhatsApp group** that the **organization configures** (destination is not hard-coded globally — each org chooses its group). The org **admin manages the group and membership** (e.g. adding employees). The **chat / messenger integration should stay loosely coupled** in design so additional channels can follow later without rewriting the job domain. Configuration should live **somewhere appropriate on the Settings page** (exact placement TBD in S1/S2).

---

## 2. Problem / opportunity (why this matters)

- **Visibility:** Ops, dispatch, or site leads often coordinate in WhatsApp (or similar) today; job logs are **in the product** while coordination is **in chat**. Bridging the two reduces “did anyone see that job?” friction.
- **Timeliness:** A push to a shared channel is closer to real-time awareness than expecting people to refresh the dashboard.
- **Future-proofing:** A **channel-agnostic** integration model avoids a rewrite when the org prefers Slack, Telegram, Microsoft Teams, or a webhook to an internal system.

---

## 3. Success (what “good” looks like — draft)

- An org admin can **turn the feature on**, **point the integration at the org’s chosen WhatsApp group**, and **see short job summaries appear** when workers submit jobs (subject to channel rules and delivery).
- The **core domain** (job logging, persistence, permissions) stays independent of **which** messenger is configured.
- Failures to notify **do not** block or corrupt job submission; delivery uses **silent retry** where appropriate, with **operational visibility** (logs / optional admin surfacing) to be defined in S1 — **not** inline blocking of the worker flow.

_(Exact KPIs and acceptance tests belong in S1/S2; this is only intent.)_

---

## 4. Research summary (implementation landscape — not a decision yet)

This section summarizes **public documentation and common patterns** to inform S1 triage. It is **not** a commitment to a specific vendor or architecture.

### 4.1 WhatsApp and “group chat” — important distinction

Meta documents a **WhatsApp Business Platform — Groups** capability (groups created and managed in the **business / Cloud API** model), including **group messaging** and **webhooks** for group lifecycle and messages. See the official hub:

- [WhatsApp Business Platform — Groups (overview)](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/)
- [Get started with Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/get-started/)
- [Group messaging](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/groups-messaging/)

**What this does _not_ mean (without further validation):**

- **Posting into an arbitrary existing “consumer” WhatsApp group** (the normal group chat users create in the WhatsApp app) is **not** the same product surface as the **Groups API** model. Community discussion and Meta’s own docs consistently distinguish **business-managed groups** (invite links, business phone number, API webhooks) from **consumer** group behavior. **S1 must** confirm the exact UX: “create a business-managed group via API” vs “use an existing group” — the second may be **unsupported or policy-risky** if it relies on unofficial automation.

**Implication for the idea:** The _intent_ (“job info goes to a WhatsApp group”) may map to **(A)** a **Business Platform group** the org adopts for this workflow, or **(B)** a different WhatsApp pattern (e.g. **1:1 or multi-recipient** templates to opted-in numbers) if the true requirement is “everyone gets the alert” rather than “one shared thread.” S1 should clarify with the stakeholder.

### 4.2 Loose coupling — recommended design patterns

| Pattern                                 | Purpose                                                                                                                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ports & adapters (hexagonal)**        | Define an internal contract like `JobNotificationSink` or `OutboundJobSummary` with implementations: `WhatsAppGroupsAdapter`, `SlackAdapter`, `TelegramAdapter`, `WebhookAdapter`. The job pipeline **emits a canonical event**; it does not import vendor SDKs.                                       |
| **Domain event**                        | Publish something like `JobSubmitted` / `JobLogged` (after successful commit) with a stable payload (job id, org, location, summary fields, timestamps). **Idempotency key** = job id + event version (or dedupe hash).                                                                                |
| **Notification / integration settings** | Org-level config: enabled flag, **channel type**, **secrets references** (not plaintext in UI), optional **message template** / field mask, and **which jobs** qualify (e.g. all vs per-location). Lives under **Settings** as a dedicated subsection (e.g. “Integrations” or “Notifications → Chat”). |
| **Reliable delivery**                   | **Transactional outbox** or **queue** (async worker): job write succeeds first; outbound send is **async** with retries and a **dead-letter** path. Never block the worker app on a third-party API.                                                                                                   |
| **Webhook escape hatch**                | A **generic HTTPS webhook** adapter lets advanced customers integrate **anything** (Zapier, n8n, custom bridge) without you building every messenger first.                                                                                                                                            |

### 4.3 Security, compliance, and product policy

- **Secrets:** Store API tokens / system user tokens in a **secret manager** or encrypted DB; rotate and audit.
- **WhatsApp:** Template messages, **opt-in**, and **24-hour conversation** rules apply to many business-initiated flows; **group** pricing and windows are documented under Meta’s [Groups pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/pricing/) — **S1 must** align messaging copy with legal/compliance review.
- **PII:** Job summaries may include customer site or worker-identifiable data; admins must understand **what** is posted to a shared channel.

### 4.4 Alternatives if WhatsApp groups are constrained

- **Broadcast to opted-in numbers** (1:1 template or utility messages) — different UX, often easier to explain policy-wise.
- **Microsoft Teams / Slack connectors** — many orgs already use these for ops; fits the same **adapter** model.
- **Email** — already common; not a replacement for chat but a **fallback channel** in the same abstraction.

---

## 5. Stakeholder preferences (captured) vs open questions (S1)

### 5.1 Captured preferences (product direction)

| Topic                | Preference                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Destination**      | Messages should land in **one org-configured WhatsApp group** (the org designates **which** group). The **group is managed by the org** (admin adds employees, etc.). |
| **Volume**           | Expect **generally &lt; 30 jobs per day** per org (order of magnitude for rate limits and cost — not a hard cap).                                                     |
| **Message shape**    | **Short summary** of the job — e.g. **key numbers, location, workers** — not full job detail in chat.                                                                 |
| **Failure handling** | **Silent retry** is appropriate; job submission must remain successful independently of chat delivery.                                                                |
| **Channels**         | **WhatsApp first**; treat **another channel / webhook** as a later phase, not required for initial scope.                                                             |

### 5.2 Open questions (still for S1 — triage / validation)

1. **Platform fit:** Meta’s **WhatsApp Business Platform — Groups** model may differ from “post into **any** arbitrary consumer group.” S1 must confirm **technical and policy** fit between “org-configured destination” and what the **official API** supports (vs business-managed group, invite flows, etc.). See §4.1.
2. **Audience / PII:** Confirm who may appear in summaries (workers, site names) and **consent / workplace norms** for a shared ops group — **internal staff only** vs broader membership.
3. **Observability:** Beyond silent retry, does the org need **in-app delivery status**, **failed-send queue**, or **email to admin** in v1 — or is **logging + support** enough?
4. **Deep link:** Should the short summary **include a link** back to the job in the dashboard (recommended for “short summary” UX) — and if so, auth / mobile handling?

---

## 6. Out of scope for S0 (explicit)

- Choosing BSP vs self-hosted Cloud API.
- Final UI mockups or exact Settings navigation.
- Pricing or commercial commitments with Meta or third parties.

---

## 7. Post–gate check (S0 quality)

> If someone reads this idea in 6 months with no other context, will they understand what was meant?

**Reader should take away:** Organizations want **job submissions** to trigger **short summaries** into **one org-configured WhatsApp group** (admin-managed membership), at **modest daily volume**, with **silent retry** and **WhatsApp-first** scope; **Settings** will hold the destination configuration; **official WhatsApp / Groups API** capabilities and **policy constraints** must still be validated in S1 before build commitments.

---

## 8. References (external)

- Meta — [WhatsApp Business Platform — Groups](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/)
- Meta — [Group messaging](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/groups-messaging/)
- Meta — [Send messages (overview)](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages/) (1:1 and general platform concepts)

---

_End of S0 — ready for S1 triage (feasibility, product fit, risk, and phased scope)._
