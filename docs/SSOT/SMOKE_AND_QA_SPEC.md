# ShopifyStrategist — SMOKE_AND_QA_SPEC.md (SSOT)

## Owned Concepts (Canonical)
- TBD

## Not Owned (References)
- TBD

- **SMOKE_AND_QA_SPEC_VERSION :** 1.2
- **Goal :** Define the **smoke tests** and **QA gates** that guarantee anti-drift on the API and deliverables (**HTML SSOT**, **PDF strictly derived**, CSV v1, Ticket/Evidence v2 exports).
- **Scope :** A test contract (no code), focused on:
  - schemas/exports, enums, versions,
  - determinism (**IDs / sorting / truncations / keys**),
  - DUO sources + `alignment_level`,
  - degraded mode + `errors[]`,
  - anchors (`Evidence.ref`) + HTML wrappers (`ticket-*`, `evidence-*`),
  - rules “HTML SSOT ⇒ ok” + allowed nulls.

---

## 0) SSOT references (source of truth)

- `docs/SSOT/API_DOC.md` (API contract: schemas, enums, sorting, `errors[]`, versions)
- `docs/SSOT/REPORT_OUTLINE.md` (HTML SSOT structure, sections, “Missing evidence”)
- `docs/SSOT/SCORING_AND_DETECTION.md` (Ticket/Evidence v2, scoring, evidence_completeness, diversity rules, sorting)
- `docs/SSOT/EVIDENCE_PACK_SPEC.md` (Evidence anchors, evidence sorting, “Missing evidence” HTML-only)
- `docs/SSOT/AUDIT_PIPELINE_SPEC.md` (macro stages, keys, copy_ready scope, degraded mode)
- `docs/SSOT/DB_SCHEMA.md` (key determinism, constraint “HTML exists ⇒ ok”)
- `docs/SSOT/DETECTORS_SPEC.md` (facts-only, determinism, prohibition of internal leaks)
- `docs/SSOT/SPEC.md` (invariants: HTML SSOT, derived PDF, evidence-based)

> Anti-drift rule: if a rule is already SSOT elsewhere, **reference** it instead of redefining it.

---

## 1) Definitions

### 1.1 Smoke test
An end-to-end execution via the API that verifies:
- API response compliance (schemas, enums, versions),
- generated deliverables (HTML SSOT mandatory, PDF/CSV best-effort),
- determinism on rerun (IDs, sorting, truncations, keys),
- degraded mode handling (`errors[]` compliant, without breaking `ok` if HTML exists).

### 1.2 QA gate
A **release-blocking** condition. If a gate fails: release is blocked.

### 1.3 Key principle: “keys ≠ storage refs”
- `keys.*` : **deterministic**, used to prove anti-drift.
- `artifacts.*_ref` : storage references (may vary), **do not** prove determinism.

### 1.4 Smoke fixtures / environments
- Smoke tests MUST run on **stable** URLs (fixtures) and be versioned in the project (controlled list).
- “Degraded” fixtures (cookie/popup/…) MUST be **reproducible**.
- Smokes MUST NOT depend on an unstable third-party site (otherwise flakiness = false negatives).

---

## 2) Required smoke scenarios (minimum)

> All scenarios MUST be executed with `render.pdf=true` and `render.csv=true`, and then at least:
> - one variant `render.pdf=false`,
> - one variant `render.csv=false`,
> to validate allowed nulls.

### S1 — SOLO Instant (baseline)
- Endpoint : `POST /api/audit-solo`
- Options : `copy_ready=false`
- Expected:
  - `status="ok"`
  - `mode="solo"`
  - `report_meta.alignment_level = null`
  - `artifacts.html_ref` non-null (HTML SSOT)
  - valid `exports.tickets[]` and `exports.evidences[]` (Ticket v2 / Evidence v2)
  - `errors[]` empty on a “healthy” fixture; otherwise see §6
  - `versions` present **according to `docs/SSOT/API_DOC.md`** (this document does not redefine the list)

### S2 — SOLO Client-Ready (copy-ready)
- Endpoint : `POST /api/audit-solo`
- Options : `copy_ready=true`
- Expected (in addition to S1):
  - **Exports strictly unchanged vs S1**: same `ticket_id`, same `evidence_id`, same order, same exported content (tickets/evidences/CSV).
  - Allowed diff: HTML/PDF (copy-ready in HTML), `errors[]` unchanged.
  - **Expected keys (anti-drift)**:
    - `run_key` **identical** to S1 (copy_ready does not change the run),
    - `audit_key` and `render_key` **may** change (because HTML/PDF change).

### S3 — DUO AB
- Endpoint : `POST /api/audit-duo`
- `compare_type="ab"` (page_a vs page_b)
- Expected:
  - `status="ok"`
  - `mode="duo_ab"`
  - `report_meta.alignment_level ∈ {high, medium, low}`
  - `report_meta.evidence_completeness` = **worst of sources** (page_a/page_b) (cf. §5.3)
  - `errors[]` : each entry has `source ∈ {page_a, page_b, na}`

