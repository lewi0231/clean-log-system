# Multi–Line of Business (Multi-Arm) Model — Working Document

**Status:** Working / research  
**Last updated:** 2026-05-03  
**Audience:** Product, engineering  
**Related:**

- Mutual exclusion (form branching) — `docs/user_stories/mobile-config/003-mutually-exclusive-groups-and-clusters.md`
- Location-scoped fields — `location_field_config` table (existing precedent for per-location field restrictions)

---

## 1. Executive summary

**Problem:** A single admin/company on one **organization** may run multiple distinct service lines (e.g. residential cleaning vs. car detailing). Those lines may need **separate field definitions, pricing, reporting, and eventually branding**—not only a "pick one cluster" branch inside one shared job form.

**Recommendation (primary):** Introduce a first-class **line of business (LOB)** (or **service line**) entity **under** `organization`, and scope **configuration and operational facts** to `(organization_id, line_of_business_id)` where it matters—starting with **jobs** and **field configs**, then **pricing** and **invoices** for reporting and correctness.

**Relationship to mutual exclusion:** Mutual exclusion stays the right tool for **within-LOB** branching on a single job (e.g. "simple vs detailed checklist" for _that_ detailing job). It does **not** replace an LOB dimension; the two are **complementary**.

**Effort estimate:** ~3–5 story points for P0–P1 (core table + job scoping); full rollout through P4 is larger but can ship incrementally behind a feature flag (`organization_settings.multi_lob_enabled`).

---

## 2. Problem statement

### 2.1 User scenario

- One legal or operational owner manages **multiple arms**: different services, different customer expectations, possibly different worker pools or vans.
- They want **separate configs** per arm without maintaining entirely separate SaaS accounts—**or** they may later want separate orgs; the model should not foreclose that.

### 2.2 What "separate configs" usually means

| Area              | "Same org, branch with mutual exclusion"  | "Separate arms" often implies                                  |
| ----------------- | ----------------------------------------- | -------------------------------------------------------------- |
| Job form fields   | One catalog; clusters hide/show subsets   | Different catalogs or different sections/pricing hooks per arm |
| Pricing           | Same `pricing_rule` / `field_pricing` set | Different rules, currencies, or bases per arm                  |
| Reporting         | Group by cluster names (fragile)          | Filter/group by explicit **arm** or **LOB**                    |
| Workers           | One pool                                  | Optional: workers tagged to arms                               |
| Invoicing / brand | One `invoice_template_config` per org     | Optional: per-arm templates or invoice identity                |
| Access control    | Org-level roles                           | Future: restrict admins to an arm                              |

### 2.3 Risk of overloading mutual exclusion

Using one giant mutually exclusive group where each "cluster" equals a **business arm** (cleaning vs detailing) tends to:

- **Conflate** "which arm is this job?" with "which variant of the form within an arm?"
- Force **all** fields into one branching structure; arms that share nothing still share one flat `organization_field_configs` namespace.
- Make **pricing** error-prone: rules keyed only by `organization_id` + field ids may apply the wrong arm's logic if field names or structures overlap.
- Make **reporting** depend on naming conventions ("cluster = business name") instead of a stable identifier.

---

## 3. Current system (Clean Log) — relevant facts

This section grounds options in the **actual** data model and code paths.

### 3.1 Tenant boundary

- Primary tenant key is **`organization_id`** on core tables (`job`, `invoice`, `location`, pricing tables, `organization_field_configs`, `form_section`, etc.).

### 3.2 Job shape

- `job` has `organization_id`, `location_id`, `submission_data` (JSONB), timestamps, flags — **no** LOB or brand dimension today.
- `job_worker` links jobs to workers (many-to-many).

### 3.3 Configuration and pricing

- **Field configs:** `organization_field_configs` — scoped by organization; mutual exclusion via `mutually_exclusive_group` + `group_cluster`.
- **Location-scoped fields (precedent):** `location_field_config` — existing join table that optionally restricts which fields appear at specific locations. This pattern is a useful template for LOB scoping.
- **Sections:** `form_section` — organization-scoped.
- **Pricing:** `pricing_rule`, `field_pricing`, `base_pricing`, `option_pricing`, `service_pricing_mode` — organization-scoped; resolution uses `organization_id`, locations, hierarchy, and field config references (see `calculate-invoice` loading configs by `organization_id` only).

### 3.3.1 Existing hints toward business differentiation

