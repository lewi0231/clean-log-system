# S1 — Triage: Typed dashboard ↔ Edge boundaries

| Field           | Value                                                                                                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**       | S1 — Triage (feasibility, risk, scope lock, phased delivery outline)                                                                                                                                                                                                         |
| **From**        | [S0 — Typed dashboard ↔ Edge boundaries](./S0-typed-dashboard-edge-boundaries.md) — promoted **2026-05-06**                                                                                                                                                                  |
| **Triaged**     | 2026-05-06                                                                                                                                                                                                                                                                   |
| **Depends on**  | Stable Edge JSON contracts ([org authorization](../stages/S1-edge-function-org-authorization-enforcement.md) gates unchanged); optional alignment with [unified handler pipeline](../stages/S2-unified-edge-handler-pipeline.md) Zod schemas **without** blocking this track |
| **Product**     | Tally Runner — **dashboard** (`dashboard/`) invoking Supabase Edge Functions                                                                                                                                                                                                 |
| **Risk/reward** | **Low–medium risk** (TypeScript-only at call sites if done incrementally); **high DX reward** — fewer silent shape mismatches, clearer refactors                                                                                                                             |

---

## 1. Locked intent

Today many services pass **`request as unknown as Record<string, unknown>`** into [`invokeEdgeFunction`](../../dashboard/lib/supabase/invoke-edge-function.ts), which accepts **`body?: unknown`** and returns **`TResponse`**. The cast **opts out** of structural checking on the **outbound** payload while leaving **`TResponse`** partially trusted at the **call site**.

**Goal:** replace **gradual** **`unknown`→`Record` bridges** with **typed request/response shapes** per function (or per **small family** of functions), so breaking Edge contract changes surface at **compile time** in the dashboard.

**Non-goals (at triage):**

- Code-generating clients from OpenAPI for **all** 103 functions (**S2/S3** decision if pursued).
- Changing Edge runtime validation (**Zod**/handlers) — dashboard typing **follows** the contract; Edge remains source of truth for authorization and parsing.

---

## 2. Problem / opportunity

| Pain                                                                      | Opportunity                                                                                                                                                                |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`as unknown as Record<string, unknown>`** hides typos and drift         | Explicit **`EdgeBody<'create-job'>`**-style types or per-call **`satisfies`** + interfaces                                                                                 |
| **`invokeEdgeFunction<TResponse>`** does not constrain **`body`**         | Overloads or a **registry** mapping **`functionName` → { body, response }`**                                                                                               |
| Duplicate “shape knowledge” vs `_utils/zod-schemas` / handler definitions | Document **single narrative**: either duplicate minimal TS interfaces with comment pointers to Edge, or extract shared types package (**later**, higher coordination cost) |

---

## 3. Relationship to other work

| Initiative                        | Relationship                                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Split large Edge handlers**     | **Orthogonal.** Typed dashboard calls **help** refactors (compile errors when payloads move).                                                      |
| **Unified Edge handler pipeline** | JSON **`secured`/`public`** handlers increasingly use **Zod** — dashboard types **should align** with those schemas when both touch the same field |
| **Org authorization**             | **No change** to membership semantics — typing only.                                                                                               |

---

## 4. Success criteria (S1 — measurable in later S2/build)

| ID  | Criterion                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC1 | **Pilot merged:** one **high-traffic** service (candidate: [`jobs.service.ts`](../../dashboard/lib/services/jobs.service.ts)) — **zero** `as unknown as Record<string, unknown>` for its Edge calls                          |
| SC2 | **`invokeEdgeFunction`** API documents **recommended** pattern (overload map vs per-wrapper); new PRs in pilot folder follow it                                                                                              |
| SC3 | **CI:** `pnpm --filter @clean-log/dashboard typecheck` passes; no **`eslint-disable`** added solely to silence typing                                                                                                        |
| SC4 | **Regression:** same runtime payloads — **no** intentional contract changes in Edge during typing-only PRs ([maintainability Rank 3 pilot discipline](../improvements/code-quality-and-maintainability-working-document.md)) |

---

## 5. Strategic gates

| Gate                                         | Decision  | Notes                                                                                  |
| -------------------------------------------- | --------- | -------------------------------------------------------------------------------------- |
| **G1 — Incremental typing**                  | **GO**    | Ship thin PRs per domain service or per function cluster                               |
| **G2 — Single mega-PR for entire dashboard** | **NO-GO** | Blast radius and review load                                                           |
| **G3 — Codegen / shared npm package**        | **DEFER** | Valid **S3** track — needs ownership of schema drift and release cadence               |
| **G4 — Pilot scope**                         | **LOCK**  | **`jobs.service.ts`** (or **organization-users** if jobs deferred) — confirm in **S2** |

---

## 6. Candidate approaches (pick one primary in S2)

| Approach                                   | Pros                                       | Cons                                       |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| **A — Per-function typed wrappers**        | Simplest; explicit                         | Many small files or exports                |
| **B — `functionName` discriminated union** | Single **`invokeTypedEdge`** entry         | Larger central module; needs discipline    |
| **C — Shared `types/edge-contracts.ts`**   | One import for dashboard **and** docs-only | Duplication vs Edge until codegen (**G3**) |

---

## 7. Inventory snapshot (illustrative — refresh before S2)

**Purpose:** `rg 'as unknown as Record<string, unknown>' dashboard/`\*\*

Known hotspots include **[`jobs.service.ts`](../../dashboard/lib/services/jobs.service.ts)**, **[`organization-users.service.ts`](../../dashboard/lib/services/organization-users.service.ts)**, **[`field-configs.service.ts`](../../dashboard/lib/services/field-configs.service.ts)**, **[`job-approval.service.ts`](../../dashboard/lib/services/job-approval.service.ts)**, and **`signup/page.tsx`**.

---

## 8. Verification (when implementing)

| Step            | Command                                        |
| --------------- | ---------------------------------------------- |
| Dashboard types | `pnpm --filter @clean-log/dashboard typecheck` |
| Unit tests      | `pnpm --filter @clean-log/dashboard test`      |

---

## 9. S2 decision

Author **`docs/stages/S2-typed-dashboard-edge-boundaries.md`** when **G4 pilot** + primary approach (**§6**) are locked — or **implement the pilot** without a formal **S2** if scope stays a **single service + `invokeEdgeFunction` tightening** (same discretion as [split-handlers S2 §14 — S3 decision](./S2-split-large-edge-handlers.md#14-s3-decision)).

---

_Promoted from [S0](./S0-typed-dashboard-edge-boundaries.md)._
