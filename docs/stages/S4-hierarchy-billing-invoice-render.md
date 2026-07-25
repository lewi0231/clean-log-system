# S4 — Detailed Action Plan: Hierarchy billing + single invoice presentation

| Field           | Value                                              |
| --------------- | -------------------------------------------------- |
| **Stage**       | S4 — Detailed Action Plan (execution-ready for S5) |
| **Created**     | 2026-07-25                                         |
| **Gold review** | **2026-07-25 — complete** (see §11)                |
| **Adversarial** | **2026-07-25 — complete** (see §12)                |
| **Product**     | Tally Runner (Dashboard + Edge)                    |
| **Agent**       | GIMBAL-34                                          |

**Scope lock (v1):** Capture structured Bill To on Company/Region; resolve billing for email + invoice display via **one server-side algorithm**; stop Open PDF / email-attachment PDF omitting Bill To / service address. **Out of v1:** Places API wiring (structured fields + `autoComplete` attrs only), customer ABN on Bill To, PO numbers, full visual React↔HTML↔pdf-lib unification (GST/bank/logo parity), inventing a fourth renderer.

**Verify discipline:** Run each step’s **Verify** before the next. Do not skip PRESERVE notes.

---

## 0. Locked product decisions

| #   | Decision          | Choice                                                                                                                                                       |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Default Bill To   | **Region** when location’s parent is a region and that region has **display-usable** billing                                                                 |
| D2  | Company override  | Company metadata flag **`use_company_billing_for_children`**. When true, descendants **must** use Company; do **not** fall back to Region                    |
| D3  | Fallback          | If resolution yields no usable billing → today’s fallbacks (location email / no Billing Address subsection)                                                  |
| D4  | Address shape     | Structured, autocomplete-ready, aligned with existing Geoapify shape: `address_line1`, `address_line2`, `city`, `state`, `postcode`, `country`               |
| D5  | Customer tax ID   | **Defer.** Jobber/ServiceM8 put **vendor** tax ID on invoices (org ABN already shown)                                                                        |
| D6  | Competitor note   | ServiceM8 Client Sites bill **head office**; Jobber uses client billing + property reference. Region-default + company override covers both                  |
| D7  | Algorithm SoT     | **Edge resolves once.** Authenticated + public invoice APIs return `resolved_billing`. Clients/PDF **do not** re-implement walk rules                        |
| D8  | PDF parity scope  | v1 = **Bill To + service address** (+ existing totals/lines). GST breakdown, bank details, Tax Invoice title rules = **out of Slice B** (track as follow-up) |
| D9  | Multi-job Bill To | v1 display uses **primary location** (same as `InvoiceDocument` today). Email continues unique-set across jobs. Conflicting Bill Tos = open item             |

### Competitor notes (research 2026-07-25)

