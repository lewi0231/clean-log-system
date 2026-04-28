# S0 — Idea Intake: Pricing tab redesign (sidebar field types, live formula, margin & recency, Title Case)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| **Stage**    | S0 — Idea capture (not triage; no build commitment)                   |
| **Captured** | 2026-04-23                                                            |
| **Updated**  | 2026-04-23                                                            |
| **Product**  | Tally Runner (organization / worker job logging, field-based pricing) |
| **Source**   | Product owner — high-fidelity mockup + SMB UX direction               |

---

## 1. Idea (submitter language)

Redesign the **main “Pricing” tab** of the dashboard **pricing** experience so that:

1. **Field-type choice is not nested tabs.** Today, under **Pricing**, users pick **Number / Boolean / Select / Group** via a **second level of tabs** inside the same tab. The proposal is a **left sidebar** of large, tappable “cards” or buttons (one per field type) so **navigation is flatter** and field types stay **visible at a glance**—no “tabs within a tab” mental model.

2. **Contextual “pricing tip” in the sidebar.** A short, high-contrast card (e.g. with a lightbulb) explains what the **currently selected** field type is for (e.g. _Number_ for variable units: square footage, hours, material quantities). Copy should be **short and business-language**, not schema jargon.

3. **Formula preview sits under the main pricing inputs and uses real numbers.** Instead of a generic or symbolic formula, show something the owner can read as **their** math, e.g. a line that reflects **current customer and worker per-unit values** and resolves to **profit per unit** (or equivalent), labeled as **automatic** or **live** so they trust the line item without re-deriving it.

4. **Two summary cards at the bottom of the field configuration area:**
   - **Profitability / margin check** — e.g. current **margin %** and, where data exists, a comparison to a **relevant benchmark** (category / historical / org default — to be defined in S1) so the owner gets an immediate _“am I in the ballpark?”_ signal.
   - **Last update** — **who** last changed the rule, **how long ago**, and a pointer to **History** for audit. Reinforces **trust and team accountability** without opening another screen first.

5. **In-context actions** where the form lives: e.g. **Test Invoice**, **Discard**, **Update Rule** (labels indicative; exact button set in S1). The floating **Test Invoice** affordance can be **revisited** so primary actions for _this_ field are not only in a corner of the page.

6. **Capitalization and tone for the target market (small business owners).** The mockup leans on **Title Case** for key labels and section headers (e.g. **“FORMULA PREVIEW”**, **“Number Field Pricing / Tender Yard”**). For SMBs who scan quickly, **strong visual hierarchy** and **familiar “business app” phrasing** reduce cognitive load. S1 should align with a small **content style** rule: e.g. **section titles in Title Case**, sentence case for body/helper text, consistent product terminology (**Customer Price**, **Worker Payment**, not internal DB names).

---

## 2. Problem / opportunity (why this matters)

- **Cognitive load:** Nested tabs hide sibling field types; owners may not discover **Group** or **Select** pricing without exploration. A **always-visible sidebar** supports **“choose type → adjust numbers → confirm”** as a single flow.
- **Relevance of math:** A symbolic formula is easy to ignore; **numbers that match the fields above** make **profit per unit (or per job sample)** feel **real** and support better pricing decisions.
- **Confidence at a glance:** **Margin** and **last editor / recency** answer _“is this sensible?”_ and _“did someone already touch this?”_—common questions for small teams without a dedicated finance role.
- **Parity with market expectations:** Many SMB tools surface **margin** and **version/recency** on configuration screens; matching that pattern can improve **perceived quality** and **adoption** of the pricing feature set.

---

## 3. Success (what “good” looks like — draft)

- **Navigation:** A user can **switch field types** without a second tab strip; the active type is **obvious** (selected state, icon + label).
- **Comprehension:** A user editing **per-unit** customer and worker values sees a **line that updates** as they type, using **actual entered values** (with clear units, e.g. _per 1,000 sq ft_ if product supports that copy).
- **Business insight (when data allows):** A **margin** (or **profit** summary) is shown with **clear definitions** (what is in the numerator and denominator) and a **credible** benchmark when not “N/A” (new org, missing category, etc. — S1 to define).
- **Auditability:** **Last modified** metadata is **accurate** and links or invites users to **History** in a way that matches the **top-level “History”** tab.
- **Copy & capitalization:** **Consistent** Title Case (or agreed rule) for **labels and major headings**; helper text in **sentence case**; terms aligned with **invoice** and **job** language used elsewhere in the app.

_(Exact layout breakpoints, API contracts, and acceptance tests belong in S1/S2.)_

---

## 4. Research summary (landscape and current product — not a decision yet)

### 4.1 Current dashboard implementation (for S1 alignment)

- **Top-level tabs** on `/dashboard/pricing` already separate **Pricing**, **History**, **Scope**, and (when not fixed pricing) **Invoice adjustments** (see `dashboard/app/dashboard/pricing/page.tsx`). This S0 is **not** proposing to remove those; it targets **the inner “Pricing” tab content** only.
- **Inside the Pricing tab**, field types are still implemented as **nested** `Tabs` (**number-pricing** | **boolean-pricing** | **select-pricing** | **group-pricing**) with `TabsList` / `TabsContent` and field lists (`NumberPricingList`, `BooleanPricingList`, etc.).
- **Test Invoice** and related flows exist but may be **separate** from a single-field “update rule” pattern in the mockup; S1 should map **current** components (e.g. `TestInvoiceModal`, `FieldPricingCard`) to the **proposed** layout.

