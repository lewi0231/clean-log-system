# S1 — Triage: Cross-client alignment + mobile hygiene

| Field           | Value                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**       | S1 — Triage (feasibility, risk, scope lock, phased delivery outline)                                                                                           |
| **From**        | [S0 — Cross-client alignment + mobile hygiene](./S0-cross-client-alignment-mobile-hygiene.md) — promoted **2026-05-06**                                        |
| **Triaged**     | 2026-05-06                                                                                                                                                     |
| **Depends on**  | [`@clean-log/shared`](../../shared/package.json) remaining the **default** channel for **cross-cutting** domain types/utils — extend only with consensus       |
| **Product**     | Tally Runner — **`dashboard/`** (Next.js), **`mobile-app/`** (Expo), **`shared/`**                                                                             |
| **Risk/reward** | **Medium operational risk** if dependency bumps break native binaries or Metro; **reward** — predictable security patches, fewer “works on web only” surprises |

---

## 1. Locked intent

**Goal:** intentional alignment of **shared** and **high-impact** dependencies between **`dashboard`**, **`mobile-app`**, and **`shared`**, plus **mobile hygiene**: remove **temporary** debug noise, document **test** expectations, and widen **automated** coverage toward **golden paths** without blocking feature work.

**Explicit scope:**

1. **Dependency alignment** — especially **`@supabase/supabase-js`**, **`react`** major families, and anything **`shared`** re-exports or both apps import for the same conceptual API.
2. **Mobile bootstrap / logging** — audit **`console.*`** and dev-only traces left from troubleshooting; replace with **`log`** pattern if one exists in mobile, or gated **`__DEV__`** logging.
3. **Tests** — increase **`mobile-app`** **`vitest`** coverage for **critical flows** (session restore, job submit smoke, navigation guards — exact list in **S2**).

**Non-goals (at triage):**

- Rewriting mobile navigation or design system.
- Forcing **pixel-perfect** version parity where **Expo**/**RN** pins **require** different minors (document **exceptions**).

---

## 2. Problem / opportunity

| Pain                                                               | Opportunity                                                                      |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **`@supabase/supabase-js`** skew (**dashboard** vs **mobile-app**) | Align on **one workspace policy** (e.g. shared range or lockstep bump checklist) |
| Silent divergence in **`shared`** consumers                        | **`pnpm why`** / Renovate-style audit table in **S2**                            |
| Debug **`console.log`** in production paths                        | Hygiene pass + optional **lint rule** (future)                                   |
| Thin mobile test surface                                           | Golden-path tests reduce regression fear when aligning deps                      |

---

## 3. Relationship to other work

| Initiative                    | Relationship                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| **Typed dashboard ↔ Edge**    | **Adjacent.** Supabase client typing/version affects **both** apps — coordinate bumps |
| **Split large Edge handlers** | **Independent** — no ordering dependency                                              |

---

## 4. Success criteria (S1 — measurable in later S2/build)

| ID  | Criterion                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC1 | **Inventory published:** table of **`dashboard`** / **`mobile-app`** / **`shared`** versions for **Supabase**, **React**, **date-fns** (and any other **dual-import** libs) |
| SC2 | **Policy decided:** e.g. “**Supabase-js** within **one minor** across apps” **or** documented exception + reason                                                            |
| SC3 | **Hygiene:** **no** unguarded debug **`console.*`** in **`mobile-app`** `app/` entry paths (**allowlist** **`__DEV__`**-only if needed) — verify via **`rg`**               |
| SC4 | **Tests:** add **≥1** meaningful **`vitest`** spec per **agreed golden path** (listed in **S2**) — CI runs **`pnpm --filter @clean-log/mobile-app test`**                   |

---

## 5. Strategic gates

| Gate                              | Decision  | Notes                                                                                   |
| --------------------------------- | --------- | --------------------------------------------------------------------------------------- |
| **G1 — Align Supabase-js**        | **GO**    | After inventory — bump **mobile** and/or **dashboard** toward single supported range    |
| **G2 — Blind major Expo jump**    | **NO-GO** | Requires device matrix / release notes                                                  |
| **G3 — Shared package API creep** | **NO-GO** | **`shared`** grows only with **both** consumers reviewed — avoid dashboard-only leakage |

---

## 6. Snapshot (2026-05 — refresh before work)

| Package                 | `dashboard`                                         | `mobile-app`                                         | Notes                       |
| ----------------------- | --------------------------------------------------- | ---------------------------------------------------- | --------------------------- |
| `@supabase/supabase-js` | **`^2.95.3`** ([pkg](../../dashboard/package.json)) | **`^2.95.3`** ([pkg](../../mobile-app/package.json)) | **Aligned** (2026-05 bump). |

---

## 7. Verification (when implementing)

| Step         | Command                                        |
| ------------ | ---------------------------------------------- |
| Dashboard    | `pnpm --filter @clean-log/dashboard typecheck` |
| Mobile lint  | `pnpm --filter @clean-log/mobile-app lint`     |
| Mobile tests | `pnpm --filter @clean-log/mobile-app test`     |

---

## 8. S2 decision

Author **`docs/stages/S2-cross-client-alignment-mobile-hygiene.md`** when **SC1–SC2** inventory + policy are locked — or ship a **minimal** “bump Supabase + hygiene” PR with rationale in the PR description if scope stays tiny.

---

_Promoted from [S0](./S0-cross-client-alignment-mobile-hygiene.md)._