- **`organization.business_mode`** — already distinguishes `'service_based'` vs `'resource_tracking'`; this is conceptually similar to LOB but is an org-level enum, not a multi-valued dimension.
- **`location.pricing_mode`** — `'field_based'` vs `'fixed_price'` per location; shows that pricing can vary by location context, which is helpful precedent for LOB pricing scoping.
- **`location.hierarchy_parent_id`** — links a location to `location_hierarchy`; some customers could map arms to top-level hierarchy nodes, though this conflates geography with service line.

### 3.4 Location hierarchy

- `location_hierarchy` supports company/region-style trees (`type IN ('company', 'region')`).
- **Some** customers might map "arms" to **top-level hierarchy nodes**, but:
  - Not every business maps arms to geography.
  - Today, **field configs and pricing are not inherently scoped to a hierarchy node**; location is used for overrides and context, not as a universal "arm" key.

### 3.5 Workers

- `worker` is scoped by `organization_id`; there is **no** LOB restriction today.
- If LOB-based worker restrictions are needed, a join table (`worker_line_of_business`) would be required (Phase 3+).

### 3.6 Mutual exclusion (product behavior)

- Documented in Dashboard help and `003-mutually-exclusive-groups-and-clusters.md`: **one** exclusive group per org, **clusters** as the worker's single choice, fields collected for the chosen cluster.
- Implemented in `dashboard/hooks/use-mutually-exclusive-fields.ts` — **per job session**, not a persistent "arm" on the row.
- Mobile app: `mobile-app/hooks/use-field-configs.ts` loads field configs by `organization_id` and applies mutual exclusion client-side.

---

## 4. External patterns (research)

Multi-tenant products usually separate:

1. **Legal / billing tenant** (who pays; data isolation boundary).
2. **Operating structure inside the tenant** (divisions, brands, regions, "business units").

Common patterns:

- **Hierarchical org chart:** Tenant → Account/Business unit → Locations → Resources (see e.g. discussion of hierarchical SaaS org models in industry write-ups on multi-tenant data modeling and account hierarchies).
- **Logical isolation:** Shared database, row-level **`tenant_id` / `organization_id`** on all rows; additional **scope keys** (OU, LOB) for sub-partitions.
- **Entitlements:** Feature flags and limits sometimes attach at **account** vs **sub-account** level.

**Takeaway:** Adding an **explicit sub-scope under `organization_id`** is a standard, low-surprise way to model "arms" without splitting legal tenants.

