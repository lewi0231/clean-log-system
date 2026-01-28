# Settings Page Reorganization Plan

## Summary

- **Relocate invoice settings** from the Invoicing page (`/dashboard/invoicing`) to the Settings page (`/dashboard/settings`).
- **Restructure the Settings page** so invoice-related settings live in one place, reduce redundancy, and follow research-backed patterns for grouping and clarity.

---

## 1. GitHub Issues Created (Optional / Later)

The following optional enhancements from the Australian Invoice Tax Legality work are tracked as GitHub issues:

| Issue | Title |
|-------|--------|
| [#37](https://github.com/lewi0231/clean-log-system/issues/37) | Enhancement: ABN validation in Settings |
| [#38](https://github.com/lewi0231/clean-log-system/issues/38) | Enhancement: Bill-to identity for tax invoices $1k+ (ATO) |
| [#39](https://github.com/lewi0231/clean-log-system/issues/39) | Enhancement: Line-item description guidance for invoicing |
| [#40](https://github.com/lewi0231/clean-log-system/issues/40) | Enhancement: Org-level default terms/notes for invoices |

---

## 2. Research Takeaways (Tavily)

- **Group by domain:** Group settings into logical categories; use tabs to split complex topics (e.g. Sales, Invoicing, Payments). Keep tab labels short and clear.
- **Reduce clutter:** “Clutter is the top issue in many dashboards” — layout and tabbing are primary tools. Remove or hide what’s not relevant.
- **Interface clarity:** One active control group per task; avoid overlapping panels and hidden state. Users should not be confused about which settings are active.
- **Single source of truth:** One place per setting. Avoid “redundant navigation options that exist just in case” and “maintaining slight variations” of the same control.
- **Consolidate:** Prefer consolidating similar functions over spreading them across multiple pages.

---

## 3. Current State

### 3.1 Settings Page (`/dashboard/settings`)

**Tabs:** Organization | Feature Specific | Payment Details

| Tab | Content | Data source |
|-----|---------|-------------|
| **Organization** | name, ABN, logo, primary_contact_email, primary_contact_phone, business_address, currency | `organization_settings` / org |
| **Feature Specific** | Customer Locations (use_predefined_locations + link to /locations), **Invoice Settings** (link to /dashboard/invoicing), **Default Invoice Due Days** | `organization_settings` |
| **Payment Details** | **Tax / GST** (gst_registered, gst_inclusive, gst_rate_percent), **Bank Transfer** (show_bank_transfer_on_invoices, BSB, account number, name), **Payment Providers** (Stripe) | `organization_settings` |

### 3.2 Invoicing Page (`/dashboard/invoicing`)

**Collapsible “Invoice Settings”** contains:

| Block | Fields | Data source |
|-------|--------|-------------|
| **Sending** | invoice_send_immediately | `organization_settings` |
| **InvoiceTemplateSettings** | invoice_title, show_logo, show_abn, service_address_config, billing_address_config, line_item_display, email_recipient_config, **auto_generate_invoices_immediately** | `invoice_template_config` + `organization_settings` |

### 3.3 Redundancy and Scatter

- **invoice_send_immediately:** Only on Invoicing page; in Settings `fetchSettings`/state but no UI.
- **auto_generate_invoices_immediately:** In Settings state; **UI only in InvoiceTemplateSettings** on Invoicing page.
- **default_invoice_due_days:** Only on Settings (Feature Specific).
- **GST, bank transfer, Stripe:** Only on Settings (Payment Details).
- **Invoice template** (title, show_logo, show_abn, bill-to, service/billing, line items, email recipient): Only on Invoicing page.

Invoice-related settings are split across: Settings (Feature Specific + Payment Details) and Invoicing (collapsible). That violates “single source of truth” and “consolidate by domain.”

---

## 4. Proposed Structure

### 4.1 Tabs (Final)

| Tab | Purpose | Contents |
|-----|---------|----------|
| **Organization** | Core org identity and contact | name, ABN, logo, primary_contact_email, primary_contact_phone, business_address, currency |
| **Invoicing** | All invoice-related: behavior, tax, template, what’s shown on invoices | Sending & behavior, Tax / GST, Template (InvoiceTemplateSettings), Bank transfer (on invoices), Default due days |
| **Payments** | How the org receives money (providers only) | Stripe, future payment providers |
| **Features** | Non-invoice feature toggles | Customer Locations (use_predefined_locations) |

### 4.2 Invoicing Tab (New) — Sections

1. **Sending & behavior**
   - `invoice_send_immediately` (Send Invoices Immediately) — moved from Invoicing page
   - `auto_generate_invoices_immediately` — moved out of InvoiceTemplateSettings into this section
   - `default_invoice_due_days` — moved from Feature Specific

2. **Tax / GST**
   - `gst_registered`, `gst_inclusive`, `gst_rate_percent` — moved from Payment Details (same card/copy)

3. **Invoice template** (InvoiceTemplateSettings)
   - `invoice_title`, `show_logo`, `show_abn`, `service_address_config`, `billing_address_config`, `line_item_display`, `email_recipient_config`
   - **Remove** `auto_generate_invoices_immediately` from InvoiceTemplateSettings; it lives in “Sending & behavior”.

4. **Bank transfer on invoices**
   - `show_bank_transfer_on_invoices`, `bank_transfer_bsb`, `bank_transfer_account_number`, `bank_transfer_account_name` — moved from Payment Details (same card/copy)

### 4.3 Payments Tab (Renamed from “Payment Details”)

- **Payment Providers:** Stripe (and future providers) only.
- All bank transfer fields move to Invoicing; no bank transfer block here.

### 4.4 Features Tab (Renamed from “Feature Specific”)

- **Customer Locations:** `use_predefined_locations` + link to /locations.
- **Remove:** “Invoice Settings” link to /dashboard/invoicing and “Default Invoice Due Days” (both moved to Invoicing tab).

### 4.5 Invoicing Page After Relocation

- **Remove** the entire collapsible “Invoice Settings” (sending + InvoiceTemplateSettings).
- Invoicing page = Create Invoice, Invoice List, Create/Preview dialogs only. Optional: short “Configure invoice settings in [Settings → Invoicing](link)” if we want a signpost.

---

## 5. Redundancy Resolution

| Setting | Before | After | Note |
|---------|--------|-------|------|
| invoice_send_immediately | Invoicing page only | Settings → Invoicing → Sending & behavior | Single place |
| auto_generate_invoices_immediately | InvoiceTemplateSettings on Invoicing | Settings → Invoicing → Sending & behavior | Extracted from InvoiceTemplateSettings; one place |
| default_invoice_due_days | Settings → Feature Specific | Settings → Invoicing → Sending & behavior | Grouped with other invoice behavior |
| gst_* | Settings → Payment Details | Settings → Invoicing → Tax / GST | Grouped with invoice output |
| show_bank_transfer_*, bank_transfer_* | Settings → Payment Details | Settings → Invoicing → Bank transfer on invoices | These control what appears on invoices; Payments tab = providers only |
| InvoiceTemplateSettings | Invoicing page | Settings → Invoicing → Invoice template | Single place |
| show_logo, show_abn | Invoice template (visibility) | Unchanged in template | Values (logo, ABN) in Organization; toggles in template — not redundant |

---

## 6. Data Sources (Unchanged)

- **organization_settings:** invoice_send_immediately, auto_generate_invoices_immediately, default_invoice_due_days, gst_*, show_bank_transfer_on_invoices, bank_transfer_*, stripe_account_id, payment_provider, etc.
- **invoice_template_config:** invoice_title, show_logo, show_abn, service_address_config, billing_address_config, line_item_display, email_recipient_config.
- **Organization:** name, ABN, logo, primary_contact_*, business_address, currency (already on Settings).

No new tables or API contracts; only UI relocation and tab/section reorganization.

---

## 7. Implementation Checklist

### 7.1 Settings page

- [ ] Add **Invoicing** tab; rename **Payment Details** → **Payments**; rename **Feature Specific** → **Features**.
- [ ] **Invoicing tab:**
  - [ ] **Sending & behavior** card: invoice_send_immediately, auto_generate_invoices_immediately, default_invoice_due_days. Reuse/adapt handlers from Settings (for due days) and from Invoicing page + InvoiceTemplateSettings (for send + auto-generate).
  - [ ] **Tax / GST** card: move existing card from Payment Details into Invoicing (no logic change).
  - [ ] **Invoice template** block: render `<InvoiceTemplateSettings organizationId={...} />` but **without** `auto_generate_invoices_immediately` (remove from InvoiceTemplateSettings component).
  - [ ] **Bank transfer on invoices** card: move existing card from Payment Details into Invoicing (no logic change).
- [ ] **Payments tab:** only Payment Providers (Stripe, etc.). Remove Tax/GST and Bank transfer cards.
- [ ] **Features tab:** remove “Invoice Settings” link and “Default Invoice Due Days”; keep Customer Locations.
- [ ] **Tab order:** Organization → Invoicing → Payments → Features (or Invoicing before Payments if preferred).
- [ ] **URL/searchParams:** Support `?tab=invoicing` (and `payment`, `features`) as needed.
- [ ] **State/handlers:** Ensure `invoice_send_immediately` and `auto_generate_invoices_immediately` are in Settings `fetchSettings`/state and have save handlers (invoice_send exists on Invoicing page; auto_generate is in InvoiceTemplateSettings — both move to Settings).

### 7.2 InvoiceTemplateSettings component

- [ ] **Remove** `auto_generate_invoices_immediately` state, `useEffect` from orgSettings, and `handleAutoGenerateInvoicesChange` and its UI. Parent (Settings) will own this in “Sending & behavior”.
- [ ] **Keep** all other fields and `invoice_template_config` logic. Component can still consume `useOrganizationSettings` if needed for other reads (e.g. logo URL for preview), but not for auto_generate.

### 7.3 Invoicing page

- [ ] **Remove** the collapsible “Invoice Settings” block (sending switch + InvoiceTemplateSettings).
- [ ] (Optional) Add a small link: “Configure invoice settings in Settings → Invoicing” if desired.

### 7.4 Tests and links

- [ ] Update any `href` to `/dashboard/invoicing` that assumed “Invoice Settings” lived there (e.g. from Feature Specific); remove or point to Settings with `?tab=invoicing`.
- [ ] Update `dashboard/components/settings/invoice-template-settings.test.tsx` for removal of auto_generate from InvoiceTemplateSettings.
- [ ] Update `dashboard/app/dashboard/invoicing/page.tsx` tests or E2E if they target the collapsible.

### 7.5 Docs and ADRs

- [ ] Short note in `docs/user_stories/invoices/007-invoice-template-customization.md` (or a README) that Invoice Template lives under Settings → Invoicing.
- [ ] If you use ADRs, add one for “Invoice settings consolidated under Settings → Invoicing”.

---

## 8. Files to Touch

| Area | File | Changes |
|------|------|---------|
| Settings | `dashboard/app/dashboard/settings/page.tsx` | New Invoicing tab; Sending & behavior card; move GST and Bank transfer from Payment Details; rename tabs; add handlers for invoice_send + auto_generate; render InvoiceTemplateSettings; remove Invoice Settings link and Default Due Days from Features |
| InvoiceTemplateSettings | `dashboard/components/settings/invoice-template-settings.tsx` | Remove auto_generate_invoices_immediately state, effect, handler, and UI |
| Invoicing | `dashboard/app/dashboard/invoicing/page.tsx` | Remove collapsible Invoice Settings block; optional signpost to Settings |
| Tests | `dashboard/__tests__/components/settings/invoice-template-settings.test.tsx` | Drop/modify tests for auto_generate in InvoiceTemplateSettings |
| Tests | `dashboard/__tests__/integration/*` or E2E | Adjust if they depend on Invoice Settings on Invoicing page |
| Docs | `docs/user_stories/invoices/007-invoice-template-customization.md` or `docs/` | Note that template is under Settings → Invoicing |

---

## 9. Tab Order Recommendation

1. **Organization** — most common, identity/contact.
2. **Invoicing** — high usage for invoice-driven workflows; groups all invoice config.
3. **Payments** — provider connection; smaller, less frequent.
4. **Features** — toggles for locations etc.

Alternative: **Organization → Features → Invoicing → Payments** if “Features” is considered more central. The plan above uses **Organization → Invoicing → Payments → Features**.

---

## 10. Open Questions

- **Tab order:** Confirm Organization → Invoicing → Payments → Features (or swap Features/Invoicing).
- **Invoicing page signpost:** Do we add “Configure invoice settings in Settings → Invoicing” on the Invoicing page, or leave it to navigation only?
- **InvoiceTemplateSettings deps:** It uses `useFieldConfigs`, `useLocations`, `useOrganizationSettings`. `useOrganizationSettings` is used for `auto_generate` and possibly logo in preview. After removing `auto_generate`, we can drop `useOrganizationSettings` from InvoiceTemplateSettings if it’s only used for that; if logo/other, keep it.

---

## 11. References

- GitHub: [lewi0231/clean-log-system](https://github.com/lewi0231/clean-log-system)
- Optional issues: [#37](https://github.com/lewi0231/clean-log-system/issues/37), [#38](https://github.com/lewi0231/clean-log-system/issues/38), [#39](https://github.com/lewi0231/clean-log-system/issues/39), [#40](https://github.com/lewi0231/clean-log-system/issues/40)
- Australian Invoice Tax Legality plan (`.cursor/plans/`)
