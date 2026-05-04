# S2 — Features & Functions: Split large Edge handlers

| Field                | Value                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**            | S2 — Features & Functions (scope lock + acceptance criteria)                                                                                                                                                                                                                                                                                |
| **From**             | [S1 — Split large Edge handlers](./S1-split-large-edge-handlers.md) — triage **GO**                                                                                                                                                                                                                                                         |
| **Created**          | 2026-05-06                                                                                                                                                                                                                                                                                                                                  |
| **Gold reviewed**    | 2026-05-06 — reconciled pilot acceptance codes + LOC against [`create-job/index.ts`](../../database/supabase/functions/create-job/index.ts); test layout vs [`create-job.test.ts`](../../database/supabase/functions/__tests__/create-job.test.ts); §6.4 anchors                                                                            |
| **Diamond reviewed** | 2026-05-06 — adversarial + cross-doc (`identity` heterogeneity, catch-path statuses, CORS, webhook raw body, pipeline merge order); acceptance + checklist amended                                                                                                                                                                          |
| **Depends on**       | [Org authorization S1](./S1-edge-function-org-authorization-enforcement.md); [Unified pipeline S2](./S2-unified-edge-handler-pipeline.md) — **reference only** for **`identity`** deferral ([§6.4](./S2-unified-edge-handler-pipeline.md#64-deferred-phase-2-identity-preset)); pilot extraction **does not** require pipeline code changes |
| **Product**          | Tally Runner — Supabase Edge Functions                                                                                                                                                                                                                                                                                                      |

---

## Gold review summary

| Dimension        | Finding                                                                                                                                                                   | Amendment                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accuracy**     | §4.1 **T3** assumed **200** success                                                                                                                                       | Happy path returns **`201`** with `{ success, job }` — acceptance criteria updated ([`create-job` response](../../database/supabase/functions/create-job/index.ts)).                                                                                                                                  |
| **Accuracy**     | §4.1 **T2** cited **403** org-resolution failures                                                                                                                         | Current handler returns **404** when user has **no organization**; location/colleague mismatches return **400** — **no early-return `403`** on those paths (**global `catch`** may still yield **`403`** via [`getErrorStatusCode`](../../database/supabase/functions/_utils/http.ts) — **§4.1 T6**). |
| **Completeness** | Existing tests                                                                                                                                                            | Document [`database/supabase/functions/__tests__/create-job.test.ts`](../../database/supabase/functions/__tests__/create-job.test.ts) — normalization / validation helpers today; extend or colocate tests next to new **`handlers/`** modules per PR convention.                                     |
| **Consistency**  | “Phase 1” ambiguous vs unified pipeline                                                                                                                                   | Clarified as **split-initiative pilot milestone** — not the same as pipeline **Phase 1** (`secured`/`public`).                                                                                                                                                                                        |
| **DX**           | Style-guide folder already has [`structure.md`](../decisions/style-guide/edge-functions/structure.md), [`testing.md`](../decisions/style-guide/edge-functions/testing.md) | **`split-handlers.md`** should cross-link those; pipeline/auth links retained.                                                                                                                                                                                                                        |

---

## Diamond review summary

**Scope:** Hostile read against live Edge patterns, [unified pipeline S2 Diamond](./S2-unified-edge-handler-pipeline.md#diamond-review-summary) themes, and pilot seams — **without** expanding scope into **`identity`** **`serveJsonHandler`** design.

| Dimension                | Finding                                                                                                                                                                                                                                                                                                                                       | Amendment                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Consistency**          | Unified pipeline Diamond: **`identity` (4)** is **not** one auth/orchestration shape ([`get-organization-id`](../../database/supabase/functions/get-organization-id/index.ts) vs [`create-job`](../../database/supabase/functions/create-job/index.ts)).                                                                                      | **§1** + **§9:** pilot playbook is **`create-job`-scoped**; other **`identity`** handlers need **per-handler** seam validation — **no** assumption that the same `handlers/*` layout ports verbatim.       |
| **Accuracy**             | **§4.1 T2** claims **no `403`** on validation paths — **true for early returns**, but the **global `catch`** uses [`getErrorStatusCode`](../../database/supabase/functions/_utils/http.ts) — thrown errors whose messages match **permission / forbidden / …** heuristics can still yield **`403`** (also **`409`**, **`500`** fall-through). | New **§4.1 T6** — preserve **`catch`** mapping (`extractErrorMessage` + `getErrorStatusCode`) and parity for **representative thrown** errors vs pre-refactor (fixtures optional).                         |
| **Completeness**         | **CORS preflight** (`handleCors`) is easy to regress when thinning **`index.ts`**.                                                                                                                                                                                                                                                            | **§4.1 T7** — **OPTIONS** / preflight still succeeds as today; **§7** checklist + **§11 I5** invariant — **`handleCors` first** before any body read.                                                      |
| **Completeness**         | **`stripe-webhook`** milestone (**§3**) touches **raw** bodies — risk of **double-consuming** `Request` when splitting routers ([unified **`raw`** preset](./S2-unified-edge-handler-pipeline.md#2-preset-matrix)).                                                                                                                           | **§3** note + **§8** risk row — **single** read of raw payload per request; dispatch modules receive **parsed payload or bytes**, not a re-used `Request`.                                                 |
| **Operations**           | Two initiatives can collide: **this extraction** vs **`serveJsonHandler`** adoption on the same function.                                                                                                                                                                                                                                     | **§8** risk **Merge order** — for **`create-job`**, **merge extraction before** HTTP-shell / pipeline migration unless explicitly coordinated (same PR owner); avoids conflicting churn in **`index.ts`**. |
| **Security / semantics** | **404** when user has **no organization** is **contract-locked** parity (**§4.1 T2**) — not an invitation to redesign enumeration semantics in the pilot.                                                                                                                                                                                     | **§9** bullet — **no** status/body “hardening” experiments under extraction-only PRs without **separate** triage ([S1 G3](./S1-split-large-edge-handlers.md)).                                             |

**Adversarial prompts (retain for PR review):** **A-1** — Does **`catch`** still map errors exactly like the monolith? **A-2** — Did **`OPTIONS`** break? **A-3** — For **`stripe-webhook`**, is there exactly **one** raw-body consumer?

**Gate:** Diamond complete — pilot PR may proceed under **§4** + **§11**; **`identity`** preset family remains **§9 / unified §6.4**.

---

## 1. Feature summary

**Extract-first refactor:** Move cohesive logic out of oversized **`database/supabase/functions/<name>/index.ts`** files into:

- **`database/supabase/functions/<name>/handlers/*.ts`** and/or **`domain/*.ts`** — orchestration **private** to one deployed function, or
- **`database/supabase/functions/_utils/<topic>.ts`** — when **≥2 callers** or a **named domain** concept applies ([S1 §5–§6](./S1-split-large-edge-handlers.md)).

**Cross-cutting (Diamond):** The **`identity`** inventory class contains **multiple distinct handler shapes** ([unified pipeline Diamond](./S2-unified-edge-handler-pipeline.md#diamond-review-summary)). This S2 pilot **proves extraction for [`create-job`](../../database/supabase/functions/create-job/index.ts) only** — other **`identity`** functions require their **own** seam map before copying the folder layout.

**Explicit non-goals for this initiative’s pilot milestone** (do **not** confuse with unified pipeline **Phase 1** — `secured` / `public`):

- No intentional change to **HTTP status**, **JSON shapes**, or **`functions-inventory.yaml`** classifications.
- **`serveJsonHandler`** migration for **`identity`** handlers (**e.g.** pilot [`create-job`](../../database/supabase/functions/create-job/index.ts)) is **out of scope for the pilot PR** — unified pipeline defers **`identity`** preset behavior ([§6.4](./S2-unified-edge-handler-pipeline.md#64-deferred-phase-2-identity-preset)); splitting reduces LOC **before** any future pipeline wrapper.

---

## 2. Pilot lock — `create-job`

| Field               | Value                                                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inventory class** | **`identity`** ([`functions-inventory.yaml`](../../database/supabase/functions/functions-inventory.yaml)) — JWT + org inference + large orchestration ([unified pipeline §6.4](./S2-unified-edge-handler-pipeline.md#64-deferred-phase-2-identity-preset)) |
| **Baseline LOC**    | **753** lines `index.ts` (**verified** gold review **2026-05-06** via `wc -l`; refresh before each milestone)                                                                                                                                              |
| **Success targets** | [S1 SC1–SC4](./S1-split-large-edge-handlers.md): **SC1** ≥40% `index.ts` LOC reduction; **SC2** ≥80% coverage on new modules; **SC3** layout convention documented; **SC4** staging parity (no contract drift)                                             |

### 2.1 Suggested extraction seams (non-prescriptive — validate against source)

_Order auth before any trust of body; preserve existing call order._

| Seam                                      | Likely home                                                                                                                                                             | Notes                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| JWT extract + `getAuthUser`               | `handlers/auth-context.ts` or inline thin `index`                                                                                                                       | Must mirror today’s failure responses (`401` / “User not found”)                                                           |
| Org resolution (admin email → worker)     | `handlers/resolve-organization.ts`                                                                                                                                      | Uses existing [`auth.ts`](../../database/supabase/functions/_utils/auth.ts) helpers — **do not** fork membership semantics |
| Parsed body / validation                  | `handlers/validate-create-job-body.ts` **or** shared Zod in [`zod-schemas.ts`](../../database/supabase/functions/_utils/zod-schemas.ts) if reused later                 | Prefer **extract functions** over giant schema rewrite in pilot                                                            |
| Core insert + transactional orchestration | `handlers/create-job-core.ts`                                                                                                                                           | Accepts `supabase`, `logger`, validated context + body; returns result or throws                                           |
| Side effects (notifications, feedback)    | `handlers/side-effects.ts` **or** keep calling [`auto-invoice.ts`](../../database/supabase/functions/_utils/auto-invoice.ts) / feedback helpers from a thin coordinator | **Preserve** existing [`autoGenerateInvoiceForJob`](../../database/supabase/functions/_utils/auto-invoice.ts) usage        |

**`index.ts` after pilot:** CORS → delegate → map errors to existing `jsonResponse` / `errorResponse` shapes — **no new business rules** in entrypoint.

**Diamond — persistence ordering:** `create-job` performs **multiple sequential** Supabase operations; extraction must **not** widen partial-failure windows or reorder side effects (**notifications**, **auto-invoice**) vs the monolith unless explicitly justified and acceptance-tested.

---

## 3. Post-pilot lanes (ordering — [S1 §8](./S1-split-large-edge-handlers.md))

| Milestone | Candidate                                                                                         | Notes                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **2a**    | [`stripe-webhook`](../../database/supabase/functions/stripe-webhook/index.ts)                     | Thin router + `handlers/<event>.ts` ([S1 G5](./S1-split-large-edge-handlers.md))                                                                                                                 |
| **2b**    | [`calculate-worker-payment`](../../database/supabase/functions/calculate-worker-payment/index.ts) | Financial core — smaller PRs; types → fetch → compute → persist                                                                                                                                  |
| **3**     | Batch (`auto-send-invoices`, **`auto-generate-invoices`**, …)                                     | **`auto-send-invoices`** → **`handlers/`** + scheduling module ([`split-handlers.md`](../decisions/style-guide/edge-functions/split-handlers.md)); same principles for remaining batch functions |

**Webhook lane (2a — Diamond):** [`stripe-webhook`](../../database/supabase/functions/stripe-webhook/index.ts) consumes a **raw** payload; keep **exactly one** `req.text()` / parse boundary in **`index.ts`** (or one dedicated **`handlers/parse-body.ts`**) and pass **serialized context** into event modules — **never** re-read the [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request). Aligns with unified **`raw`** / stripe guidance ([preset matrix §2](./S2-unified-edge-handler-pipeline.md#2-preset-matrix)).

---

## 4. Acceptance tests

### 4.1 Pilot (`create-job`)

| #   | Test                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | **401** when missing / invalid JWT — message parity with pre-refactor (or documented intentional equivalence).                                                                                                                                                                              |
| T2  | **404** when user is **not associated with any organization** (exact message parity); **400** for invalid body, missing `submissionData`, invalid location / colleague membership — match pre-refactor **early-return** statuses (**note:** these branches do **not** use **`403`** today). |
| T3  | **201** happy path — `{ success: true, job: { id, organization_id, location_id, completed_at, created_at } }` unchanged.                                                                                                                                                                    |
| T4  | **Auto-invoice** hook still invoked when org settings demand it (reuse / mock patterns already in `_utils` tests where applicable).                                                                                                                                                         |
| T5  | **Unit tests** for each **new module** with meaningful branching (validation errors, mapping helpers).                                                                                                                                                                                      |
| T6  | **Global `catch`** still uses **`extractErrorMessage`** + **`getErrorStatusCode`** ([`http.ts`](../../database/supabase/functions/_utils/http.ts)) — parity vs monolith for **representative thrown** errors (**403** / **409** / **500** paths possible via message heuristics).           |
| T7  | **`handleCors`** — **OPTIONS** preflight and CORS headers behave as today (**no** regression from thinning **`index.ts`**).                                                                                                                                                                 |

### 4.2 Repo regression

| #   | Test                                      |
| --- | ----------------------------------------- |
| R1  | `pnpm test:edge-unit` — **0 failures**    |
| R2  | `pnpm validate:functions-inventory`       |
| R3  | Prettier / ESLint per CI on touched paths |

---

## 5. Developer documentation

Add **`docs/decisions/style-guide/edge-functions/split-handlers.md`** in pilot PR (or immediately after) covering:

- `_utils` vs `<fn>/handlers` decision rule ([S1 §6](./S1-split-large-edge-handlers.md)).
- Alignment with existing [**`structure.md`**](../decisions/style-guide/edge-functions/structure.md) and [**`testing.md`**](../decisions/style-guide/edge-functions/testing.md).
- Testing expectation (**edge-unit** vs integration).
- Cross-links from [`auth.md`](../decisions/style-guide/edge-functions/auth.md) and [`handler-pipeline.md`](../decisions/style-guide/edge-functions/handler-pipeline.md) (“split orchestration **before** adopting `serveJsonHandler` on large **`identity`** handlers” — see [unified §6.4](./S2-unified-edge-handler-pipeline.md#64-deferred-phase-2-identity-preset)).

---

## 6. File manifest (pilot — illustrative)

| Path                                                                                                                                                             | Description                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `database/supabase/functions/create-job/index.ts`                                                                                                                | Thin entry — delegates to handlers                                                               |
| [`database/supabase/functions/__tests__/create-job.test.ts`](../../database/supabase/functions/__tests__/create-job.test.ts)                                     | **Existing** normalization / validation tests — extend or import shared helpers from new modules |
| `database/supabase/functions/create-job/handlers/*.ts`                                                                                                           | Extracted modules (names finalized in PR)                                                        |
| `database/supabase/functions/_utils/zod-schemas.ts`                                                                                                              | **Optional** — only if shared schema justified                                                   |
| New tests under `create-job/__tests__/*.test.ts` **and/or** extensions to [`create-job.test.ts`](../../database/supabase/functions/__tests__/create-job.test.ts) | Handler-focused unit tests co-located or shared — **≥80% coverage on new module lines** (SC2)    |
| `docs/decisions/style-guide/edge-functions/split-handlers.md`                                                                                                    | Style guide addendum                                                                             |

---

## 7. Migration checklist (per handler)

```
Function: ____________________

Pre-extraction:
[ ] Inventory class noted (identity / secured / …) — pipeline preset migration deferred unless entrypoint already small
[ ] **Diamond:** if **`identity`**, confirm this seam map matches **this** handler (not assumed portable from **`create-job`**)
[ ] Auth ordering diagrammed — no code runs on pre-auth trusted body data
[ ] Baseline LOC recorded (wc -l …/index.ts)

Extraction:
[ ] **`handleCors` / OPTIONS** remain the **first** guard in `index.ts` (before body read)
[ ] Modules placed per S1 §6 (_utils vs function-local)
[ ] Tests added (§4)
[ ] No contract drift (status + JSON shape)

Post-extraction:
[ ] pnpm test:edge-unit
[ ] pnpm validate:functions-inventory
[ ] Staging smoke for Tier-1 flows (job create for pilot)
```

---

## 8. Risks & mitigations

| Risk                                        | Mitigation                                                                                                                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Regression** in job flows                 | Small PRs; staging parity; preserve error strings where clients rely on them                                                                                                                                                |
| **Circular imports**                        | Handlers depend **down** on `_utils`; `_utils` must not import `create-job/handlers`                                                                                                                                        |
| **Coverage gaming**                         | Require meaningful asserts — not empty tests                                                                                                                                                                                |
| **Premature `serveJsonHandler`**            | Pilot explicitly **does not** migrate **`identity`** preset ([S2 pipeline §6.4](./S2-unified-edge-handler-pipeline.md#64-deferred-phase-2-identity-preset))                                                                 |
| **Pipeline vs extraction merge collisions** | For **`create-job`**, land **module extraction before** adopting **`serveJsonHandler`** on the same entrypoint unless **one** PR owns both — avoids conflicting **`index.ts`** churn (**Diamond summary**, Operations row). |
| **`stripe-webhook` raw body**               | Split routers must **not** double-consume **`Request`** — **one** raw read, then dispatch (**§3** webhook note).                                                                                                            |

---

## 9. Out of scope (S2 lock for pilot milestone)

- **`identity`** **`serveJsonHandler`** preset design (**S3** per unified pipeline).
- **Security / UX experiments** on HTTP statuses or error copy (**e.g.** changing **404** no-org to **403**) — **contract lock** unless separately triaged ([S1 G3](./S1-split-large-edge-handlers.md); **Diamond** parity finding).
- Rank **4** dashboard invoke typing.
- **`calculate-*`** full decomposition (follow-on milestones).
- Changing **`verify_jwt`** / RLS strategy.

---

## 10. Verification commands

| Step            | Command                                                   |
| --------------- | --------------------------------------------------------- |
| Edge unit suite | `pnpm test:edge-unit`                                     |
| Inventory       | `pnpm validate:functions-inventory`                       |
| LOC snapshot    | `wc -l database/supabase/functions/*/index.ts \| sort -n` |

---

## 11. Implementation invariants

| ID  | Invariant                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------- |
| I1  | **Auth before trust:** org resolution and JWT validation **before** interpreting sensitive body fields as authoritative.         |
| I2  | **Inventory law:** do not change **`functions-inventory.yaml`** classification in extraction-only PRs unless fixing a bug.       |
| I3  | **Two-consumer rule:** promote logic to `_utils` **only** when [S1 §5 G6](./S1-split-large-edge-handlers.md) satisfied.          |
| I4  | **Observability:** `logger` / correlation patterns **preserved** — do not drop logging fields without stakeholder sign-off.      |
| I5  | **CORS-first:** `handleCors` / **OPTIONS** short-circuit remains **before** request body access in **`index.ts`** (§4.1 **T7**). |

---

## 12. PR plan

### 12.1 Pre-implementation gate

Before starting PR 1, confirm:

- [ ] No **open PRs** touching `database/supabase/functions/create-job/index.ts`
- [ ] No **pipeline migration** (`serveJsonHandler`) targeting `create-job` is in flight
- [ ] **Staging** is healthy — `pnpm test:edge-unit` green on `main`
- [ ] Implementer has read **§2.1** seam table and validated against **current** source

### 12.2 PR sequence

| PR       | Scope                                                                                             | Exit criteria                                                                            |
| -------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **PR 1** | `create-job` extraction + unit tests + `split-handlers.md` style guide + cross-links              | SC1–SC4 ([S1 §4](./S1-split-large-edge-handlers.md)) satisfied; §4 acceptance tests pass |
| **PR 2** | Optional small follow-up — further shrink `index.ts` or extract shared types if duplication found | Only if PR 1 lands cleanly                                                               |

**Complexity:** Moderate — single-function extraction with well-defined seams; no new architecture.

---

## 13. Rollback

| Scenario           | Action                                                                      |
| ------------------ | --------------------------------------------------------------------------- |
| Pilot defect       | Revert PR 1 — restore monolithic `create-job/index.ts` from git history     |
| Partial extraction | Revert entire extraction PR (avoid half-migrated state on `main`/`staging`) |

---

## 14. S3 decision

| Option                               | Rationale                                                                                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skip formal S3 → implement pilot** | Scope is bounded (**one** handler + docs); HLP-level detail can live in **this S2** + PR descriptions.                                                                            |
| **Open S3 later**                    | If **`identity` + `serveJsonHandler`** convergence is desired — unite with [pipeline S2 §6.4](./S2-unified-edge-handler-pipeline.md#64-deferred-phase-2-identity-preset) roadmap. |

**Recommendation:** **Implement PR 1 directly** per §12; open **S3** only if pilot reveals cross-cutting architecture decisions (e.g. shared job-domain package spanning multiple functions).

---

## 15. Summary

| Item          | Outcome                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pilot**     | **`create-job`** — **`identity`**, extraction-only first                                                                                                                                                         |
| **Diamond**   | **Gate clear** — **`identity`** heterogeneity, **`catch`** parity, CORS, webhook raw-body, merge order captured                                                                                                  |
| **Tests**     | §4 — edge-unit + **T6/T7** (catch mapping + CORS) + targeted unit modules                                                                                                                                        |
| **Docs**      | **`split-handlers.md`** style guide                                                                                                                                                                              |
| **Pre-impl**  | §12.1 gate — confirm no conflicting PRs, staging healthy, seams validated                                                                                                                                        |
| **Next work** | **`calculate-invoice`** / **`auto-generate-invoices`** (largest remaining **`index.ts`** monoliths); optional thin **`index`** sweep elsewhere; **`auto-send-invoices`** (**§3**) — **`handlers/`** split landed |

---

_**Promoted from:** [S1 — Split large Edge handlers](./S1-split-large-edge-handlers.md)._
