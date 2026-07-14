# S2 — Features & Functions: Inline pricing scope on field and option cards

| Field                  | Value                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| **Stage**              | S2 — Features & Functions (scope lock before S3 DAP)                                                      |
| **From S0**            | [`S0-pricing-scope-inline-on-field-cards.md`](./S0-pricing-scope-inline-on-field-cards.md) (2026-07-02)   |
| **From S1**            | _Skipped — triage decisions locked in **§1** below (product owner proceed-to-S2)_                         |
| **Created**            | 2026-07-02                                                                                                |
| **Updated**            | 2026-07-02 (Adversarial review re-verified against codebase)                                              |
| **Gold review (S2)**   | **Completed** 2026-07-02 — **re-verified** 2026-07-02 — see **§11**                                       |
| **Adversarial review** | **Completed** 2026-07-02 — **re-verified** 2026-07-02 — see **§12**                                       |
| **Product**            | Tally Runner (dashboard — Pricing tab, location-scoped rules)                                             |
| **Persona (v1)**       | Multi-yard car-yard operator — grouped options (Nissan/Ford), mostly org-default pricing, yard exceptions |

---

## 1. S0 recap (locked for this delivery)

**G2 — GO (v1):** Move **daily pricing scope** from the separate **Scope** tab onto **field cards** and **option rows**, using **default + exceptions** with **progressive disclosure**.

### 1.1 Triage decisions (S0 open questions → locked)

| #   | S0 question                                   | **S2 decision**                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Hierarchy scope on option rows in v1?         | **v1:** **Yard-level** overrides inline. **Region/hierarchy** remains on **Advanced (Scope)** tab in v1 — do not block car-yard delivery.                                                                                                                                                                                                                                                                        |
| 2   | Multi-select yards on save?                   | **Yes** — one action creates **one rule per yard**; **confirmation dialog** required (§4.6).                                                                                                                                                                                                                                                                                                                     |
| 3   | Scheduled price increases?                    | **v1.1** — separate “New rate from [date]” flow. **v1** supports **Valid until** (`expires_at`) only.                                                                                                                                                                                                                                                                                                            |
| 4   | Global `PricingScopeProvider` location state? | **Split semantics (mandatory):** keep `effectiveDate` global. Add **`previewLocationId`** / **`previewLocationHierarchyId`** (Pricing tab sticky bar only). **`locationId` / `locationNodeId`** remain for **Advanced** tab + **Invoice adjustments** edit scope. Main price inputs on Pricing tab **always** save org default (`location_id` null) unless **Manage overrides** flow. See **§4.3.1**, **§11.1**. |
| 5   | Worker + customer scope linked?               | **Yes in v1** — yard overrides apply to **both** customer and worker prices for the same option/field when saved together (matches current dual-context Pricing tab).                                                                                                                                                                                                                                            |
| 6   | Concierge bulk copy in Phase 2?               | **v1.1** — bulk “copy org defaults to yard” stays on **Advanced** tab; not blocking v1.                                                                                                                                                                                                                                                                                                                          |
| 7   | Fixed-price location mode?                    | **Hide** inline scope controls; existing **fixed pricing** banner remains. Read-only message: “Location uses fixed pricing.”                                                                                                                                                                                                                                                                                     |
| 8   | Manage overrides UI pattern?                  | **Desktop (`lg+`):** inline **Collapsible** under the row/card. **Below `lg`:** **Sheet** (drawer) from the row action.                                                                                                                                                                                                                                                                                          |
| 9   | Max visible overrides before compact?         | Show **first 3** override rows; then **“View all overrides (N)”** expands full list.                                                                                                                                                                                                                                                                                                                             |
| 10  | Undo after bulk multi-yard save?              | **v1:** explicit **Discard** on dirty state before save; post-save recovery via **History** tab only. No undo stack in v1.                                                                                                                                                                                                                                                                                       |

### 1.2 v1 deliverables (summary)

1. **Sticky context bar** on Pricing tab: **View as of** + **Preview for yard** (display-only scope; not save target).
2. **Scope chips** on field cards and option rows: **All yards default**, **Yard override**, **Inherited from …**.
3. **Manage overrides** progressive disclosure on **group/select** options (primary gap) and **number/boolean** field cards.
4. **Valid until** + read-only **Reverts to** on yard overrides; validation when org default missing.
5. **Multi-yard save confirmation** with affected-record summary.
6. **Scope tab** renamed/help-updated to **Advanced pricing scope** — bulk/history/hierarchy; not required for daily edits.
7. **Tests** for scope resolution display helpers and save validation.

---

## 2. Product boundaries

| In scope (v1)                                                               | Out of scope (v1)                                                                  |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Inline **Manage overrides** on `OptionPricingEditor` and `FieldPricingCard` | Full **yards × options** spreadsheet matrix                                        |
| **Scope chips** + inheritance labels                                        | Always-visible per-row location dropdowns                                          |
| **View as of** sticky on Pricing tab                                        | Per-card **Effective from** date picker                                            |
| **Valid until** on yard overrides (`expires_at`)                            | **Scheduled rate increase** wizard (`effective_at` future-dated create) — **v1.1** |
| **Reverts to** read-only preview                                            | Second editable “fallback rate” field                                              |
| **Multi-yard** override save with confirmation                              | Bulk **copy all pricing to yard** — **v1.1**                                       |
| Align option save with field save (`effectiveAt`, `expires_at`)             | New DB tables / migrations                                                         |
| **Advanced** tab retains hierarchy + history filters                        | Removing Scope/Advanced tab entirely                                               |
| Shared **`PricingScopeControls`** component                                 | Mobile app pricing UI                                                              |
| Help + ContextualHelp updates                                               | Changing `calculate-invoice` resolution algorithm (display-only alignment)         |
| Fixed-price locations: hide inline scope                                    | Region/hierarchy overrides inline on option rows                                   |

