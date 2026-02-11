# ShopifyStrategist - AUDIT_PIPELINE_SPEC.md
## Owned Concepts (Canonical)
- Pipeline orchestration (normalize → capture → detectors → scoring → report → render_pdf → storage)
- Stage contracts and error propagation

## Not Owned (References)
- **Persistence**: Prisma with Supabase PostgreSQL
- **Capture**: Playwright-based capture (Desktop/Mobile)
- **Storage**: Supabase Storage Buckets

**Spec version:** 1.0  
**Status:** SSOT (orchestration specification)  
**Goal:** Lock the end-to-end pipeline **without drift**: snapshot → detectors (facts) → scoring (evidences+tickets) → HTML report (SSOT) → PDF (Playwright) → CSV v1.  
**Mandatory compatibility:** `docs/SSOT/SPEC.md`, `docs/SSOT/REPORT_OUTLINE.md (V3.1)`, `docs/SSOT/SCORING_AND_DETECTION.md (v2.2)`, `docs/SSOT/DETECTORS_SPEC.md (v1.3)`.

---

## 0) Invariants (non-negotiable)
1) **HTML report = SSOT**; **PDF** strictly derived from HTML (Playwright).
2) **Evidence-based**: no ticket without `evidence_refs[]` (>= 1).
3) **No RUM**: performance/weight = lab best-effort; never real user metrics.
4) **Anti-drift**:
   - **No new exported field** (Ticket v2 / Evidence v2 / CSV v1).
   - Any additional info MUST remain **internal** or in `Evidence.details` (without changing the schema).
   - Do not redefine thresholds/keywords/enums/rules already SSOT: **reference `SCORING_AND_DETECTION`**.
5) **Degraded mode**: deliver a usable report even if capture/measurement partially fails (with explicit limitations).
6) **Determinism**: same inputs + same versions => same outputs (IDs, ordering, truncations, content).

---

## 1) Goals / Non-goals
### 1.1 Goals
- Specify orchestration for **SOLO + DUO (AB & Before/After)**.
- Define internal contracts (request/result) to run without ambiguity.
- Specify timeouts, errors, determinism, cache/keys, degraded mode.
- Guarantee export compliance: **Tickets v2**, **Evidence v2**, **CSV v1**.

### 1.2 Non-goals
- Define signals, signal->ticket mapping, thresholds, diversity rules: that is `SCORING_AND_DETECTION`.
- Define detector details: that is `DETECTORS_SPEC`.
- Define the report structure: that is `REPORT_OUTLINE`.
- Define the public API: that will be `API_DOC.md`.

---

## 2) Versions (anti-drift)
The HTML report (Cover + metadata) MUST display:
- `REPORT_OUTLINE_VERSION = 3.1`
- `TICKET_SCHEMA_VERSION = 2`
- `EVIDENCE_SCHEMA_VERSION = 2`
- `CSV_EXPORT_VERSION = 1`
- `DETECTORS_SPEC_VERSION = 1.3`

And the runtime versions:
- `NORMALIZE_VERSION`
- `SCORING_VERSION`
- `ENGINE_VERSION`
- `RENDER_VERSION`

Rules:
- Change signals/thresholds/mapping/merge/dedup/IDs/ordering => bump `SCORING_VERSION`.
- Change report structure => bump `REPORT_OUTLINE_VERSION`.

---

## 3) Modes & sources
### 3.1 Mode
- `mode = "solo" | "duo_ab" | "duo_before_after"`

### 3.2 Source (used in Evidence)
- `source = "page_a" | "page_b" | "before" | "after"`

Rule: in DUO, capture + detectors run **per source**. Comparisons/diffs are produced at scoring.

### 3.3 Viewports
- Mobile: 390x844
- Desktop: 1440x900

---

## 4) Capture artefacts (best effort)
The exact names of screenshots/artefacts to produce are SSOT (see `DETECTORS_SPEC` and references in `SCORING_AND_DETECTION` / `REPORT_OUTLINE`).

The pipeline attempts (best effort):
- DOM snapshot (`dom`)
- SSOT screenshots
- `network_log` (optional)
- `lighthouse` (optional)

### 4.1 Gating screenshots & evidence_completeness (SSOT)
The definition of sets A/B and gating lives in `SCORING_AND_DETECTION` (and is mirrored in `REPORT_OUTLINE`).

