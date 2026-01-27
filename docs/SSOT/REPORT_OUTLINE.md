# ShopifyStrategist — REPORT_OUTLINE.md (SSOT-aligned) — V3.1
**Purpose:** freeze the “agency-grade” deliverable (structure + rules + formats) to prevent drift and reduce support.  
**SSOT:** the **HTML report** is the source of truth; the **PDF** is a strict (Playwright) rendering of the HTML.

---

## 0) Format versions (anti-drift)
Any structural change MUST bump a version.

- `REPORT_OUTLINE_VERSION`: `3.1`
- `TICKET_SCHEMA_VERSION`: `2`
- `EVIDENCE_SCHEMA_VERSION`: `2`
- `CSV_EXPORT_VERSION`: `1`

**Rule:**
- breaking change (field removed/renamed, enum modified) ⇒ bump the **major** version of the impacted spec.
- the report MUST display these versions (Cover + metadata).

---

## 1) Quick definitions
- **PDP**: Product Detail Page.
- **Teardown**: structured analysis oriented to actions (evidence → action).
- **Battlecard**: comparison vs competitor (proven gaps + plan).
- **Ticket**: exportable actionable unit (stable format).
- **Evidence**: screenshot / measurement / factual detection.
- **Lab metrics**: measurements in a test environment (≠ “real user” data).
- **Evidence completeness**: completeness indicator of the evidence pack (`complete` / `partial` / `insufficient`).

---

## 2) Global rules (non-negotiable)

### 2.1 Evidence-based + evidence levels (A/B/C)
Each ticket MUST reference **≥ 1 evidence**. Each evidence is qualified:

- **A (strong)**: clear and directly relevant evidence.
  - e.g., a sharp screenshot showing absence/presence, or an unambiguous detection, or a numeric measurement with method.
- **B (medium)**: relevant but incomplete evidence (lazy-load, popup, partially visible section).
- **C (weak)**: plausible inference without sufficient evidence.

**Acceptance rules:**
- **Top actions**: tickets with evidence **A or B only** and `confidence` ≠ `low`.
- **Appendix**: allows C evidence (marked “Best effort”).

### 2.2 Anti-hallucination (forbidden)
It is forbidden to assert facts that were not detected (delivery times, guarantees, returns, labels, certifications, “verified reviews”…).
If business info is not detectable:
- use a **placeholder**: `[INSERT ...]`, or
- use **conditional** wording: “If you offer X, display it here”.

### 2.3 Degraded mode (graceful degradation)
If a screenshot/measurement fails:
- still produce the report,
- move impacted elements into the **Appendix**,
- explain: likely cause + workaround (e.g., “blocking cookie popup”).

### 2.4 Sellable prioritization (anti-checklist)
The report MUST remain “decidable”:
- **Top actions: 10 to 14 tickets** (target)
- **Quick wins 48h: 3 to 5 tickets** (subset)
- the rest (if needed) in Appendix.

### 2.5 Scorecard (secondary)
The scorecard is **indicative**:
- never the primary argument,
- MUST NOT block report usage.

### 2.6 “Rolls-avoidance” limit (anti-endless dev)
- Sections are fixed, but internal analyses MAY evolve.
- Any new category / export field ⇒ version bump.
- Anything that increases support SHOULD be pushed to Appendix or offered as an add-on.

---

## 3) Audit protocol (consistency + comparability)

### 3.1 Standard viewports (mandatory)
- **Mobile**: 390×844
- **Desktop**: 1440×900

### 3.2 Standard screenshot set (best effort) + guaranteed minimum
For each audited page, target (best effort):
- `above_fold_mobile`
- `above_fold_desktop`
- `cta_area_mobile` (if CTA area is distinct)
- `media_section` (if detected)
- `trust_section` (if detected)
- `details_section`
- `full_page_mobile` (if possible)
- `full_page_desktop` (if possible)

**Guaranteed minimum (gating):**
The report MUST produce at least one of the following two sets:
- **Set A (preferred)**: `above_fold_mobile` + `above_fold_desktop` + `full_page_mobile`
- **Set B (fallback)**: `above_fold_mobile` + `cta_area_mobile` + `details_section`

**Decision (SSOT):**
- if **Set A** is met ⇒ `evidence_completeness = complete`
- if **Set B** is met (and Set A not met) ⇒ `evidence_completeness = partial`
- if **no set** is met ⇒ `evidence_completeness = insufficient`

**Consequences if `insufficient`:**
- show a **“Evidence incomplete”** badge on cover
- move tickets that most depend on screenshots into Appendix (or lower `confidence`)

**DUO (AB / Before-After) — conservative rule:**
- compute a status **per source** (`page_a/page_b/before/after`)
- show on cover a global status = **worst of sources** (`insufficient > partial > complete`)
- detail missing items **per source** in “Missing evidence” (HTML-only)

### 3.3 Dynamic pages (rules)
- Best effort attempt: close cookies/popup/chat overlays.
- If impossible: continue and record the blockage.

