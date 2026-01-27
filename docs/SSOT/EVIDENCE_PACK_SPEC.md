# ShopifyStrategist — EVIDENCE_PACK_SPEC.md (SSOT-aligned)

**EVIDENCE_PACK_SPEC_VERSION:** 1.2  
**Status:** SSOT (EvidenceBuilder + HTML rendering "Evidence pack")  
**Owner:** Nicolas  

## 0) Purpose
Lock **without drift**:
- the production of **Evidence v2** objects (`EVIDENCE_SCHEMA_VERSION=2`) used by tickets,
- navigation rules (`Evidence.ref` → HTML anchor),
- HTML rendering for **Evidence pack** + **Missing evidence**,
- determinism (IDs, sorting, truncations),

…while respecting:
- **HTML report = SSOT**, PDF strictly derived (Playwright),
- **Evidence-based** (no ticket without `evidence_refs[]`),
- **No new export field** (tickets/evidence/csv).

---

## 1) SSOT references (source of truth)
- `docs/SSOT/SCORING_AND_DETECTION.md` (v2.2): Ticket v2 / Evidence v2 / CSV v1 schemas, ID formats, screenshot gating, reasons, confidence rules, “contestable → DOM-first” rules, diversity rules.
- `docs/SSOT/REPORT_OUTLINE.md` (V3.1): report structure, A/B/C definitions, Top actions vs Appendix rules, Evidence pack, Missing evidence.
- `docs/SSOT/DETECTORS_SPEC.md` (v1.3): detector envelopes (`method`, `data_sources_used`, `errors`, `facts`, `evidence_hints`) + determinism rules.
- `docs/SSOT/AUDIT_PIPELINE_SPEC.md` (latest): pipeline steps (scoring → EvidenceBuilder → HTML builder → PDF), errors, mapping to the 6 reasons.

> Anti-drift: this document **does not redefine** thresholds/keyword lists/signal catalog/business enums/diversity rules. If a “business rule” is needed, reference `SCORING_AND_DETECTION`.

---

## 2) Goals / Non-goals

### 2.1 Goals
1) Define **normative** rules to produce `exports.evidences[]` compliant with **Evidence v2**.
2) Guarantee **navigability**: `Evidence.ref` points to a stable HTML anchor.
3) Guarantee **determinism**: same inputs + same versions ⇒ same IDs / same sorting / same truncations.
4) Describe **degraded mode** on evidence (no invented metrics, explicit limitations, tickets moved or confidence adjusted per SSOT).
5) Support **SOLO + DUO (AB & Before/After)**: evidences are **per source** (`page_a/page_b/before/after`).

### 2.2 Non-goals
- Define which signals produce which tickets: `SCORING_AND_DETECTION`.
- Define detectors (their rules/thresholds): `DETECTORS_SPEC`.
- Define the full report structure: `REPORT_OUTLINE`.
- Add/rename exported fields: forbidden.

---

## 3) Invariants (non-negotiable)
1) **No new export field**: strict Evidence v2 / Ticket v2 / CSV v1.
2) **Evidence-based**: every exported ticket has `evidence_refs[]` with **≥ 1** existing `evidence_id`.
3) **Lab-only**: perf/weight = lab best-effort, never RUM; if unavailable ⇒ no invented value.
4) **Coded reasons**: any `missing_evidence_reason` ∈ {6 SSOT enums} or `null`.
5) **Determinism**: no `now()`, no sampling; stable sort; deterministic truncations.
6) **DUO**: `Evidence.source` is **never** `gap/diff` (forbidden because not SSOT). “gap/diff” tickets reference evidences **page_a + page_b** (or before+after).

---

## 4) Schema reminder — Evidence v2
Evidence (EVIDENCE_SCHEMA_VERSION=2):
- `evidence_id` (deterministic)
- `level`: `A|B|C`
- `type`: `screenshot|measurement|detection`
- `label` (stable slug)
- `source`: `page_a|page_b|before|after`
- `viewport`: `mobile|desktop|na`
- `timestamp` (ISO)
- `ref`: **stable HTML anchor** `#evidence-<evidence_id>` (hard rule)
- `details` (free)

> Any additional information (storage refs, method, metrics, rects, facts, truncations…) MUST remain in `Evidence.details`.

---

## 5) Pipeline placement (anti-drift)
Aligned with `AUDIT_PIPELINE_SPEC`:
- Detectors produce **facts** (and `evidence_hints`) via `DETECTORS_SPEC`.
- Scoring (SSOT: `SCORING_AND_DETECTION`) decides **which tickets** and **which evidences** are needed.
- **EvidenceBuilder** (pipeline) normalizes and secures evidences: `evidence_id`, `ref`, `timestamp`, `details`, sorting/truncations.
- The HTML report renders the **Evidence pack** (grouped) and “Missing evidence”.