> **EXTRAIT VERBATIM - DO NOT EDIT HERE (source SSOT)**
- Set A (prefere) : `above_fold_mobile` + `above_fold_desktop` + `full_page_mobile`
- Set B (fallback) : `above_fold_mobile` + `cta_area_mobile` + `details_section`

Pipeline decision (SSOT-aligned):
- `evidence_completeness = complete` if Set A is met
- `evidence_completeness = partial` if Set B is met (and Set A is not met)
- `evidence_completeness = insufficient` if neither set is met

Consequence (SSOT): if `insufficient`, show badge + “Missing evidence” table + move tickets that depend on missing evidence to Appendix (or lower `confidence`).

---

## 5) Cache & keys (determinism)
SPEC enforces a multi-layer cache with deterministic keys (conceptually: `product_key`, `snapshot_key`, `run_key`, `audit_key`, `render_key`).

### 5.1 Normative invariants
- Keys are derived from a **canonical JSON** (stable ordering), then hashed (e.g., sha256).
- A key MUST include all options/versions that change the result **of its layer** (cf. `DB_SCHEMA` §4).  
  Normative examples: `locale` belongs in `snapshot_key`; `copy_ready` belongs in `audit_key`; `copy_ready` does not affect `run_key`.
- No key depends on `now()`; timestamps come from snapshot/capture.
- Identical rerun => same result OR cache hit at the expected layer.

Note: the exact details of the fields composing each key are documented elsewhere (DB schema / cache spec). Here: invariants only.

---

## 6) Internal contracts (JSON)
> These contracts are **internal** to orchestration. They do not change exported schemas.

### 6.1 AuditJobRequest (internal)
```json
{
  "mode": "solo",
  "locale": "fr",
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  },
  "urls": {
    "page_a": "https://example.com/products/abc"
  },
  "options": {
    "copy_ready": false
  }
}
```

DUO AB (internal)
```json
{
  "mode": "duo_ab",
  "locale": "en",
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  },
  "urls": {
    "page_a": "https://brand-a.com/products/x",
    "page_b": "https://brand-b.com/products/y"
  },
  "options": {
    "copy_ready": true
  }
}
```

DUO Before/After (internal)
```json
{
  "mode": "duo_before_after",
  "locale": "fr",
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  },
  "urls": {
    "before": "https://example.com/products/abc?v=2026-12-01",
    "after": "https://example.com/products/abc?v=2026-01-10"
  },
  "options": {
    "copy_ready": false
  }
}
```

### 6.2 AuditJobResult (internal) — examples per mode

SOLO (internal) — example
```json
{
  "status": "ok",
  "mode": "solo",
  "keys": {
    "product_key": "prod_...",
    "snapshot_key": "snap_...",
    "run_key": "run_...",
    "audit_key": "audit_...",
    "render_key": "render_..."
  },
  "versions": {
    "REPORT_OUTLINE_VERSION": "3.1",
    "TICKET_SCHEMA_VERSION": "2",
    "EVIDENCE_SCHEMA_VERSION": "2",
    "CSV_EXPORT_VERSION": "1",
    "DETECTORS_SPEC_VERSION": "1.3",
    "NORMALIZE_VERSION": "x.y.z",
    "SCORING_VERSION": "x.y.z",
    "ENGINE_VERSION": "x.y.z",
    "RENDER_VERSION": "x.y.z"
  },
  "report_meta": {
    "evidence_completeness": "partial",
    "alignment_level": null
  },
  "artifacts": {
    "html_ref": "storage://.../report.html",
    "pdf_ref": "storage://.../report.pdf",
    "csv_ref": "storage://.../tickets.csv"
  },
  "exports": {
    "tickets": [],
    "evidences": []
  },
  "errors": [],
  "timings_ms": {
    "capture_total": 0,
    "detectors_total": 0,
    "scoring_total": 0,
    "report_total": 0,
    "render_pdf_total": 0,
    "end_to_end": 0
  }
}
```

