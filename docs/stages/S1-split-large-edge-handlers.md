# S1 — Triage: Split large Edge handlers into testable modules

| Field           | Value                                                                                                                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**       | S1 — Triage (feasibility, risk, scope lock, phased delivery outline)                                                                                                                                                                                           |
| **From**        | [S0 — Split large Edge handlers](./S0-split-large-edge-handlers.md) — promoted **2026-05-06**                                                                                                                                                                  |
| **Triaged**     | 2026-05-06                                                                                                                                                                                                                                                     |
| **Depends on**  | [Org authorization S1](./S1-edge-function-org-authorization-enforcement.md) — **gates intact per handler**; [Unified pipeline S2](./S2-unified-edge-handler-pipeline.md) — **optional** HTTP-shell adoption **after** extraction when entrypoints remain large |
| **Product**     | Tally Runner — Supabase Edge Functions                                                                                                                                                                                                                         |
| **Risk/reward** | **Medium engineering risk** (large financial/user flows), **high maintainability reward** — incremental extraction limits blast radius                                                                                                                         |

---

## 1. Locked intent (from S0 — unchanged meaning)

Very large **`index.ts`** files (~400+ LOC, with several **600–1500+ LOC**) mix HTTP scaffolding, orchestration, Supabase access, and domain logic in one surface. **Goal:** **extract-first** — lift cohesive units into **`database/supabase/functions/_utils/`** (cross-cutting / ≥2 callers / named domain) or **`database/supabase/functions/<fn>/handlers/*.ts`** / **`domain/*.ts`** (single-function orchestration), add **unit tests**, keep **external contracts stable**.

Intake prose and recommendation defaults from **[S0 (stub)](./S0-split-large-edge-handlers.md)** are folded into **§2–§13 below**; the stub retains promotion bookkeeping only.

---

## 2. Problem / opportunity (summary)

| Pain                                                   | Opportunity                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| Review fatigue & missed interactions in monolithic PRs | Smaller files; reviewers scope by module                       |
| Weak seams for unit tests                              | Pure helpers & typed handlers testable without full HTTP mocks |
| Duplicated fragments copied between giants             | Shared `_utils` **when** two-consumer / domain rule applies    |

---

## 3. Relationship to other work

