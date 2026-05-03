# Working document — Code quality, maintainability, and security posture

| Field            | Value                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Purpose**      | Track prioritized improvements from the 2026-05 codebase review                                                                                                                                                                      |
| **Status**       | Living document — update as stages complete                                                                                                                                                                                          |
| **Last updated** | 2026-05-04 (Org-auth Phases **1–4** complete — [S1 §18](../stages/S1-edge-function-org-authorization-enforcement.md#18-postdelivery-status--remaining-work); Unified pipeline → [S2](../stages/S2-unified-edge-handler-pipeline.md)) |

---

## How to use this file

Each **rank** may progress through stage documents (`S0` idea intake → `S1` triage → …) under [`docs/stages/`](../stages/). This file stays a **thin index**: scope, priority, links, and one-line outcomes.

---

## Prioritized improvements

| Rank  | Theme                                       | Brief description                                                                                                                                                                     | Stage docs                                                                                                                                                           |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Edge Function org authorization**         | **Phases 1–4 done.** Tier 1–3 gates + inventory CI + dashboard invoice `organization_id`. Deferred: **G5/G8**, fuller invocation tests (**§18**).                                     | [S0](../stages/S0-edge-function-org-authorization-enforcement.md) → [S1](../stages/S1-edge-function-org-authorization-enforcement.md)                                |
| **2** | **Unified Edge handler pipeline**           | Composable handler shell (CORS → parse → validate → log → errors) around existing gates — **S2 ready** (2026-05-04).                                                                  | [S0 stub](../stages/S0-unified-edge-handler-pipeline.md) → [S1](../stages/S1-unified-edge-handler-pipeline.md) → [S2](../stages/S2-unified-edge-handler-pipeline.md) |
| **3** | **Split large Edge handlers**               | Break multi-hundred-line `serve` blocks (e.g. job creation orchestration) into testable modules.                                                                                      | —                                                                                                                                                                    |
| **4** | **Typed dashboard ↔ Edge boundaries**       | Reduce `as unknown as Record<string, unknown>` around `invokeEdgeFunction` with proper body typing or per-function overloads.                                                         | —                                                                                                                                                                    |
| **5** | **Cross-client alignment + mobile hygiene** | Align major dependency versions between dashboard and mobile where intentional; remove temporary debug logging in mobile bootstrap; widen mobile automated tests toward golden paths. | —                                                                                                                                                                    |

---

## Completed / superseded rows

_Move finished work here with a pointer to PRs or decision docs._

| Rank | Theme | Outcome |
| ---- | ----- | ------- |
| —    | —     | —       |

---

## Related internal references

- `database/supabase/functions/_utils/auth.ts` — `verifyOrganizationMembership`, `verifyOrganizationMembershipFromRequest`
- `database/supabase/config.toml` — per-function `verify_jwt`
- `docs/decisions/style-guide/edge-functions/auth.md` — style guidance
- `docs/decisions/archive/phase-4-api-and-data-flow-patterns.md` — intended request lifecycle pattern