**Article 1 (PRESERVE):** Existing **LocationOverridesMatrix** behaviour for number/boolean at org default **must continue to work** until shared component replaces it; no removal without parity.

**Relationship to [`S2-pricing-tab-redesign.md`](./S2-pricing-tab-redesign.md):** Sidebar field-type nav and formula/margin cards are **orthogonal**. This S2 may land **before or after** pricing tab redesign; shared components must not assume nested tabs still exist.

**Base pricing (`BasePricingEditor`):** Out of v1 inline scope. Existing override matrix at org default **unchanged**. Revisit in v1.1 if concierge needs parity.

**Invoicing dashboard (`dashboard/components/invoicing/option-pricing-editor.tsx`):** Separate, location-scoped editor — **out of scope** for this S2.

**Worker Payments page:** Also wraps `PricingScopeProvider`. Preview-state split (**§11.1**) must **not** alter worker-payments behaviour — scope preview UI is **Pricing tab only**.

---

## 3. Personas & user stories

| ID       | Persona                   | Story                                                                                                   | Acceptance (v1)                                                                                                                                     |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PS-1** | **Org admin (car yard)**  | I want to set **Nissan** and **Ford** prices for **Full soap** at **All yards** without switching tabs. | Save org-default option rules from Group editor; chips show **All yards default**.                                                                  |
| **PS-2** | **Org admin**             | I want **Yard North** to charge more for **Nissan** only.                                               | **Manage overrides** → add yard → prices → save; chip shows **1 yard override**.                                                                    |
| **PS-3** | **Org admin**             | I want to know what price applies **after** a promotional override ends.                                | **Valid until** set → **Reverts to $X (All yards)** shown read-only before save.                                                                    |
| **PS-4** | **Org admin**             | I want to see whether a price is **inherited** or **saved on this yard**.                               | Row shows **Inherited from All yards: $8** or **Yard override: $9**.                                                                                |
| **PS-5** | **Org admin**             | I want to preview pricing **as of a job date** without editing in the past.                             | **View as of** changes **fetched/displayed** rules only; **Save** always writes `effective_at` = **today** (never the preview date). See **§12.9**. |
| **PS-6** | **Org admin**             | I want confidence before applying the same override to **two yards**.                                   | Confirmation lists yards, option, customer/worker amounts, valid-until, fallback.                                                                   |
| **PS-7** | **Concierge implementer** | I want to set up a new org’s yard pricing **without** teaching the Scope tab dance.                     | Car-yard workflow (§5.1) completable on Pricing tab only.                                                                                           |

**Non-stories (v1):** Pricing **simulator** for all yards at once; **Excel import** of override matrix; **worker-only** yard override without customer price.

---

## 4. Features and implementation map

### 4.1 Shared component: `PricingScopeControls`

| Task      | Detail                                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.1.1** | **New file:** `dashboard/components/pricing/pricing-scope-controls.tsx` (name flexible).                                                                                                                                   |
| **4.1.2** | **Props:** `mode: 'summary' \| 'expanded'`, `scopeChip`, `overrideCount`, `overrides: OverrideRow[]`, `orgDefaultPreview`, `onAddOverride`, `onEditOverride`, `onDeleteOverride`, `locations`, `disabled` (fixed pricing). |
| **4.1.3** | **Summary mode:** scope chip + override count badge + **Manage overrides** button.                                                                                                                                         |
| **4.1.4** | **Expanded mode:** override list (max 3 visible + expand), **Add yard override**, per-row **Valid until**, **Reverts to** read-only.                                                                                       |
| **4.1.5** | **Reuse** styling/patterns from `location-overrides-matrix.tsx` where sensible; **do not** duplicate delete-confirm logic.                                                                                                 |
| **4.1.6** | **Single expand:** at most one option/card override panel open at a time on desktop (**§12.20**).                                                                                                                          |

### 4.2 Scope chips & inheritance display

| Task      | Detail                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.2.1** | **New file or colocated:** `dashboard/components/pricing/pricing-scope-chip.tsx` — variants: `all-yards-default`, `yard-override`, `inherited`, `mixed`.                                                                                                                                                                                                                                                                  |
| **4.2.2** | **Helper:** extend `dashboard/lib/pricing-scope.ts` with `resolveDisplayScope(records, optionValue, previewParams, viewDate)` returning `{ chip, inheritedLabel, effectivePrice, overrideCount }`. Reuse **`buildScopedPricingMap`** for org/yard match; for yard preview with hierarchy rules, walk **`location.hierarchy_parent_id`** via ancestor set (mirror `buildLocationContext` in `calculate-invoice/index.ts`). |
| **4.2.3** | **Override list helper:** extend or generalize `getLocationOverrides` in `dashboard/lib/pricing-utils.ts` for **option** rules (today it accepts `FieldPricing[]` only). Filter overrides with **`viewDate`** (from `effectiveDate`), not wall-clock `now` — **Gold:** current `getLocationOverrides` uses `new Date()` for `isActive` (**§11.7**).                                                                       |
| **4.2.4** | **Tests:** extend `dashboard/lib/__tests__/pricing-scope.test.ts` (or add `pricing-scope-display.test.ts` colocated) — org default only; yard override; inherited at preview yard; expired override when view date past `expires_at`; **pricedCount** must count inherited org default as priced (**§11.5**).                                                                                                             |

### 4.3 Sticky context bar (Pricing tab)

