# REGISTRY.md (v1.0) — Elite Lock (SSOT)

## Role
This file is the **source of truth** for:
- The **taxonomy** (`subject_key`, `root_cause_key`)
- The **scoring criteria** (`criteria_id`, `weight`)
- The **rules/detectors** (`rule_id`)
- The authorized **templates** (referenced by `template_id`)
- The **anti-drift constraints** (rejecting unknowns)

Any output (tickets, score, explanations, plans) MUST be traceable to this registry.

---

## Versions (MUST)
- `registry_version`: `1.0.0`
- Any non-backward-compatible change ⇒ major bump.
- Any backward-compatible change ⇒ minor bump.

---

## Enums (MUST)

### Languages
- `report_language`: `fr|en`

### Sides
- `source_side`: `solo|a|b|before|after`

### Severities
- `severity`: `P0|P1|P2|P3`

### Impact
- `impact`: `low|medium|high`

### Confidence
- `confidence`: `low|medium|high`

### Owners
- `owner`: `cro|copy|design|dev|merch|data`

### Effort
- `effort`: `s|m|l`

### Evidence
- `evidence_type`: `dom_fact|selector_fact|screenshot|screenshot_crop|html_fragment|network_fact|config_fact|lab_metric|console_fact`

Notes:
- `evidence_type` is a closed list used by `evidence_refs[].type` (or equivalent) across all outputs.
- Any evidence type not in this list MUST be rejected by Registry gating (anti-drift).

---

## 1) Taxonomy (MUST)

### 1.1 subject_key (closed list)
> A ticket MUST belong to exactly 1 `subject_key`.

**PDP / Conversion**
- `pdp:cta`
- `pdp:price`
- `pdp:variant_picker`
- `pdp:availability_stock`
- `pdp:payment_options`
- `pdp:shipping_returns`
- `pdp:trust_security`
- `pdp:urgency_promo`
- `pdp:bundles_upsell`
- `pdp:sticky_atc`

**PDP / Persuasion**
- `pdp:value_prop`
- `pdp:benefits_features`
- `pdp:social_proof_reviews`
- `pdp:ugc_media`
- `pdp:faq_objections`
- `pdp:sizing_fit`
- `pdp:ingredients_materials`
- `pdp:how_to_use_care`
- `pdp:guarantee_warranty`

**PDP / Content & UX**
- `pdp:gallery_media`
- `pdp:content_structure`
- `pdp:readability`
- `pdp:above_the_fold`
- `pdp:mobile_ux`
- `pdp:accessibility`

**Tech / Perf / SEO**
- `tech:performance_lab`
- `tech:stability_ready_state`
- `seo:metadata`
- `seo:structured_data`
- `seo:indexability`
- `tech:errors_broken_assets`

**Validity / Targeting**
- `target:non_product`
- `target:blocked_by_consent`
- `target:blocked_by_policy`

---

### 1.2 root_cause_key (closed list)
> Used for deterministic consolidation (`group_key = subject_key.root_cause_key.source_side`) [CHECK]

**Content**
- `rc:missing`
- `rc:unclear`
- `rc:contradictory`
- `rc:too_long`
- `rc:too_short`
- `rc:poor_structure`

**UX**
- `rc:hard_to_find`
- `rc:friction_clicks`
- `rc:mobile_issue`
- `rc:visual_hierarchy`
- `rc:interaction_bug`

**Trust**
- `rc:missing_trust_signal`
- `rc:weak_social_proof`
- `rc:policy_unclear`

**Merch**
- `rc:pricing_confusion`
- `rc:variant_confusion`
- `rc:stock_confusion`
- `rc:promo_confusion`

**Tech**
- `rc:slow_lab`
- `rc:layout_unstable`
- `rc:broken_asset`
- `rc:seo_gap`
- `rc:structured_data_gap`

**Targeting**
- `rc:not_a_pdp`
- `rc:blocked_consent`
- `rc:blocked_policy`

---

## 2) Criteria Registry (MUST)