- **Jobber:** Invoice tied to client billing address; property for reference. Tax ID on invoice is **vendor** ([Invoice Basics](https://help.getjobber.com/hc/en-us/articles/115009685047-Invoice-Basics), [Tax Settings](https://help.getjobber.com/hc/en-us/articles/115014367307-Tax-Settings)).
- **ServiceM8:** Separate job vs billing address/contact. Client Sites: sites have **no** billing contact — always head office ([Client Sites Overview](https://support.servicem8.com/help-center/servicem8-add-ons/client-sites/client-sites-overview)).

---

## 1. Current state (root causes)

### Hierarchy billing

| Fact                      | Detail                                                                                                                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expected shape (implicit) | `metadata.billing_address` with flat `name`, `address`, `contact_person`, `email`, `phone`                                                                                                                                                                |
| UI gap                    | Hierarchy manager edits name/type/parent + `auto_generate_invoices` only — **never** billing                                                                                                                                                              |
| Email vs Bill To          | Email helper accepts **any** parent type and reads `billing_address.email` on the **immediate** parent (region works today if email is on the region). Bill To requires `type === "company"` **and** `billing_address_config.enabled` (default **false**) |
| Metadata load             | `get-invoice-details` / `get-invoice-public` load only immediate `hierarchy_parent_id` nodes — **no** company walk-up, **no** `parent_id` in select                                                                                                       |
| Settings copy             | Billing + email copy say “parent company” while locations usually hang off regions                                                                                                                                                                        |
| Edge update semantics     | `update-location-hierarchy` **replaces** entire `metadata` JSONB with client payload — client merge is the only safety net                                                                                                                                |

### Invoice presentation duplication

| Path        | File                                                  | Used by                                                                      | Bill To / service                            |
| ----------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| A — React   | `dashboard/components/invoicing/invoice-document.tsx` | Detail, preview dialog, public `/invoice/[id]`                               | Yes if `enabled` + company parent            |
| B — HTML    | `generate-invoice-pdf/index.ts`                       | Open PDF (`InvoiceService.generatePdfHtml` → edge)                           | **No** (also no GST/bank — thinner document) |
| C — pdf-lib | `_utils/invoice-pdf.ts`                               | **auto-send-invoices** + **update-invoice-status** (manual send) attachments | **No**                                       |

Public “Download PDF” uses `window.print()` on React (Path A), not Path B. Detail-page Print clones `#invoice-preview` (Path A).

---

## 2. PRESERVE (Article 1)

| ID              | Preserve                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| **PRESERVE-1**  | Missing hierarchy billing → no hard fail on invoice generate/send; same fallbacks as today                   |
| **PRESERVE-2**  | Pricing inheritance / `pricing_rule` + hierarchy scope unchanged                                             |
| **PRESERVE-3**  | `auto_generate_invoices` metadata + scheduled auto-invoice unchanged                                         |
| **PRESERVE-4**  | Location fields remain service-site source                                                                   |
| **PRESERVE-5**  | Org ABN / GST / payment methods on **React** invoices unchanged                                              |
| **PRESERVE-6**  | Do not remove Open PDF or email PDF capability                                                               |
| **PRESERVE-7**  | `billing_address_config.enabled` remains the display gate unless product explicitly changes default/behavior |
| **PRESERVE-8**  | Hierarchy save **merges** metadata — never drop unknown keys (billing, auto-gen, future keys)                |
| **PRESERVE-9**  | Legacy flat `billing_address.address` still displays (map to `address_line1`)                                |
| **PRESERVE-10** | Email chain when source is `hierarchy_billing_email`: resolved hierarchy email → location email              |
| **PRESERVE-11** | Feedback recipient resolution continues to share `getInvoiceEmailRecipient` (regression surface)             |

---

## 3. Target metadata shape

Stored on `location_hierarchy.metadata` (no new columns for v1):

```json
{
  "billing_address": {
    "name": "Metro South AP",
    "contact_person": "Accounts Payable",
    "email": "ap-south@example.com",
    "phone": "+61 …",
    "address_line1": "1 Example St",
    "address_line2": "Level 2",
    "city": "Adelaide",
    "state": "SA",
    "postcode": "5000",
    "country": "AU"
  },
  "use_company_billing_for_children": false,
  "auto_generate_invoices": { "enabled": false }
}
```

### Usability predicates (do not conflate)

| Predicate          | Rule                                                                                                           | Used by                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Email-usable**   | Non-empty valid `email`                                                                                        | `getInvoiceEmailRecipient`      |
| **Display-usable** | Any of: `name`, address lines (`address_line1` / legacy `address` / city…), `contact_person`, `email`, `phone` | Bill To block (after `enabled`) |

**Do not** require `name` for email-usable (would break email-only AP mailboxes).

**Legacy:** if `address` string present and `address_line1` empty → treat as `address_line1`.

---

## 4. Resolution algorithm (single Edge SoT)

Implement in **`shared/utils/hierarchy-billing.ts`** (canonical), re-export from `database/supabase/functions/_utils/hierarchy-billing.ts` (same pattern as `invoice-line-item-display.ts`). Dashboard imports `@clean-log/shared/...` for **formatters only**.

```
resolveHierarchyBilling(hierarchyParentId) → { node, billing } | null

  load N by id (select id, type, name, parent_id, metadata, active)
  if N missing or active === false → return null

  if N.type == region:
    load C by N.parent_id (may be null — orphan region; treat as no company)
    if C?.use_company_billing_for_children:
      if C is email/display-usable (caller picks predicate) → return C
      else → return null   // OVERRIDE ON: do NOT fall back to region
    if N usable → return N
    if C usable → return C
    return null

  if N.type == company:
    if N usable → return N
    return null

  return null
```

**Override semantics (adversarial lock):** `use_company_billing_for_children === true` means “bill company or nothing,” never silent Region substitution.

### API contract (D7)

`get-invoice-details` and `get-invoice-public` additionally return:

```ts
resolved_billing: {
  hierarchy_node_id: string;
  hierarchy_node_type: "company" | "region";
  hierarchy_node_name: string;
  billing_address: HierarchyBillingAddress; // normalized (legacy address folded in)
} | null
```

Resolved from **primary location** (same selection rules as `InvoiceDocument` today). Populate `hierarchy_metadata` with immediate parents **plus** company grandparents needed for debugging/UI; clients **must** prefer `resolved_billing` for Bill To lines.

Wire resolve into:

1. `getInvoiceEmailRecipient` (`hierarchy_billing_email`) — per job, email-usable predicate
2. `get-invoice-details` / `get-invoice-public` → `resolved_billing`
3. Invoice content builder for Path B + C (display-usable + respect `billing_address_config.enabled`)
4. `InvoiceDocument` — render from `resolved_billing` (remove `type === "company"` hard gate)

---

## 5. Workstreams

### W1 — Shared billing types + resolve helper

| Step | ID  | Action                                                                                                                                                          | File(s)                                   | Cx  | Pri | Depends | Verify                                        |
| ---- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --- | --- | ------- | --------------------------------------------- |
| 5.1  | H1  | Types + `isEmailUsableBilling` + `isDisplayUsableBilling` + `formatBillingAddressLines` + legacy `address` → `address_line1`; export from `shared/package.json` | `shared/utils/hierarchy-billing.ts` (new) | M   | P0  | —       | Shared unit test or edge-unit via re-export   |
| 5.2  | H1b | Thin Deno re-export                                                                                                                                             | `_utils/hierarchy-billing.ts`             | S   | P0  | H1      | Import from edge compiles                     |
| 5.3  | H2  | `resolveHierarchyBilling(supabase, hierarchyParentId, predicate)` with override / orphan / inactive rules                                                       | shared + edge                             | M   | P0  | H1      | Matrix tests (see T1)                         |
| 5.4  | H3  | Switch `invoice-email.ts` to H2 (email-usable); keep location fallback                                                                                          | `_utils/invoice-email.ts` + tests         | S   | P0  | H2      | Edge-unit green; feedback path still compiles |

### W2 — Hierarchy UI (capture fields)

| Step | ID  | Action                                                                                                                                                                                                                                 | File(s)                          | Cx  | Pri | Depends | Verify                                                   |
| ---- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --- | --- | ------- | -------------------------------------------------------- |
| 5.5  | U1  | Company + Region form: name, contact, email, phone, structured address (`address_line1`…); Company-only toggle “Use this company billing for all regions”                                                                              | `location-hierarchy-manager.tsx` | L   | P0  | —       | Save → reload shows metadata                             |
| 5.6  | U2  | Merge recipe on edit: `{ ...existingMetadata, auto_generate_invoices, billing_address?, use_company_billing_for_children? }` — never form-only replace. Clear billing = set `billing_address: null` or omit keys explicitly documented | same                             | S   | P0  | U1      | Edit billing keeps auto-gen; edit auto-gen keeps billing |
| 5.7  | U3  | Hierarchy help: pricing **and** billing / invoice recipients                                                                                                                                                                           | same                             | S   | P1  | —       | Copy review                                              |
| 5.8  | U4  | Invoice settings copy (billing **and** email recipient): “resolved region or company” + mention company override                                                                                                                       | `invoice-template-settings.tsx`  | S   | P1  | —       | Copy review                                              |
| 5.9  | U5  | Inputs use HTML `autoComplete` (`organization`, `address-line1`, `address-level2`, `address-level1`, `postal-code`, `country`) for future Places wiring                                                                                | same                             | S   | P1  | U1      | Attributes present                                       |

**Note:** `update-location-hierarchy` replaces JSONB wholesale — U2 is mandatory, not optional polish.

### W3 — API + InvoiceDocument

| Step | ID  | Action                                                                                                                                                                          | File(s)                                          | Cx  | Pri | Depends | Verify                                                         |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --- | --- | ------- | -------------------------------------------------------------- |
| 5.10 | D2  | Load parents with `parent_id`; fetch company nodes for region parents; fix `get-invoice-public` job-as-array when collecting hierarchy ids; compute + return `resolved_billing` | `get-invoice-details`, `get-invoice-public`      | M   | P0  | H2      | Response includes company when location→region; public matches |
| 5.11 | D1  | `InvoiceDocument` Bill To from `resolved_billing` when `billing_address_config.enabled`; structured lines via shared formatter; drop company-only gate                          | `invoice-document.tsx`, types, public page types | M   | P0  | D2      | Preview shows Region Bill To with toggle ON                    |
| 5.12 | D3  | Types/contracts: add `resolved_billing` to edge-contracts / dashboard types                                                                                                     | `edge-contracts.ts`, `types.ts`                  | S   | P0  | D2      | Typecheck                                                      |

### W4 — PDF content parity (narrowed)

| Step | ID  | Action                                                                                                                                                                                                                | File(s)                                                                 | Cx  | Pri | Depends | Verify                                                       |
| ---- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --- | --- | ------- | ------------------------------------------------------------ |
| 5.13 | P1  | Shared **invoice content** helper for: org name/ABN (existing), **service address lines**, **Bill To lines** (from resolve + `enabled`), dates, line items, subtotal/total/notes — **not** full GST/bank parity in v1 | `_utils/invoice-content.ts` (new) using H2 + existing line-item display | L   | P0  | H2, D2  | Unit: fixture → expected Bill To / service                   |
| 5.14 | P2  | `generateInvoiceHtml` consumes P1 for Bill To + service sections                                                                                                                                                      | `generate-invoice-pdf/index.ts`                                         | M   | P0  | P1      | Open PDF Bill To/service match React for fixture (toggle ON) |
| 5.15 | P3  | `invoice-pdf.ts` draws Bill To + service (used by auto-send **and** update-invoice-status)                                                                                                                            | `_utils/invoice-pdf.ts`                                                 | M   | P0  | P1      | Attachment contains Bill To when V1 data present             |
| 5.16 | P4  | Do **not** add a fourth path; keep detail Print / public print on Path A                                                                                                                                              | —                                                                       | —   | —   | N/A     |

> Follow-up (not blocking G4): GST breakdown, bank transfer block, Tax Invoice title rules on Path B/C.

### W5 — Tests + docs

| Step | ID  | Action                                                                                                                                | File(s)                                      | Cx  | Pri | Depends | Verify                |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --- | --- | ------- | --------------------- |
| 5.17 | T1  | Resolve matrix: region win; company override; override+empty company→null; company-only; orphan region; inactive node; legacy address | `_utils/__tests__/hierarchy-billing.test.ts` | M   | P0  | H2      | `pnpm test:edge-unit` |
| 5.18 | T2  | Update invoice-email + payment-flow hierarchy cases; touch feedback-email fixtures if resolve changes                                 | existing tests                               | S   | P0  | H3      | Green                 |
| 5.19 | T3  | Dashboard: hierarchy manager merge preserves billing + auto-gen                                                                       | component/service test                       | M   | P1  | U2      | Green                 |
| 5.20 | T4  | Suggest `PROJECT_LEARNINGS.md`: three render paths; `resolved_billing` SoT; metadata replace-on-update                                | after ship                                   | S   | P1  | —       | Suggestion posted     |

---

## 6. Verify matrix (acceptance)

| #   | Scenario                                        | Pass criteria                                                                |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| V0  | Precondition                                    | Org `billing_address_config.enabled === true` for display checks             |
| V1  | Location → Region with billing; override off    | Email = region email; Bill To = region; Open PDF Bill To/service match React |
| V2  | Same; company override on + company usable      | Email + Bill To = company                                                    |
| V2b | Override on + company **not** email-usable      | Email falls to **location** (not region); Bill To empty/missing company      |
| V3  | Region empty; company has billing; override off | Falls through to company                                                     |
| V4  | No hierarchy billing                            | Location email fallback; no Billing Address subsection                       |
| V5  | Edit billing then auto-gen (and reverse)        | Both metadata keys survive                                                   |
| V6  | Email attachment (auto-send **or** status→sent) | Bill To present when V1 data present                                         |
| V7  | Public `/invoice/[id]`                          | Bill To matches authenticated preview for same invoice                       |
| V8  | Orphan region (null company parent)             | No throw; resolve null or region-only                                        |

---

## 7. Rollback

- Clear `billing_address` / toggle from nodes; no migration to reverse.
- Revert P2/P3 if PDF regresses; Open PDF returns to thinner HTML (emergency only).
- `resolved_billing` additive — clients ignoring it keep old (broken) Bill To until D1 lands; deploy **D2 before or with D1**.

---

## 8. S5 slice order

1. **Slice A (P0):** H1–H3, U1–U2, D2–D3, D1, T1–T2 — hierarchy billing on screen + email
2. **Slice B (P0):** P1–P3 — Open PDF + attachment Bill To/service parity
3. **Slice C (P1):** U3–U5, T3–T4 — copy, autocomplete attrs, learnings

Deploy note: land shared helper + edge resolve **before** relying on UI-only metadata (settings already assume billing exists).

---

## 9. Open items (do not block Slice A)

| Item                              | Notes                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| Places / Geoapify                 | Wire into same `address_line1`… fields (`docs/research/address-autocomplete-research.md`) |
| Customer ABN                      | If AP requires it                                                                         |
| `billing_address_config.source`   | Still unused; leave unless product wants org/form_fields                                  |
| Full GST/bank on Path B/C         | Follow-up after Slice B                                                                   |
| Multi-job conflicting Bill Tos    | v1 = primary location only; email unique-set may still fan out                            |
| Enforce region.parent_id NOT NULL | API allows orphan regions today — resolve handles null; optional DB constraint later      |

---

## 10. Gate

**G4 request:** Approve this DAP (D1–D9 + Slice A/B) before S5.

Checklist:

- [x] Gold + adversarial amendments applied (§11–§12)
- [ ] PRESERVE-1…11 acknowledged
- [ ] `billing_address_config.enabled` behavior accepted (PRESERVE-7)
- [ ] PDF scope D8 accepted (Bill To/service only in v1)
- [ ] Stakeholder **G4** / proceed-to-S5

---

## 11. Gold review record (2026-07-25)

| #   | Assumption                                 | Challenge                                                                         | Resolution                        |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------- |
| G1  | “Optional shared/ if pattern exists”       | `@clean-log/shared` + edge re-export is established (`invoice-line-item-display`) | H1/H1b mandatory shared path      |
| G2  | Email + Bill To equally broken for regions | Email already works on region parent; Bill To is company-gated + `enabled`        | §1 corrected; separate predicates |
| G3  | `enabled` irrelevant                       | Default `billing_address_config.enabled === false` hides Bill To                  | PRESERVE-7; V0 precondition       |
| G4  | D2 “load company” vague                    | Select lacks `parent_id`; public job-array bug                                    | D2 expanded                       |
| G5  | Path C = auto-send only                    | `update-invoice-status` also attaches pdf-lib                                     | §1 + P3                           |
| G6  | “Usable = name AND …”                      | Email needs only email; display needs any line + enabled                          | §3 predicates                     |
| G7  | Open PDF gap ≈ Bill To                     | HTML also lacks GST/bank                                                          | D8 narrows v1 PDF scope           |
| G8  | U2 only mentions auto-gen                  | Edge replaces full metadata blob                                                  | PRESERVE-8 + U2 merge recipe      |
| G9  | Field names `line1`                        | Geoapify / `address-autocomplete` use `address_line1`                             | D4 aligned                        |
| G10 | Helper only in `_utils`                    | Dashboard cannot import Deno `_utils`                                             | shared + `@clean-log/shared`      |
| G11 | Public Download PDF = Path B               | Public uses `window.print` on React                                               | Documented                        |

---

## 12. Adversarial review record (2026-07-25)

| #   | Finding                                                          | Severity     | Amendment                                          |
| --- | ---------------------------------------------------------------- | ------------ | -------------------------------------------------- |
| A1  | Dual walk in React + Edge will drift                             | **Critical** | D7: server `resolved_billing`; clients format only |
| A2  | Override ON + empty company falling through to Region            | **Critical** | Algorithm returns null; V2b                        |
| A3  | Slice B “totals semantics / GST titles” over-scoped vs thin HTML | **High**     | D8: Bill To + service only                         |
| A4  | Multi-job invoices: which Bill To?                               | **High**     | D9: primary location v1; open item                 |
| A5  | Feedback shares invoice email helper — silent regression         | **High**     | PRESERVE-11; T2                                    |
| A6  | Orphan region (`parent_id` null) crashes walk                    | **Medium**   | Null-safe; V8                                      |
| A7  | Deploy D1 before D2 → still broken Bill To                       | **High**     | Rollback/deploy: D2 with/before D1                 |
| A8  | Clearing billing fields vs merge                                 | **Medium**   | U2 explicit clear semantics                        |
| A9  | Inactive hierarchy nodes still billable                          | **Medium**   | Resolve checks `active === false` → null           |
| A10 | “Open PDF matches screen” overclaim                              | **Medium**   | Verify = Bill To/service match, not full visual    |

### Hostile questions

- **“Will Region billing show if the settings toggle is off?”** → No — PRESERVE-7. Testers must enable Show Billing Address (V0).
- **“If company override is on but company has no email, do we use the region?”** → No — V2b; location email fallback only.
- **“Is Open PDF the same as the email PDF?”** → No — Path B HTML vs Path C pdf-lib; both must get Bill To/service from P1.
- **“Can the dashboard invent a different walk?”** → No — D7 forbids it.

---

## 13. Handoff

| Next           | Action                                         |
| -------------- | ---------------------------------------------- |
| **S5 Build**   | Execute Slice A → B → C; stop on failed Verify |
| **Acceptance** | §6 V0–V8                                       |
| **Learnings**  | T4 after ship                                  |

---

_End of S4 — gold + adversarial reviewed. Proceed to S5 only after G4 / explicit build go-ahead._
