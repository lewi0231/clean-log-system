# S0 — Idea Intake: Inline pricing scope on field and option cards

| Field        | Value                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Stage**    | S0 — Idea capture (not triage; no build commitment)                                                                                |
| **Captured** | 2026-07-02                                                                                                                         |
| **Product**  | Tally Runner (dashboard — Pricing tab, location-scoped rules, group/option pricing)                                                |
| **Source**   | Product owner — Scope tab feels disconnected from where prices are set; multi-yard grouped-field pricing is awkward today          |
| **Related**  | [`S0-pricing-tab-redesign.md`](./S0-pricing-tab-redesign.md), [`S2-pricing-tab-redesign.md`](./S2-pricing-tab-redesign.md)         |
| **UX check** | Reviewed 2026-07-02 against complex-app heuristics, cognitive-load reduction, and progressive-disclosure principles (see **§3.1**) |

---

## 1. Idea (submitter language)

On the **Pricing** tab, **location scope** (which yard or region a price applies to) and **time scope** (when a price starts or ends) should be configured **where the user sets customer and worker values** — not on a separate **Scope** tab.

Today, an admin must:

1. Open the **Scope** tab and pick org default / region / yard + dates.
2. Return to **Pricing** and edit field or option values.
3. Repeat for every yard and every grouped option (e.g. car brand).

This feels disconnected. The owner’s mental model is: _“For **Full soap → Nissan**, Yard North is $X until June; all other yards use the default.”_

**Proposal (refined):**

- Embed **“Applies to”** (org default = all yards, or specific yard(s)) on each **field card** and **option row**.
- **Valid until** optional on scoped overrides; default = no end date.
- When an override has an end date, it **reverts to** the inherited org default (shown read-only) — org default must exist before a timed override can be saved.
- Keep a **single global “View as of”** date on the Pricing tab for preview/history, not per-card effective dates for routine editing.
- Demote the **Scope** tab to bulk tools / history filters, not daily price entry.
- Use **progressive disclosure**: default rows stay simple; overrides open in an expandable panel, drawer, or popover instead of showing location controls on every row at all times.

**Reference persona:** Car-yard cleaning — invoiced **per car**; **Wipe** and **Full soap** as separate grouped fields; options like **Nissan**, **Ford**; multiple **static location** yards with mostly shared pricing and occasional yard-specific overrides.

---

## 2. Problem / opportunity (why this matters)

| Problem                                         | Impact                                            | Evidence                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Scope tab disconnected from editing**         | Users forget active yard; edit wrong scope        | Scope only on Scope tab; `PricingScopeIndicator` exists but **unwired** on Pricing tab                                      |
| **Group/option pricing lacks inline overrides** | Multi-yard car-brand pricing requires tab hopping | `OptionPricingEditor` has no `LocationOverridesMatrix`; number/boolean cards only show overrides at org default             |
| **Hidden inheritance**                          | “No price set” when org default exists            | `buildScopedPricingMap` at yard scope does not surface hierarchy/org fallback in UI; invoice engine **does** walk ancestors |
| **Global scope + many fields**                  | High friction for 2 yards × 5 brands × 2 services | Context in `PricingScopeProvider` applies to all editors at once                                                            |
| **Inconsistent date behaviour**                 | Confusion on scheduled vs expiring rates          | Field save passes `effectiveAt`; option save often defaults to “now”; Scope help text contradicts behaviour                 |

**Opportunity:** Inline scope makes multi-location SMB pricing match how owners think (default + exceptions), unblocks car-yard-style operators, and reduces concierge setup time.

---

## 3. Success (what “good” looks like — draft, non-binding)

_(Precise acceptance tests belong in S1/S2.)_