### 2.1 criteria_id (closed list)
> Weights are **relative weights**; the sum is normalized to 100 in the engine.
> A ticket MUST populate `affected_criteria_ids[]` with ≥ 1 id among these.

**Conversion Core (55)**
- `C.CORE.CTA` — weight 18 — subject family: `pdp:cta`, `pdp:sticky_atc`
- `C.CORE.PRICE_CLARITY` — weight 10 — `pdp:price`
- `C.CORE.VARIANTS` — weight 10 — `pdp:variant_picker`
- `C.CORE.SHIPPING_RETURNS` — weight 9 — `pdp:shipping_returns`
- `C.CORE.TRUST` — weight 8 — `pdp:trust_security`

**Persuasion (30)**
- `C.PERS.VALUE_PROP` — weight 8 — `pdp:value_prop`
- `C.PERS.BENEFITS` — weight 6 — `pdp:benefits_features`
- `C.PERS.SOCIAL_PROOF` — weight 6 — `pdp:social_proof_reviews`, `pdp:ugc_media`
- `C.PERS.FAQ_OBJECTIONS` — weight 5 — `pdp:faq_objections`
- `C.PERS.SIZING_FIT` — weight 5 — `pdp:sizing_fit`

**Tech & SEO (15)**
- `C.TECH.PERF_LAB` — weight 6 — `tech:performance_lab`
- `C.TECH.MOBILE_UX` — weight 4 — `pdp:mobile_ux`
- `C.SEO.METADATA` — weight 2 — `seo:metadata`
- `C.SEO.STRUCTURED_DATA` — weight 2 — `seo:structured_data`
- `C.SEO.INDEXABILITY` — weight 1 — `seo:indexability`

### 2.2 Explanation templates (MUST)
Each criterion MUST reference a template:
- `criteria_explanation_template_id` :
  - `TPL.CRIT.CORE.CTA`
  - `TPL.CRIT.CORE.PRICE_CLARITY`
  - `TPL.CRIT.CORE.VARIANTS`
  - `TPL.CRIT.CORE.SHIPPING_RETURNS`
  - `TPL.CRIT.CORE.TRUST`
  - `TPL.CRIT.PERS.VALUE_PROP`
  - `TPL.CRIT.PERS.BENEFITS`
  - `TPL.CRIT.PERS.SOCIAL_PROOF`
  - `TPL.CRIT.PERS.FAQ_OBJECTIONS`
  - `TPL.CRIT.PERS.SIZING_FIT`
  - `TPL.CRIT.TECH.PERF_LAB`
  - `TPL.CRIT.TECH.MOBILE_UX`
  - `TPL.CRIT.SEO.METADATA`
  - `TPL.CRIT.SEO.STRUCTURED_DATA`
  - `TPL.CRIT.SEO.INDEXABILITY`

---

## 3) Rule Registry (MUST)

### 3.1 rule_id format
- `R.<DOMAIN>.<TOPIC>.<CHECK>`
- Example: `R.PDP.CTA.MISSING_ATF`

### 3.2 Rule map (closed list, extensible via registry bump)
> Each rule is associated with:
> - `subject_key`
> - `default_owner`
> - `default_effort`
> - `default_root_cause_key`
> - `affected_criteria_ids[]`

**CTA**
- `R.PDP.CTA.MISSING_ATF`
  - subject_key: `pdp:cta`
  - root_cause_key: `rc:hard_to_find`
  - owner: `cro`
  - effort: `m`
  - affected_criteria_ids: [`C.CORE.CTA`]

- `R.PDP.CTA.WEAK_LABEL`
  - subject_key: `pdp:cta`
  - root_cause_key: `rc:unclear`
  - owner: `copy`
  - effort: `s`
  - affected_criteria_ids: [`C.CORE.CTA`]

- `R.PDP.STICKY_ATC.MISSING_MOBILE`
  - subject_key: `pdp:sticky_atc`
  - root_cause_key: `rc:mobile_issue`
  - owner: `cro`
  - effort: `m`
  - affected_criteria_ids: [`C.CORE.CTA`, `C.TECH.MOBILE_UX`]

