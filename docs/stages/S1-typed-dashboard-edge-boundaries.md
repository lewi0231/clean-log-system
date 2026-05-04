# S1 — Triage: Typed dashboard ↔ Edge boundaries

| Field           | Value                                                                                                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**       | S1 — Triage (feasibility, risk, scope lock, phased delivery outline)                                                                                                                                                                                                         |
| **From**        | [S0 — Typed dashboard ↔ Edge boundaries](./S0-typed-dashboard-edge-boundaries.md) — promoted **2026-05-06**                                                                                                                                                                  |
| **Triaged**     | 2026-05-06                                                                                                                                                                                                                                                                   |
| **Reviewed**    | 2026-05-05 — **implemented**: all 36 service casts removed, registry contains 41 functions                                                                                                                                                                                   |
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

| Pain                                                                      | Opportunity                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **`as unknown as Record<string, unknown>`** hides typos and drift         | Types **already exist** in `api.ts` — wire them via a registry mapping `functionName → { body, response }` |
| **`invokeEdgeFunction<TResponse>`** does not constrain **`body`**         | Add **`invokeTypedEdge<K>`** wrapper inferring `body` + `response` from `EdgeContracts` interface          |
| Call-sites cast even when they import the correct types                   | Remove casts entirely — the registry + generic wrapper provides full inference                             |
| Duplicate "shape knowledge" vs `_utils/zod-schemas` / handler definitions | **Deferred** — codegen (**G3**) would generate dashboard types from Edge Zod; tolerable until then         |

**Key insight:** [`dashboard/lib/types/api.ts`](../../dashboard/lib/types/api.ts) already defines **25+ typed request/response pairs** (e.g., `CreateJobRequest`, `ListJobsResponse`). The problem is **not authoring types** — it's **wiring** them to `invokeEdgeFunction` so the compiler can enforce the contract.

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
| SC2 | **`invokeEdgeFunction`** API documents **recommended** pattern (registry + `invokeTypedEdge`); new PRs in pilot folder follow it                                                                                             |
| SC3 | **CI:** `pnpm --filter @clean-log/dashboard typecheck` passes; no **`eslint-disable`** added solely to silence typing                                                                                                        |
| SC4 | **Regression:** same runtime payloads — **no** intentional contract changes in Edge during typing-only PRs ([maintainability Rank 3 pilot discipline](../improvements/code-quality-and-maintainability-working-document.md)) |

---

## 5. Strategic gates

| Gate                                         | Decision  | Notes                                                                    |
| -------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| **G1 — Incremental typing**                  | **GO**    | Ship thin PRs per domain service or per function cluster                 |
| **G2 — Single mega-PR for entire dashboard** | **NO-GO** | Blast radius and review load                                             |
| **G3 — Codegen / shared npm package**        | **DEFER** | Valid **S3** track — needs ownership of schema drift and release cadence |
| **G4 — Pilot scope**                         | **LOCK**  | **`jobs.service.ts`** (4 casts, types already exist) — confirm in **S2** |

---

## 6. Candidate approaches

| Approach                                   | Pros                                           | Cons                                       |
| ------------------------------------------ | ---------------------------------------------- | ------------------------------------------ |
| **A — Per-function typed wrappers**        | Simplest; explicit; no registry overhead       | Many small files or exports (15+ services) |
| **B — `functionName` discriminated union** | Single **`invokeTypedEdge`** entry             | Long overload chains; harder to maintain   |
| **C — Shared `EdgeContracts` registry**    | One import; full inference; incremental growth | Requires one-time wiring of existing types |

### 6.1 Recommended: **Approach C — Registry Pattern**

**Rationale:**

1. **Types already exist** — 25+ pairs in `api.ts` just need mapping to function names.
2. **Minimal new code** — one interface + one generic wrapper function.
3. **Graceful migration** — untyped `invokeEdgeFunction` remains for functions not yet in registry.
4. **Better DX than A** — no wrapper proliferation.
5. **Better than B** — TypeScript infers from registry; no overload maintenance.

---

## 7. Pilot implementation sketch (Approach C)

### 7.1 Create the registry

```typescript
// dashboard/lib/types/edge-contracts.ts
import type {
  CreateJobRequest,
  CreateJobResponse,
  ListJobsRequest,
  ListJobsResponse,
  UpdateJobRequest,
  UpdateJobResponse,
  GetJobEditsRequest,
  GetJobEditsResponse,
} from "./api";

export interface EdgeContracts {
  "admin-create-job": { body: CreateJobRequest; response: CreateJobResponse };
  "list-jobs": { body: ListJobsRequest; response: ListJobsResponse };
  "update-job": { body: UpdateJobRequest; response: UpdateJobResponse };
  "get-job-edits": { body: GetJobEditsRequest; response: GetJobEditsResponse };
  // add incrementally per G1
}
```

