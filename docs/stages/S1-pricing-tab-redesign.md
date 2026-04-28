# S1 — Triage: Pricing tab redesign (sidebar field types, live formula, margin & recency, Title Case)

| Field           | Value                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| **Stage**       | S1 — Triage (feasibility, risk, phased scope)                             |
| **From S0**     | [`S0-pricing-tab-redesign.md`](./S0-pricing-tab-redesign.md) (2026-04-23) |
| **Triaged**     | 2026-04-23                                                                |
| **Gold review** | _Pending_                                                                 |
| **Product**     | Tally Runner (field-based pricing, dashboard)                             |

---

## 1. S0 recap

The **Pricing** top-level tab should drop **nested tabs** for **Number / Boolean / Select / Group** in favor of a **left sidebar** (or equivalent) with **visible field-type choices** and a **contextual tip** per type. The **main pane** should show **pricing controls** with a **live “formula” line using real numbers** (not only symbolic text), plus **two summary cards**: **margin / profitability** and **last update** (with a path to **History**). **Actions** (save, discard, test invoice) should feel **in-context**. **Copy** should use **Title Case** for primary labels and section titles, **sentence case** for body text, aligned with SMB expectations.

**In scope:** Inner content of the **Pricing** tab only (`/dashboard/pricing` → `value="pricing"`). **Out of scope for this S1:** redesigning **History**, **Scope**, or **Invoice adjustments** tabs (they may gain cross-links from new copy).

---

## 2. S1 decisions (resolved here)

### 2.1 Information architecture: field types + multiple fields

| Decision                  | Choice                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Field-type navigation** | Replace the **inner** `Tabs` / `TabsList` with a **vertical sidebar** (desktop) listing **Number**, **Boolean**, **Select**, **Group** with icon + label. **Selected** state must meet **WCAG** contrast and not rely on color alone.                                                                                                                          |
| **Fields per type**       | **Keep the current product behavior:** for the selected type, show **all** relevant field configs (e.g. all **number** fields) as a **scrollable list** of cards—same data model as today (`NumberPricingList` → `FieldPricingList`). The mockup’s **single-field** focus is **aspirational**; forcing one field at a time would **regress** multi-field orgs. |
| **Future (S2+)**          | Optional **compact field switcher** (search or select) at the top of the main column when **many** fields of one type exist—only if usability research or support tickets justify it.                                                                                                                                                                          |

### 2.2 “Category average” and margin card

| Decision                                                          | Choice                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **External / industry benchmark** (e.g. “category average 18.5%”) | **Not in v1.** No committed data source; risk of **misleading** SMBs. **Do not** ship placeholder numbers that imply real benchmarks.                                                                                                                       |
| **v1 margin card**                                                | Show **derived** metrics from **current form values** for the **active field card** (or per card in list—see **§3.3**): e.g. **per-unit margin $** and **margin %** where mathematically defined (**Number** and **Select**-style per-unit contexts first). |
| **v1.1+ (optional)**                                              | **Org-relative** insight (e.g. “vs your **previous saved** customer rate for this field”) if **pricing history** or **rule `updated_at`** supports a cheap, **honest** comparison—product to score in S2.                                                   |

**Definition (v1, number per unit):** Use clear, **duplicated** microcopy: e.g. **margin per unit = customer price per unit − worker payment per unit** (when both are **fixed per unit** for the row in question). If **worker** is **percentage** or **tiered**, show **“Margin not shown”** or a **simplified** line only when the code path can justify it—**S2** may tighten rules; v1 avoids **wrong** implied margin.

### 2.3 Formula preview (live values)

| Decision            | Choice                                                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Replace**         | The static **Equation:** line in `FieldPricingCard` that uses **`getEquationPreview`** (symbolic only for `number`)—see `dashboard/components/pricing/field-pricing-card.tsx`.                                              |
| **With**            | A **Formula preview** block **below** customer/worker inputs that **substitutes parsed numeric values** (and **currency**) for the **current** field row, updating on **debounced** input (e.g. 150–300 ms) to limit churn. |
| **Accessibility**   | Prefer **`aria-live="polite"`** on the preview region so screen readers get **optional** updates without shouting on every keystroke; or update only **on blur** if user testing shows annoyance.                           |
| **Boolean / Group** | Show a **plain-language** line (still **Title Case** section label) with **conditional** math text; full numeric fusion can follow **Number** in **v1** or **v1.1** per capacity.                                           |

### 2.4 Last update card

| Decision  | Choice                                                                                                                                                                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Data**  | Prefer **`source_rule` / `PricingRule`** attached to the row (`FieldPricing` includes **`source_rule`** per `dashboard/lib/types.ts`)—use **`updated_at`** and, when present, **`updated_by`** (resolve display name via existing org user lookup if the app already does this elsewhere; if not, **S2** adds a small resolver or shows **“Unknown user”**). |
| **Link**  | **“View history”** → set main tab to **`history`** (reuse `setMainTab` pattern on the pricing page) or **link** to `/dashboard/pricing` with a documented **hash/query** in S2; **v1** minimum = **button** that switches to **History** tab.                                                                                                                |
| **Scope** | **Per field card** (each card shows **its** last change), not one global site footer.                                                                                                                                                                                                                                                                        |

