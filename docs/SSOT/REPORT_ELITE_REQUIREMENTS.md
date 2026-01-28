# REPORT_ELITE_REQUIREMENTS.md (v1.9)

## Owned Concepts (Canonical)
- TBD

## Not Owned (References)
- TBD

## Objective
Produce a Shopify audit report at an **elite level**: “agency-grade”, sendable as-is, **client-safe**, robust in degraded mode, and **reproducible**.

**SSOT rule**
- **HTML is the SSOT**.
- **PDF is strictly derived from the HTML** (Playwright, no content transformation).
- **REGISTRY.md is the SSOT** for taxonomy, criteria, rules, and templates (anti-drift).

## Scope
- **SOLO Instant**
- **SOLO Client-Ready**
- **DUO AB** (A vs B)
- **DUO Before/After** (Before vs After)

---

## 0) Global contracts (MUST)

### 0.1 Language & locale (anti-mix)
- `report_language`: `fr` or `en` (no mix allowed)
- `report_locale`: e.g. `fr-FR` / `en-US`

Rules:
1) Static strings via i18n.
2) Zero FR/EN mixing in titles/labels/paragraphs/appendices (except standard metrics, IDs, technical keys).
3) All client-facing fields (`title`, `summary`, `why`, `how`, `validation`) are generated in `report_language`.

### 0.2 “Strong” determinism (snapshot guarantee)
**Main guarantee**
- **Same `snapshot_key` + same versions (engine/scoring/detectors/render/templates/registry) ⇒ same outputs: score, tickets, order, text, HTML, PDF.**

The report displays:
- `captured_at`, `final_url`
- `snapshot_key`, `snapshot_fingerprint`, `snapshot_schema_version`
- `report_fingerprint`
- `registry_version`, `template_catalog_version`, `ticket_schema_version`

### 0.3 AI policy
- **AI is forbidden** for anything “final”: scoring, detection, inclusion/exclusion, sorting, severity/impact/confidence, consolidation, DUO winner, final text.
- Optional AI only for **Draft (to review)** sections:
  - clear visual separation,
  - immutable cache `copy_artifact_key`,
  - fallback templates if AI is KO,
  - no impact on score/tickets.

### 0.4 Client-facing text contract (templates + allowlist)
All “final” text comes from a **versioned template catalog** AND must comply with the registry:
- Each text field has a `template_id` + `template_version`.
- `template_id` MUST follow the registry conventions (e.g. `TPL.TITLE.<rule_id>`, `TPL.SUMMARY.<rule_id>`, `TPL.WHY.<rule_id>.<step_id>`, etc.).
- **Typed** variables only (no “final” free-text).
- Deterministic bullet ordering: sort by `rule_id` then `step_id`.

---

## 1) Registry Contract (anti-drift) (MUST)

### 1.1 Source of truth
`REGISTRY.md` is the single source for:
- Enums (owners/effort/severity/impact/confidence/sides…)
- Taxonomy: `subject_key`, `root_cause_key`
- Criteria: `criteria_id`, `weight`, `criteria_explanation_template_id`
- Rules: `rule_id` + mapping (defaults)
- Allowed templates (IDs/conventions)

The report MUST display `registry_version`.

### 1.2 Enforcement (gating)
During report generation/export, the engine MUST validate:
- All `rule_id`, `subject_key`, `root_cause_key`, `criteria_id`, `template_id` present in outputs are **allowed** by `REGISTRY.md`.

On violation:
- produce a `contract_error` in appendix with a stable code (e.g. `REGISTRY_UNKNOWN_RULE_ID`, `REGISTRY_UNKNOWN_SUBJECT_KEY`, etc.)
- **do not** emit the ticket in client-facing
- if the violation affects scoring (e.g. unknown criteria): `scoring_status=KO` + score not displayed (or displayed as “N/A”) + client-safe report.

### 1.3 Deterministic defaults (via registry)
If a detector does not explicitly provide:
- `owner`, `effort`, `root_cause_key`, `affected_criteria_ids[]`
then these fields take the **defaults** from the rule mapping in `REGISTRY.md`.

---

## 2) Snapshot Contract (MUST)

### 2.1 Snapshot definition
An immutable, versioned snapshot includes at minimum:
- `dom_snapshot` (normalized DOM + metadata)
- `screenshots` (minimal Offline Proof Pack)
- `extraction_facts` (typed JSON)
- `network_facts` (redirect chain, status, relevant headers)
- `lab_metrics` (if enabled)
- `context` (device/viewport, locale, UA, ready_profile)