| Task      | Detail                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **4.3.1** | **Context split (critical):** Add `previewLocationId` / `previewLocationHierarchyId` to `PricingScopeProvider` (or Pricing-tab-local state). **Do not** reuse `locationId` for preview — today `page.tsx` passes global `locationId` into `OptionPricingEditor` and saves hit that yard (**§11.1**). Advanced tab + Invoice adjustments keep using `locationId` / `locationNodeId` for **edit** scope. |
| **4.3.2** | **New component:** `dashboard/components/pricing/pricing-context-bar.tsx` — **do not** wire `PricingScopeIndicator` as-is. That component is read-only, has **no** date picker, and copy says **“Active scope”** / **“Applying to: Field, Option…”** — contradicts preview-only model (**§11.2**). Reuse card styling if desired; replace copy with C-1/C-2.                                           |
| **4.3.3** | **Left:** **View as of** date picker → `effectiveDate`.                                                                                                                                                                                                                                                                                                                                                |
| **4.3.4** | **Right:** **Preview for yard** dropdown — **All yards** or specific yard/region. Binds **preview** state only.                                                                                                                                                                                                                                                                                        |
| **4.3.5** | Link: **Advanced scope & bulk tools** → `setMainTab("scope")`.                                                                                                                                                                                                                                                                                                                                         |
| **4.3.6** | **Fixed pricing:** when `previewLocationId` resolves to `pricing_mode === "fixed_price"`, show amber note; disable inline override actions. Use preview location for guard, not Advanced-tab edit location (**§11.1**).                                                                                                                                                                                |
| **4.3.7** | Pass **`previewLocationId`** into editors for **display** resolution only; pass **`locationId={null}`** / **`locationHierarchyId={null}`** for org-default **save** scope on main inputs (**§4.4.2**).                                                                                                                                                                                                 |
| **4.3.8** | Block or confirm **Preview for yard** / **View as of** changes when pricing tab has unsaved edits (C-12, **§12.12**).                                                                                                                                                                                                                                                                                  |

**Files:** `pricing/page.tsx`, `pricing-scope-context.tsx`, new `pricing-context-bar.tsx`. Deprecate or refactor `pricing-scope-indicator.tsx`.

### 4.4 `OptionPricingEditor` (group/select — primary v1)

| Task       | Detail                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.4.1**  | Each option row: customer/worker inputs + **`PricingScopeControls`** summary. **Main inputs always bind org-default values** for editing — never the preview-yard effective price. When **Preview for yard** is active and row is **Inherited**, show effective price in chip/label only; inputs stay org-default (**§12.8**).                                                                           |
| **4.4.2**  | **Org default save:** upsert with `locationId: null`, `locationHierarchyId: null` **always** from main row Save — **ignore** global Advanced-tab `locationId` and **ignore** `previewLocationId` (**§11.1**).                                                                                                                                                                                            |
| **4.4.3**  | **Override save:** pass explicit `locationId` per yard from Manage overrides; multi-yard via dialog (§4.6).                                                                                                                                                                                                                                                                                              |
| **4.4.4**  | **`effective_at` on save:** use **today** (same default as `use-option-pricing.ts` when `effectiveAt` omitted) — **not** `effectiveDate` from View as of. View as of drives **`listRules` fetch only** (**§12.9**). _Note:_ `field-pricing-list.tsx` today incorrectly passes `effectiveAt: effectiveDate` on save — **do not copy that bug** for option saves; fix field saves in same PR or follow-up. |
| **4.4.5**  | **`expires_at`:** from **per-override** **Valid until** only. **Do not** pass global `expirationDate` from context on org-default batch saves — today option save applies `expirationDate` to every upsert (**§11.4**). Advanced tab global expiration remains for hierarchy edit flows until v1.1 cleanup.                                                                                              |
| **4.4.6**  | **Validation:** if **Valid until** set on override, require org-default rule exists for `(field_config_id, option_value, pricing_context)` — client-side block + toast C-8.                                                                                                                                                                                                                              |
| **4.4.7**  | **Discard:** option editor has **no** discard today — add row-level or editor-level **Discard** clearing `editingPrices` **and** pending override draft state (mirror `FieldPricingList` / `onDiscardForField` pattern).                                                                                                                                                                                 |
| **4.4.8**  | **pricedCount / header fraction:** count option as priced when **effective** rule exists (including **inherited** org default at preview yard). Fix `entry?.source === scopeSource` check (**§11.5**).                                                                                                                                                                                                   |
| **4.4.9**  | **Responsive:** below `lg`, **Manage overrides** opens **Sheet** with same content.                                                                                                                                                                                                                                                                                                                      |
| **4.4.10** | **Dirty detection:** `pendingChangesCount` must compare edits against **org-default** baseline, not preview-effective values (**§12.11**).                                                                                                                                                                                                                                                               |
| **4.4.11** | **Zero price:** allow explicit **$0** save; do not treat `"0"` as empty (today `hasCustomerChange && editing.customer` skips falsy zero paths — audit before ship, **§12.18**).                                                                                                                                                                                                                          |

**Files:** `option-pricing-editor.tsx`, `use-option-pricing.ts`.

### 4.5 `FieldPricingCard` / `FieldPricingList` (parity)

| Task      | Detail                                                                                                                                                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.5.1** | Integrate **`PricingScopeControls`** inside expanded card content (below price inputs).                                                                                                                                                                                             |
| **4.5.2** | **Preserve** existing `LocationOverridesMatrix` until shared component reaches parity; matrix today only **lists** overrides when `overrides.length > 0` — **cannot add** yard override without Scope tab (**§11.9**). v1 must add **Add yard override** in `PricingScopeControls`. |
| **4.5.3** | Collapsed card header shows **scope chip** + override count.                                                                                                                                                                                                                        |
| **4.5.4** | **`onDiscardForField`** must reset **pending override** draft state. Unsaved prices live in **`FieldPricingList` `editingPrices`**, not `useFieldPricingCardState` (**§11.10**, pricing-tab-redesign Gold).                                                                         |
| **4.5.5** | When `showBothContexts`, field list may show **separate** customer and worker override rows — override form still **linked save** (§12.3); do not split yards per context in v1.                                                                                                    |
| **4.5.6** | **Field save `effective_at`:** same rule as §4.4.4 — inline Pricing-tab saves use **today**, not View as of date (fixes existing field-list bug when touched).                                                                                                                      |