| Initiative                   | Relationship                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Org authorization**        | **Non-negotiable.** Extractions **must not** remove or reorder gates; pass **`SupabaseClient`** / validated IDs into modules as today’s handlers do.                                      |
| **Unified handler pipeline** | **After split when >~400 LOC entrypoint** — thin `serveJsonHandler` / legacy `serve` wraps extracted orchestration (**extract modules before migrating HTTP shell** where feasible — §8). |
| **`pnpm test:edge-unit`**    | New modules should prefer tests included in the non-integration Edge suite ([S2 §14](./S2-unified-edge-handler-pipeline.md#14-verification-commands)).                                    |

---

## 4. Success criteria (S1-level — measurable in S2/build)

| ID  | Criterion                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC1 | **Pilot merged:** **`create-job`** entrypoint **materially reduced** (target **≥40% LOC drop** in `index.ts` where feasible without forcing artificial splits). |
| SC2 | **tests:** New extracted modules have **≥80% line coverage** in unit tests **or** documented rationale for integration-only (heavy DB coupling).                |
| SC3 | **Layout convention** documented and followed for pilot (§6).                                                                                                   |
| SC4 | **Staging parity** — no intentional HTTP / JSON contract changes on pilot (same status codes & payloads for equivalent inputs).                                 |
| SC5 | **Backlog** maintained — ordered list beyond pilot using LOC **plus** risk / seams; optional scripted LOC snapshot in S2 or CI-on-demand.                       |

---

## 5. Strategic gates (decisions — triage lock)

| Gate                                       | Decision            | Notes                                                                                                                                                                |
| ------------------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1 — Pursue handler splitting**          | **GO**              | Incremental extraction; no rewrite of business semantics as primary goal                                                                                             |
| **G2 — Big-bang split all large handlers** | **NO-GO**           | **Adopt-on-touch** + explicit milestones per function / lane                                                                                                         |
| **G3 — Change external API contracts**     | **NO-GO** at triage | Same contracts unless defect discovered during extraction                                                                                                            |
| **G4 — Pilot function**                    | **LOCK**            | **`create-job`** first (~753 LOC `index.ts` snapshot **2026-05-06**); proves playbook before **`calculate-worker-payment`** / **`calculate-invoice`** financial core |
| **G5 — Webhook lane**                      | **LOCK**            | **`stripe-webhook`** uses thin **`index.ts`** + **`handlers/*.ts`** dispatch (thin router + per-event modules); separate milestone from JSON POST handlers           |
| **G6 — `_utils` dumping ground**           | **NO-GO**           | **Two-consumer or domain concept** rule; otherwise function-local modules                                                                                            |

---

## 6. File layout convention (S1 lock — detail in S2 style note)

| Placement                                                                            | Use when                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database/supabase/functions/_utils/<topic>.ts` + `_utils/__tests__/<topic>.test.ts` | Shared by **≥2** functions **or** stable domain concept (e.g. [`worker-payment-split.ts`](../../database/supabase/functions/_utils/worker-payment-split.ts), [`auto-invoice.ts`](../../database/supabase/functions/_utils/auto-invoice.ts)). |
| `database/supabase/functions/<function-name>/handlers/*.ts` (and/or `domain/*.ts`)   | Steps **only** meaningful inside one deployed function (e.g. job creation phases, Stripe event bodies).                                                                                                                                      |
| `database/supabase/functions/<function-name>/index.ts`                               | Stays **thin**: CORS, auth/gates (until pipeline migration), delegate to handlers/services; avoid new business logic here post-pilot pattern.                                                                                                |

**Imports:** Keep Deno-style **`../_utils/...ts`** / relative paths consistent with existing functions.

---

## 7. Initial backlog snapshot (`index.ts` LOC — 2026-05-06)

_Reproduce anytime:_ `wc -l database/supabase/functions/*/index.ts | sort -n`

| Priority hint        | Function                                                                         | LOC (snapshot) | Notes                                                       |
| -------------------- | -------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------- |
| **Pilot (locked)**   | `create-job`                                                                     | 753            | First milestone                                             |
| **Tier A — calc**    | `calculate-worker-payment`                                                       | 1507           | After pilot playbook proven                                 |
|                      | `calculate-invoice`                                                              | 1295           | Same lane                                                   |
| **Tier A — webhook** | `stripe-webhook`                                                                 | 683            | Dispatch-table extraction (§5 G5)                           |
| **Tier B — batch**   | `auto-send-invoices` / `auto-generate-invoices`                                  | 663 / 639      | Same principles; Phase **3** may sequence as **batch lane** |
| **Tier B — ops**     | `update-organization-settings`, `manage-worker-rate-card`, `admin-create-job`, … | 540–680        | Curate in S2 backlog ordering                               |

**Thresholds:** **>400** → review candidate; **>600** → high priority unless explicitly deprioritized.

---

## 8. Phased delivery (outline — acceptance detail in S2)

| Phase | Scope                                                                                                                                                                                                                                                                                         | Exit criteria                                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **1** | **`create-job`** extraction + tests; optionally short **style guide addendum** under `docs/decisions/style-guide/edge-functions/` (cross-link from [auth](../decisions/style-guide/edge-functions/auth.md) / [handler pipeline](../decisions/style-guide/edge-functions/handler-pipeline.md)) | SC1–SC4 satisfied for pilot                                   |
| **2** | **`stripe-webhook`** handlers split OR **`calculate-worker-payment`** chunk 1 (choose based on capacity — webhook improves routing clarity; calc is higher risk)                                                                                                                              | One Tier A item improved with tests + no contract regressions |
| **3** | Remaining **Tier A/B** items **adopt-on-touch** + intentional milestones                                                                                                                                                                                                                      | Backlog burn-down tracked in working doc or S2 table          |

---

## 9. Risks & mitigations

| Risk                                        | Mitigation                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Regression in job creation / payments       | Staging parity checks; small PRs; preserve types exported from modules                                     |
| Over-extraction into `_utils`               | **G6** — function-local `handlers/` by default until second caller exists                                  |
| Merge conflicts on frequently touched files | Pilot **`create-job`** first to establish pattern; then parallel work on other dirs                        |
| Pipeline migration collision                | **Split before** `serveJsonHandler` when entrypoint large — pair extraction PR then pipeline migration PR. |

---

## 10. Verification commands (repeat each milestone)

| Step                | Command (repo root unless noted)                |
| ------------------- | ----------------------------------------------- |
| Edge unit suite     | `pnpm test:edge-unit`                           |
| Functions inventory | `pnpm validate:functions-inventory`             |
| Format              | `pnpm exec prettier --write …` on touched files |

---

## 11. Out of scope (S1 lock)

- Dashboard **`invokeEdgeFunction`** typing (**Rank 4** — separate initiative).
- Performance optimization **as primary** deliverable.
- Replacing org gates or inventory classifications.
- Batch/cron handlers (**e.g.** `auto-send-invoices`) use the **same extraction principles**; **lane sequencing** is planning-only until Phase **3** ([S1 §8](./S1-split-large-edge-handlers.md)), not implementation obligation at triage.

---

## 12. References

- [S0 — Split large Edge handlers](./S0-split-large-edge-handlers.md) — promotion stub (bookkeeping); rationale folded into this doc
- [S2 — Unified Edge handler pipeline](./S2-unified-edge-handler-pipeline.md)
- [S1 — Org authorization](./S1-edge-function-org-authorization-enforcement.md)
- [`database/supabase/functions/_utils/`](../../database/supabase/functions/_utils/) — existing extraction patterns + tests

---

## 13. Summary

| Item           | Outcome                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------ |
| **Verdict**    | **GO** — scope locked in **[S2 — Split large Edge handlers](./S2-split-large-edge-handlers.md)** |
| **Pilot**      | **`create-job`** locked                                                                          |
| **Convention** | **`_utils`** vs **`<fn>/handlers`** locked per §6                                                |
| **Rollout**    | **Incremental** — no big-bang                                                                    |

---

_**Promoted:** [S2 — Features & Functions](./S2-split-large-edge-handlers.md) — pilot acceptance, manifest, invariants, verification, rollback._

**Next stage:** Implementation per S2 §12–§14 (optional formal **S3** only if architecture expands).