### S4 — DUO Before/After
- Endpoint : `POST /api/audit-duo`
- `compare_type="before_after"` (before vs after)
- Expected:
  - `status="ok"`
  - `mode="duo_before_after"`
  - `report_meta.alignment_level ∈ {high, medium, low}`
  - `report_meta.evidence_completeness` = **worst of sources** (before/after) (cf. §5.3)
  - `errors[]` : each entry has `source ∈ {before, after, na}`

---

## 3) QA anti-drift gates (release-blocking)

### 3.1 Export schemas (strict)
- No ticket without `evidence_refs[]` (>=1).
- `ticket_id` and `evidence_id` comply with SSOT formats.
- No exported field added (Ticket/Evidence/CSV).
- `Evidence.ref` is **exactly** : `#evidence-<evidence_id>`.

### 3.2 HTML wrappers / anchors (SSOT)
From the HTML pointed to by `artifacts.html_ref`:
- For each `exports.evidences[]` : an element exists with `id="evidence-<evidence_id>"`.
- For each `exports.tickets[]` : an element exists with `id="ticket-<ticket_id>"`.
- Each `ticket.evidence_refs[]` references an existing `evidence_id` in `exports.evidences[]`.

> Gate: if a single anchor/wrapper is missing → FAIL (SSOT navigability is broken).

### 3.3 Determinism IDs / sorting / truncations / diversity (normative)
- Tickets:
  - stable order according to SSOT (API_DOC / SCORING),
  - truncations: **sort then truncate** (never sampling),
  - respect **caps** defined SSOT (without redefining numbers here),
  - respect **diversity rules** SSOT (API_DOC / SCORING).
- Evidences:
  - stable order according to SSOT (API_DOC / EVIDENCE_PACK_SPEC),
  - timestamps come from snapshot/capture (forbidden: render timestamp),
  - respect **caps** defined SSOT.

### 3.4 Exposed versions (anti-drift)
- `versions` and its keys MUST comply with the contract of `docs/SSOT/API_DOC.md`.
- Adding/removing/renaming a version key = **mandatory SSOT patch** (API_DOC first), otherwise FAIL QA.

### 3.5 Errors: macro enums only + no internal leak
- Each entry in `errors[]` complies with:
  - `stage` ∈ **macro** enum (API_DOC),
  - `source` ∈ SSOT enum:
    - SOLO: `na` only,
    - DUO AB: `page_a|page_b|na`,
    - DUO Before/After: `before|after|na`,
  - `missing_evidence_reason` ∈ SSOT enum (if applicable).
- Forbidden: exposing detector names, internal modules, or non-SSOT sub-stages.

### 3.6 SOLO vs DUO: `alignment_level` (contract)
- SOLO: `report_meta.alignment_level` MUST be `null`.
- DUO: `report_meta.alignment_level` MUST be in `{high, medium, low}`.

### 3.7 Consistency `evidence_completeness` ↔ capture errors
- If an `errors[]` entry has non-null `missing_evidence_reason` ⇒ `report_meta.evidence_completeness` **cannot** be `complete`.
- If `report_meta.evidence_completeness == "complete"` ⇒ no capture error MUST carry `missing_evidence_reason`.

---

## 4) HTML gates: “Missing evidence” (SSOT)

### 4.1 Conditional display
- If `report_meta.evidence_completeness != "complete"`:
  - a **“Missing evidence”** section MUST exist in the HTML.
- If `report_meta.evidence_completeness == "complete"`:
  - the “Missing evidence” section MAY be absent.

### 4.2 Reasons vocabulary (6 reasons)
The “Missing evidence” section uses only the 6 SSOT reasons (API_DOC / EVIDENCE_PACK_SPEC), with no variants.

### 4.3 DUO: per-source details (HTML-only)
In DUO, the “Missing evidence” section MUST state details **per source** (page_a/page_b or before/after).  
The cover always reflects the **worst of sources**: `insufficient > partial > complete`.

### 4.4 Linking errors ↔ “Missing evidence” (anti-drift)
For each `errors[]` entry with `stage="capture"` and non-null `missing_evidence_reason`:
- the “Missing evidence” section MUST include a corresponding item (at minimum: **source + reason**).

---

## 5) `evidence_completeness` gates (SSOT)

### 5.1 Mapping (hard rule)
Mapping gating screenshots → `report_meta.evidence_completeness`:
- **Set A present** ⇒ `complete`
- **Set B present** and **Set A absent** ⇒ `partial`
- **No set** ⇒ `insufficient`

### 5.2 SOLO: result
- The smoke verifies that the returned value matches the mapping above, on fixtures explicitly built (A only / B only / none).

### 5.3 DUO: cover aggregation (worst of sources)
- In DUO, the computation is **per source** (internal) and the cover displays the **worst of sources**:
  - `insufficient > partial > complete`
- Per-source proof is visible in the HTML “Missing evidence” section (HTML-only).