### 3.4 Standard failure reasons (for logs + Appendix)
If an evidence is not produced, assign a reason:
- `blocked_by_cookie_consent`
- `blocked_by_popup`
- `infinite_scroll_or_lazyload`
- `navigation_intercepted`
- `timeout`
- `unknown_render_issue`

---

## 4) AB and Before/After: realistic protocol (anti-impossible promise)

### 4.1 Alignment level
Because pages differ, the comparison is qualified:

- `alignment_level = high`: same sections found, evidence aligned section by section.
- `alignment_level = medium`: partial alignment.
- `alignment_level = low`: pages too different/dynamic; limited comparison.

**Rule:**
- the DUO report MUST display `alignment_level` (Cover + Summary).
- if `low`, limit claims and prefer “single-side” tickets + notes.

### 4.2 Consequences if `alignment_level = low` (product rule)
- Cap: **6–8 comparative tickets max**
- prefer “single-side” tickets (evidence from one side only)
- `confidence` max = `medium` unless comparative A evidence
- standard visible note:  
  “Comparison limited due to dynamic content / template mismatch. Focus is on actionable gaps supported by available evidence.”

### 4.3 AB (you vs competitor)
- same viewports
- timestamps visible
- comparative evidences if possible; otherwise separate evidences and adjusted `confidence`.

### 4.4 Before/After
- display: “before timestamp” / “after timestamp”
- if dynamic content (stock, promos), note in Appendix.

---

## 5) Delivered artefacts (outputs)
For each run:
1) **HTML report (SSOT)**: browsable, anchored, evidence → action  
2) **PDF**: strict rendering of the HTML (Playwright)  
3) **Tickets CSV export**: stable format (section 12)  
4) **Metadata** (in the report and/or JSON):
   - URL(s), timestamp, language, mode, options
   - versions (pipeline + format versions)
   - key ids if available (product/snapshot/run/audit/render)
   - `evidence_completeness` and `alignment_level` (if DUO)

---

## 6) “Agency-grade” PDF rules (realistic)
Goal: a readable and presentable PDF, without requiring the impossible.

**Minimum guarantees:**
- header or footer: title + date + page X/Y (best effort)
- no unreadable text (minimum font size)
- sections and titles clearly separated

**Best effort:**
- 1-page table of contents max (otherwise HTML-only)
- avoid cutting a ticket in the middle (preferred, not guaranteed)
- repeat section title if a section continues

---

## 7) Common report structure (all modes)
> Section IDs MUST be **stable** (anchors) to avoid drift.

### 7.1 Cover (`#cover`)
- Title: “ShopifyStrategist Report”
- Mode: SOLO / DUO AB / DUO Before-After
- URL(s)
- Date/time (Europe/Paris)
- Language (FR/EN)
- Versions: pipeline + format versions
- `evidence_completeness` (complete/partial/insufficient)
- (DUO) displayed value = **worst of sources** (`insufficient > partial > complete`); per-source detail is in “Missing evidence”.
- (DUO) `alignment_level` (high/medium/low)
- (Optional) Light white-label:
  - Logo
  - “Prepared for: {Client}”
  - “Prepared by: {Agency}”

### 7.2 Executive summary (`#executive-summary`)
**Max 6 lines** (copyable into an email):
- main blocker (1 sentence)
- main opportunity (1 sentence)
- top 3 actions (bullets)
- quick wins 48h (1–3 bullets)
- overall effort (S/M/L)
- next step (e.g., sprint 72h)

### 7.3 Top actions (`#top-actions`)
- 10–14 tickets (target)
- A/B evidence only and `confidence` ≠ low
- includes a “Quick wins 48h” subset (3–5 tickets)

**Diversity rule (anti-monotone report)**
Within Top actions:
- at least 1 `offer_clarity` ticket
- at least 1 `ux` ticket
- at least 1 `performance` OR `media` ticket (based on detections)
- at least 1 `trust` ticket **if applicable** (i.e., trust signal “missing/weak” detected)
- max 4 tickets from the same `category`

### 7.4 Evidence pack (`#evidence-pack`)
- evidences grouped by type: screenshots / measurements / detections
- each evidence displays: source (A/B/before/after), viewport, timestamp, `evidence_id`, level A/B/C
- includes “What we detected” (facts) separated from interpretations
- includes a “Missing evidence” table if `evidence_completeness != complete` (codified reason + impact).

### 7.5 Appendix (`#appendix`)
- scorecard (optional)
- “Best effort” tickets (C evidence or low confidence)
- encountered errors + workarounds (codified reasons)
- limitations & assumptions

---

## 8) Ticket format (TICKET_SCHEMA_VERSION: 2)

### 8.1 Fields (stable format)
Each ticket contains:

- `ticket_id`
- `mode` : `solo` | `duo_ab` | `duo_before_after`
- `title`
- `impact` : `high` | `medium` | `low`
- `effort` : `small` | `medium` | `large`
- `risk` : `low` | `medium` | `high`
- `confidence` : `high` | `medium` | `low`
- `category` : `offer_clarity` | `trust` | `media` | `ux` | `performance` | `seo_basics` | `accessibility` | `comparison`
- `why`
- `evidence_refs` : list of `evidence_id` (≥ 1)
- `how_to` : 3–7 steps (bullets) — **executable**
- `validation` : observable checks (bullets)
- `quick_win` : `true/false`
- `owner_hint` : `design` | `dev` | `content` | `ops`
- `notes` : optional