**Files:** `field-pricing-card.tsx`, `field-pricing-list.tsx`.

### 4.6 Multi-yard save confirmation

| Task      | Detail                                                                                                                                                                                                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.6.1** | **New:** `dashboard/components/pricing/pricing-scope-save-dialog.tsx`.                                                                                                                                                                                                                                     |
| **4.6.2** | Trigger when user saves override affecting **>1 yard** or uses **Apply to selected yards**.                                                                                                                                                                                                                |
| **4.6.3** | Dialog body: table — Yard name, Customer $, Worker $, Valid until, Reverts to.                                                                                                                                                                                                                             |
| **4.6.4** | Primary **Confirm and save**; secondary **Cancel** (no partial write).                                                                                                                                                                                                                                     |
| **4.6.5** | Single-yard override: **no dialog** (low friction).                                                                                                                                                                                                                                                        |
| **4.6.6** | **Partial failure:** multi-yard save must not leave a torn batch — use **all-or-nothing** client orchestration (sequential upsert + rollback delete on failure, or single batch edge function in v1.1). **`Promise.all` alone is insufficient** if one request succeeds before another fails (**§12.10**). |
| **4.6.7** | **Duplicate yard:** block adding override for a yard that already has a rule for `(field, option)`; offer **edit existing** instead (**§12.15**).                                                                                                                                                          |

### 4.7 Advanced (Scope) tab updates

| Task      | Detail                                                                                                                                                                                                                                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.7.1** | Rename tab label **Scope** → **Advanced** (or **Advanced scope**) in `pricing/page.tsx`.                                                                                                                                                                                                                                    |
| **4.7.2** | Top **Alert** or **ContextualHelp:** “Day-to-day pricing is set on each field or option. Use this tab for region/company scope, bulk tools, and history filters.”                                                                                                                                                           |
| **4.7.3** | Fix Scope tab intro copy in `page.tsx` (lines ~612–615) and `location-scope-selector.tsx` — today Scope tab says scope **“applies to Pricing tab”** which conflicts with preview-only Pricing bar. Advanced tab copy: **edit** scope for hierarchy + invoice adjustments; daily option/field pricing uses inline overrides. |
| **4.7.4** | Update `LocationOverridesMatrix` default empty message — remove reference to **“Where to Apply Pricing above”** (**§11.9**).                                                                                                                                                                                                |
| **4.7.5** | Update `dashboard/app/dashboard/help/page.tsx` **pricing-scope** section.                                                                                                                                                                                                                                                   |

### 4.8 Copy inventory (v1 — implement in S3/content PR)

| ID       | Location                 | String (intent)                                                                                                            |
| -------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **C-1**  | Sticky bar               | **View as of** — “Show prices that apply on this date.”                                                                    |
| **C-2**  | Sticky bar               | **Preview for yard** — “See what this yard would use; change overrides on each price below.”                               |
| **C-3**  | Scope chip               | **All yards default**                                                                                                      |
| **C-4**  | Scope chip               | **Yard override**                                                                                                          |
| **C-5**  | Scope chip               | **Inherited from All yards** (+ amount when previewing a yard)                                                             |
| **C-6**  | Override row             | **Valid until** (optional) — “Leave blank for no end date.”                                                                |
| **C-7**  | Override row             | **Reverts to $X (All yards)** — read-only                                                                                  |
| **C-8**  | Validation toast         | “Set an All yards price for [option] before adding a dated yard override.”                                                 |
| **C-9**  | Advanced tab             | “Set region or company pricing here. For yard-specific option prices, use **Manage overrides** on the Pricing tab.”        |
| **C-10** | Fixed pricing            | “This location uses fixed pricing. Per-field overrides are not available.”                                                 |
| **C-11** | Preview + inherited row  | “Showing Yard North’s effective price. Edits below update **All yards** default — use **Manage overrides** for this yard.” |
| **C-12** | Unsaved + preview change | “You have unsaved pricing changes. Discard or save before changing preview yard.”                                          |

**Tone:** Sentence case for body; Title Case for section titles per [`S2-pricing-tab-redesign.md`](./S2-pricing-tab-redesign.md).

---

## 5. Reference workflow (acceptance)

### 5.1 Car-yard cleaning (canonical v1 QA script)

| Step | Action                                             | Expected                                                                                                          |
| ---- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1    | Pricing → Group → **Full soap**                    | Option list with customer/worker columns                                                                          |
| 2    | Set **Nissan** $8 / $4, **Ford** $7 / $3, Save     | Chips: **All yards default**                                                                                      |
| 3    | Nissan → **Manage overrides** → Yard North $9 / $4 | Override row visible; chip **1 yard override**                                                                    |
| 4    | Set **Valid until** 30 Jun on Yard North           | **Reverts to $8 (All yards)** shown                                                                               |
| 5    | **Preview for yard:** Yard North                   | Chip shows effective $9; **main input** still shows org-default $8 unless user opens Manage overrides (**§12.8**) |
| 6    | **Preview for yard:** Yard South                   | Nissan shows **Inherited from All yards: $8**                                                                     |
| 7    | Repeat for **Wipe only** field                     | Independent org defaults                                                                                          |
| 8    | **Test Invoice** job at Yard North, soap, Nissan   | Invoice uses $9 customer pricing                                                                                  |

### 5.2 Acceptance scenarios (from S0 — normative)