Fingerprint:
- `snapshot_fingerprint` = hash of the normalized DOM + minimal context (deterministic)
- `snapshot_schema_version` displayed

### 2.2 Deterministic IDs (aligned registry)
- `ticket_id` = `T.<rule_id>.<subject_key>.<source_side>`
- `evidence_id` = `E.<type>.<locator_hash>.<source_side>`

---

## 3) Input Normalization (MUST)
- Remove tracking params (utm, fbclid, gclid, etc.), keep functional allowlist (e.g. `variant`).
- Follow redirects: `final_url`, `redirect_chain[]`.
- Determine `page_kind`: `product|non_product|unknown`.
  - if `non_product`: client-safe report, no PDP scoring (or minimal “invalid target” scoring), tickets limited to access/redirection/URL.
- `variant_context` displayed if detected/selected, otherwise `unknown`.

---

## 4) Page Ready & Anti-Variability (MUST)
- `ready_profile`: `fast|standard|deep`
- Freeze animations + attempt to pause carousels.
- Bounded wait:
  - `domcontentloaded`
  - + `ready_wait_ms` (profile)
  - + “layout stable” checks (N checks at fixed interval, fixed px threshold)
- If unstable:
  - `volatile_ready_state=true`
  - degraded mode for unstable elements (fields/blocks marked “volatile”)

---

## 5) HTML & PDF (MUST)
- Forbidden: CDN CSS/JS/fonts.
- Offline = readable layout + text without network.
- Playwright PDF strictly derived.

---

## 6) Evidence-based (MUST)
- Each ticket has ≥ 1 `evidence_ref`.
- Allowed evidence types: those listed in `REGISTRY.md` (or in the equivalent technical contract if separated).
- Zero causal attribution without `config_fact|network_fact` (otherwise `where="unknown"`).
- Claim ↔ evidence: summaries contain only supported claims; otherwise rephrase as a hypothesis + adjust confidence.

---

## 7) Offline Proof Pack (MUST)
Minimum embedded:
- SOLO: 1 hero screenshot
- DUO: 1 hero per side
- Before/After: 2 pairs side-by-side
- Evidence for Top Actions embedded first

Budgets:
- `size_budget_profile`: `compact|standard|heavy`
- If exceeded: keep the minimum + stable placeholders

---

## 8) Scoring & traceability (MUST)

### 8.1 Criteria & weights via registry
- The list of `criteria_id` and `weight` comes exclusively from `REGISTRY.md`.
- Each criterion displays:
  - `criteria_id`
  - `weight`
  - `score_component`
  - `criteria_explanation_template_id` (via registry)

### 8.2 Unknown-handling (anti-unfairness)
- `unknown` ⇒ neutral contribution by default (no bonus and no penalty) + `data_completeness=partial`.
- The explanation MUST mention “data unavailable at capture time” if a criterion depends on an `unknown` field.

### 8.3 Tickets ↔ criteria
- Each ticket includes `affected_criteria_ids[]` (≥1), and these IDs MUST be allowed by `REGISTRY.md`.
- Exception: `target:*` tickets (non-product URL / blocked) may have `affected_criteria_ids=[]`.

### 8.4 Lab performance
- Perf = lab only, never presented as RUM.
- `lab_profile` displayed.
- If perf influences score: buckets + tolerance + snapshot metrics.

---

## 9) DUO — Comparability & Winner (MUST)
- `duo_type`: `same_product_variant|two_products|before_after_same_product`
- `comparability_status`: `ok|partial|ko`

Winner:
- Winner allowed **only** if `comparability_status=ok`.

Comparability:
- Must-match (ok): same devices/ready, same locale, `variant_context` match (or unknown on both sides), pages accessible, no consent blocking.

Partial:
- If `comparability_status=partial`, per-criterion comparability (`comparable=true|false`) MUST follow the map defined in `REGISTRY.md`.
- No non-comparable criterion may influence a winner (winner forbidden if partial).

Delta method:
- Delta based on extracted facts (normalized values, presence/absence, buckets).
- Volatile fields excluded from winner decisions.

---

## 10) Volume, consolidation, sorting (MUST)

### 10.1 Volume
- SOLO Instant: max 12 tickets (P0–P2)
- SOLO Client-Ready: max 18
- DUO: max 14

### 10.2 Deterministic consolidation (aligned registry)
- `group_key = subject_key.root_cause_key.source_side`
- `subject_key` and `root_cause_key` MUST come from the registry (or defaults from the rule mapping).
- Mandatory merge on identical `group_key`.
- Stable ordering: `rule_id asc` then `ticket_id asc`.

