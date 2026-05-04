# Working document — Code quality, maintainability, and security posture

| Field            | Value                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**      | Track prioritized improvements from the 2026-05 codebase review                                                                                                                                                                                                                                                                                                                       |
| **Status**       | Living document — update as stages complete                                                                                                                                                                                                                                                                                                                                           |
| **Last updated** | 2026-05-06 — **S1 opened** for Rank **4** + **5** (typed dashboard ↔ Edge; cross-client + mobile hygiene). Rank **3 pilot** shipped; backlog lanes remain. Org-auth **1–4** complete — [S1 §18](../stages/S1-edge-function-org-authorization-enforcement.md#18-postdelivery-status--remaining-work). Unified pipeline → [S2 pipeline](../stages/S2-unified-edge-handler-pipeline.md). |

---

## How to use this file

Each **rank** may progress through stage documents (`S0` idea intake → `S1` triage → …) under [`docs/stages/`](../stages/). This file stays a **thin index**: scope, priority, links, and one-line outcomes.

**Sequencing:** **Rank 4** and **Rank 5** are **not** prerequisites for **Rank 3** (`stripe-webhook`, etc.). Prioritize **Rank 4** when dashboard–Edge typing or invocation safety is the bottleneck; prioritize **Rank 5** when shipping **mobile** builds or dependency drift (e.g. Supabase client skew) matters most; otherwise continuing **Rank 3** momentum remains valid.

---

## Prioritized improvements

| Rank  | Theme                                       | Brief description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Stage docs                                                                                                                                                           |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Edge Function org authorization**         | **Phases 1–4 done.** Tier 1–3 gates + inventory CI + dashboard invoice `organization_id`. Deferred: **G5/G8**, fuller invocation tests (**§18**).                                                                                                                                                                                                                                                                                                                                                                                                                  | [S0](../stages/S0-edge-function-org-authorization-enforcement.md) → [S1](../stages/S1-edge-function-org-authorization-enforcement.md)                                |
| **2** | **Unified Edge handler pipeline**           | Composable handler shell (CORS → parse → validate → log → errors) around existing gates — **S2 ready** (2026-05-04).                                                                                                                                                                                                                                                                                                                                                                                                                                               | [S0 stub](../stages/S0-unified-edge-handler-pipeline.md) → [S1](../stages/S1-unified-edge-handler-pipeline.md) → [S2](../stages/S2-unified-edge-handler-pipeline.md) |
| **3** | **Split large Edge handlers**               | **Pilot done:** [`create-job`](../../database/supabase/functions/create-job/index.ts) split into [`handlers/`](../../database/supabase/functions/create-job/handlers/) (auth/context → validate body → insert/side-effects); [`split-handlers.md`](../decisions/style-guide/edge-functions/split-handlers.md) + stage refs **S0–S2**. **Still open:** post-pilot milestones (**`stripe-webhook`**, **`calculate-worker-payment`**, batch lane — [S2 §3](../stages/S2-split-large-edge-handlers.md)); **staging smoke** (SC4) per checklist in `split-handlers.md`. | [S0 stub](../stages/S0-split-large-edge-handlers.md) → [S1](../stages/S1-split-large-edge-handlers.md) → [S2](../stages/S2-split-large-edge-handlers.md)             |
| **4** | **Typed dashboard ↔ Edge boundaries**       | Reduce `as unknown as Record<string, unknown>` around `invokeEdgeFunction` with proper body typing or per-function overloads.                                                                                                                                                                                                                                                                                                                                                                                                                                      | [S0 stub](../stages/S0-typed-dashboard-edge-boundaries.md) → [S1](../stages/S1-typed-dashboard-edge-boundaries.md)                                                   |
| **5** | **Cross-client alignment + mobile hygiene** | Align major dependency versions between dashboard and mobile where intentional; remove temporary debug logging in mobile bootstrap; widen mobile automated tests toward golden paths.                                                                                                                                                                                                                                                                                                                                                                              | [S0 stub](../stages/S0-cross-client-alignment-mobile-hygiene.md) → [S1](../stages/S1-cross-client-alignment-mobile-hygiene.md)                                       |

---

## Next focus

**Recommended (unchanged default):** Continue **Rank 3** milestone **2a** — [`stripe-webhook`](../../database/supabase/functions/stripe-webhook/index.ts) ([S2 §3](../stages/S2-split-large-edge-handlers.md); [`split-handlers.md`](../decisions/style-guide/edge-functions/split-handlers.md)).

**If prioritizing client quality first:** start **Rank 4** pilot per [S1 typed dashboard ↔ Edge](../stages/S1-typed-dashboard-edge-boundaries.md) (**`jobs.service`** candidate), and/or **Rank 5** inventory per [S1 cross-client + mobile](../stages/S1-cross-client-alignment-mobile-hygiene.md) (**Supabase-js** skew **dashboard `^2.95` vs mobile `^2.84`**).

**Alternative:** **Rank 2** pipeline — [unified S2](../stages/S2-unified-edge-handler-pipeline.md).

---

## Completed / superseded rows

_Move finished work here with a pointer to PRs or decision docs._

| Rank  | Theme                                 | Outcome                                                                                                                                                                                                                                                                                                      |
| ----- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **3** | Split large Edge handlers — **pilot** | **`create-job`** refactor landed (thin entrypoint, `handlers/*`, tests import **`submission-parsing`**). Decision/style: [`split-handlers.md`](../decisions/style-guide/edge-functions/split-handlers.md). Scope/acceptance: [`S2-split-large-edge-handlers.md`](../stages/S2-split-large-edge-handlers.md). |

---

## Related internal references

- `database/supabase/functions/create-job/handlers/` — pilot layout for Rank **3**
- [`split-handlers.md`](../decisions/style-guide/edge-functions/split-handlers.md) — `_utils` vs `handlers/`, staging smoke checklist
- [`dashboard/lib/supabase/invoke-edge-function.ts`](../../dashboard/lib/supabase/invoke-edge-function.ts) — Rank **4** touchpoint
- [`dashboard/package.json`](../../dashboard/package.json), [`mobile-app/package.json`](../../mobile-app/package.json) — Rank **5** alignment
- `database/supabase/functions/_utils/auth.ts` — `verifyOrganizationMembership`, `verifyOrganizationMembershipFromRequest`
- `database/supabase/config.toml` — per-function `verify_jwt`
- `docs/decisions/style-guide/edge-functions/auth.md` — style guidance
- `docs/decisions/archive/phase-4-api-and-data-flow-patterns.md` — intended request lifecycle pattern
