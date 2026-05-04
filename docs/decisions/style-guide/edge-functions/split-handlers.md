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