DUO AB (internal) — example
```json
{
"status": "ok",
"mode": "duo_ab",
"keys": {
"product_key": "prod_...",
"snapshot_key": "snap_...",
"run_key": "run_...",
"audit_key": "audit_...",
"render_key": "render_..."
},
"versions": {
"REPORT_OUTLINE_VERSION": "3.1",
"TICKET_SCHEMA_VERSION": "2",
"EVIDENCE_SCHEMA_VERSION": "2",
"CSV_EXPORT_VERSION": "1",
"DETECTORS_SPEC_VERSION": "1.3",
"NORMALIZE_VERSION": "x.y.z",
"SCORING_VERSION": "x.y.z",
"ENGINE_VERSION": "x.y.z",
"RENDER_VERSION": "x.y.z"
},
"report_meta": {
"evidence_completeness": "partial",
"alignment_level": "medium"
},
"artifacts": {
"html_ref": "storage://.../report.html",
"pdf_ref": "storage://.../report.pdf",
"csv_ref": "storage://.../tickets.csv"
},
"exports": { "tickets": [], "evidences": [] },
"errors": [],
"timings_ms": { "capture_total": 0, "detectors_total": 0, "scoring_total": 0, "report_total": 0, "render_pdf_total": 0, "end_to_end": 0 }
}
```

DUO Before/After (internal) — example
```json
{
"status": "ok",
"mode": "duo_before_after",
"keys": {
"product_key": "prod_...",
"snapshot_key": "snap_...",
"run_key": "run_...",
"audit_key": "audit_...",
"render_key": "render_..."
},
"versions": {
"REPORT_OUTLINE_VERSION": "3.1",
"TICKET_SCHEMA_VERSION": "2",
"EVIDENCE_SCHEMA_VERSION": "2",
"CSV_EXPORT_VERSION": "1",
"DETECTORS_SPEC_VERSION": "1.3",
"NORMALIZE_VERSION": "x.y.z",
"SCORING_VERSION": "x.y.z",
"ENGINE_VERSION": "x.y.z",
"RENDER_VERSION": "x.y.z"
},
"report_meta": {
"evidence_completeness": "partial",
"alignment_level": "medium"
},
"artifacts": {
"html_ref": "storage://.../report.html",
"pdf_ref": "storage://.../report.pdf",
"csv_ref": "storage://.../tickets.csv"
},
"exports": { "tickets": [], "evidences": [] },
"errors": [],
"timings_ms": { "capture_total": 0, "detectors_total": 0, "scoring_total": 0, "report_total": 0, "render_pdf_total": 0, "end_to_end": 0 }
}
```

Normative:
- `exports.tickets[]` compliant with **Ticket v2**.
- `exports.evidences[]` compliant with **Evidence v2**.
- `artifacts.csv_ref` compliant with **CSV v1** (no added column).
- SOLO: `report_meta.alignment_level = null`; DUO: `high|medium|low` (see §9.2).

---

## 7) Errors + SSOT mapping “Missing evidence reason”
### 7.1 SSOT enum (non-negotiable)
Any `missing_evidence_reason` MUST be `null` or one of the 6 SSOT enums:
- `blocked_by_cookie_consent`
- `blocked_by_popup`
- `infinite_scroll_or_lazyload`
- `navigation_intercepted`
- `timeout`
- `unknown_render_issue`

### 7.2 Error (internal pipeline)
```json
{
  "code": "CAPTURE_TIMEOUT",
  "stage": "capture",
  "message": "Navigation timed out on mobile viewport",
  "missing_evidence_reason": "timeout",
  "source": "page_a"
}
```

- `stage`: `normalize|capture|detectors|scoring|report|render_pdf|storage|unknown`
- `source`: `page_a|page_b|before|after|na`

Anti-drift note:
- Internal detector errors (`DETECTORS_SPEC`: stages `dom_query|screenshot|network|lighthouse|dependency|unknown`) MUST NOT be copied as-is into pipeline `errors[]`.
- Pipeline `errors[]` only exposes the **macro** `stage` above. Detector details remain internal (e.g., logs or `Evidence.details`).

### 7.3 Assignment rules (recommended, conservative)
- Navigation / screenshot / measurement timeout => `timeout`
- Cookie overlay present and not bypassable => `blocked_by_cookie_consent`
- Blocking popup/chat not bypassable => `blocked_by_popup`
- Infinite scroll / lazyload preventing stable capture => `infinite_scroll_or_lazyload`
- Redirects / navigation intercept / antibot => `navigation_intercepted`
- Render crash / empty DOM / major inconsistency => `unknown_render_issue`

If multiple causes are plausible: choose the **most explanatory**; if unsure: `unknown_render_issue`.