**PRICE / STOCK / VARIANTS**
- `R.PDP.PRICE.MISSING_OR_AMBIGUOUS`
  - subject_key: `pdp:price`
  - root_cause_key: `rc:pricing_confusion`
  - owner: `merch`
  - effort: `s`
  - affected_criteria_ids: [`C.CORE.PRICE_CLARITY`]

- `R.PDP.VARIANTS.CONFUSING_PICKER`
  - subject_key: `pdp:variant_picker`
  - root_cause_key: `rc:variant_confusion`
  - owner: `cro`
  - effort: `m`
  - affected_criteria_ids: [`C.CORE.VARIANTS`]

- `R.PDP.STOCK.CONTRADICTORY_SIGNALS`
  - subject_key: `pdp:availability_stock`
  - root_cause_key: `rc:stock_confusion`
  - owner: `merch`
  - effort: `s`
  - affected_criteria_ids: [`C.CORE.VARIANTS`, `C.CORE.CTA`]

**SHIPPING / RETURNS / TRUST**
- `R.PDP.SHIPPING.MISSING_POLICY_AT_PDP`
  - subject_key: `pdp:shipping_returns`
  - root_cause_key: `rc:policy_unclear`
  - owner: `cro`
  - effort: `s`
  - affected_criteria_ids: [`C.CORE.SHIPPING_RETURNS`]

- `R.PDP.TRUST.MISSING_SIGNALS`
  - subject_key: `pdp:trust_security`
  - root_cause_key: `rc:missing_trust_signal`
  - owner: `cro`
  - effort: `s`
  - affected_criteria_ids: [`C.CORE.TRUST`]

**VALUE PROP / BENEFITS / SOCIAL PROOF**
- `R.PDP.VALUE_PROP.WEAK_ATF`
  - subject_key: `pdp:value_prop`
  - root_cause_key: `rc:unclear`
  - owner: `copy`
  - effort: `s`
  - affected_criteria_ids: [`C.PERS.VALUE_PROP`]

- `R.PDP.BENEFITS.MISSING_SCANNABLE_LIST`
  - subject_key: `pdp:benefits_features`
  - root_cause_key: `rc:poor_structure`
  - owner: `copy`
  - effort: `s`
  - affected_criteria_ids: [`C.PERS.BENEFITS`]

- `R.PDP.REVIEWS.MISSING_OR_HIDDEN`
  - subject_key: `pdp:social_proof_reviews`
  - root_cause_key: `rc:hard_to_find`
  - owner: `cro`
  - effort: `m`
  - affected_criteria_ids: [`C.PERS.SOCIAL_PROOF`]

**FAQ / SIZING**
- `R.PDP.FAQ.MISSING_OBJECTIONS`
  - subject_key: `pdp:faq_objections`
  - root_cause_key: `rc:missing`
  - owner: `copy`
  - effort: `m`
  - affected_criteria_ids: [`C.PERS.FAQ_OBJECTIONS`]

- `R.PDP.SIZING.MISSING_GUIDE`
  - subject_key: `pdp:sizing_fit`
  - root_cause_key: `rc:missing`
  - owner: `merch`
  - effort: `m`
  - affected_criteria_ids: [`C.PERS.SIZING_FIT`]

**TECH / SEO**
- `R.TECH.READY_STATE.VOLATILE_LAYOUT`
  - subject_key: `tech:stability_ready_state`
  - root_cause_key: `rc:layout_unstable`
  - owner: `dev`
  - effort: `m`
  - affected_criteria_ids: [`C.TECH.MOBILE_UX`]

- `R.TECH.PERF_LAB.POOR_BUCKET`
  - subject_key: `tech:performance_lab`
  - root_cause_key: `rc:slow_lab`
  - owner: `dev`
  - effort: `m`
  - affected_criteria_ids: [`C.TECH.PERF_LAB`]