_References (general industry background):_ Flightcontrol — [Ultimate guide to multi-tenant SaaS data modeling](https://www.flightcontrol.dev/blog/ultimate-guide-to-multi-tenant-saas-data-modeling); various "account hierarchy" / OU articles (e.g. enterprise entitlement modeling). No third-party product should be copied verbatim—use these as pattern validation only.

---

## 5. Options compared

| Option                                         | Description                                                                                 | Pros                                                            | Cons                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **A. Mutual exclusion only**                   | Treat each arm as a cluster in the default exclusive group                                  | No migration; familiar UX                                       | Wrong abstraction; pricing/reporting/config scale poorly; easy misconfiguration   |
| **B. Location hierarchy as "arm"**             | Force arms to be top-level hierarchy nodes; encode rules by location                        | Uses existing structure                                         | Poor fit when arms aren't geographic; doesn't scope global field catalogs cleanly |
| **C. Tag / metadata convention**               | e.g. `metadata.lob` on field_config rows                                                    | Light schema change                                             | No FK integrity; query complexity; easy drift between tags and pricing            |
| **D. Multiple organizations + linking**        | Separate `organization` per arm; optional "holding group" product concept later             | Strong isolation                                                | Duplicate users/settings; higher support burden; heavier UX                       |
| **E. LOB / service line entity (recommended)** | New table keyed by `organization_id`; nullable `line_of_business_id` on job + scoped config | Clear model; incremental rollout; aligns with industry patterns | Requires migrations and phased UI/edge-function updates                           |

---

## 6. Recommended approach (Option E) — detailed design

### 6.1 Conceptual model

```sql
CREATE TABLE line_of_business (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,                -- e.g. "Residential cleaning", "Car detailing"
  slug TEXT,                          -- stable for imports/APIs (optional)
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX idx_line_of_business_org ON line_of_business(organization_id);
ALTER TABLE line_of_business ENABLE ROW LEVEL SECURITY;
```

- **Cardinality:** Many LOBs per organization; each LOB belongs to exactly one organization.

### 6.2 Where to attach `line_of_business_id`

**Phase 1 — correctness path (minimum viable):**

1. **`job.line_of_business_id`** (nullable at first)
   - **Resolution order** when creating a job (in `create-job` edge function):
     1. Explicit admin selection (preferred).
     2. Else inherit from **`location.default_line_of_business_id`** if set.
     3. Else **organization default LOB** if exactly one active LOB exists.
     4. Else require explicit selection (no silent wrong arm).

2. **`organization_field_configs.line_of_business_id`** (nullable)
   - `NULL` = **org-wide** field (available in all LOBs).
   - Non-null = field belongs to that LOB's "catalog".
   - **Mobile app** (`use-field-configs.ts`): filter visible fields by job's LOB.
   - **Dashboard** (Mobile Config): add LOB filter dropdown.

3. **`form_section.line_of_business_id`** (nullable) — same semantics as field configs.

**Phase 2 — pricing and money:**

4. **`pricing_rule`, `field_pricing`, `base_pricing`, …**
   - Add nullable `line_of_business_id`.
   - Resolver in `calculate-invoice` / `calculate-worker-payment`:
     ```sql
     WHERE (line_of_business_id IS NULL OR line_of_business_id = :job_lob)
     ```
   - Precedence: LOB-specific rule wins over NULL LOB rule (most specific wins).

5. **`invoice.line_of_business_id`** (nullable, denormalized)
   - Set from jobs when invoicing; enables reporting and future per-LOB numbering or branding.

6. **`worker_payment.line_of_business_id`** (nullable, denormalized)
   - Optionally denormalize for reporting; alternatively join through `job`.

**Phase 3 — optional advanced:**

- Per-LOB **invoice template** (`invoice_template_config.line_of_business_id`).
- Worker ↔ LOB allowlists (`worker_line_of_business` join table).
- RLS or dashboard permission "can only manage LOB X".

### 6.3 Migration and defaults

- **Existing customers with one implicit business:**
  - Insert one LOB per org (e.g. name = "General", slug = "general").
  - **Option A:** Backfill all `job.line_of_business_id` to that LOB.
  - **Option B:** Leave `job.line_of_business_id` NULL; interpret NULL as "default LOB" until you tighten policy.
  - Field configs: leave as NULL (= available to all LOBs) unless you want stricter scoping.

- **Feature flag:** `organization_settings.multi_lob_enabled` (boolean, default false).
  - When false: hide LOB UI; use single implicit LOB.
  - When true: show LOB management and LOB filters.

### 6.4 Mutual exclusion after LOB exists

- Keep **mutually exclusive groups inside a LOB's field set**.
- Avoid using the **same** exclusive group to mean both "pick arm" and "pick package"; LOB should be selected **before** or **alongside** location so the worker app loads the correct catalog.
- Worker picks location → location's `default_line_of_business_id` applies → form shows only that LOB's fields (with mutual exclusion within).

### 6.5 Alternative you might still combine: "default LOB per location"

Many field-service SMBs associate a **yard** or **depot** with one primary service line. Optional `location.default_line_of_business_id` reduces friction: worker picks location → job inherits LOB → form + pricing stay consistent.

For multi-LOB locations (e.g. a site that receives both cleaning and detailing), require explicit LOB selection or allow multiple `location` rows per physical site.

---

## 7. Why this recommendation ranks above the others

1. **Matches the mental model** — Customers say "we have two businesses," not "we have two clusters in one exclusive group."
2. **Stable reporting & accounting** — LOB is a column on `job` and `invoice`, not an inference from form answers.
3. **Pricing safety** — Scoping rules by LOB prevents cross-arm rule application when field names collide.
4. **Incremental** — You can ship LOB on jobs + field configs before touching every pricing table; nullable FKs preserve backward compatibility.
5. **Avoids unnecessary tenant splits** — Option D is valid for **legal** separation or **billing** separation, but it's heavy for a shared owner who wants one login and one consolidated view.

**When Option D (separate organizations) is still right:** Different tax entities, different Stripe accounts with no sharing, or regulatory isolation. The LOB model does not block you from later **splitting** an org: export/migrate rows by `line_of_business_id` into a new `organization_id`.

---

## 8. Phased delivery outline (engineering)

> Order is indicative; adjust to roadmap pressure.

| Phase  | Scope                                                                                                                                                       | Outcome                      | Estimated effort |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------- |
| **P0** | DB: `line_of_business` table; org admin CRUD; `organization_settings.multi_lob_enabled`                                                                     | Data model exists            | 1–2 SP           |
| **P1** | `job.line_of_business_id`; `location.default_line_of_business_id`; filter field configs & sections in mobile + admin by LOB; update `create-job` resolution | Jobs and forms are LOB-aware | 2–3 SP           |
| **P2** | Pricing tables + `calculate-invoice` / `calculate-worker-payment` filter by LOB; integration tests for "no cross-LOB bleed"                                 | Money path is safe           | 2–3 SP           |
| **P3** | `invoice.line_of_business_id`; reporting filters (Completed Jobs, Worker Payments, Invoicing pages); CSV exports                                            | Ops/analytics                | 1–2 SP           |
| **P4** | Per-LOB templates; worker allowlists; RLS / per-LOB admin roles                                                                                             | Enterprise                   | 3+ SP            |

Each phase should include:

- **Migration scripts** (seed default LOB for existing orgs).
- **RLS/service-role policies** if applicable.
- **Vitest/integration coverage** for pricing and job creation paths.

---

## 9. Risks and mitigations

| Risk                            | Impact                                                                                             | Mitigation                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Mobile app changes required** | Workers see LOB-filtered fields; may need LOB picker if location doesn't imply LOB                 | Start with `location.default_line_of_business_id` inheritance so workers don't need new UI in P1           |
| **Pricing bleed between LOBs**  | If a rule is created for one LOB but mis-scoped, wrong prices appear                               | Enforce `line_of_business_id` on pricing rule creation UI; integration tests for "no cross-LOB bleed" (P2) |
| **Worker payment consistency**  | `worker_payment` is keyed by job; if jobs gain LOB, worker payment history/reports need LOB filter | Denormalize LOB onto `worker_payment` or join through `job`; add LOB filter to worker payment dashboard    |
| **GST / tax complexity**        | Different LOBs might have different tax treatments (e.g. one is GST-registered, another exempt)    | Future: per-LOB tax settings; for now, inheriting org-level GST is acceptable                              |
| **Migration ambiguity**         | Existing jobs/configs don't have LOB; backfill strategy unclear                                    | Default: insert one "General" LOB per org; existing rows get that LOB _or_ remain `NULL` (= "all LOBs")    |
| **Feature creep**               | LOB could expand to full "multi-tenant within tenant" with complex permissions                     | Keep P0–P2 focused on data scoping; defer RLS / per-LOB admin roles to P4                                  |
| **Invoices spanning LOBs**      | Mixed-LOB invoices complicate line-item grouping and branding                                      | Default to **split invoices** (one per LOB); reconsider if customers complain                              |

---

## 10. Open questions

1. **Selection UX:** Is LOB chosen per job by admin only, or also by worker at job start? If worker chooses, the mobile app needs a picker.
2. **Cross-LOB locations:** One customer site served by two arms — one `location` row or two? Example: a car yard that does both detailing and mechanical work.
3. **Invoices spanning LOBs:** If an invoice aggregates jobs from multiple LOBs, require **split invoices** or allow mixed with clear line-level tagging? Affects `calculate-invoice` grouping logic.
4. **Naming:** "Line of business" vs "Brand" vs "Service line" — pick user-facing language early. Suggestion: **"Service line"** is simple for field-service SMBs.
5. **Worker ↔ LOB mapping:** Some businesses restrict workers to specific LOBs; others share freely. Hard restriction (P4 allowlist) or soft guidance?
6. **Mobile config admin UX:** How does an admin filter the field list by LOB in the dashboard? Dropdown filter? Tabs?

---

## 11. Decision log

| Date       | Decision                                                                      | Rationale                                                                                            |
| ---------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 2026-05-03 | Prefer **LOB entity (Option E)** over mutual-exclusion-only or hierarchy-only | Aligns with customer language, reporting, and pricing boundaries; mutual exclusion remains intra-LOB |

---

## 12. Next steps (non-binding)

1. Review with stakeholders: Is geographic "arm" mapping enough for the first 3 customers, or is explicit LOB needed immediately?
2. If approved for build: add **S0 user story** and a **DAP** with explicit migration + `calculate-invoice` test matrix.
3. Keep this document updated when the first production org enables multi-LOB.

---

## Appendix A: Concrete example scenarios

### A.1 Car yard with detailing + mechanical

**Setup:**

- Organization: "Smith's Auto Services"
- LOB 1: "Detailing" — fields: vehicle type, interior clean, exterior polish, wax type
- LOB 2: "Mechanical" — fields: service type (oil change, brakes, tyres), parts used, labour hours

**Flow:**

1. Worker arrives at customer's home (Location: "123 Main St — Sarah Jones").
2. Location has `default_line_of_business_id = Detailing` (most common).
3. Worker opens app → sees only Detailing fields.
4. If Sarah also needs mechanical work: admin creates a **second job** for LOB Mechanical, or worker overrides LOB (requires UX decision).

### A.2 Cleaning company: residential + commercial

**Setup:**

- Organization: "Clean Team Co"
- LOB 1: "Residential" — fields: rooms cleaned, extras (oven, fridge), hours
- LOB 2: "Commercial" — fields: square metres, floors, after-hours flag

**Pricing difference:**

- Residential: per-room pricing via `pricing_rule` scoped to LOB 1.
- Commercial: base price per sqm via `pricing_rule` scoped to LOB 2.

**Reporting:**

- Dashboard filter: "Show jobs for: [All] [Residential] [Commercial]"
- P&L: revenue and worker costs split by LOB.

### A.3 Mixed-arm invoice (edge case)

One customer (a property manager) uses both Residential and Commercial services in the same billing period. Options:

| Approach                                                 | Pros                                                | Cons                                      |
| -------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| **Split invoices** — one per LOB                         | Clean line-item grouping; per-LOB branding possible | Customer receives two invoices            |
| **Mixed invoice** — jobs tagged with LOB inline          | Single invoice for customer convenience             | Line items need LOB label; harder to read |
| **Customer decision** — setting per location or customer | Flexibility                                         | More config surface                       |

**Recommendation:** Start with split invoices (simplest); revisit if customers complain.

---

## 13. Interim hygiene (before LOB ships)

Do these **now** so a future LOB rollout is cheaper and less error-prone. None of this requires creating the `line_of_business` table.

### 13.1 Product and data conventions

| Do                                                                                                                                                                          | Why                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Do not** use mutual-exclusion **cluster names** as the only encoding of “which business arm” (e.g. clusters literally named `cleaning` vs `detailing` with no other plan) | You lose a stable key and confuse “arm” with “package variant”; migration becomes guesswork |
| Prefer **separate fields** or clear admin labels when arms need different capture—not one mega-branch unless they truly share one invoice story                             | Keeps pricing and reporting semantics clear                                                 |
| Use **`location_field_config`** when the real axis is “this site only gets these fields”                                                                                    | Matches future LOB + location composition without inventing parallel rules                  |

### 13.2 API and code shape

| Do                                                                                                                                              | Why                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Thread **job context** through create/update paths as a small object (`organization_id`, `location_id`, …) instead of dozens of positional args | Adding `line_of_business_id` later is one field                                     |
| Keep **`list-field-configs`** and **`list-form-sections`** the two canonical reads for mobile + dashboard config                                | LOB filtering lands in one place per resource (documented in edge function headers) |
| Treat **extra JSON keys** on edge bodies as tolerated where validation is minimal today                                                         | Forward-compatible clients won’t break older servers                                |

**Repo note:** `ListFieldConfigsRequest` in `dashboard/lib/types/api.ts` includes an optional reserved `line_of_business_id` (ignored until implementation) so TypeScript call sites document the future contract.

### 13.3 Pricing and calculation

| Do                                                                                                                         | Why                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| When adding rules, **name or document** which service line they mentally belong to (internal comment or admin description) | Easier to partition rules when `pricing_rule.line_of_business_id` exists                                                            |
| Avoid **duplicate field `name`** values across unrelated “arms” if arms are already implicit                               | `organization_field_configs` is unique on `(organization_id, name)`—but overlapping _meanings_ across branches still confuse admins |

### 13.4 Testing and QA

| Do                                                                                                                               | Why                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Add or keep integration tests that assert **org + location** filtering for field lists (`list-field-configs` with `location_id`) | Same tests gain a `line_of_business_id` parameter later |
| When reproducing invoice bugs, note **which location / hierarchy** was used                                                      | Speeds root cause when LOB joins that story             |

### 13.5 What not to do early

- **No** obligatory `metadata.lob` on every row unless you are willing to **enforce** it in CI/reviews; loose tags drift.
- **No** second `organization` per “arm” as a shortcut unless legal/billing truly requires it (high exit cost).
- **No** large refactors “for LOB” before the first customer—**documentation + conventions + thin API hooks** are enough.

### 13.6 Trigger to schedule real LOB work

Revisit the phased plan when **any** of these appear: overlapping pricing intents and field names across arms, reports that must split revenue by arm, or one login that must show **separate** invoice identities. Until then, this section is the guardrail.