### 4.2 UX patterns (industry-agnostic)

| Pattern                                      | Intent                                 | Notes for S1                                                                                      |
| -------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Flat navigation** (sidebar vs nested tabs) | Reduce depth, increase discoverability | Check **narrow viewports** (sidebar collapse, horizontal scroll, or bottom sheet)                 |
| **Live derived line** (formula preview)      | Connect inputs to **outcome**          | **Debouncing**, **a11y** (announced updates or `aria-live` for optional announcements)            |
| **Margin**                                   | Business sanity check                  | **Definition** of margin; **data source** for “category average” (may be **out of scope** for v1) |
| **Last updated**                             | Trust + accountability                 | Reuse or extend **pricing history** and **rule** metadata (who/when)                              |

### 4.3 Capitalization and voice (for S1 / content pass)

- **Title Case** for **primary** labels and **section** titles (e.g. _Customer Price Per Unit_, _FORMULA PREVIEW_) can improve **scannability** for users who are **not** designers or engineers.
- **Avoid** Title Case in **long sentences** and **body** helper copy—**sentence case** usually reads more naturally and reduces “staccato” fatigue.
- **Glossary:** Align with existing strings (**customer** vs **client**, **worker payment** vs **payout**, etc.) from invoices and job flows.

### 4.4 Open product questions (for S1 triage — not decided in S0)

| Question                                                                                          | Why it matters                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **“Category average”** — real benchmark v1, placeholder, or shipped later?                        | Affects data pipeline, **honesty of copy**, and **empty states**                                                                 |
| **One field at a time** in the main pane vs list of all fields of that type?                      | Current UI often lists **multiple** fields; mockup shows **one field** (e.g. “Tender Yard”)—confirm **information architecture** |
| **Discard / Update Rule** — map to **autosave**, **explicit save**, or **per-field** dirty state? | Ties to **optimistic** patterns and **undo**                                                                                     |
| **Responsive** — sidebar as **drawer** on small screens?                                          | SMB owners **may** use tablets; S1 should specify **breakpoints**                                                                |
| **Fixed-pricing locations** — sidebar still shown with disabled types?                            | Already partially handled by **fixed pricing** messaging; S1 to unify with new layout                                            |

---

## 5. Stakeholder preferences (captured) vs open items (S1)

### 5.1 Captured in this S0

| Topic                                   | Direction                                                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No nested tab strip** for field types | **Sidebar** (or equivalent **single-level** control) for **Number / Boolean / Select / Group**                                                              |
| **Formula preview**                     | **Concrete values** from current inputs, **under** the pricing fields                                                                                       |
| **Bottom cards**                        | **Margin (or profit) insight** + **last update** with path to **History**                                                                                   |
| **Target market**                       | **Small business owners** — **clear hierarchy**, **business-friendly** language, **Title Case** for key headings/labels (with sentence case for paragraphs) |
| **Scope of this document**              | **Pricing** tab **content** only; **not** a redesign of **History / Scope / Invoice adjustments** tabs except **cross-links** in copy (e.g. “View history”) |

### 5.2 Explicitly not decided in S0

- **Visual design system** (exact tokens, card colors, lightbulb component reuse).
- **Whether “profit margin check”** ships without external benchmarks in v1.
- **Back-end** changes (if any) to surface **last editor** on **per-rule** or **per-field** rows—**may** be read-only from existing `pricing` history and rule tables, or need **schema** work (S1).
- **Internationalization** — Title Case rules differ by locale; S1 if non-EN markets matter soon.

---

## 6. Out of scope (unless pulled in by S1)

- **Worker payment split** math beyond what is required to show **per-unit** customer vs worker and a **simple margin** line for **one** configurable field.
- **Mobile** app pricing UI (this S0 is **dashboard**-centric; patterns may **inform** mobile later).
- **Replacing** the top-level **History** tab with the bottom **Last update** card only—the card is a **complement**, not a full substitute for history.

---

## 7. References

- **Mockup:** High-fidelity **Pricing Rules** screen (sidebar field types, formula preview, margin and last-update cards, Title Case labels) — attach the PNG under `docs/` or design storage when checked in; filename at capture was `pricing_redesign-0fdea299-69e0-49fe-ab70-a0a3094fa4a0.png`.
- **Current implementation (starting points for S1):** `dashboard/app/dashboard/pricing/page.tsx`, `dashboard/components/pricing/*` (e.g. `number-pricing-list`, `field-pricing-card`).
- **Related project learning:** `docs/decisions/PROJECT_LEARNINGS.md` — e.g. **#9** (ContextualHelp vs Tooltip) for any **in-form** help beside labels.

---

_Project stage doc — Tally Runner — S0 idea intake only. Triage: [`S1-pricing-tab-redesign.md`](./S1-pricing-tab-redesign.md). Build spec: [`S2-pricing-tab-redesign.md`](./S2-pricing-tab-redesign.md)._