- **AS-1** through **AS-6** in S0 §10 remain **binding** for v1 sign-off.

---

## 6. Data & API (no schema change)

| Fact                                                                                                 | Implication                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`pricing_rule`** unique on org + context + scope + field + option + location keys + `effective_at` | Multi-yard save = **N upserts**                                                                                                                                                                                                                                                   |
| **`expires_at`** nullable                                                                            | **Valid until** optional                                                                                                                                                                                                                                                          |
| **`list-pricing-rules`** filters by `effective_at` **and** `expires_at` vs view date                 | **View as of** drives fetch (`.lte("effective_at")` + `.or(expires_at null or gt view date)`)                                                                                                                                                                                     |
| **`useOptionPricing` fetch**                                                                         | `queryFn` always calls `listRules` with `location_id: null`, `location_hierarchy_id: null` — returns **all** scopes for the field (correct for override UI). **Gold:** `queryKey` includes location filters that **do not** affect fetch — normalize key or document (**§11.8**). |
| **Option upsert**                                                                                    | Omitting `effectiveAt` defaults to **now** (correct for save). **Do not** pass View as of date on save (**§12.9**). Remove global `expirationDate` from org-default saves (§4.4.5).                                                                                               |
| **`buildScopedPricingMap`**                                                                          | With `locationId` set, fills org defaults with `source: "organization"` but does **not** walk hierarchy **ancestors** unless `locationHierarchyId` passed. Yard preview needs `hierarchy_parent_id` chain (**§4.2.2**).                                                           |
| **`getLocationOverrides`**                                                                           | Uses wall-clock `now` for active/future — must use **`effectiveDate`** for View as of (**§4.2.3**).                                                                                                                                                                               |

**Edge functions (verify only):** upsert path via `PricingService.upsertRule` — ensure `expires_at`, `location_id`, `effective_at` pass through; optional server guard for orphan timed override (AS-3).

---

## 7. Non-functional requirements

