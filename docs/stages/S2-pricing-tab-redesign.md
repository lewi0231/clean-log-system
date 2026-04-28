# S2 — Features & Functions: Pricing tab redesign (sidebar, live formula, margin & recency)

| Field                  | Value                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| **Stage**              | S2 — Features & Functions (scope lock before DAP / implementation detail)                     |
| **From S1**            | [`S1-pricing-tab-redesign.md`](./S1-pricing-tab-redesign.md)                                  |
| **Created**            | 2026-04-23                                                                                    |
| **Updated**            | 2026-04-23 (§11 gold, §12 adversarial)                                                        |
| **Gold review**        | 2026-04-23 — findings in **§11**; mandates in **§4.2**, **§4.6**, **§4.7**, **§4.11**         |
| **Adversarial review** | 2026-04-23 — **§12**; resolutions in **§2**, **§4.5–4.6**, **§4.4**, **§4.1**, **§7**, **§8** |
| **Product**            | Tally Runner (dashboard field pricing)                                                        |

---

## 1. S1 recap (locked decisions)

- Replace **inner** field-type `Tabs` with a **sidebar** (desktop); **&lt; lg** use a **documented** narrow pattern (this S2 **locks** the pattern in **§4.3**).
- **List all fields** of the selected type in the main column (**no** single-field-only regression).
- **Formula preview** uses **real values** (debounced), replacing symbolic **`getEquationPreview`** for **number** in v1.
- **Margin card:** v1 = **derived from current inputs** for **per-unit** scenarios; **no** fake industry benchmark; show **N/A** when not computable.
- **Last update** per **FieldPricingCard** from **`source_rule.updated_at`** / **`updated_by`**; **View history** switches main tab to **History** (v1) — optional **query param** in **§6.1**.
- **Save** model **unchanged** (per field); add **Update rule** + **Discard**; **Test invoice** stays **page-level FAB** in v1.
- **Title Case** for new section titles; **sentence case** for body; **ContextualHelp** for long help where applicable (Learning **#9**).
- **Tours** and **`data-tour`** must be **updated** when inner structure changes.

---

## 2. Product boundaries

| In scope (v1)                                                                                                                                                          | Out of scope (defer)                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Inner **Pricing** tab layout, sidebar, tips, **number**-field live formula, margin + last update **cards**, discard, **History** handoff, tour updates, responsive nav | **Industry** or **territory** benchmark percentages                                                   |
| **Number**-field margin math where **v1** rules apply (see **§4.11** + **§11.3**)                                                                                      | **Misleading** margin for **`percentage`** or **ambiguous** `same_structure` without product sign-off |
|                                                                                                                                                                        | **“Focus mode”** (one field) matching mockup only                                                     |
|                                                                                                                                                                        | **i18n** / locale-specific title casing (English v1)                                                  |
| **Disclaimer** copy in **ContextualHelp** (§2.1) for margin / formula                                                                                                  | **Legal**, **tax**, **AFSL**, or **compliance** **certification** language (see **§12.4**)            |

**v1.1** (after v1 shippable): **Boolean / Select / Group** formula copy parity, optional **in-card Test invoice**, fixed-pricing **sidebar** polish, **`same_structure`** margin rule if product defines it.

### 2.1 Product disclaimer (not legal/financial advice)

**Adversarial / trust:** A **“Profitability check”** or **margin %** can be read as **tax compliance**, **payroll legality**, or **investment** advice. **v1** copy in **ContextualHelp** (or footnote) must state that the figure is **an arithmetic comparison of entered rates** and **not** tax, **award**, or **net profit** guidance—employers remain responsible for their own **compliance** (align tone with [S1 worker payment / rate cards](./S1-worker-payment-split-weights.md) **§2.7** _Australia / compliance_ disclaimer pattern where appropriate). **DAP** must not add **AFSL**-style claims.

---

## 3. User stories (implementation-facing)

| ID       | Story                                                                                                                                               | Acceptance                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **US-1** | As an **org admin**, I want to **choose** Number, Boolean, Select, or Group **without** nested tabs, so I **see** all field types at once.          | Sidebar (or narrow equivalent) shows **4** types; **selected** has non-color-only state. |
| **US-2** | As an **admin** editing a **number** field, I want the **formula** line to show **my** customer and worker **amounts** so the math is **credible**. | Preview shows **currency-formatted** values matching inputs after debounce.              |
| **US-3** | As an **admin**, I want a **clear margin** line when the product can **honestly** compute it.                                                       | **N/A** or short explanation when not computable — **no** misleading **%**.              |
| **US-4** | As an **admin**, I want to see **when** the rule was last changed and open **History** in **one** action.                                           | Relative or absolute time + **View history** → **History** tab.                          |
| **US-5** | As an **admin**, I want to **undo** my unsaved edits for one field.                                                                                 | **Discard** disabled when not dirty; restores **server**-sourced display (see **§4.7**). |

---

## 4. Features and implementation map

### 4.1 Layout: `page.tsx` refactor

| Task      | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.1.1** | Remove inner **`Tabs`** / **`TabsList`** / **`TabsTrigger`** / **`TabsContent`** that wrap `number-pricing` … `group-pricing`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **4.1.2** | Introduce **`useState` for `innerFieldType`** with values aligned to current tab **values** for traceability: **`"number-pricing" \| "boolean-pricing" \| "select-pricing" \| "group-pricing"`** (or shorten to `number` / `boolean` / `select` / `group` if all call sites are updated — **one enum**, document in code). Default from existing **`defaultTab`** / **`hasNoPriceableFields`** logic (preserve **fixed pricing** and **empty** field lists). **Persist** selected inner type in **`sessionStorage` keyed by** `orgId` (see **§12.2**): **optional v1.1** if scope creep; v1 may **reset on refresh** (documented). |
| **4.1.3** | Render **`aside`** (sidebar) + **`main`** in a **`grid` / `flex`**; **min-height** and **overflow** so long field lists **scroll** inside `main` only. After **`onNavigateToHistory`**, call **`requestAnimationFrame` → `querySelector` focus** the **first focusable in main** (or the **inner nav**) when user returns to **Pricing** so **Tab** order is not **stranded** (see **§12.6**).                                                                                                                                                                                                                                     |
| **4.1.4** | Pass **`onNavigateToHistory`** into **`FieldPricingList` → `FieldPricingCard`** (two levels — **no** new context **unless** a third level appears). **Optional:** `React.useCallback` in page to keep props stable.                                                                                                                                                                                                                                                                                                                                                                                                                |

**Files:** `dashboard/app/dashboard/pricing/page.tsx` (primary).

### 4.2 New: `PricingFieldTypeNav` (name flexible)

| Task      | Detail                                                                                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.2.1** | Props: `value`, `onValueChange`, `numberCount`, `booleanCount`, `selectCount`, `groupCount`, `disabled` (e.g. global loading), `isFixedPricing` (optional — dim or still navigable to **empty** education).                  |
| **4.2.2** | Each type: **icon** (reuse **Hash**, **CheckSquare**, **List**, **Layers** from `page.tsx`), **label** (**Number**, **Boolean**, **Select**, **Group**), **badge** with count or **“0”** treatment per S1 empty-state rules. |
| **4.2.3** | **Tip** region: one **Card** or **Callout** below nav items with **per-type** string constants (e.g. `PRICING_FIELD_TYPE_TIPS.number`) — **Title Case** title line + **sentence** body.                                      |

**New file (suggested):** `dashboard/components/pricing/pricing-field-type-nav.tsx`.

**Accessibility (see §11.2):** Use **`role="radiogroup"`** + **`role="radio"`** with one **`aria-checked`** / **`tabIndex` 0/−1`**, **or** a **Toolbar**-style **button** group with **`aria-pressed`**. **Do not** use native **`<input type="radio">`** inside **Shadcn** `Button` without testing — custom styling may break. **Roving** `onKeyDown` (Arrow) is **required** for **radiogroup**; **or** use **RovingTabIndex** from Radix if adopted.

### 4.3 Responsive (locked for DAP)

| Breakpoint                                     | Behavior                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`lg` and up** (`@media (min-width: 1024px)`) | **Vertical** sidebar on the **left**; `aside` **width** ~`12rem`–`16rem` (tune in PR).                                                                                                                                                                            |
| **Below `lg`**                                 | **Horizontal scroll** row of the **same four** controls (icons + short labels), **`gap-2`**, `overflow-x-auto`, **`snap-x`** optional; **tip** card **below** the row, **full width**. **Do not** hide field types behind a **single** unlabeled hamburger in v1. |

**Touch:** Minimum **44×44** px tap target for each type control (padding on trigger). **iOS / overscroll:** `overflow-x-auto` on the row only; **avoid** `overscroll-behavior-x: none` unless it breaks nested scroll (QA **§7**).

### 4.4 `FormulaPreview` (new subcomponent)

| Task      | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **4.4.1** | **Location:** e.g. `dashboard/components/pricing/formula-preview.tsx` **or** colocated with `field-pricing-card.tsx`.                                                                                                                                                                                                                                                                                                                                            |
| **4.4.2** | **Inputs:** `fieldType`, `fieldConfig`, `customerPriceStr`, `workerPriceStr`, `currencyFormatter`, `workerPaymentType: WorkerPaymentType                                                                                                                                                                                                                                                                                                                         | null` (from **`workerPricingRecord`** / **`scopedPricing`\*\*). |
| **4.4.3** | **Number (v1):** Parse strings with the **same** semantics as **`FieldPricingList`** (parseFloat, empty → baseline). Build a line: e.g. per-unit: “Customer **$X** / unit − Worker **$Y** / unit = **$Z** margin / unit” when margin is in scope. **Debounce: 200 ms** (constant `FORMULA_PREVIEW_DEBOUNCE_MS` in the module). **Do not** reference a **non-existent** `parsePriceInput` — **verify** during DAP; extract a shared **parse** only if duplicated. |
| **4.4.4** | **Section label:** **“Formula preview”** (Title Case) + optional **“Live”** / **“Automatic”** `Badge` per product.                                                                                                                                                                                                                                                                                                                                               |
| **4.4.5** | **`aria-live="polite"`** on a **non-chatty** sub-element: prefer **updating on debounced settle**; if that still **floods** screen readers, fall back to **updating on blur** of either price `Input` and document in **§7**. **Adversarial (§12.3):** If **`fieldConfig.label`** or other strings are ever **reflected** into the formula line from **untrusted** sources, **treat as text** (React **escapes** by default) — **no** `dangerouslySetInnerHTML`. |

**Pure helpers:** `buildNumberFieldFormulaLine(...)` in `dashboard/lib/pricing-formula-preview.ts` (or under `lib/`) with **unit tests** in `dashboard/__tests__/lib/…`.

### 4.5 Margin card (`FieldPricingCard`)

| Task      | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **4.5.1** | **Use** the computability rules in **§4.11** (gold-reviewed). Do **not** use informal labels like “per unit” in code **without** mapping to **`WorkerPaymentType`**.                                                                                                                                                                                                                                                                                                                                         |
| **4.5.2** | **Metrics (when in scope):** `marginPerUnit = customer - worker` (same **currency** / unit as inputs); `marginPercent = (marginPerUnit / customer) * 100` if **customer > 0**. **Guard** divide-by-zero. If **`marginPerUnit < 0`**: show **value** with **`text-destructive`** (or **amber**) and **short** “**Worker cost exceeds customer rate**” — do **not** look like a **“good”** margin (see **§12.5**). **Floating-point** (§12.1): use **cents-integer** math or **round** to 2 dp before display. |
| **4.5.3** | **UI:** small **Card** or **dl** rows; **ContextualHelp** for “**How we calculate this**” including **disclaimer** from **§2.1** — **#9** compliant. **Title** e.g. **“Profitability check”** (Title Case).                                                                                                                                                                                                                                                                                                  |

### 4.6 Last update card

| Task      | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.6.1** | **Two rule contexts (showBoth):** **Customer** and **worker** pricing use **separate** `FieldPricing` rows (`customerPricingRecord` vs `workerPricingRecord`) — each has its own **`source_rule`**. **Do not** show only **customer** `updated_at` (misleading if worker was edited later). **v1 contract:** `lastRelevant = max( customerRecord?.source_rule.updated_at, workerRecord?.source_rule.updated_at )` (parse as **Date**); **display** that instant; for **`updated_by`**, use the **same** rule that **wins** the `max` (if **tie**, prefer **customer** and note in **code comment**). If **one** side **missing**: use the **other** only. If **neither** saved: **“Not saved in this scope yet”** (see **§11.4**, **§12.7**). |
| **4.6.2** | **Time:** Use **`formatDistanceToNow`** from **`date-fns`** (already a **dashboard** dependency — see e.g. `notification-list.tsx`); add **`addSuffix: true`**. **Absolute** datetime in `title` attribute for hover / long-press. **Clock skew** is **improbable** for client-only display; if **max** of two ISO strings, **rely on** server-issued **timestamps** from **Supabase** (assumed monotonic per row).                                                                                                                                                                                                                                                                                                                           |
| **4.6.3** | **User label:** If the **winning** rule’s **`updated_by`** is **null**, show **“Unknown user”**; if **non-null**, resolve in **S2+** or v1.1 — **do not** show raw UUIDs (§11.4). If **only one** **side** exists, use **its** `updated_by` only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **4.6.4** | **“View history”** → **`onNavigateToHistory()`** (page passes **`setMainTab("history")`**). Optional **`?tab=history`** (§6) in same PR or **v1.1**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### 4.7 Discard (dirty reset) — **code-verified (gold §11.1)**

| Task      | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **4.7.1** | **Draft state** for customer/worker **strings** lives in **`FieldPricingList`**: **`editingPrices: Record<fieldId, { customer?: string; worker?: string }>`** (`field-pricing-list.tsx`). **`useFieldPricingCardState`** only holds **UI** (expanded, saving, deleting) — **not** price drafts. **Do not** “reset from React Query” alone; **orchestrate** with **`setEditingPrices`**.                                                                                                                                  |
| **4.7.2** | **Discard** for a field: **remove** `editingPrices[fieldId]` (or set to **undefined** so `currentCustomerPrice` / `currentWorkerPrice` **fall back** to **`customerPricingRecord` / `workerPricingRecord`**, per existing lines **507–518** in **`field-pricing-list.tsx`). **Adversarial (§12.8):** Optional **`refetch` of both** customer+worker `fieldPricing` **queries** on discard (or on focus) if **stale-while-revalidate** could show **another user’s** save — **v1.1** if **not\*\* needed after manual QA. |
| **4.7.3** | **Implementation:** add **`onDiscardForField(fieldConfigId: string)`** in **`FieldPricingList`**; pass to **`FieldPricingCard`**. **Button** **`variant="outline"`**; **disabled** when **`!hasChanges`**.                                                                                                                                                                                                                                                                                                               |
| **4.7.4** | **Option pricing** lists (select/group) that use a **different** store — **DAP** must **either** add discard there too or **document** “Discard only for number/boolean list” in v1. **S2 recommendation:** same **`editingPrices` pattern** for **any** list that will show **Formula preview** in v1.1.                                                                                                                                                                                                                |

### 4.8 Chrome: “Update rule”

| Task      | Detail                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| **4.8.1** | **Primary** `Button` label **“Update rule”** or **“Save”**; **same** handler as current **Save** (`handleSave` from list). |
| **4.8.2** | If **icon-only Save** exists, keep **one** clear primary; avoid **two** primary CTAs.                                      |

### 4.9 Tours

| File                                             | Update                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard/components/tours/tour-definitions.ts` | Replace steps targeting `[data-tour="pricing-tabs"]` **inner** tab triggers with **new** targets on **`PricingFieldTypeNav`** and **first** `FieldPricingCard` / formula. |
| `page.tsx`                                       | Re-apply `data-tour` on **inner** nav; **re-run** the tour in browser before merge.                                                                                       |

### 4.10 Copy & documentation

| Task       | Detail                                                                                                                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.10.1** | Add **§ Pricing (dashboard)** to **`docs/patterns/copy-dashboard.md`** (new) **or** a subsection in **`docs/research/pricing-ui-improvements.md`**: list **approved** strings for **Formula preview**, **Profitability check**, **Last update**, **Not saved in this scope yet**, **Margin not shown** … |
| **4.10.2** | **PR** checklist: **Title Case** vs **sentence** case on new copy.                                                                                                                                                                                                                                       |

### 4.11 Margin: computability matrix (**DAP must implement — aligned with `WorkerPaymentType`**)

Source of truth: **`export type WorkerPaymentType = "same_structure" | "percentage" | "fixed_rate"`** in `dashboard/lib/types.ts`.

| Field type                   | `WorkerPaymentType` (worker row)                                             | v1 margin card                                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Number**                   | **`fixed_rate`** (and **numeric** customer + **worker** from inputs/records) | **Show** $ and **%** (see **§4.5.2**).                                                                                                                         |
| **Number**                   | **`percentage`**                                                             | **N/A** — show **one-line** explanation.                                                                                                                       |
| **Number**                   | **`same_structure`**                                                         | **N/A** in v1 — _worker mirrors customer’s pricing shape; margin is not a simple $/unit line without product definition._ Revisit in **v1.1** (see **§11.3**). |
| **Number**                   | **`null` / missing**                                                         | **N/A**                                                                                                                                                        |
| **Boolean / Group / Select** | —                                                                            | **N/A** in v1 (optional **one-line** explainer).                                                                                                               |

---

## 5. Non-functional requirements

| NFR        | Target                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **INP**    | No **long** tasks on main thread from formula; **debounce** + **`memo(FormulaPreview)`** with **stable** callback props.                                                                                                                                                                                                                                    |
| **Bundle** | No new **heavy** deps; **date-fns** subpath import only what you use.                                                                                                                                                                                                                                                                                       |
| **A11y**   | **Field type** control (§4.2) meets **§4.2** + **§11.2**; **focus** order: type nav → first focusable in **main** → card fields. **Scroll:** **main** column `overflow-y-auto` with **min-h-0** in flex children if using flex layout (gold: **avoid** “page won’t scroll” on short viewports).                                                             |
| **Test**   | **Vitest** for **`buildNumberFieldFormulaLine`** (≥5 cases: happy path, **0** customer, **invalid** parse, **percentage** path, **same_structure** path) + **`maxUpdatedAt` helper** (§4.6.1): **two** rules with **A < B**; **one** side **null**; **tie** (same timestamp). **Floats:** assert **$3.00 − $1.10** does not show **$1.9000000001** (§12.1). |

---

## 6. URL and state (optional polish)

### 6.1 Deep link

| Param       | Value                                        | Behavior                                                                                                                       |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `fieldType` | `number` \| `boolean` \| `select` \| `group` | On load, set **`innerFieldType`**; **ignore** if invalid. **Document** the **exact** query values to match the **state** enum. |
| `tab`       | `pricing` \| `history` \| …                  | **Unify** with top-level **`mainTab`** if implemented — **v1.1** if not in v1.                                                 |

**Implementation note:** `useSearchParams` **must** run in a **client** component; avoid **infinite** `useEffect` sync loops when **updating** the URL (gold: read **once** on mount for **inbound** deep links; **outbound** URL updates on tab change = **v1.1**).

---

## 7. Test plan (QA)

| #   | Check                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Desktop** `lg+`: sidebar + main; **all four** types switch content.                                                                                                                                |
| 2   | **Narrow** &lt; `lg`: **horizontal** type row scrolls; **no** layout **jump**; **min-h-0** scroll works.                                                                                             |
| 3   | **Number** field: type prices → **formula** updates after **debounce**; **not** on every key.                                                                                                        |
| 4   | **Discard** reverts: **editingPrices** cleared → display matches **server** snapshot **without** refetch if cache current.                                                                           |
| 5   | **View history** → **History** tab **active** (`resolvedMainTab` / fixed-pricing still OK). **Return** to **Pricing** → **focus** not **stuck** in header / **announced** in SR (smoke) (**§12.6**). |
| 6   | **Fixed pricing** location: **amber** card + inner rules **not** **broken** (existing behavior).                                                                                                     |
| 6b  | **Last update** with **only customer** or **only worker** rule saved: timestamp **sane**; with **both**, **newer** rule wins (§4.6.1).                                                               |
| 6c  | **Negative margin** line has **not-success** **styling** (§4.5.2, **§12.5**).                                                                                                                        |
| 7   | **No priceable fields** empty state still **wins** over inner layout.                                                                                                                                |
| 8   | **Screen reader:** **formula** region **not** **spam**; if **annoying**, implement **blur-only** update (update **doc** and **NFR**).                                                                |
| 9   | **Tour** “Pricing” path **passes** or step IDs **intentionally** changed in **PR**.                                                                                                                  |
| 10  | **`Keyboard`:** Arrow keys move **between** field-type options **if** using **radiogroup**; **Tab** order sane.                                                                                      |

---

## 8. DAP / implementation checklist (order suggested)

1. [ ] **Extract** `buildNumberFieldFormulaLine` + **tests** (TDD).
2. [ ] **`PricingFieldTypeNav`** + **constants** for tips; **a11y** (§4.2, **§11.2**).
3. [ ] **Refactor** `page.tsx` inner structure; **wire** `innerFieldType` **state** + **`onNavigateToHistory`**.
4. [ ] **`onDiscardForField` +** wire **`FieldPricingCard`**; verify **`editingPrices`**.
5. [ ] **`FormulaPreview`** in **`FieldPricingCard`**; **gate** `getEquationPreview` for number; **no** raw HTML; **field labels** escaped.
6. [ ] **Margin** (§4.11) + **negative** styling (§4.5.2) + **last update** `max( customer, worker )` (§4.6.1) + **disclaimer** (§2.1).
7. [ ] **Update rule** button layout.
8. [ ] **Responsive** &lt; `lg` **styles** + **scroll** (§7#2, **§11.5**).
9. [ ] **Tours** + **`data-tour`**.
10. [ ] **Copy doc** (§4.10).
11. [ ] **Manual QA** (§7) + **screenshots** in PR.

---

## 9. Open items (post–v1 / backlog)

- **In-card** **Test invoice** (same **modal** state as FAB).
- **Field search** when **> N** fields (N **TBD**).
- **Benchmark** or **“vs last saved”** (needs **data** + **product**).
- **`updated_by` → name** resolution **hook**.
- **`same_structure` margin** rule after product definition.
- **i18n** and **title case** rules per **locale**.
- **sessionStorage** for **`innerFieldType`** (§12.2).
- **Refetch** on **Discard** / **focus** if multi-tab **stale** cache proves painful (**§12.8**).
- **Focus restore** when switching **History** → **Pricing** (**§12.6**).

---

## 10. References

- [`S0-pricing-tab-redesign.md`](./S0-pricing-tab-redesign.md)
- [`S1-pricing-tab-redesign.md`](./S1-pricing-tab-redesign.md)
- `dashboard/components/pricing/field-pricing-list.tsx` (**`editingPrices`**, `currentCustomerPrice` / `hasChanges`)
- `dashboard/components/pricing/field-pricing-card.tsx`, `field-price-input.tsx`
- `dashboard/lib/types.ts` — **`WorkerPaymentType`**, **`FieldPricing`**, **`PricingRule`**
- `docs/decisions/PROJECT_LEARNINGS.md` — **#9** (ContextualHelp)
- [`S1-worker-payment-split-weights.md`](./S1-worker-payment-split-weights.md) — product **disclaimer** tone reference

---

## 11. Gold review (2026-04-23)

### 11.1 **Discard and draft state (critical correction)**

The prior draft implied **`useFieldPricingCardState`** or **React Query** alone would power **Discard**. **Code truth:** Unsaved **price strings** are **`editingPrices`** in **`FieldPricingList`**. **Discard = remove** the field’s entry from **`editingPrices`** so the UI **reverts** to **`customerPricingRecord` / `workerPricingRecord`**, consistent with **lines 507–518** of **`field-pricing-list.tsx`**. This must be the **DAP** implementation; **`useFieldPricingCardState`** is **irrelevant** to drafts.

### 11.2 **Field-type navigation: accessibility**

**Radiogroup** is **not** a default in Shadcn. Pick **one** and test: (a) **`role="radiogroup"`** + roving `radio`, or (b) **toggle** **`button`**s with **`aria-pressed`**. **Arrow-key** support is **expected** for (a). Document the choice in the **PR** and add **§7#10** pass/fail.

### 11.3 **`WorkerPaymentType` vs informal “per unit” copy**

`WorkerPaymentType` is **`same_structure` | `percentage` | `fixed_rate`**, not `per_unit`. The margin matrix in **§4.11** is **rebased** on this enum. **`same_structure`** in v1 is **N/A** to avoid **wrong** implied dollar math; re-open when product defines the relationship to **customer** price.

### 11.4 **Last update: empty `source_rule`**

If a field has **no** saved rule for the **current** scope, **`FieldPricing` may** have **gaps** in how **list** is built—**show** **“Not saved in this scope yet”** and **no** “last modified 1970” artifacts.

### 11.5 **Flex + scroll: layout footgun**

**Gold:** When using **`flex` + `min-h-screen`**-style parents, the **main** column must often use **`min-h-0`** and **`overflow-y-auto`**, or the **page** will **not** scroll on short viewports. DAP: verify **§7#2** on **a real** 13" laptop and **emulated** mobile width.

### 11.6 **`parsePriceInput`**

The prior draft **referenced** a **helper** that may **not** exist. **DAP** must **dedupe** parsing with the **actual** `parseFloat` + **empty** handling in **`FieldPricingList`**, or **extract** `parseFieldPriceString` **once** and reuse in **list + formula**.

### 11.7 **`fieldType` query + `setState` on every render**

**Syncing** URL ↔ state **in** `useEffect` **without** a **stable** dependency **array** is a **cascade** risk. v1: **read** `searchParams` **once** on **mount** for inbound links, **or** ship **v1.1** for **bi-directional** sync. Prevents **Next.js** + **App Router** **loop** bugs. **Elaboration:** see **§12.2**.

### 11.8 **`aria-live` and debounced updates**

**Polite** `aria-live` on **every** debounced **tick** may still be **noisy**. **PR** may switch to **live on blur** (documented in **§4.4.5** and **§5** NFR) after **one** screen reader check.

---

## 12. Adversarial review (red team, 2026-04-23)

_Goal:_ Catch **user harm**, **misleading** numbers, and **regression** risks before DAP. **Not** a substitute for **concurrency** or **e2e** load tests.

### 12.1 **Floating-point and currency display**

`parseFloat` + JS arithmetic can produce **1.0000000002**-style **noise** in the **Formula preview** and **margin** — users **distrust** the product. **Mitigation in §4.5.2, §5:** round **display** to **2 dp** (or **org currency** minor units) in **one** place; keep **raw** for save **validation** as today.

### 12.2 **State loss on refresh; URL sync foot-guns**

User selects **Group**, refreshes, lands on **Number** (default) — **loses** place; support burden. **Mitigations:** (a) **optional** `sessionStorage` (§4.1.2), (b) **`?fieldType=group`** read **once** on mount, (c) **never** write URL in `useEffect` without **idempotent** guards — **supersedes** partial note in **§6** / **§11.7**.

### 12.3 **XSS and injection (low risk, explicit)**

Field **labels** and **formulas** are **React text**; **forbid** `dangerouslySetInnerHTML` in **FormulaPreview** / **margin** cards. If **markdown** is ever added to tips — **sanitize** in **S2+**.

### 12.4 **“Profitability” misread as legal, tax, or net profit**

SMBs may **confuse** **margin on rates** with **gross margin on jobs**, **GST**, or **compliance**. **Mitigation:** **§2.1** + **ContextualHelp** body; do **not** use **“You are tax compliant”**-style phrasing.

### 12.5 **Negative or zero margin as “success”**

**Green** / **primary** **colors** on **loss-making** per-unit **spread** (worker **> customer**) would **mislead**. **Mitigation:** **§4.5.2** **destructive** or **warning** variant when **`marginPerUnit < 0`**; **neutral** for **0**.

### 12.6 **History tab handoff: focus trap and disorientation**

Clicking **“View history”** switches **tabs**; on **return** to **Pricing**, **focus** can sit on **document** **body** or the **wrong** control. **Mitigation partial:** **§4.1.3**; **full** fix may need **`useEffect` + `ref`** when **`mainTab === "pricing"`** (v1.1) — **at minimum** **QA#5** in **§7**.

### 12.7 **Last update: which rule?**

**Failure mode:** show **customer** `updated_at` when **worker** was edited **5 minutes** later — **false** sense of recency. **Resolution:** **§4.6.1** `max(…)`; **adversarial** test in **§5** / **§7#6b**.

### 12.8 **Multi-tab and stale cache on Discard**

**Scenario:** **Tab A** and **Tab B** same org; **Tab B** saves; **Tab A** **Discards** — reverts to **stale** **React Query** cache, **hiding** B’s work until **refetch**. **Mitigation (optional v1.1):** `invalidateQueries` on **window `focus`** for pricing, or **refetch** on **Discard** — **DAP** triages; document **known limitation** in **release** **notes** if v1 skimps.

### 12.9 **Roster: adversarial test matrix (DAP self-check)**

| #   | Test                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Worker > customer** → **red/warning** margin line                                                                                |
| B   | **Worker rule newer** than customer → last update **date** **matches** worker                                                      |
| C   | **Only** customer rule exists → last update from **customer** only                                                                 |
| D   | **Two** **tabs** (browser) — second **save**; first **tab** after **Discard** (expected **stale** or **refetch** per §12.8)        |
| E   | **Long** (100+) fields of one type — **scroll** still **in main**, **INP** under **2s** interaction budget on **M1**-class (smoke) |

---

_Project stage doc — Tally Runner — S2 features & functions. Implementation: DAP / PR following §8. **Gold** §11 + **adversarial** §12 (2026-04-23)._