---

## 6) Hard rule: `Evidence.ref` + HTML wrappers
To guarantee reliable navigation in HTML SSOT:
- **Hard rule**: `Evidence.ref = "#evidence-<evidence_id>"`.
- The HTML contains:
  - evidence wrapper: `id="evidence-<evidence_id>"`
  - ticket wrapper: `id="ticket-<ticket_id>"`

Any storage link (screenshot key, path, storage url, json pointer…) is allowed **only** in `Evidence.details`.

---

## 7) `evidence_id` (determinism) + indexing
SSOT format:
`E_<source>_<viewport>_<type>_<label>_<idx>`

- `<source>`: `page_a|page_b|before|after`
- `<viewport>`: `mobile|desktop|na`
- `<type>`: `screenshot|measurement|detection`
- `<label>`: stable slug
- `<idx>`: `01..99`

### 7.1 Indexing (normative)
If multiple evidences share `(source, viewport, type, label)`:
1) sort by a stable key (e.g., `dom_order` then `url` asc then `node_ref.dom_path` asc),
2) assign `01`, `02`, …
3) if possible, **prefer bundling** (stable list in `details`) rather than multiplying evidences.

---

## 8) `timestamp` (hard anti-non-determinism rule)
- `Evidence.timestamp` MUST come from the **snapshot/capture timestamp** of the source (or from the artifact if more precise).
- Forbidden: `now()` at render time.

---

## 9) Evidence `level` (A/B/C) — SSOT-aligned
Base definition = `REPORT_OUTLINE`:
- **A**: clear and directly relevant evidence (sharp screenshot / unambiguous detection / numeric measurement with method).
- **B**: relevant but incomplete evidence (lazy-load, popup, partial section).
- **C**: plausible inference without sufficient proof ⇒ **Appendix-only**.

### 9.1 EXTRACT VERBATIM (FR version for example) — “visually obvious screenshot B” (SCORING v2.2 Patch 3)
> DO NOT EDIT HERE — Source : `docs/SSOT/SCORING_AND_DETECTION.md` v2.2 §12.1
- l’élément est lisible sans zoom,
- l’absence/présence est incontestable (ex : pas un pixel-crop, pas un overlay),
- le viewport et timestamp sont présents dans l’evidence pack.

### 9.2 Minimum rules (MVP) by `type`
#### a) `type="screenshot"`
- **A** if the screenshot is sharp and directly probative (per REPORT_OUTLINE).
- **B** if the screenshot is “visually obvious” (extract above) but with less complete context (crop/partial section acceptable as long as the probative element is indisputable).
- **C** allowed if reading is ambiguous (blur, residual overlay, non-conclusive element) — **Appendix-only**.

#### b) `type="measurement"`
- **A** if: method + context + values are present (and “lab” limitation is explicit).
- **B** if: partial measurement but still usable with explicit limits.
- **C** only if the information is an estimate (Appendix-only) — otherwise omit.

#### c) `type="detection"`
- **A** if method is unambiguous (e.g., `dom_strict`) and facts are clear.
- **B** if controlled fallback (e.g., `dom_fallback` or `screenshot_b` with ultra conservative facts).
- **C** if fragile heuristic / insufficient context ⇒ Appendix-only.

---

## 10) `label` (stability, anti-drift)
- `label` is a **stable slug**: a nomenclature change can change `evidence_id` ⇒ implies bump `SCORING_VERSION`.
- This doc **does not maintain** an “official list” of labels (drift risk).

Practical rule (normative):
- screenshots: `label` derived from SSOT `screenshot_name` (e.g., `above_fold_mobile` → `above_fold`).
- detections: `label` derived from `detector_id` (or from a stable mapping defined in `SCORING_AND_DETECTION`).
- measurements: `label` derived from `measurement_id` (or stable mapping `SCORING_AND_DETECTION`).

---

## 11) `viewport` (rules)
- screenshots: `viewport` ∈ {`mobile`,`desktop`} (never `na`).
- measurement/detection: `viewport="na"` if not dependent on a viewport.
- If a detection/measurement is explicitly viewport-dependent, use `mobile/desktop` (but stay consistent and deterministic).

---

## 12) `Evidence.details` (recommendations, no schema constraint)
> `details` is free, but MUST remain **deterministic** (sorting, truncations, no unstable fields).

### 12.1 Screenshot details (recommended)
```json
{
  "screenshot_name": "cta_area_mobile",
  "storage_ref": "storage://.../snap_.../page_a/mobile/cta_area.png",
  "focus_rect": {"x": 12, "y": 600, "w": 366, "h": 200},
  "notes": "best_effort"
}
```