### 8.2 “Confidence” rules
- A evidence ⇒ `confidence=high`
- B evidence ⇒ `confidence=medium`
- C evidence ⇒ `confidence=low` (Appendix only)

### 8.3 Stable sorting (prioritization) + guardrails
Mapping:
- impact: high=3, medium=2, low=1  
- effort: small=1, medium=2, large=3  
- risk: low=1, medium=2, high=3  
- confidence: high=3, medium=2, low=1  

**PriorityScore = impact*3 + confidence*2 - effort*2 - risk*1**

Sort:
1) PriorityScore descending
2) impact descending
3) confidence descending
4) effort ascending
5) risk ascending
6) ticket_id

**Top actions guardrails:**
- exclude `confidence=low`
- max 2 tickets with `effort=large` (except structural changes in before/after)
- target 3–5 quick wins (effort small + confidence high/medium)

---

## 9) Evidence format (EVIDENCE_SCHEMA_VERSION: 2)

### 9.1 Fields (stable format)
- `evidence_id`
- `level` : `A` | `B` | `C`
- `type` : `screenshot` | `measurement` | `detection`
- `label`
- `source` : `page_a` | `page_b` | `before` | `after`
- `viewport` : `mobile` | `desktop` | `na`
- `timestamp`
- `ref` : **stable HTML anchor** `#evidence-<evidence_id>` (hard rule). Any storage/path/json pointer goes in `details`.
- `details` : free (metric, value, method, threshold)

### 9.1.1 Compat exports — wrappers / anchors (hard rules)
To guarantee navigability and anti-drift with the API:
- each exported ticket MUST have an HTML wrapper: `id="ticket-<ticket_id>"`
- each exported evidence MUST have an HTML wrapper: `id="evidence-<evidence_id>"`
- `Evidence.ref` MUST point to the anchor: `#evidence-<evidence_id>`

### 9.2 Measurements: rules
- “Web Vitals” = **Lab metrics** by default.
- Always display: method + context + limitation.
- If unavailable: fallback to `detection` (e.g., “images > 300KB detected”).

---

## 10) Mode variants

## 10A) SOLO — Instant Teardown
The report stays focused on Executive summary + Top actions + Evidence pack.
Internal generation sections:
- offer_clarity, trust, media, ux, performance, seo_basics, accessibility.

## 10B) DUO — AB Battlecard
Specific sections:
- `#battlecard-summary` : gaps (3–10) + copy in 72h + do-not-copy + `alignment_level`
- `#gap-tickets` : comparison tickets (aligned evidences if possible)

## 10C) DUO — Before/After Diff
Specific sections:
- `#diff-summary` : what changed + expected impact (prudent) + risks + `alignment_level`
- `#change-tickets` : tickets per major change

---

## 11) Copy-ready (optional AI) — concrete format (anti-fluff)

### 11.1 Copy-ready scope (limited by design)
To avoid endless expansion:
- Copy-ready applies only to the **Top 5 tickets** (by default).
- Per ticket, maximum: **headline + 3 bullets + 1 CTA**.

### 11.2 Output format (stable)
Each proposal is tied to a ticket:
- `ticket_id`
- `placement` : e.g., “above CTA”, “under price”, “FAQ block”
- `constraints` : e.g., “headline ≤ 60 chars”, “bullets ≤ 90 chars”
- `safe_version` : conservative (always allowed)
- `assertive_version` : only if sufficient evidence, otherwise `null`
- `rationale` : 1 sentence tied to the detected issue
- `placeholders_required` : list of placeholders to fill if business info is missing

### 11.3 Forbidden
- invent numbers, delivery times, guarantees, labels
- oversell without evidence

---

## 12) CSV export (tickets) — CSV_EXPORT_VERSION: 1
Columns (stable format):
- `ticket_id`
- `mode`
- `title`
- `impact`
- `effort`
- `risk`
- `confidence`
- `category`
- `why`
- `evidence_refs` (separator `|`)
- `how_to` (separator `|`)
- `validation` (separator `|`)
- `quick_win`
- `owner_hint`
- `url_context`

---

## 13) FR/EN labels
- Identical structure
- Only labels/text change
- Export enums remain stable (high/medium/low etc.), display MAY be translated.

---

## 14) “Sendable report” criteria
A report is “sendable” if:
- executive summary is clear and short
- top actions: 10–14 tickets, A/B evidence, confidence ≠ low
- quick wins: 3–5 tickets
- evidence pack is readable (viewport + source + timestamp + ids)
- “Missing evidence” is explicit if incomplete + codified reasons
- errors/limits in Appendix
- PDF is readable (clear structure, no tiny text)

---

## 15) Anti-drift checklist (release gate)
- sections/ids conform to this doc
- versions (outline/ticket/evidence/csv) displayed
- stable CSV
- SOLO + DUO AB + DUO Before/After pass smoke tests
- PDF faithful to HTML SSOT (Playwright)