---

## 6) Degraded-case matrix (mandatory)

> Goal: prove the stack remains deliverable (HTML SSOT) and explicitly states its limits via `errors[]`, without breaking invariants.

| Degraded case | Symptom (high level) | Expected `status` | Expected `errors[]` (minimum) | Expected `missing_evidence_reason` | Deliverable notes |
|---|---|---|---|---|---|
| cookie | blocked by consent | ok if HTML exists | 1+ error `stage="capture"` + `source` | `blocked_by_cookie_consent` | “Missing evidence” visible if completeness != complete |
| popup | blocking popup | ok if HTML exists | 1+ error `stage="capture"` + `source` | `blocked_by_popup` | same |
| timeout | capture timeout | ok if HTML exists | 1+ error `stage="capture"` + `source` | `timeout` | same |
| navigation_intercepted | redirect / navigation intercepted | ok if HTML exists | 1+ error `stage="capture"` + `source` | `navigation_intercepted` | same |
| infinite_scroll_or_lazyload | elements never load | ok if HTML exists | 1+ error `stage="capture"` + `source` | `infinite_scroll_or_lazyload` | same |
| unknown_render_issue | unclassified capture error | ok if HTML exists | 1+ error `stage="capture"` + `source` | `unknown_render_issue` | same |

Rules:
- `missing_evidence_reason` is populated **only** for evidence/capture-related errors.
- For errors not related to evidence (e.g., storage), `missing_evidence_reason` MUST remain `null`.

---

## 7) Rules “HTML SSOT ⇒ ok” + allowed nulls

### 7.1 Status
- If `artifacts.html_ref` is non-null ⇒ `status="ok"` (even if degraded).
- If `status="error"` ⇒ `artifacts.html_ref` MUST be `null` (no SSOT deliverable possible).

### 7.2 PDF / CSV (best-effort)
- `artifacts.pdf_ref` MAY be `null` if:
  - PDF rendering is disabled (`render.pdf=false`), or
  - rendering/storage fails (then `errors[]` reflects an SSOT macro stage, e.g., `render_pdf` or `storage`).
- `artifacts.csv_ref` MAY be `null` if:
  - CSV rendering is disabled (`render.csv=false`), or
  - storage fails (then `errors[]` reflects `storage`).

---

## 8) Rerun tests (deterministic keys + export stability)

### 8.1 Rerun “same request”
Rerun the exact same payload:
- same `ticket_id` / `evidence_id`,
- same order (tickets/evidences),
- same `report_meta.*`,
- same expected `keys.*` (determinism per DB_SCHEMA),
- `artifacts.*_ref`: not used as proof of determinism.

### 8.2 Rerun “same request” with `copy_ready` toggled
Same payload except `copy_ready`:
- exports unchanged (IDs/order/exported content),
- `run_key` identical,
- `audit_key`/`render_key` may change (if HTML/PDF change).

### 8.3 Rerun “by key”
When the API supports rerun by `snapshot_key`/`run_key`/`audit_key`/`render_key`:
- rerun by key reproduces the same exports and the same HTML SSOT (if same versions and same applicable options).

### 8.4 Render variants (pdf/csv)
- `render.pdf=false`:
  - `status="ok"` if HTML exists,
  - `artifacts.pdf_ref` MAY be `null`,
  - no error is required if non-generation is intentional.
- `render.csv=false`:
  - `artifacts.csv_ref` MAY be `null`,
  - JSON exports (tickets/evidences) remain present.

> Gate: an option “disable render” MUST NOT cause `status="error"` if HTML exists.

---

## 9) DoD (Definition of Done) — SMOKE & QA

- [ ] S1 SOLO Instant: OK (HTML SSOT, valid exports, stable sorting, versions compliant with API_DOC).
- [ ] S2 SOLO Client-Ready: exports strictly identical to S1 (IDs/order/exported content) + identical `run_key`.
- [ ] S3 DUO AB: OK + `alignment_level` enum + `evidence_completeness` = worst of sources.
- [ ] S4 DUO Before/After: OK + `alignment_level` enum + `evidence_completeness` = worst of sources.
- [ ] HTML anchors: wrappers `ticket-*` and `evidence-*` present and consistent with exports.
- [ ] `Evidence.ref` = `#evidence-<evidence_id>` (hard rule).
- [ ] “Missing evidence”: present if completeness != complete + 6-reasons vocabulary + **linked to capture errors** + per-source detail in DUO.
- [ ] Degraded: 6 cases covered with `errors[]` + SSOT `missing_evidence_reason`, with no internal leak.
- [ ] Allowed nulls: PDF/CSV may be null without breaking `status="ok"` if HTML exists.
- [ ] Rerun: stable IDs/sorting + deterministic `keys.*` (storage refs not used as proof).
- [ ] No schema drift: no exported field / CSV column added.
- [ ] Caps + diversity compliance: compliant with SSOT (SCORING/API_DOC), without redefinition here.