### 2.5 Save, discard, test invoice

| Decision         | Choice                                                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Save**         | **Keep** existing **per-field** persistence (`onSave` on `FieldPricingCard` / `useFieldPricing` mutations). Add **visually primary** **“Update rule”** (or **“Save”**) in the **card chrome** to match the mockup **without** changing the **network** model in v1.                        |
| **Discard**      | **Reset** local **dirty** state for that field to last loaded server values (if hook does not support yet, **implement** in `use-field-pricing-card-state` or parent list state). **Disabled** when not dirty.                                                                             |
| **Test invoice** | **Keep** a **page-level** `TestInvoiceModal` trigger (existing **floating** button) for v1. **v1.1:** Add **secondary** **“Test invoice”** near the **card** actions **if** it calls the same modal with **no** duplicate state bugs. **Do not** remove global access without replacement. |

### 2.6 Responsive / narrow viewports

| Decision                      | Choice                                                                                                                                                                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **&lt; `lg` (tunable in S2)** | **Stack:** field-type selector becomes a **horizontal scroll** row of **pills** / **icon buttons** (same four types) **above** the main content, **or** a **`Sheet` / `Drawer`** “**Field type**” control. **S1** picks one pattern and documents **breakpoint** in code comments. |
| **Tablet**                    | Touch targets for sidebar items **≥ 44px** height (platform HIG / Material).                                                                                                                                                                                                       |

### 2.7 Fixed-pricing location

| Decision     | Choice                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Behavior** | **Unchanged** from today: when **`useLocationFixedPricingGuard`** reports **fixed pricing**, the **inner** number/select/group pricing UIs are **disabled** or show the **amber** org messaging; **sidebar** may still show **all types** with **non-interactive** state **or** only **Number** with explanation—**UX polish** in v1.1. **Boolean** and related lists already respect guard via page props. |

### 2.8 Capitalization & content

| Decision  | Choice                                                                                                                                                                                                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rule**  | **Title Case** for **section titles** and **card titles** (e.g. **Formula Preview**, **Profitability check**, **Last update**). **Sentence case** for **descriptions**, **helper paragraphs**, and **tooltips** / **ContextualHelp** bodies. **Product terms:** **Customer price**, **Worker payment** (align with `FieldPriceInput` and invoices). |
| **Audit** | Add a **short** subsection to **`docs/code-quality-alignment.md`** or **`docs/research/pricing-ui-improvements.md`** (or new **`docs/patterns/copy-dashboard.md`**) in **S2** listing **approved** pricing strings—**S1** references that follow-up.                                                                                                |

---

## 3. Technical feasibility

### 3.1 Touchpoints (expected files)

| Area                                                                   | Work                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`dashboard/app/dashboard/pricing/page.tsx`**                         | Refactor **inner** structure: **`Tabs` for field types** → **grid or flex** with **`aside` + `main`**. **State** for **selected field type** (`useState` + default from existing **`defaultTab`** logic). **Pass** `setMainTab` or equivalent into children for **“View history”**.                           |
| **New component** (e.g. `pricing-field-type-sidebar.tsx` or colocated) | Renders the **four** type buttons, **tip** content map (`number` → copy, etc.), **disabled** / **empty** state when a type has **zero** field configs.                                                                                                                                                        |
| **`FieldPricingList` / `FieldPricingCard`**                            | **Move** or **duplicate** **equation** UI into a **`FormulaPreview`** subcomponent; **accept** `currentCustomerPrice`, `currentWorkerPrice`, `fieldConfig` for **numeric** interpolation. **Margin** + **last update** blocks as **optional** child sections or **sibling** cards inside the same **`Card`**. |
| **`getEquationPreview`**                                               | **Deprecate** for **Number** in favor of **value-driven** string; keep fallback for **unknown** types until parity.                                                                                                                                                                                           |
| **Hooks**                                                              | Reuse **`useFieldPricing`**, **`useFieldPricingCardState`**; extend for **reset** (discard) if missing.                                                                                                                                                                                                       |
| **Tests**                                                              | **Vitest** for **FormulaPreview** string given mock prices; **smoke** render of sidebar (optional).                                                                                                                                                                                                           |

### 3.2 Layout sketch (desktop)

```
┌──────────────────────────────────────────────────────────────┐ │ Top-level: Pricing | History | Scope | Invoice…             │
├────────────┬─────────────────────────────────────────────────┤
│ [Number]   │  [ Field card — Tender Yard / … ]                │
│ [Boolean]  │  … Customer / Worker inputs …                    │
│ [Select]   │  FORMULA PREVIEW (live)                          │
│ [Group]    │  … Margin card | Last update card …            │
│────────────│  [ Test invoice* ] [ Discard ] [ Update rule ]  │
│ 💡 Tip card│  (* or page FAB only in v1)                      │
└────────────┴─────────────────────────────────────────────────┘
```