---

## 8) Determinism (hard rules)
1) **Stable ordering then truncation**: always sort with a stable key before limiting (N).
2) **Deterministic IDs**: `ticket_id` and `evidence_id` formats = SSOT (`SCORING_AND_DETECTION`).
3) **HTML anchors** (SSOT-friendly):
   - `id="ticket-<ticket_id>"`
   - `id="evidence-<evidence_id>"`
4) **No random / no now()**: no randomness, no sampling, no clock in results.
5) **Stable rounding**: Rect = int px; Money = rounded to 2 decimals (internal calculation in cents recommended).

---

## 9) End-to-end orchestration (normative)
### 9.1 Steps
1) **Normalize** URL(s) -> `product_key` (NORMALIZE_VERSION)
2) **Capture** per source (SSOT viewports): DOM + screenshots (+ optional network_log + optional lighthouse)
3) **Detectors** per source (facts-only, `DETECTORS_SPEC`)
4) **Scoring** (`SCORING_VERSION`, `SCORING_AND_DETECTION`):
   - facts -> `evidences[]` (v2) + `tickets[]` (v2)
   - apply stable ordering + caps + SSOT diversity rules
   - in DUO: apply SSOT comparison rules / limitations
5) **Build HTML report (SSOT)** (`REPORT_OUTLINE`)
6) **Render PDF** via Playwright **from HTML SSOT only** (`RENDER_VERSION`)
7) **Export CSV v1** from tickets v2 (SSOT)
8) **Persist** artefacts + metadata + errors + timings

### 9.2 DUO: `alignment_level` (SSOT)
`REPORT_OUTLINE` defines semantics and consequences (high/medium/low).

Pipeline decision (conservative, anti-support):
- `low` if:
  - a source has `evidence_completeness=insufficient`, or
  - minimum comparable evidence cannot be established (e.g., blocking overlays, navigation intercept, repeated timeouts)
- `high` only if:
  - both sources have a high-quality evidence pack (at least Set A), and
  - “section by section” alignment is provable via evidences (no inference)
- otherwise `medium`

If `alignment_level=low`: apply the DUO caps/limitations defined in `REPORT_OUTLINE` (notably reduced comparative tickets, explicit limitations).

---

## 10) Degraded mode (graceful degradation)
### 10.1 Principle
A partial failure must not prevent delivery.
- Deliver a complete report + explicit limitations.
- Move to Appendix any ticket depending on missing evidence (or lower `confidence`), per SSOT rules.

### 10.2 Cases & rules
- **DOM unavailable**:
  - DOM detectors => `available=false` + SSOT reason
  - scoring: avoid disputable claims; Appendix-only if evidence is weak
- **Insufficient screenshots**:
  - `evidence_completeness` per SSOT
  - “Missing evidence” table visible (SSOT reason + impact)
- **network_log absent**:
  - no reliable bytes measurement; fallback to evidence type `detection` (level C) if possible, otherwise omission
- **Lighthouse unavailable**:
  - no invented metrics; lab-only when available; otherwise omission / Appendix

### 10.3 Screenshot B rule (SSOT)
If a detector uses `method="screenshot_b"`:
- **ultra conservative** facts, only visually obvious
- no business conclusions that are not provable
- scoring adjusts `confidence` and/or relegates (Appendix) if needed

---

## 11) Copy-ready (AI add-on) - SSOT lock
- Copy-ready applies only to the **Top 5 tickets** (SSOT rule).
- The copy-ready format follows `REPORT_OUTLINE` strictly.
- If evidence is insufficient: `assertive_version = null` (SSOT).

---

## 12) DoD (Definition of Done)
- SOLO + DUO (AB & Before/After) produce: **HTML SSOT**, **PDF Playwright**, **CSV v1**.
- `tickets[]` and `evidences[]` are SSOT-compliant (v2/v2); CSV is v1-compliant; **no added column**.
- `evidence_completeness` visible (Cover) + “Missing evidence” table if != complete (reason ∈ 6 enums).
- DUO: `alignment_level` visible + limitations/caps applied if low (OUTLINE).
- Deterministic IDs + anchors `ticket-...` / `evidence-...`.
- Degraded mode validated: report delivered even in case of partial failure.
- Observability: timings per step + error traces; identical rerun => expected cache hit.