### 7.2 Add typed wrapper

```typescript
// dashboard/lib/supabase/invoke-edge-function.ts (augment)
import type { EdgeContracts } from "../types/edge-contracts";

export async function invokeTypedEdge<K extends keyof EdgeContracts>(
  functionName: K,
  body: EdgeContracts[K]["body"]
): Promise<EdgeContracts[K]["response"]> {
  return invokeEdgeFunction(functionName, body);
}
```

### 7.3 Migrate call-sites

```typescript
// dashboard/lib/services/jobs.service.ts — BEFORE
const data = await invokeEdgeFunction<CreateJobResponse>(
  "admin-create-job",
  request as unknown as Record<string, unknown>
);

// AFTER
const data = await invokeTypedEdge("admin-create-job", request);
// ✓ body constrained to CreateJobRequest
// ✓ response inferred as CreateJobResponse
// ✓ no cast required
```

---

## 8. Implementation summary (completed 2026-05-05)

### 8.1 Service migration — complete

All 36 `as unknown as Record<string, unknown>` casts in dashboard services have been replaced with `invokeTypedEdge`. Verification:

```bash
rg 'as unknown as Record<string, unknown>' dashboard/lib/services  # 0 matches
```

**Files migrated (15 services + 2 UI):**

| File                              | Original casts | Status   |
| --------------------------------- | -------------- | -------- |
| `organization-users.service.ts`   | 5              | Migrated |
| `workers.service.ts`              | 5              | Migrated |
| `jobs.service.ts`                 | 4              | Migrated |
| `locations.service.ts`            | 4              | Migrated |
| `location-hierarchy.service.ts`   | 4              | Migrated |
| `invoice.service.ts`              | 3              | Migrated |
| `service-pricing-mode.service.ts` | 2              | Migrated |
| `pricing.service.ts`              | 2              | Migrated |
| `worker-payment.service.ts`       | 1              | Migrated |
| `feedback.service.ts`             | 1              | Migrated |
| `invoice-template.service.ts`     | 1              | Migrated |
| `job-approval.service.ts`         | 1              | Migrated |
| `field-configs.service.ts`        | 1              | Migrated |
| `onboarding-wizard.tsx`           | 1              | Migrated |
| `signup/page.tsx`                 | 1              | Migrated |

### 8.2 Registry population

`EdgeContracts` now contains **41 entries** covering all migrated call-sites.

### 8.3 New type files

| File                                         | Purpose                              |
| -------------------------------------------- | ------------------------------------ |
| `dashboard/lib/types/edge-contracts.ts`      | Registry mapping Edge names → shapes |
| `dashboard/lib/types/invoice-edge.ts`        | Invoice calculate/details types      |
| `dashboard/lib/types/pricing-api.ts`         | Pricing rule CRUD types              |
| `dashboard/lib/types/worker-payment-edge.ts` | Worker payment calculation types     |

### 8.4 Optional extension (done 2026-05)

Settings / sending-domain UI calls are registered: **`get-organization-settings`**, **`update-organization-settings`**, **`register-org-sending-domain`**, **`refresh-org-sending-domain-status`**, **`remove-org-sending-domain`** (see `edge-contracts.ts`).

---

## 9. Verification (when implementing)

| Step            | Command                                        |
| --------------- | ---------------------------------------------- |
| Dashboard types | `pnpm --filter @clean-log/dashboard typecheck` |
| Unit tests      | `pnpm --filter @clean-log/dashboard test`      |

---

## 10. S2 decision — superseded

**Implemented directly** (2026-05-05) without formal S2 — scope was small enough, same discretion as [split-handlers S2 §14](./S2-split-large-edge-handlers.md#14-s3-decision).

All pilot scope and full service migration completed in commits `732108d` through `97241ec`.

---

## 11. Outcome

| Criterion                         | Result                                                           |
| --------------------------------- | ---------------------------------------------------------------- |
| SC1 — Pilot merged                | ✓ `jobs.service.ts` plus **all** 15 services                     |
| SC2 — Pattern documented          | ✓ See [PROJECT_LEARNINGS #10](../decisions/PROJECT_LEARNINGS.md) |
| SC3 — `typecheck` passes          | ✓ `pnpm --filter @clean-log/dashboard typecheck` clean           |
| SC4 — No runtime contract changes | ✓ Typing-only PRs; Edge handlers unchanged                       |

**Next (optional — G1):** Type **`invokeEdgeFunction`** call sites outside `dashboard/` (e.g. future packages), or add **`eslint`** guard against raw **`invokeEdgeFunction`** where a registry key exists.

---

_Promoted from [S0](./S0-typed-dashboard-edge-boundaries.md)._
