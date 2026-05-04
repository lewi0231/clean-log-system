# Splitting large Edge handlers

Companion initiative: [`docs/stages/S2-split-large-edge-handlers.md`](../../../stages/S2-split-large-edge-handlers.md) (pilot: **`create-job`**).

Related conventions:

- Folder layout and entrypoints: [`structure.md`](./structure.md)
- Edge unit vs integration tests: [`testing.md`](./testing.md)
- Auth must not be weakened during extraction: [`auth.md`](./auth.md)
- Unified HTTP shell (**after** extraction when entrypoints are still large): [`handler-pipeline.md`](./handler-pipeline.md) — **`identity`** preset remains deferred ([unified S2 §6.4](../../../stages/S2-unified-edge-handler-pipeline.md#64-deferred-phase-2-identity-preset))

---

## Decision rule (`_utils` vs function-local)

| Placement                                                                     | Use when                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `database/supabase/functions/<function>/handlers/*.ts` (and/or `domain/*.ts`) | Logic **only** meaningful inside **one** deployed function         |
| `database/supabase/functions/_utils/<topic>.ts`                               | Shared by **≥2** functions **or** a stable **named domain** helper |

Do **not** use `_utils` as a dumping ground; see [S1 §5 G6](../../../stages/S1-split-large-edge-handlers.md).

---

## Entrypoint shape

After extraction, **`index.ts`** should stay **thin**:

1. **`handleCors`** / **OPTIONS** first — before reading the body ([S2 §4.1 T7](../../../stages/S2-split-large-edge-handlers.md#41-pilot-create-job)).
2. Delegate to **`handlers/`** modules.
3. Keep **one** outer **`try` / `catch`** using **`extractErrorMessage`** + **`getErrorStatusCode`** unless the pipeline replaces that pattern later.

No **new** business rules in the entrypoint — preserve HTTP status codes and JSON shapes.

---

## Raw body / webhooks

For **`stripe-webhook`** and similar: **one** read of the raw payload per request; dispatch modules receive **parsed data or bytes**, never a second read on the same [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request). Align with [`handler-pipeline.md`](./handler-pipeline.md) (**raw** discipline).

---

## Reference layout (illustrative)

Pilot implementation:

- `database/supabase/functions/create-job/index.ts` — wiring only
- `database/supabase/functions/create-job/handlers/*.ts` — e.g. **`resolve-create-job-context`**, **`validate-create-job-request`**, **`insert-job-and-related-records`**, **`maybe-send-job-feedback-email`**, **`run-create-job-persistence`**, **`submission-parsing`** (pure helpers)

Tests may live under `database/supabase/functions/__tests__/` or next to modules; prefer **`pnpm test:edge-unit`** for fast feedback.

---

## Staging smoke (`create-job` pilot)

Run after deploy to staging (S2 **SC4** — parity). Automated suite cannot substitute full HTTP + auth + DB.

1. **Happy path** — authenticated user with org + valid body → **201**, payload `{ success: true, job: { id, organization_id, location_id, completed_at, created_at } }`.
2. **401** — no `Authorization` or invalid JWT → same messages as before (**Authentication required** / **User not found**).
3. **404** — user not in any org → fixed administrator message (unchanged).
4. **400** — malformed JSON; missing **`submissionData`**; invalid location or colleague IDs → same statuses/messages.
5. **OPTIONS** — CORS preflight still succeeds (**§4.1 T7**).
6. **Side paths** (if configurable on staging): colleague confirmation pending flow; optional **`feedback_email_send_immediately`** / auto-invoice org flags — observe logs only unless regressions appear.

Record correlation IDs from responses when investigating anomalies.

---

## Reference layout — `stripe-webhook` (Rank 3 milestone 2a)

Same rules as above: **one** read of the raw body ([§ Raw body / webhooks](#raw-body--webhooks)); **`index.ts`** stays orchestration-only.

- `database/supabase/functions/stripe-webhook/index.ts` — **CORS**, **`loadEnvIfLocal`**, **`verifyStripeWebhookRequest`** → **`ensureWebhookEventRecord`** → **`dispatchStripeEvent`** → **`markWebhookEventProcessed`**, outer **`catch`** / failed-row update.
- `handlers/verify-stripe-webhook-request.ts` — **POST**, **`req.text()`**, signature verification.
- `handlers/ensure-webhook-event-record.ts` — idempotency check + **`webhook_event`** insert.
- `handlers/dispatch-stripe-event.ts` — **`switch (event.type)`** (Stripe event handlers).
- `handlers/mark-webhook-event-processed.ts` — success **`processed_at`** update.

### Staging smoke (`stripe-webhook`)

Run against **staging** Stripe webhook endpoint (or **`stripe listen`** → local Edge) after deploy. Confirm **`200`** JSON `{ received: true }` and DB side-effects unchanged vs pre-split.

| #   | Scenario                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`checkout.session.completed`** with valid **`invoice_id`** metadata → **`payment_link`** updated; **`payment`** row; **`invoice`** totals; optional email path — match prior behaviour. |
| 2   | Duplicate **`event.id`** → **`200`** with **`Event already processed`** body (idempotency).                                                                                               |
| 3   | Invalid signature → **400** (message unchanged).                                                                                                                                          |
| 4   | **`payment_intent.succeeded`** / **`payment_failed`** / **`charge.refunded`** / **`charge.dispute.created`** — spot-check DB updates on staging test data.                                |
| 5   | **OPTIONS** — CORS preflight succeeds.                                                                                                                                                    |

Correlate **`event.id`** with **`webhook_event`** rows when debugging.

---

## Reference layout — `calculate-worker-payment` (Rank 3 milestone **2b**)

Financial core: keep **`index.ts`** limited to **CORS**, **`req.json()`** validation, and **`try`/`catch`**; load data + orchestrate in **`handlers/run-*`**, pure pricing/split logic in **`handlers/calculation-engine.ts`**.

- `database/supabase/functions/calculate-worker-payment/index.ts` — **`handleCors`**, body validation (**`organization_id`**, non-empty **`job_ids`**), delegate **`runCalculateWorkerPaymentPersistence`**.
- `handlers/types.ts` — request-local interfaces (**`WorkerPaymentCalculation`**, **`PricingRuleRow`**, …).
- `handlers/worker-rate-card-map.ts` — **`buildWorkerRateCardMultiMap`**, **`getWorkerRateCard`**.
- `handlers/calculation-engine.ts` — **`calculateWorkerPayment`**, **`calculateWorkerSplits`**, and pricing helpers (**~970 LOC**, unchanged behaviour vs monolith).
- `handlers/run-calculate-worker-payment-persistence.ts` — org gate, Supabase reads (**jobs**, field configs, hierarchy, rules, rate cards, **`job_worker`**), per-job loop, **`jsonResponse`**.

Shared split math remains in **`_utils/worker-payment-split.ts`** ([worker-payment-split tests](../../../../database/supabase/functions/_utils/__tests__/worker-payment-split.test.ts)).
