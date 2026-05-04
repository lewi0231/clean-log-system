# Working document — Code quality, maintainability, and security posture

| Field            | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**      | Track prioritized improvements from the 2026-05 codebase review                                                                                                                                                                                                                                                                                                                                                                                          |
| **Status**       | Living document — update as stages complete                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Last updated** | 2026-05-06 — **Rank 3:** **`stripe-webhook`** split into [`handlers/`](../../database/supabase/functions/stripe-webhook/handlers/) + [staging smoke checklist](../decisions/style-guide/edge-functions/split-handlers.md). **Rank 4:** settings + sending-domain **`invokeTypedEdge`**. **Rank 5:** **`@supabase/supabase-js`** aligned **`^2.95.3`**; bootstrap **`useAuth`** + **`lib/supabase`** logs gated with **`__DEV__`** (more hooks optional). |

---

## How to use this file

Each **rank** may progress through stage documents (`S0` idea intake → `S1` triage → …) under [`docs/stages/`](../stages/). This file stays a **thin index**: scope, priority, links, and one-line outcomes.

**Sequencing:** **Rank 5** is **not** a prerequisite for **Rank 3**. **`stripe-webhook`** split is landed; next backend maintainability slice is **`calculate-worker-payment`** (or batch lane in **S2**). Use **Rank 5** when mobile dependency hygiene or tests need attention; use **Rank 2** when standardizing new Edge handlers.

---

## Prioritized improvements

| Rank  | Theme                                       | Brief description                                                                                                                                                                                                                                                                                                                                                                                | Stage docs                                                                                                                                                           |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Edge Function org authorization**         | **Phases 1–4 done.** Tier 1–3 gates + inventory CI + dashboard invoice `organization_id`. Deferred: **G5/G8**, fuller invocation tests (**§18**).                                                                                                                                                                                                                                                | [S0](../stages/S0-edge-function-org-authorization-enforcement.md) → [S1](../stages/S1-edge-function-org-authorization-enforcement.md)                                |
| **2** | **Unified Edge handler pipeline**           | Composable handler shell (CORS → parse → validate → log → errors) around existing gates — **S2 ready** (2026-05-04).                                                                                                                                                                                                                                                                             | [S0 stub](../stages/S0-unified-edge-handler-pipeline.md) → [S1](../stages/S1-unified-edge-handler-pipeline.md) → [S2](../stages/S2-unified-edge-handler-pipeline.md) |
| **3** | **Split large Edge handlers**               | **`create-job`** pilot + **`stripe-webhook`** split ([`handlers/`](../../database/supabase/functions/stripe-webhook/handlers/)); smoke checklists in [`split-handlers.md`](../decisions/style-guide/edge-functions/split-handlers.md). **Still open:** **`calculate-worker-payment`** / batch lane ([S2 §3](../stages/S2-split-large-edge-handlers.md)); **manual staging smoke** after deploys. | [S0 stub](../stages/S0-split-large-edge-handlers.md) → [S1](../stages/S1-split-large-edge-handlers.md) → [S2](../stages/S2-split-large-edge-handlers.md)             |
| **4** | **Typed dashboard ↔ Edge boundaries**       | **Done:** registry + **`invokeTypedEdge`** everywhere in dashboard including settings / sending-domain flows ([S1 §8.4](../stages/S1-typed-dashboard-edge-boundaries.md)).                                                                                                                                                                                                                       | [S0 stub](../stages/S0-typed-dashboard-edge-boundaries.md) → [S1](../stages/S1-typed-dashboard-edge-boundaries.md)                                                   |
| **5** | **Cross-client alignment + mobile hygiene** | **Supabase-js** aligned with dashboard (**`^2.95.3`**). **`__DEV__`**-gated logs in **`lib/supabase.ts`** + **`useAuth`**. **Remaining:** optional **`console.*`** cleanup in other hooks; widen **`vitest`** golden paths per [S1](../stages/S1-cross-client-alignment-mobile-hygiene.md).                                                                                                      | [S0 stub](../stages/S0-cross-client-alignment-mobile-hygiene.md) → [S1](../stages/S1-cross-client-alignment-mobile-hygiene.md)                                       |

---

## Next focus

**Recommended default:** **Rank 3** — **`calculate-worker-payment`** split ([S2 §3](../stages/S2-split-large-edge-handlers.md)) or next batch target from **S2**.

**Manual QA (no code):** Run **`create-job`** + **`stripe-webhook`** [staging smoke](../decisions/style-guide/edge-functions/split-handlers.md) on the next Edge deploy.

**Rank 5 follow-through:** **`rg 'console\.(log|debug|info)' mobile-app/hooks`** — gate remaining traces with **`__DEV__`** or remove; add golden-path tests when you expand scope.

**Larger architectural track:** **Rank 2** — [unified handler pipeline S2](../stages/S2-unified-edge-handler-pipeline.md).

---

## Completed / superseded rows

_Move finished work here with a pointer to PRs or decision docs._

| Rank  | Theme                                                | Outcome                                                                                                                                                                                                                                                                  |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **3** | Split large Edge handlers — **pilot (`create-job`)** | Thin entrypoint, **`handlers/*`**, tests import **`submission-parsing`**. [`split-handlers.md`](../decisions/style-guide/edge-functions/split-handlers.md), [`S2`](../stages/S2-split-large-edge-handlers.md).                                                           |
| **3** | Split large Edge handlers — **`stripe-webhook`**     | Thin **`index.ts`** + **`handlers/`** ([verify → idempotency → dispatch → finalize](../../database/supabase/functions/stripe-webhook/)); smoke: [`split-handlers.md`](../decisions/style-guide/edge-functions/split-handlers.md).                                        |
| **4** | Typed dashboard ↔ Edge boundaries                    | **`EdgeContracts`** + **`invokeTypedEdge`**; **41** functions in registry; all service **`invokeEdgeFunction`** casts removed. Pattern: [PROJECT_LEARNINGS #10](../decisions/PROJECT_LEARNINGS.md). Status: [`S1 §11`](../stages/S1-typed-dashboard-edge-boundaries.md). |

---

## Related internal references

- `database/supabase/functions/create-job/handlers/` — **`create-job`** pilot layout (Rank **3**)
- `database/supabase/functions/stripe-webhook/handlers/` — **`stripe-webhook`** split (Rank **3**)
- [`split-handlers.md`](../decisions/style-guide/edge-functions/split-handlers.md) — `_utils` vs `handlers/`, staging smoke checklist
- [`dashboard/lib/types/edge-contracts.ts`](../../dashboard/lib/types/edge-contracts.ts), [`invoke-edge-function.ts`](../../dashboard/lib/supabase/invoke-edge-function.ts) — Rank **4** (`invokeTypedEdge`)
- [`dashboard/package.json`](../../dashboard/package.json), [`mobile-app/package.json`](../../mobile-app/package.json) — Rank **5** alignment
- `database/supabase/functions/_utils/auth.ts` — `verifyOrganizationMembership`, `verifyOrganizationMembershipFromRequest`
- `database/supabase/config.toml` — per-function `verify_jwt`
- `docs/decisions/style-guide/edge-functions/auth.md` — style guidance
- `docs/decisions/archive/phase-4-api-and-data-flow-patterns.md` — intended request lifecycle pattern