- `R.SEO.META.MISSING_TITLE_OR_DESC`
  - subject_key: `seo:metadata`
  - root_cause_key: `rc:seo_gap`
  - owner: `data`
  - effort: `s`
  - affected_criteria_ids: [`C.SEO.METADATA`]

- `R.SEO.JSONLD.MISSING_PRODUCT`
  - subject_key: `seo:structured_data`
  - root_cause_key: `rc:structured_data_gap`
  - owner: `data`
  - effort: `s`
  - affected_criteria_ids: [`C.SEO.STRUCTURED_DATA`]

**TARGETING / BLOCKS**
- `R.TARGET.NON_PRODUCT.URL_INVALID`
  - subject_key: `target:non_product`
  - root_cause_key: `rc:not_a_pdp`
  - owner: `cro`
  - effort: `s`
  - affected_criteria_ids: []

- `R.TARGET.BLOCKED.CONSENT`
  - subject_key: `target:blocked_by_consent`
  - root_cause_key: `rc:blocked_consent`
  - owner: `cro`
  - effort: `s`
  - affected_criteria_ids: []

- `R.TARGET.BLOCKED.POLICY`
  - subject_key: `target:blocked_by_policy`
  - root_cause_key: `rc:blocked_policy`
  - owner: `cro`
  - effort: `s`
  - affected_criteria_ids: []

---

## 4) Template Registry (MUST)

### 4.1 Template id conventions
- Titles: `TPL.TITLE.<rule_id>`
- Summaries: `TPL.SUMMARY.<rule_id>`
- Why steps: `TPL.WHY.<rule_id>.<step_id>`
- How steps: `TPL.HOW.<rule_id>.<step_id>`
- Validation: `TPL.VAL.<rule_id>`

### 4.2 Template rules
- “Final” templates = typed variables only (no free text).
- Any sentence that implies causality MUST require an evidence (`config_fact|network_fact`) via boolean variable `has_causal_evidence`.

### 4.3 Examples (logical format)
> Note: the exact contents of templates (FR/EN) are in the i18n catalog,
> here we only reference the allowed IDs.

Allowed examples:
- `TPL.TITLE.R.PDP.CTA.MISSING_ATF`
- `TPL.SUMMARY.R.PDP.CTA.MISSING_ATF`
- `TPL.WHY.R.PDP.CTA.MISSING_ATF.01`
- `TPL.HOW.R.PDP.CTA.MISSING_ATF.01`
- `TPL.VAL.R.PDP.CTA.MISSING_ATF`

---

## 5) Anti-drift enforcement (MUST)

### 5.1 Reject unknowns
- Any ticket emission with a `rule_id` absent from the registry ⇒ contractual KO.
- Any `subject_key` or `root_cause_key` outside the list ⇒ contractual KO.
- Any `criteria_id` outside the list ⇒ contractual KO.

### 5.2 Deterministic grouping
- `group_key = subject_key.root_cause_key.source_side`
- Consolidation sort: `rule_id asc` then `ticket_id asc`.

### 5.3 Deterministic defaults
- If a field is not explicitly set by the detector:
  - `owner`, `effort`, `root_cause_key` take the defaults from the registry.

---

## 6) DUO rules (MUST)

### 6.1 Comparable criteria map
For `comparability_status=partial`, each criterion MUST be marked:
- `comparable=true|false`
By default:
- `C.TECH.PERF_LAB` = false (unless same lab_profile + tolerance OK)
- `C.SEO.*` = true
- `C.CORE.*` = true if `variant_context` matches and `page_kind=product` on both sides

### 6.2 Winner gating
- Winner allowed only if `comparability_status=ok`.
- Otherwise: “delta insights” only (templated).

---

## 7) Change log (MUST)
- Any change MUST be documented here (summary + impact).

---

## Implementation notes (NON-SSOT)
No implementation plan here.
The code MUST load this registry as **SSOT** and reject out-of-registry outputs.