| Outcome                            | Measurement                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **No tab switch for yard pricing** | User sets org default and yard override for a grouped option without visiting Scope tab                                          |
| **Clear “applies to”**             | Each field/option shows All yards (org default) or named yard override(s)                                                        |
| **Inheritance visible**            | UI shows “inherited from All yards: $X” vs “Yard override: $Y”                                                                   |
| **Timed overrides safe**           | End date on override blocked unless org default exists; “reverts to” shown read-only                                             |
| **Group parity**                   | `OptionPricingEditor` has same scope/override affordances as `FieldPricingCard`                                                  |
| **Global preview date**            | One “View as of” control on Pricing tab; not duplicated on every card                                                            |
| **Invoice alignment**              | Displayed fallback chain matches `calculate-invoice` resolution order                                                            |
| **Low cognitive load**             | Default view shows current price + inheritance/override status; advanced scope/date controls appear only when managing overrides |
| **Error prevention**               | Bulk multi-yard changes require a preview of affected yards/options and an explicit confirmation                                 |

### 3.1 UX review (senior design assessment)

The **direction is sound** and likely to improve user satisfaction because it follows well-established UX principles for complex business software:

| Principle                       | Assessment                                                                                                                           | Required adjustment                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Visibility of system status** | Moving scope context onto Pricing is correct; users need to know which yard/date they are editing without remembering the Scope tab. | Use a sticky page-level **View as of** indicator and row-level scope chips such as **All yards**, **Inherited**, or **Yard override**. |
| **Recognition over recall**     | Users should not have to remember the active scope while editing prices.                                                             | Show the inherited source and current effective price in each row, e.g. **Inherited from All yards: $8**.                              |
| **Match to mental model**       | “Default + exceptions” matches how SMB operators talk about pricing.                                                                 | Keep **All yards** as org default; do not introduce a separate “all selected yards” concept.                                           |
| **Progressive disclosure**      | Inline scope is helpful, but too many controls per row can become clutter for group fields with many options.                        | Default rows show summary chips only; detailed location/date controls open via **Manage overrides**.                                   |
| **Error prevention**            | Bulk location pricing can cause expensive mistakes.                                                                                  | Multi-yard apply must show affected yards/options and resulting prices before save; preserve discard/undo where feasible.              |
| **Consistency**                 | Group/select pricing needs parity with number/boolean cards.                                                                         | Reuse one shared scope/override component across field cards, option rows, and base pricing where possible.                            |
| **User control**                | Users need confidence that changes are scoped and reversible.                                                                        | Keep explicit save, dirty state, discard, history link, and visible “what will change” copy.                                           |

**UX risk to avoid:** embedding full dropdowns, dates, and override controls in every option row by default would solve the Scope-tab problem but create a new density problem. The preferred pattern is **summary in-row, details on demand**.

**Research references used for this assessment:**