### 3.3 Margin placement when **multiple** fields

**Default (v1):** Each **`FieldPricingCard`** shows **its own** margin and last-update rows **inside** the card (bottom), so **scrolling** the list does not lose **per-field** context.

**Alternative (rejected for v1):** **Sticky** summary for “**selected**” field only—requires **selection** state and adds **click** before edit; **S2** optional.

### 3.4 Risks to regression

- **Tours** (`data-tour` on inner tabs) — **update** `dashboard/components/tours/tour-definitions.ts` when the **inner** structure changes.
- **Conditional rules** and **location overrides** — must remain **unchanged** in behavior; only **layout** / **copy** / **previews** move.
- **React Query** cache keys — **no** change expected if hooks unchanged.

### 3.5 Optional gold-review checklist

- [ ] **Keyboard:** sidebar types focusable, **roving** `tabindex` or single tab **radio**-like group per **WAI-ARIA** `radiogroup` pattern.
- [ ] **i18n:** Title Case is **English-centric**; if **non-EN** ships within a year, **S2** uses **per-locale** title rules or **avoids** automatic casing.

---

## 4. Risk assessment

| Risk                                            | Likelihood | Impact | Mitigation                                                                                                 |
| ----------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| **Layout breaks** on small laptops              | Medium     | Medium | **§2.6** responsive pattern; manual QA on **1280×720** and **iPad** widths                                 |
| **Incorrect margin** for non-linear pricing     | Medium     | High   | **Narrow** v1 to **per-unit** number fields; **explicit** “not applicable” for ambiguous rows              |
| **Performance** re-renders on every keystroke   | Low        | Medium | **Debounced** formula line; **memo** child components                                                      |
| **Tour / E2E** breaks                           | Medium     | Low    | **Update** selectors; run **`pricing`** tour in CI if present                                              |
| **User expects** single-field focus like mockup | Low        | Low    | **Release note** + **in-app** one-line: “**All** your **number** fields are listed here—scroll to switch.” |

---

## 5. Phased delivery

| Phase        | Deliverables                                                                                                                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v1 (MVP)** | Sidebar (or **responsive** row/sheet) for **4** types; **tip** card; **`FieldPricingCard`** updates: **live formula** for **number** (min), **margin** + **last update** using **`source_rule`** metadata; **Discard**; **Title Case** pass on **new** strings; **History** handoff; **tour** target updates. |
| **v1.1**     | **Boolean / Select / Group** formula lines to **same standard**; optional **in-card** test invoice; **improved** fixed-pricing + **empty type** empty states.                                                                                                                                                 |
| **S2+**      | **Field** search/selector; **query/hash** for deep link; **benchmark** or **org historical** compare **only** with real data; **i18n** title rules; design tokens from **Figma** if formalized.                                                                                                               |

---

## 6. Acceptance criteria (v1)

1. **No nested `TabsList`** for field type inside the **Pricing** tab; user selects type via **sidebar** (desktop) or **documented** narrow pattern.
2. For at least one **number** field with **valid** customer and worker per-unit **numbers**, **Formula preview** shows **those numbers** in the line (not only `price_per_unit × quantity` without values).
3. **Margin** block shows **dollar** and/or **%** with a **one-line** definition, or a **declared N/A** when not computable.
4. **Last update** shows **date** (relative or absolute) from **`source_rule`**, and a control switches to the **History** tab or is **wired** to the same effect.
5. **Discard** clears **unsaved** edits for that field when dirty state exists.
6. **Fixed pricing** and **no fields** empty states do **not** break the new layout.
7. **Copy:** New user-visible strings for **section titles** use **Title Case**; **body** uses **sentence case** (spot-check + PR review).

---

## 7. Open items for S2 / product (not blocking v1)

- **Industry benchmark** or **territory** average (needs **data** + **legal** copy).
- **Single-field** “focus mode” matching the **mockup** exactly.
- **Deep link** `?innerTab=number` (naming TBD) for support.
- **Full** margin story for **percentage** worker payments and **tiers**.

---

## 8. References

- **S0:** [`S0-pricing-tab-redesign.md`](./S0-pricing-tab-redesign.md)
- **Code:** `dashboard/app/dashboard/pricing/page.tsx`, `dashboard/components/pricing/field-pricing-card.tsx`, `field-pricing-list.tsx`, `option-pricing-editor.tsx` (select/group)
- **Types:** `FieldPricing`, `PricingRule` in `dashboard/lib/types.ts`
- **Project learning:** `docs/decisions/PROJECT_LEARNINGS.md` — **#9** (ContextualHelp) for in-form help

---

_Project stage doc — Tally Runner — S1 triage. Features & functions: [`S2-pricing-tab-redesign.md`](./S2-pricing-tab-redesign.md)._