### 12.2 Detection details (aligned with `DETECTORS_SPEC`)
```json
{
  "detector_id": "buybox_detector",
  "detector_version": "1.3.0",
  "method": "dom_strict",
  "data_sources_used": ["dom", "screenshots"],
  "facts_summary": {
    "buybox_detected": true,
    "primary_cta_text": "Ajouter au panier"
  }
}
```

### 12.3 Measurement details (recommended)
```json
{
  "measurement_id": "lighthouse_lab",
  "method": "lighthouse_run",
  "context": {"preset": "mobile", "throttling": "default"},
  "metrics": {"perf_score": 38, "lcp_s": 4.8, "cls": 0.29, "tbt_ms": 720},
  "limitations": "Lab metrics (not real user data)."
}
```

### 12.4 Deterministic truncations (if long lists)
If `details` contains long lists:
- sort in a stable way,
- truncate deterministically,
- annotate:
```json
{"truncated": true, "kept": 20, "total": 124}
```

---

## 13) Screenshot gating → `evidence_completeness` + “Missing evidence”
### 13.1 SSOT rules (reference)
Sets A/B, gating, and consequences (cover badge + Appendix) are defined in:
- `SCORING_AND_DETECTION` v2.2 §2.3
- `AUDIT_PIPELINE_SPEC` §4.1 (extract verbatim)

This document only enforces:
- SSOT-compliant computation (`complete|partial|insufficient`),
- “Missing evidence” table visible if `!= complete`,
- reasons strictly within the 6 SSOT enums.

### 13.2 DUO: multi-source aggregation (conservative rule)
- Compute a status **per source** (internal).
- The `report_meta.evidence_completeness` displayed on cover (single) = **worst of sources**: `insufficient > partial > complete`.
- In HTML: detail per source in the “Missing evidence” table.

### 13.3 “Missing evidence” (HTML-only)
The table MUST contain, per item:
- `source` (page_a/page_b/before/after)
- `missing_evidence_reason` (1 of the 6 SSOT enums)
- `impact` (short **deterministic** phrase)

**Determinism rule (impact)**:
- use a stable template (no free generation):
  - `"Some evidence could not be captured (<artifact>). Related tickets may be moved to the Appendix."`
- where `<artifact>` is a stable identifier (e.g., an SSOT `screenshot_name`, or `network_log`, or `lighthouse`).

> No exported field is affected: this table is HTML-only.

---

## 14) Stable sorting of evidences (normative)
Recommended stable sort for `exports.evidences[]`:
1) `source` (page_a, page_b, before, after)
2) `type` (screenshot, measurement, detection)
3) `viewport` (mobile, desktop, na)
4) `label`
5) `evidence_id`

---

## 15) Attaching `ticket.evidence_refs[]` (determinism)
### 15.1 Hard rules
- Every exported ticket references **≥1** existing `evidence_id`.
- Top actions: tickets with A/B evidence only and `confidence != low` (SSOT).
- Appendix: allows C evidence (Appendix-only).

### 15.2 Deterministic selection (recommended)
For a ticket:
1) build the candidate list (per SSOT scoring),
2) filter by “min evidence level for Top actions” (SSOT internal),
3) sort by `evidence_id` asc,
4) keep the smallest sufficient set (often 1–2, max 3).

---

## 16) Degraded mode (graceful degradation)
- If Lighthouse unavailable: **no** invented metric; omit the measurement or degrade to detection (Appendix-only if contestable).
- If `network_log` unavailable: no reliable bytes; omit measurement; conservative fallback only.
- If DOM unavailable: prefer `screenshot_b` (ultra conservative facts); otherwise Appendix.
- If screenshots insufficient: `evidence_completeness` degraded + “Missing evidence” table + dependent tickets moved/confidence lowered per SSOT.

---

## 17) Internal errors + mapping to the 6 reasons (no invented enums)
Pipeline/detector errors are defined in `AUDIT_PIPELINE_SPEC` / `DETECTORS_SPEC`.

Rule: when an error explains missing evidence, it MUST carry `missing_evidence_reason` ∈ {6 SSOT enums}.

Example (internal pipeline):
```json
{
  "code": "CAPTURE_TIMEOUT",
  "stage": "capture",
  "message": "Navigation timed out on mobile viewport",
  "source": "page_a",
  "missing_evidence_reason": "timeout"
}
```

---

## 18) DoD — Evidence pack
- `exports.evidences[]` strictly compliant with Evidence v2.
- `Evidence.ref` navigable in HTML (`#evidence-...`) + wrappers `evidence-*` and `ticket-*`.
- Deterministic IDs + stable sort + deterministic truncations.
- `report_meta.evidence_completeness` SSOT-compliant + “Missing evidence” table if != complete (reasons ∈ 6 SSOT enums).
- DUO: evidences per source; cover = worst of sources; no `source=gap/diff`.
- Degraded mode validated: report delivered, explicit limitations, no invented metrics.