- Nielsen Norman Group — [10 Usability Heuristics Applied to Complex Applications](https://www.nngroup.com/articles/usability-heuristics-complex-applications/)
- Nielsen Norman Group — [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- Nielsen Norman Group — [4 Principles to Reduce Cognitive Load in Forms](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/)

---

## 4. Current product snapshot (verified)

### 4.1 Pricing page structure

| Tab                     | Role today                                                                        |
| ----------------------- | --------------------------------------------------------------------------------- |
| **Pricing**             | Field-type editors (Number, Boolean, Select, Group)                               |
| **Scope**               | `LocationScopeSelector` — org / hierarchy / location + effective/expiration dates |
| **History**             | Audit log with scope filters                                                      |
| **Invoice adjustments** | Base/global rules                                                                 |

**Provider:** `PricingScopeProvider` (`dashboard/components/pricing/pricing-scope-context.tsx`) — shared `locationId`, `locationHierarchyId`, `effectiveDate`, `expirationDate`.

### 4.2 Where values are set

| Field type       | Component             | Inline scope today                                                                   |
| ---------------- | --------------------- | ------------------------------------------------------------------------------------ |
| Number / Boolean | `FieldPricingCard`    | `LocationOverridesMatrix` **only** when org default selected **and** overrides exist |
| Select / Group   | `OptionPricingEditor` | **None** — reads global scope context only                                           |
| Base / global    | `BasePricingEditor`   | Override matrix at org default (similar to field cards)                              |

### 4.3 Data model (no change required for v1 concept)

**Table:** `pricing_rule`

| Column                                  | Inline scope use                         |
| --------------------------------------- | ---------------------------------------- |
| `location_id` / `location_hierarchy_id` | “Applies to” target                      |
| _(null both)_                           | Org default = **All yards**              |
| `option_value`                          | Group/select option (e.g. `Nissan`)      |
| `effective_at` / `expires_at`           | Rule timeline; “View as of” filters list |
| `pricing_context`                       | Separate customer / worker rows          |

**Resolution:** `dashboard/lib/pricing-scope.ts` (`buildScopedPricingMap`); invoice engine adds hierarchy walk in `calculate-invoice`.

### 4.4 Known gaps (this S0 addresses)

| Gap                                        | Severity for car-yard persona |
| ------------------------------------------ | ----------------------------- |
| Option editor no override UI               | **High**                      |
| Scope invisible on Pricing tab             | **High**                      |
| Yard view hides org-default inheritance    | **Medium**                    |
| Option save ignores scoped `effectiveAt`   | **Medium**                    |
| Scope tab does edit + preview in one place | **Medium**                    |

---

## 5. Proposed UX model (refined from product discussion)

### 5.1 Scope vocabulary (avoid duplicate concepts)

| User-facing label    | Meaning                                                              | DB                                                                      |
| -------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **All yards**        | Organization default — same price everywhere unless overridden       | No `location_id` / `location_hierarchy_id`                              |
| **Specific yard(s)** | Override for one or more locations                                   | `location_id` per rule (multi-select save → multiple rules)             |
| **Region / company** | Optional hierarchy scope (existing)                                  | `location_hierarchy_id`                                                 |
| **Valid until**      | Optional end of this override                                        | `expires_at`                                                            |
| **Reverts to**       | Read-only inherited price after expiry                               | Resolved org/hierarchy rule — **not** a second editable “default” field |
| **View as of**       | Page-level preview date                                              | Filters `list-pricing-rules` by `effective_at`                          |
| **Inherited from**   | Read-only label for the rule currently supplying the displayed value | Derived from scope resolution                                           |
| **Manage overrides** | Row/card action that opens location/date controls                    | UI state only                                                           |

**Do not introduce** a fourth “all locations selected” mode separate from org default.

### 5.2 Per card / per option layout (target)

```text
Pricing tab
├── [View as of: today ▾]     [Pricing shown for: All yards ▾]  ← sticky context bar
├── Group → "Full soap"
│   ├── Nissan   Customer $8   Worker $4
│   │   Chip: All yards default
│   │   [Manage overrides]
│   │     └─ Yard North: Customer $9 until 30 Jun → reverts to $8 (All yards)
│   ├── Ford     Customer $7   Worker $3
│   └── ...
└── Group → "Wipe only"
    └── (same pattern)
```

**Interaction rules:**

1. **Default path:** Set customer/worker prices at **All yards** for each option.
2. **Exception path:** “Manage overrides” → “Add yard override” → pick yard → price + optional valid until.
3. **Validation:** Timed yard override requires org-default rule for same `(field, option, context)`.
4. **No full matrix by default:** Show org row + scope chips; override list appears only when expanded.
5. **Bulk safety:** Multi-yard apply shows a confirmation summary before save: selected yards, option values, customer price, worker price, dates, and fallback source.

### 5.2.1 Recommended interaction pattern

| UI element         | Default state                                                    | Expanded state                                                          |
| ------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Option row         | Option label, customer/worker inputs, scope chip, override count | Yard override list, add override, valid-until field, reverts-to preview |
| Field card         | Field label, live formula, current scope chip                    | Override manager reused from option rows                                |
| Sticky context bar | View date + current preview scope                                | Link to advanced Scope/bulk tools                                       |
| Save bar           | Shows number of changed rows                                     | Shows affected scopes before confirmation                               |

**Preferred microcopy:**

- **All yards default** — base rule used unless a yard/region override exists.
- **Inherited from All yards** — this price is not saved directly on this yard.
- **Yard override** — this yard has its own saved price.
- **Reverts to $X from All yards after 30 Jun** — expiry behaviour is explicit.

### 5.3 Scope tab future role (demote, don’t delete)

| Keep on Scope tab                         | Move to inline cards                |
| ----------------------------------------- | ----------------------------------- |
| Bulk “copy org prices to yard”            | Daily price entry                   |
| History-oriented filters                  | “Applies to” per rule               |
| Advanced hierarchy editing                | Per-option overrides                |
| Optional: org-wide “view as of” duplicate | Primary “View as of” on Pricing tab |

### 5.4 Reference workflow — car-yard cleaning

| Step | Owner action                                                      |
| ---- | ----------------------------------------------------------------- |
| 1    | Open **Group → Full soap**                                        |
| 2    | Set **Nissan** / **Ford** customer + worker at **All yards**      |
| 3    | For **Yard North** only: add override on Nissan ($9) if different |
| 4    | Repeat for **Wipe only** field (separate grouped field)           |
| 5    | **Test Invoice** for a job at Yard North with soap + Nissan       |

**Out of scope for this feature:** Per-car pricing beyond grouped options; fixed-price location mode (existing banner disables field pricing).

---

## 6. Design principles

| #   | Principle                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Edit where you set the number** — scope is part of the price row, not a separate journey                                  |
| D2  | **Default + exceptions** — org default first; overrides are explicit and visible                                            |
| D3  | **Inherit, don’t duplicate** — “Reverts to” is computed, not re-typed                                                       |
| D4  | **Separate time concepts** — `expires_at` (override ends) vs `effective_at` (scheduled start); routine edits use “now”      |
| D5  | **Parity across field types** — group/select options get same scope affordances as number/boolean                           |
| D6  | **Match invoice engine** — UI fallback chain aligns with `calculate-invoice` specificity                                    |
| D7  | **Progressive disclosure** — override list collapsed by default; no N×M matrix                                              |
| D8  | **Safe bulk edits** — any multi-yard action previews affected records and requires confirmation                             |
| D9  | **View vs edit separation** — “View as of” explains what is being displayed; “Manage overrides” explains what will be saved |
| D10 | **Support scanning** — row chips and short labels are visible without opening help text                                     |

---

## 7. Work required

### 7.1 Phase 1 — Visibility (low risk)

| ID   | Work                                                                              | Files / notes                                                             |
| ---- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| P1.1 | Wire **sticky scope bar** on Pricing tab (“View as of”, active editing scope)     | `pricing/page.tsx`, `pricing-scope-indicator.tsx`                         |
| P1.2 | Show **inherited vs override** badge on field cards and option rows               | `field-pricing-card.tsx`, `option-pricing-editor.tsx`, `pricing-scope.ts` |
| P1.3 | Align Scope tab copy with actual save behaviour (`effectiveAt`, `expires_at`)     | `location-scope-selector.tsx`, help text                                  |
| P1.4 | Add row/card scope chips: **All yards default**, **Inherited**, **Yard override** | Shared badge/chip component                                               |

### 7.2 Phase 2 — Inline scope on option/group editor (car-yard unblock)

| ID   | Work                                                                                             | Files / notes                                  |
| ---- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| P2.1 | **Applies to** control on each option row (All yards / specific yard)                            | `option-pricing-editor.tsx`                    |
| P2.2 | **Yard overrides** section per option (reuse or extend `LocationOverridesMatrix`)                | New or shared `pricing-scope-controls.tsx`     |
| P2.3 | Pass `effectiveAt` / `expires_at` consistently on option save                                    | `use-option-pricing.ts`, upsert edge functions |
| P2.4 | Multi-yard apply: selecting multiple yards creates **one rule per yard**                         | Save handler + confirmation                    |
| P2.5 | Use **Manage overrides** progressive disclosure, not always-visible controls in every option row | `option-pricing-editor.tsx`                    |
| P2.6 | Add affected-record summary before bulk save                                                     | Save confirmation dialog                       |

### 7.3 Phase 3 — Field cards + validation

| ID   | Work                                                                             | Files / notes                                      |
| ---- | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| P3.1 | Move **Applies to** onto `FieldPricingCard` (not only via global Scope tab)      | `field-pricing-card.tsx`, `field-pricing-list.tsx` |
| P3.2 | **Valid until** + read-only **Reverts to** on overrides                          | Shared scope control component                     |
| P3.3 | Validation: block timed override without org default                             | Client + optional server guard                     |
| P3.4 | Fix yard-scope UI to show org-default inheritance (match invoice hierarchy walk) | `buildScopedPricingMap` or fetch parent rules      |
| P3.5 | Keep explicit dirty state, discard, and history link after inline scope changes  | Field and option editors                           |

### 7.4 Phase 4 — Scope tab repurpose

| ID   | Work                                                                  | Notes                             |
| ---- | --------------------------------------------------------------------- | --------------------------------- |
| P4.1 | Bulk **copy pricing to yard**                                         | Concierge + multi-yard onboarding |
| P4.2 | Demote Scope tab to “Advanced / bulk” or merge into Pricing sub-panel | Product decision in S1            |
| P4.3 | Update `dashboard/app/dashboard/help/page.tsx` pricing-scope help     |                                   |

### 7.5 Explicitly out of scope (v1)

| Item                                                    | Reason                                              |
| ------------------------------------------------------- | --------------------------------------------------- |
| New DB tables                                           | `pricing_rule` sufficient                           |
| Full yards × options spreadsheet matrix                 | UX complexity                                       |
| Always-visible per-row scope dropdowns for every option | Too dense; use progressive disclosure               |
| Per-field “effective from” on every card                | Use page “View as of” + scheduled rule flow (S1)    |
| Mobile pricing UI                                       | Dashboard-only S0                                   |
| Changing invoice calculation algorithm                  | Display/inheritance alignment only unless bug found |

---

## 8. Relationship to pricing tab redesign S0

[`S0-pricing-tab-redesign.md`](./S0-pricing-tab-redesign.md) §5.1 scoped the redesign to **Pricing tab content only** and excluded **Scope tab** changes except cross-links.

**This S0 amends that boundary:** inline scope is part of **Pricing tab content** (field/option cards). The **Scope tab** may shrink but is not removed in v1 without S1 approval.

**Combined delivery order (draft):**

1. Pricing tab redesign **navigation** (sidebar field types) — existing S0/S2 track
2. **Phase 1–2** of this S0 (sticky bar + option inline scope) — unblocks car-yard
3. Phase 3–4 — parity and bulk tools

---

## 9. Open questions for S1 (Triage)

| #   | Question                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------- |
| 1   | **Hierarchy scope** on option rows in v1, or yards-only?                                                      |
| 2   | **Multi-select yards** on save — one click “apply to Yard A + B” vs add overrides one at a time?              |
| 3   | **Scheduled price increases** — separate “New rate from [date]” flow vs only expires_at?                      |
| 4   | Remove **global** `PricingScopeProvider` location state once inline scope ships, or keep for History/filters? |
| 5   | **Worker + customer** scope always linked (same yards) or independent overrides?                              |
| 6   | Should **concierge setup** get a “copy all org defaults to yard” bulk action in Phase 2?                      |
| 7   | Fixed-price location mode — hide inline scope or show read-only?                                              |
| 8   | Should **Manage overrides** open inline, in a side panel, or in a modal for small screens?                    |
| 9   | What is the maximum visible override count before using a compact “View all overrides” pattern?               |
| 10  | What undo/recovery pattern is required after a bulk multi-yard save?                                          |

---

## 10. Acceptance scenarios (reference persona)

### AS-1 — Org default for all yards

_Given_ two yards and Full soap → Nissan  
_When_ admin sets customer $8 at **All yards** and saves  
_Then_ jobs at either yard use $8 unless a yard override exists

### AS-2 — Yard override with end date

_Given_ org default Nissan $8  
_When_ admin adds Yard North $9, valid until 30 Jun  
_Then_ jobs at Yard North before 30 Jun use $9; after expiry use $8  
_And_ UI shows “Reverts to: $8 (All yards)”

### AS-3 — Block orphan timed override

_Given_ no org default for Ford  
_When_ admin tries Yard South override with valid until date  
_Then_ save blocked with message to set All yards price first

### AS-4 — No Scope tab switch

_Given_ admin on Pricing → Group → Full soap  
_When_ configuring Nissan for Yard North  
_Then_ complete flow without opening Scope tab

### AS-5 — Progressive disclosure keeps the row scannable

_Given_ Full soap has 10 car options  
_When_ the admin opens the group field  
_Then_ each option row shows prices and scope chips only  
_And_ yard/date controls appear only after selecting **Manage overrides**

### AS-6 — Bulk edit preview prevents accidental changes

_Given_ admin selects Yard North and Yard South for Nissan override  
_When_ they save the override  
_Then_ a confirmation summary lists both yards, the customer and worker prices, the valid-until date, and the fallback source before writing rules

---

## 11. Out of scope for this S0

- DAP steps, component API specs, exact copy strings
- Schema migrations (unless S1 finds gap)
- E2E test plan (S2/S3)

---

## 12. Post–S0 gate (Process Excellence)

> _If someone reads this idea in 6 months with no other context, will they understand what was meant?_

- **Yes, if:** reader sees (1) **problem** = Scope tab disconnected, options lack overrides, (2) **solution** = inline “Applies to” + inherit/revert model, (3) **persona** = multi-yard car soap/wipe, (4) **phases** P1–P4, (5) **no new “all yards” concept** beyond org default.

---

## 13. Related documents & code

| Doc / path                                                                                                                           | Relationship                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| [`S0-pricing-tab-redesign.md`](./S0-pricing-tab-redesign.md)                                                                         | Sidebar/layout track; amended boundary in §8                  |
| [`S0-concierge-onboarding-and-handoff.md`](./S0-concierge-onboarding-and-handoff.md)                                                 | Concierge sets yard pricing — benefits from Phase 2 bulk copy |
| `dashboard/app/dashboard/pricing/page.tsx`                                                                                           | Pricing page entry                                            |
| `dashboard/components/pricing/pricing-scope-context.tsx`                                                                             | Global scope state                                            |
| `dashboard/components/pricing/location-scope-selector.tsx`                                                                           | Scope tab UI                                                  |
| `dashboard/components/pricing/field-pricing-card.tsx`                                                                                | Number/boolean card + overrides matrix                        |
| `dashboard/components/pricing/option-pricing-editor.tsx`                                                                             | Group/select — primary gap                                    |
| `dashboard/components/pricing/location-overrides-matrix.tsx`                                                                         | Reusable override table                                       |
| `dashboard/components/pricing/pricing-scope-indicator.tsx`                                                                           | Unwired — Phase 1                                             |
| `dashboard/lib/pricing-scope.ts`                                                                                                     | Client scope resolution                                       |
| `database/supabase/functions/calculate-invoice/index.ts`                                                                             | Runtime resolution reference                                  |
| Nielsen Norman Group — [Complex application heuristics](https://www.nngroup.com/articles/usability-heuristics-complex-applications/) | UX validation reference                                       |
| Nielsen Norman Group — [Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)                            | UX validation reference                                       |
| Nielsen Norman Group — [Reduce cognitive load in forms](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/)        | UX validation reference                                       |

---

_S0 — Inline pricing scope on field and option cards — Tally Runner — 2026-07-02_