| NFR                 | Target                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cognitive load**  | Default option row shows **≤3** scope-related elements (chip, override count, Manage button)                                                     |
| **Performance**     | Expanding overrides for one option does not refetch entire org rule list — use cached rules + local filter                                       |
| **A11y**            | **Manage overrides** button has `aria-expanded`; confirmation dialog traps focus; chips have text labels not color-only                          |
| **Responsive**      | Sheet pattern below `lg`; sticky bar wraps on narrow viewports                                                                                   |
| **Trust / billing** | UI effective price for preview yard must match **Test Invoice** for same yard/date/option — mismatch is **release blocker** (**§12.17**, QA #10) |
| **Save semantics**  | View as of **never** written to `effective_at` on inline save (**§12.9**)                                                                        |
| **Data integrity**  | Multi-yard override save is all-or-nothing or surfaces partial failure explicitly (**§12.10**)                                                   |

---

## 8. Test plan (QA)

| #   | Check                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sticky bar visible on **Pricing** tab; **not** required on History                                                                     |
| 2   | Group option: org default save without opening Advanced tab                                                                            |
| 3   | Yard override on one option; other options unchanged                                                                                   |
| 4   | **Valid until** + **Reverts to** displays; save blocked without org default (AS-3)                                                     |
| 5   | Multi-yard confirm dialog lists all yards before write                                                                                 |
| 6   | **Preview for yard** changes inherited labels, not saved rules                                                                         |
| 7   | Fixed-price location: inline scope disabled                                                                                            |
| 8   | Number field card: scope chip + Manage overrides works                                                                                 |
| 9   | Existing **LocationOverridesMatrix** rows still deletable until migration complete                                                     |
| 10  | Test Invoice amount matches preview for overridden yard                                                                                |
| 11  | Mobile width: Manage overrides opens Sheet                                                                                             |
| 12  | Advanced tab help links back to Pricing tab                                                                                            |
| 13  | **Preview yard** selected: inherited org-default options show as **priced** (not 0/N) — **§11.5**                                      |
| 14  | Main row Save with Advanced tab set to a yard does **not** create yard-scoped org-default rules — **§11.1**                            |
| 15  | Org-default option save does **not** attach global `expirationDate` from Advanced tab — **§11.4**                                      |
| 16  | Override list **isActive** respects **View as of**, not today’s date — **§11.7**                                                       |
| 17  | **Preview yard + inherited row:** editing main input changes **org default**, not yard — C-11 visible (**§12.8**)                      |
| 18  | Save with **View as of** set to past date does **not** create back-dated `effective_at` (**§12.9**)                                    |
| 19  | Multi-yard override: simulated mid-batch failure leaves **no** orphan rules (**§12.10**)                                               |
| 20  | Switch **Preview for yard** with dirty edits → warn or block (**§12.12**)                                                              |
| 21  | **Valid until** last day inclusive — job on expiry date uses override until end of day per `list-pricing-rules` semantics (**§12.13**) |
| 22  | Add override for yard that already has rule → blocked with edit path (**§12.15**)                                                      |
| 23  | Explicit **$0** org-default option saves successfully (**§12.18**)                                                                     |
| 24  | **Linked save:** customer + worker override upserts both succeed or user sees single error (**§12.14**)                                |

---

## 9. DAP / implementation checklist (suggested order)

0. [ ] **Context split:** `previewLocationId` vs edit `locationId`; stop passing edit `locationId` into Pricing-tab editors for saves (**§4.3.1**, **§11.1**).
1. [ ] **`resolveDisplayScope`** + **`getLocationOverrides`** view-date fix + unit tests (TDD) (**§4.2**, **§11.5**, **§11.7**).
2. [ ] **`PricingContextBar`** (new) + **`PricingScopeChip`** + **`PricingScopeControls`** summary mode (**§4.3.2**).
3. [ ] **`OptionPricingEditor`:** org-default save (`locationId` null), `effectiveAt`, no global `expirationDate`, pricedCount fix (**§4.4**).
4. [ ] Override expanded UI + **Add yard override** (**§4.4**, **§11.9**).
5. [ ] **`PricingScopeSaveDialog`** + all-or-nothing multi-yard orchestration (§4.6, **§12.10**).
6. [ ] **Valid until** validation + **Reverts to** preview (§4.4.6).
7. [ ] **`FieldPricingCard`** parity + option **Discard** + preview edit trap UX C-11 (§4.5, §4.4.7, **§12.8**).
8. [ ] Advanced tab rename + copy fixes (§4.7).
9. [ ] Help page + ContextualHelp (C-1–C-12).
10. [ ] Manual QA §5.1 + §8 (#13–24) + adversarial matrix **§12.21**.

**Suggested DAP doc:** `S3-pricing-scope-inline-on-field-cards.md`

---

## 10. Open items (post–v1 / backlog)

- Bulk **copy org defaults to yard** (concierge) on Advanced tab.
- Inline **region/company** overrides on option rows.
- **Scheduled rate increase** (“New rate from [date]”) without expiring old rule manually.
- **Undo** last override save (toast action).
- **Export** override matrix CSV for audit.
- Unify **`LocationOverridesMatrix`** fully into **`PricingScopeControls`** and remove duplicate UI.
- Deep link `?previewYard=` on Pricing tab.
- Fix **field-pricing-list** backdating bug (`effectiveAt: effectiveDate` on save) if not in v1 PR.
- Server-side guard for orphan timed override (AS-3) beyond client toast.

---

## 11. Gold review (2026-07-02, re-verified against codebase)

### 11.1 **Preview vs edit context split (critical correction)**

**Code truth:** `pricing/page.tsx` passes **`locationId={locationId}`** and **`locationHierarchyId={locationNodeId}`** from global context into **`OptionPricingEditor`** and **`FieldPricingList`**. When an admin selects a yard on the **Scope** tab, **main-row Save** writes rules **scoped to that yard** (`option-pricing-editor.tsx` lines 181–196 pass props `locationId` / `locationHierarchyId` into upsert).

**S2 intent:** main price inputs = **org default**; yard rules only via **Manage overrides**.

**Mandate:** Introduce **`previewLocationId`** (display only). Pricing-tab editors receive **`locationId={null}`** for org-default saves. Advanced tab + Invoice adjustments keep using **`locationId` / `locationNodeId`** for hierarchy edit. **QA #14** is pass/fail for this item.

### 11.2 **`PricingScopeIndicator` is not the sticky bar**

**Code truth:** `pricing-scope-indicator.tsx` has **no** date picker, is **not imported** in `pricing/page.tsx`, and copy reads **“Active scope”** / **“Applying to: Field, Option, Base…”** — implies global edit scope.

**Mandate:** New **`PricingContextBar`** (§4.3.2). Do not ship by wiring the existing indicator unchanged.

### 11.3 **Option save and `effectiveAt` semantics**

**Code truth:** `OptionPricingEditor` omits `effectiveAt`; hook defaults to **`new Date().toISOString()`** — **correct for save**. **`field-pricing-list.tsx`** incorrectly passes **`effectiveAt: effectiveDate`** (View as of) on field save — can **backdate** rules.

**Mandate:** §4.4.4 — inline saves use **today**; View as of is **fetch/display only**. Adversarial **§12.9**.

### 11.4 **Global `expirationDate` on option batch save**

**Code truth:** Option save passes **`expirationDate`** from `usePricingScope()` into **every** upsert in the batch, including org-default rows.

**Mandate:** Org-default saves: `expires_at: null`. Override saves: per-row **Valid until** only. **QA #15**.

### 11.5 **`pricedCount` / `hasScopedValue` treats inheritance as unpriced**

**Code truth:** `OptionPricingEditor` `pricedCount` requires `entry?.source === scopeSource`. When global/preview scope is a **yard** and the option has only an **org-default** rule, `buildScopedPricingMap` returns `source: "organization"` while `scopeSource` is `"location"` — option counted **unpriced** despite showing inherited price in inputs.

**Mandate:** Count as priced when **any** effective rule exists in the resolution chain. Same pattern may affect `hasScopedValue` on field cards. **QA #13**.

### 11.6 **`buildScopedPricingMap` ≠ invoice hierarchy walk**

**Code truth:** Client map matches location → (optional explicit hierarchy id) → org. **`calculate-invoice`** uses **`buildLocationContext`** to walk **`hierarchy_parent_id`** ancestors (`calculate-invoice/index.ts` ~741–764).

**Mandate:** Display helper for yard preview must pass ancestor hierarchy ids or replicate walk. v1 inline overrides are **yard-only**; hierarchy **display** still needed when previewing a yard under a region-scoped rule.

### 11.7 **`getLocationOverrides` ignores View as of**

**Code truth:** `pricing-utils.ts` sets `isActive` / `isFuture` using **`new Date()`**, not `effectiveDate`.

**Mandate:** Pass **`viewDate`** from sticky bar. **QA #16**.

### 11.8 **`useOptionPricing` query key mismatch**

**Code truth:** `queryKey` includes `locationId` / `locationHierarchyId`; `queryFn` always fetches with both **null** (all scopes).

**Mandate:** Either drop location from `queryKey` or document intentional cache sharing. Avoid duplicate fetches when preview changes.

### 11.9 **Field overrides matrix: list-only, wrong empty copy**

**Code truth:** `FieldPricingCard` shows `LocationOverridesMatrix` only when **`!locationId && !locationHierarchyId && overrides.length > 0`**. Empty message tells user to select location in **“Where to Apply Pricing”** — Scope tab pattern.

**Mandate:** `PricingScopeControls` must support **Add yard override** without Scope tab. Update empty copy (§4.7.4).

### 11.10 **Discard draft state lives in list, not card hook**

**Code truth:** Unsaved field prices are in **`FieldPricingList` `editingPrices`**. `useFieldPricingCardState` tracks expand/save spinner only.

**Mandate:** Option editor needs explicit **Discard**; field discard resets override drafts in **list** state (pricing-tab-redesign Gold §11.1).

### 11.11 **Prior table findings (retained)**

| ID      | Finding                           | Mandate                                          |
| ------- | --------------------------------- | ------------------------------------------------ |
| **G-6** | Group fields may have 10+ options | Progressive disclosure mandatory (§4.1.3, §12.1) |

---

## 12. Adversarial review (2026-07-02, re-verified against codebase)

_Goal:_ Catch **user harm**, **misleading prices**, **silent invoice mismatch**, and **data torn writes** before DAP. Not a substitute for load or e2e tests.

### 12.1 Density / progressive disclosure

**Risk:** Inline scope on 10 option rows × 3 controls = cluttered UI.  
**Resolution:** **Summary in-row, details on demand** only. DAP must reject designs that show location dropdown + date on every row by default. Only **one** option row’s override panel expanded by default; opening another **collapses** the prior (**§12.20**).

### 12.2 Preview vs edit scope confusion

**Risk:** User sets sticky bar to “Yard North” and thinks all saves target Yard North.  
**Resolution:** Sticky label **“Preview for yard”**; saves from main price inputs always write **All yards default** unless **Manage overrides** flow used. **Gold:** today Scope-tab yard selection **does** affect main saves — fixed by **§11.1**. Optional one-time **ContextualHelp** on first preview change.

### 12.3 Worker/customer scope drift

**Risk:** Customer override on Yard A, worker only on org default — margin preview wrong.  
**Resolution:** v1 **linked save** — override form always shows **both** customer and worker fields; confirmation dialog shows both.

### 12.4 Expired override display

**Risk:** **View as of** after expiry still shows override row as active.  
**Resolution:** Override list greys out expired rules; effective chip uses **inherited** price when view date > `expires_at`. **Gold:** also fix `getLocationOverrides` wall-clock bug (**§11.7**).

### 12.5 Advanced tab orphan

**Risk:** Users never discover region pricing.  
**Resolution:** Advanced tab kept with explicit copy (C-9); sticky bar link always visible.

### 12.6 Concurrent edit

**Risk:** Two admins edit same option override.  
**Resolution:** v1 accepts last-write-wins; **Last update** card (pricing tab redesign) mitigates; refetch on **Manage overrides** open = **v1.1** if QA finds stale data.

### 12.7 Accidental org-default expiry

**Risk:** Admin sets **Expiration date** on Advanced tab, then saves org-default options — all options inherit unintended `expires_at`.  
**Resolution:** §4.4.5 / **§11.4** — decouple global expiration from inline org-default saves.

### 12.8 **Inherited price edit trap (critical user harm)**

**Risk:** Admin selects **Preview for yard: Yard North**. Nissan shows effective **$9** (override) or inherited **$8** in chip while input shows org **$8**. User changes input to **$10** and saves — creates **org-default $10**, not a yard override. Yard North keeps old override; all other yards jump to $10. **Silent mispricing across yards.**

**Resolution:** Main row inputs **always edit org-default values**. Preview-yard effective price appears **only** in chip / C-11 helper — **not** in editable inputs when inherited. If user edits org-default while preview yard selected, show C-11. Yard-specific edits **only** through **Manage overrides**. **QA #17** pass/fail.

### 12.9 **View as of backdating on save**

**Risk:** Admin sets **View as of** to 1 Jan, saves Nissan at $8 — rule gets `effective_at` = 1 Jan (field list **already does this** via `effectiveAt: effectiveDate`). Rewrites pricing history and breaks “preview only” promise in `location-scope-selector.tsx` help (“saved rules take effect as of today”).

**Resolution:** **Fetch** uses `effectiveDate`; **save** uses **today**. §4.4.4, §4.5.6. **QA #18**.

### 12.10 **Partial multi-yard write**

**Risk:** Multi-yard confirmation confirms 3 yards; client fires 3 upserts via `Promise.all`; request 2 fails after request 1 succeeds — **2 yards updated, 1 not**, user believes batch complete.

**Resolution:** §4.6.6 — sequential with rollback, or aggregate error + “Saved 1 of 3 — retry”; never silent partial success. **QA #19**.

### 12.11 **Dirty baseline under preview**

**Risk:** With preview yard selected, inputs show org-default **$8** but user mentally compares to effective **$9**; `pendingChangesCount` or save diff uses wrong baseline → spurious saves or missed saves.

**Resolution:** §4.4.10 — dirty detection always vs **org-default record** for main inputs; override drafts tracked separately.

### 12.12 **Unsaved edits + preview switch**

**Risk:** User edits Nissan price, switches **Preview for yard** before save — loses context or saves wrong scope.

**Resolution:** Block preview change when `pendingChangesCount > 0` or override draft dirty; toast C-12. **QA #20**.

### 12.13 **Valid until boundary (timezone)**

**Risk:** Admin sets **Valid until** 30 Jun; job on 30 Jun evening uses org default or override depending on UTC vs local interpretation.

**Resolution:** Align with `list-pricing-rules`: date-only `expires_at` compared as ISO end-of-day (**§6**). Document in C-6: “Includes this date through end of day (UTC).” **QA #21**. Match Test Invoice on expiry boundary.

### 12.14 **Linked save partial failure**

**Risk:** Override save upserts customer rule succeeds, worker rule fails — yard has customer override only; margin and worker payment diverge.

**Resolution:** Wrap customer + worker override upserts in single user action; on failure show **one** error and refetch both contexts. Do not toast success until **both** complete.

### 12.15 **Duplicate yard override**

**Risk:** User adds Yard North override when one already exists — unique index on `(org, context, scope, field, option, location, effective_at)` may create **second** rule with different `effective_at` or fail obscurely.

**Resolution:** §4.6.7 — picker excludes yards with existing override for same option; show **Edit** instead. **QA #22**.

### 12.16 **Inactive location in override list**

**Risk:** Override row shows deleted/inactive yard name; delete still works but confuses audit.

**Resolution:** Yard picker: **active locations only** (match `location-scope-selector` `sortedLocations`). Stale overrides for inactive yards show “(inactive)” badge; deletable.

### 12.17 **Display ≠ invoice (silent billing harm)**

**Risk:** UI shows **Inherited from All yards: $8** at Yard South but invoice uses **region** rule from hierarchy walk — customer undercharged/overcharged; admin trusts preview.

**Resolution:** §4.2.2 hierarchy walk is **release blocker** for orgs with region-scoped rules. Car-yard-only orgs (yards, no hierarchy rules) may ship first; add **QA #10** + hierarchy fixture test. If walk not ready, chip must say **“Preview may not include region rules — use Test Invoice”** (fail-safe copy).

### 12.18 **Zero price and empty input**

**Risk:** Option save uses `if (hasCustomerChange && editing.customer)` — **`"0"`** is falsy in some paths; clearing input vs zero conflated.

**Resolution:** §4.4.11 — explicit zero handling; empty = no change / validation error, not silent skip. **QA #23**.

### 12.19 **Two edit paths coexist (Advanced + inline)**

**Risk:** Power user sets region scope on **Advanced**, switches to **Pricing**, uses **Manage overrides** — unclear which rules win at invoice time.

**Resolution:** Advanced tab help (C-9) + chip shows **winning source** (location / region / org). v1 does not remove Advanced hierarchy edit — document precedence matches invoice engine.

### 12.20 **Expand-all overrides performance**

**Risk:** User expands **Manage overrides** on every row in a 15-option group — 15 × N yard rows DOM; scroll jank on laptop.

**Resolution:** Single expanded option at a time; override list virtualized only if **>10** rows (v1.1). NFR: one expanded panel default.

### 12.21 **Adversarial test matrix (DAP self-check)**

| #     | Scenario                                                                | Pass criteria                                                        |
| ----- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **A** | Preview Yard North, inherited Nissan $8, change main input to $10, Save | Org default $10; Yard North override **unchanged**; C-11 was visible |
| **B** | View as of = 90 days ago, Save org default                              | New rule `effective_at` = **today**, not 90 days ago                 |
| **C** | Multi-yard save, 2nd upsert fails                                       | Zero or all yards updated; user sees error (**§12.10**)              |
| **D** | Preview switch with dirty edits                                         | Blocked or confirm dialog (**§12.12**)                               |
| **E** | Job on **Valid until** last day                                         | Same amount as Test Invoice preview (**§12.13**)                     |
| **F** | Region rule + yard preview                                              | Chip + Test Invoice agree (**§12.17**)                               |
| **G** | Save customer + worker override, worker API fails                       | No success toast; neither context left inconsistent (**§12.14**)     |
| **H** | Advanced tab yard selected, Pricing tab Save                            | No yard-scoped org-default rule created (**§11.1**, QA #14)          |

---

## 13. References

| Doc / path                                                                                 | Relationship                                                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| [`S0-pricing-scope-inline-on-field-cards.md`](./S0-pricing-scope-inline-on-field-cards.md) | Idea intake                                                              |
| [`S0-pricing-tab-redesign.md`](./S0-pricing-tab-redesign.md)                               | Orthogonal layout track                                                  |
| [`S2-pricing-tab-redesign.md`](./S2-pricing-tab-redesign.md)                               | Discard / last-update patterns to integrate                              |
| [`S0-concierge-onboarding-and-handoff.md`](./S0-concierge-onboarding-and-handoff.md)       | Concierge setup beneficiary                                              |
| `dashboard/components/pricing/option-pricing-editor.tsx`                                   | Primary implementation target                                            |
| `dashboard/components/pricing/field-pricing-card.tsx`                                      | Parity target                                                            |
| `dashboard/components/pricing/pricing-scope-indicator.tsx`                                 | **Do not wire as-is** — replace with `pricing-context-bar.tsx` (§11.2)   |
| `dashboard/components/pricing/pricing-context-bar.tsx`                                     | **New** — sticky bar (§4.3.2)                                            |
| `dashboard/lib/pricing-scope.ts`                                                           | `buildScopedPricingMap` — extend for hierarchy display (§11.6)           |
| `dashboard/lib/pricing-utils.ts`                                                           | `getLocationOverrides` — extend for options + view date                  |
| `dashboard/hooks/use-option-pricing.ts`                                                    | Upsert defaults, queryKey (§11.3, §11.8)                                 |
| `dashboard/app/dashboard/pricing/page.tsx`                                                 | Passes edit scope to editors today — **§11.1**                           |
| `dashboard/components/pricing/field-pricing-list.tsx`                                      | Passes `effectiveAt: effectiveDate` on save — backdating bug (**§12.9**) |
| `database/supabase/functions/calculate-invoice/index.ts`                                   | Runtime truth for inheritance                                            |
| NN/g — [Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)  | UX validation                                                            |

---

_S2 — Inline pricing scope on field and option cards — Tally Runner — 2026-07-02 — Next: [`S3-pricing-scope-inline-on-field-cards.md`](./S3-pricing-scope-inline-on-field-cards.md) (DAP)_