### 10.3 Stable sorting
severity desc, impact desc, confidence desc, ticket_id asc

---

## 11) System Health & budgets (MUST)
- `time_budget_profile`: `fast|standard|deep` (recommended numeric values)
- Exceeded ⇒ degraded mode (reduce non-critical, keep Offline Proof Pack)

System Health (client-safe) displays:
- ready state: `ready_profile`, `volatile_ready_state`
- capture/extraction/scoring status + versions
- budgets status
- snapshot metadata
- artifact refs (html_ref/pdf_ref)

---

## 12) Data Governance (MUST)
- `data_retention_days` (appendix)
- minimization: store only what is needed for snapshot/proof
- PII redaction (emails/phones/addresses) if detected
- never store secrets, tokens, sensitive checkout info

---

## 13) Non-regression & acceptance (MUST)
1) no-mix language
2) determinism: same snapshot_key ⇒ same outputs + identical fingerprints
3) registry gating: no out-of-registry id in client-facing/export
4) Offline Proof Pack present
5) valid evidence_refs + claim↔evidence respected
6) DUO: comparability_status gates winner + non-flaky delta
7) JSON export matches schema + versions displayed

## Evolution policy
- visual/structure ⇒ bump `render_version`
- scoring/detectors ⇒ bump versions + golden fixtures
- registry ⇒ bump `registry_version`
- templates ⇒ bump `template_catalog_version`
- export schema ⇒ bump `ticket_schema_version`
- snapshot schema ⇒ bump `snapshot_schema_version`

## Performance SLOs & Time-to-First-Value (MUST)

### Goals
The system must optimize **perceived speed** and **commercial usability** (agency demo / client call), not only total runtime.

### Time-to-First-Value (TTFV) (MUST)
A usable first view must be available quickly, even if the full report is still rendering.

**TTFV definition**
- Minimum content:
  - `captured_at`, `final_url`
  - current `status` + progress stage (`capture|extract|scoring|render`)
  - **Score** (or `N/A` if scoring not available yet)
  - **Top Actions (3–5)** (templated)
  - **1 hero screenshot** (embedded)
  - `snapshot_key` (as soon as created)
- Target: **TTFV p50 ≤ 10–15s**, **TTFV p95 ≤ 20–30s** (SOLO).  
  For DUO: **TTFV p50 ≤ 15–25s**, **TTFV p95 ≤ 30–45s**.

TTFV must never show an empty screen: if any stage is blocked, display a client-safe message + System Health summary.

### End-to-End runtime SLOs (MUST)
SLOs are enforced via `time_budget_profile` and automatic degradation.

**Profiles**
- `time_budget_profile=fast` (default for client-facing / demos)
- `time_budget_profile=standard` (agency internal)
- `time_budget_profile=deep` (batch/offline)

**Recommended budgets (total)**
- SOLO Instant:
  - fast: p50 ≤ 20s, p95 ≤ 45s
  - standard: p50 ≤ 45s, p95 ≤ 90s
- DUO (AB / Before-After):
  - fast: p50 ≤ 45s, p95 ≤ 90s
  - standard: p50 ≤ 75s, p95 ≤ 150s
- SOLO Client-Ready:
  - fast: p50 ≤ 60s, p95 ≤ 120s
  - standard: p50 ≤ 90s, p95 ≤ 180s

SLO reporting MUST be shown in System Health:
- `ttfv_ms`, `total_ms`
- `time_budget_profile`, `time_budget_status=ok|exceeded`
- stage breakdown timings

### Degradation policy on budget exceed (MUST)
If the time budget is exceeded (or likely to be exceeded), the engine must degrade deterministically while preserving business value:

**Keep (always)**
- Snapshot creation + fingerprints
- Score (if possible) + criteria table
- Top Actions (3–5) + Offline Proof Pack minimum
- Evidence integrity (no ticket without evidence_refs)

**Reduce first**
- Non-critical screenshots/evidences
- Secondary detectors (P3, low impact)
- Heavy rendering embellishments
- DUO non-essential deltas when `comparability_status!=ok`

**Never**
- Invent data or claims
- Change scoring rules
- Break determinism guarantees (same snapshot ⇒ same output)

All degradations must be recorded in appendix as:
- `degradation_applied=true`
- `degradation_reasons[]`
- `degradation_actions[]`

### Progressive delivery (MUST)
The report may be delivered progressively (e.g., “skeleton → filled sections”), but must remain:
- client-safe at every intermediate step
- deterministic for a given snapshot + versions
- consistent with Registry gating and template rules
