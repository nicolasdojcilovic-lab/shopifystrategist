# ShopifyStrategist — DB_SCHEMA.md (SSOT)

**DB_SCHEMA_VERSION:** 1.0  
**Status:** SSOT (DB schema + deterministic keys + anti-drift invariants)  
**Target:** Supabase (Postgres + Storage)

## 0) Purpose

Define the **minimum** set of tables/relations needed for the MVP to support:
- End-to-end pipeline: normalize → capture → detectors → scoring → HTML report (SSOT) → PDF (Playwright) → CSV v1
- Multi-layer cache via **deterministic keys**
- Idempotence (same inputs + same versions ⇒ same outputs)
- Retention of evidence packs (auditability) without creating new public export fields

## 1) SSOT references (source of truth)

- `docs/SSOT/SPEC.md` (HTML=SSOT, multi-layer cache, versioning, observability)
- `docs/SSOT/REPORT_OUTLINE.md` (V3.1): report structure, Ticket v2, Evidence v2, CSV v1
- `docs/SSOT/SCORING_AND_DETECTION.md` (v2.2): ID formats, stable ordering, screenshot gating, reasons (6), DUO rules
- `docs/SSOT/AUDIT_PIPELINE_SPEC.md`: orchestration + macro errors
- `docs/SSOT/EVIDENCE_PACK_SPEC.md`: Evidence.ref (anchor), evidence pack determinism
- `docs/SSOT/API_DOC.md`: public envelopes (keys + versions + artifacts + exports)

> Anti-drift: this document changes **no public export schema** (Ticket v2 / Evidence v2 / CSV v1).  
> Any additional field = **internal DB** or `Evidence.details` (without changing the export).

## 2) Invariants (non-negotiable)

1) **HTML report = SSOT**; PDF is strictly derived from HTML (Playwright).  
2) **Evidence-based**: no exported ticket without `evidence_refs[]` (>= 1).  
3) **Determinism**: same effective inputs + same versions ⇒ same keys, same IDs, same ordering, same truncations, same exports.  
4) **No RUM**: performance/weight = lab best-effort; no “real user” data.  
5) **No new export field** (tickets/evidence/csv).  
6) **DUO**: evidence_completeness is computed **per source** and the cover shows the **worst** (insufficient > partial > complete). Per-source detail = HTML-only.  
7) **Reasons (6)**: `missing_evidence_reason` ∈ {blocked_by_cookie_consent, blocked_by_popup, infinite_scroll_or_lazyload, navigation_intercepted, timeout, unknown_render_issue} or `null`.

## 3) Conceptual model (multi-layer cache)

Logical layer → pivot table → key:
- **Normalized product** → `products` → `product_key`
- **Snapshot capture** (DOM + screenshots + optional artifacts) → `snapshots` (+ `snapshot_sources`) → `snapshot_key`
- **Scoring run** (facts→evidences+tickets, ordering, caps) → `score_runs` → `run_key`
- **Audit report HTML (SSOT)** → `audit_jobs` → `audit_key`
- **Renders** (PDF + CSV + storage refs) → `audit_renders` → `render_key`

Each layer is:
- **addressable** via a deterministic key,
- **immutable** once written (except purely operational fields: retry_count, last_error_at, etc.),
- **replayable**: an identical rerun MUST cache-hit at the highest available layer.

## 4) Deterministic keys (where they live, what they are for)

### 4.1 Common derivation rule (normative)

Each key is derived from:
1) a **canonical JSON** (stable key ordering, lists sorted when order is not semantic),
2) a hash (e.g., sha256),
3) a readable prefix: `prod_`, `snap_`, `run_`, `audit_`, `render_`.

Forbidden:
- depending on `now()` or a render timestamp,
- depending on a non-stable order,
- omitting an option/version that changes the result.

The DB always stores:
- `*_key` (text)
- `canonical_input` (jsonb): the exact canonical JSON used for the hash
- `versions` (jsonb): versions that impact the layer

### 4.2 `product_key`
**Purpose:** group audits of the “same object” (SOLO or DUO) independently of runs.

Canonical input (minimum):
- `mode` (solo|duo_ab|duo_before_after)
- `normalized_urls`:
  - SOLO: `{ "page_a": "<normalized_url>" }`
  - DUO AB: `{ "page_a": "...", "page_b": "..." }`
  - DUO BA: `{ "before": "...", "after": "..." }`
- `NORMALIZE_VERSION`

Notes:
- **SSOT rule (anti-drift):** `locale` is **not** part of `product_key`.  
  Language separation lives at the `snapshot_key` level (and beyond).  
  Consequence: any locale isolation is done via snapshots/runs/audits, not via `product_key`.

### 4.3 `snapshot_key`
**Purpose:** identify a capture pack (per source): DOM + screenshots + optional artifacts.

Canonical input (minimum):
- `product_key`
- `locale`
- `viewports` (mobile 390×844, desktop 1440×900)
- capture options that change artifacts (e.g., user-agent/preset if applicable)
- `ENGINE_VERSION` (if this is the version that carries capture/orchestration)
- (optional) stable “capture_profile” if you have multiple (otherwise omit)

### 4.4 `run_key`
**Purpose:** identify a stable scoring output: facts (detectors) → evidences v2 + tickets v2, ordering + caps + diversity rules.

Canonical input (minimum):
- `snapshot_key`
- `DETECTORS_SPEC_VERSION`
- (optional) effective detector versions if they are independent from `DETECTORS_SPEC_VERSION`
- `SCORING_VERSION`
- `mode` (solo|duo_ab|duo_before_after)
- scoring options that exist in the MVP — **not** `copy_ready`

### 4.5 `audit_key`
**Purpose:** identify an HTML SSOT (V3.1 structure + content).

Canonical input (minimum):
- `run_key`
- `REPORT_OUTLINE_VERSION`
- HTML options that change the SSOT rendering:
  - `copy_ready` (because HTML changes)
  - light white-label (if enabled and parameterized)

### 4.6 `render_key`
**Purpose:** identify derived renders (PDF/CSV) for an audit.

Canonical input (minimum):
- `audit_key`
- `RENDER_VERSION`
- `CSV_EXPORT_VERSION`
- render options (PDF format if parameterizable)

## 5) Tables (MVP) — columns & constraints

> Indicative types: `uuid`, `text`, `timestamptz`, `jsonb`, `int`, `bool`.  
> MVP goals: **few tables**, **unique keys**, **immutability**, **minimal observability**.

### 5.1 `products`
**Role:** “normalized product” root (SOLO or DUO)

Columns:
- `id` (uuid, PK)
- `product_key` (text, UNIQUE, NOT NULL)
- `mode` (text, NOT NULL) — `solo|duo_ab|duo_before_after`
- `normalized_urls` (jsonb, NOT NULL) — see §4.2
- `versions` (jsonb, NOT NULL) — includes `NORMALIZE_VERSION`
- `canonical_input` (jsonb, NOT NULL)
- `created_at` (timestamptz)
- `first_seen_at` (timestamptz)
- `last_seen_at` (timestamptz)

Constraints:
- UNIQUE(`product_key`)
- `mode` ∈ SSOT enum

### 5.2 `snapshots`
**Role:** “logical” capture pack (can aggregate multiple sources for DUO)

Columns:
- `id` (uuid, PK)
- `snapshot_key` (text, UNIQUE, NOT NULL)
- `product_key` (text, FK → products.product_key, NOT NULL)
- `locale` (text, NOT NULL) — `fr|en` (MVP)
- `viewports` (jsonb, NOT NULL) — mobile/desktop
- `capture_meta` (jsonb, NOT NULL) — stable info (UA/profile if applicable)
- `versions` (jsonb, NOT NULL) — includes `ENGINE_VERSION` (+ NORMALIZE_VERSION if useful)
- `canonical_input` (jsonb, NOT NULL)
- `created_at` (timestamptz)
- `completed_at` (timestamptz, nullable)
- `status` (text, NOT NULL) — `ok|partial|failed` (internal)
- `errors` (jsonb, NOT NULL, default `[]`) — capture errors (internal, macro stage if you want reuse)
- `timings_ms` (jsonb, NOT NULL, default `{}`)

Constraints:
- UNIQUE(`snapshot_key`)
- FK(`product_key`) → products
- `locale` ∈ `fr|en`

### 5.3 `snapshot_sources`
**Role:** per-source detail (page_a/page_b/before/after): urls, timestamps, available artifacts

Columns:
- `id` (uuid, PK)
- `snapshot_key` (text, FK → snapshots.snapshot_key, NOT NULL)
- `source` (text, NOT NULL) — `page_a|page_b|before|after`
- `url` (text, NOT NULL) — normalized url used
- `captured_at` (timestamptz, NOT NULL) — capture timestamp (source of truth for Evidence.timestamp)
- `artefacts` (jsonb, NOT NULL) — availability + internal storage refs (dom_ref, screenshot_refs, network_log_ref, lighthouse_ref)
- `evidence_completeness` (text, NOT NULL) — `complete|partial|insufficient` (SSOT computed per source)
- `missing_evidence` (jsonb, NOT NULL, default `[]`) — items {reason, artifact_name} (HTML-only in the end, but useful internal storage)
- `created_at` (timestamptz)

Constraints:
- UNIQUE(`snapshot_key`,`source`)
- `source` ∈ SSOT enum
- `evidence_completeness` ∈ `complete|partial|insufficient`

### 5.4 `score_runs`
**Role:** deterministic scoring result: evidences v2 + tickets v2 + errors + timings

Columns:
- `id` (uuid, PK)
- `run_key` (text, UNIQUE, NOT NULL)
- `snapshot_key` (text, FK → snapshots.snapshot_key, NOT NULL)
- `mode` (text, NOT NULL)
- `versions` (jsonb, NOT NULL) — includes `DETECTORS_SPEC_VERSION`, `SCORING_VERSION`
- `canonical_input` (jsonb, NOT NULL)
- `exports` (jsonb, NOT NULL) — `{ tickets: [...Ticket v2...], evidences: [...Evidence v2...] }`
- `errors` (jsonb, NOT NULL, default `[]`) — macro errors (pipeline stage)
- `timings_ms` (jsonb, NOT NULL, default `{}`)
- `created_at` (timestamptz)
- `completed_at` (timestamptz, nullable)
- `status` (text, NOT NULL) — `ok|degraded|failed` (internal)

Constraints:
- UNIQUE(`run_key`)
- FK(`snapshot_key`) → snapshots

Anti-drift notes:
- `exports.evidences[].ref` MUST remain `#evidence-<evidence_id>` (HTML anchor).
- Any storage/path/json pointer goes into `exports.evidences[].details`.

### 5.5 `audit_jobs`
**Role:** HTML SSOT (V3.1 structure) + “report_meta” metadata

Columns:
- `id` (uuid, PK)
- `audit_key` (text, UNIQUE, NOT NULL)
- `run_key` (text, FK → score_runs.run_key, NOT NULL)
- `mode` (text, NOT NULL)
- `report_meta` (jsonb, NOT NULL) — `{ evidence_completeness, alignment_level }`
- `versions` (jsonb, NOT NULL) — includes `REPORT_OUTLINE_VERSION` (+ other useful versions)
- `canonical_input` (jsonb, NOT NULL)
- `html_ref` (text, NOT NULL) — storage ref to HTML SSOT
- `html_content_hash` (text, NOT NULL) — HTML hash (drift detection)
- `created_at` (timestamptz)
- `completed_at` (timestamptz, nullable)
- `status` (text, NOT NULL) — `ok|degraded|failed` (internal)
- `errors` (jsonb, NOT NULL, default `[]`) — macro errors (pipeline stage)
- `timings_ms` (jsonb, NOT NULL, default `{}`)

Constraints:
- UNIQUE(`audit_key`)
- FK(`run_key`) → score_runs
- SOLO: `report_meta.alignment_level` MUST be `null`
- DUO: `report_meta.alignment_level` ∈ `high|medium|low`

### 5.6 `audit_renders`
**Role:** derived renders: PDF + CSV (best effort)

Columns:
- `id` (uuid, PK)
- `render_key` (text, UNIQUE, NOT NULL)
- `audit_key` (text, FK → audit_jobs.audit_key, NOT NULL)
- `versions` (jsonb, NOT NULL) — includes `RENDER_VERSION`, `CSV_EXPORT_VERSION`
- `canonical_input` (jsonb, NOT NULL)
- `pdf_ref` (text, nullable) — null if render fails
- `csv_ref` (text, nullable) — null if export fails
- `created_at` (timestamptz)
- `completed_at` (timestamptz, nullable)
- `status` (text, NOT NULL) — `ok|partial|failed` (internal)
- `errors` (jsonb, NOT NULL, default `[]`) — stage `render_pdf|storage|...`
- `timings_ms` (jsonb, NOT NULL, default `{}`)

Constraints:
- UNIQUE(`render_key`)
- FK(`audit_key`) → audit_jobs

### 5.7 (Optional MVP but recommended) `request_log`
**Role:** observability + anti-abuse + minimal support (without coupling to cache)

Columns (minimum):
- `id` (uuid, PK)
- `received_at` (timestamptz)
- `request_id` (text, UNIQUE)
- `endpoint` (text) — `/api/audit-solo|/api/audit-duo`
- `request_hash` (text) — canonical payload hash (debug)
- `keys` (jsonb) — product/snapshot/run/audit/render if known
- `status` (text) — `ok|error`
- `http_status` (int)
- `error_code` (text, nullable)
- `duration_ms` (int, nullable)

## 6) Storage (Supabase) — internal refs (no export impact)

Principle:
- The DB stores internal `*_ref` pointers to Storage (e.g., `storage://...`), but **public exports** remain SSOT-compliant.
- `Evidence.ref` remains an **HTML anchor**. Storage paths (screenshots, dom, logs) go into `Evidence.details.storage_ref`.

Recommended structure (non-normative):
- `snapshots/<snapshot_key>/<source>/<viewport>/...`
- `runs/<run_key>/...` (exports JSON, traces)
- `audits/<audit_key>/report.html`
- `renders/<render_key>/report.pdf` and `tickets.csv`

## 7) Anti-drift: immutability & idempotence constraints

1) **Uniqueness**: each `*_key` is UNIQUE; writes MUST be “insert-if-absent” upserts.  
2) **Logical immutability**: if a record exists for a key, do not rewrite `exports`, `html_ref`, `pdf_ref`, etc. (unless the record is explicitly marked `failed` and a retry produces strictly the same hash).  
3) **Drift detection**:
   - `audit_jobs.html_content_hash` allows detecting any unexpected divergence for the same `audit_key`.
4) **Evidence pack retention**:
   - `score_runs.exports` is kept as-is (auditability), even if the HTML rendering evolves via a version bump.
5) **Strict vs best-effort separation**:
   - Operational fields (retry_count, last_error_at) may change without impacting outputs.
6) **Ordering & truncations**:
   - Store already-sorted lists (tickets/evidences) according to SSOT rules.
   - If internal truncation happens: annotate only in `Evidence.details` (e.g., `{truncated:true,...}`).

## 8) DoD — DB_SCHEMA (release gate)

- [ ] MVP tables present: `products`, `snapshots`, `snapshot_sources`, `score_runs`, `audit_jobs`, `audit_renders`
- [ ] UNIQUE on `product_key/snapshot_key/run_key/audit_key/render_key`
- [ ] `snapshot_sources` carries `evidence_completeness` **per source** + `missing_evidence` (internal)
- [ ] `audit_jobs.report_meta.evidence_completeness` = **worst of sources**
- [ ] SOLO: `alignment_level=null`; DUO: `high|medium|low`
- [ ] `score_runs.exports` stores Ticket v2 + Evidence v2 **without drift**
- [ ] Exported `Evidence.ref` = `#evidence-<evidence_id>`; storage refs only in `Evidence.details`
- [ ] `captured_at` (per source) is the source of truth for `Evidence.timestamp` (no `now()`)
- [ ] `html_content_hash` stored to detect drift for the same `audit_key`
- [ ] `pdf_ref/csv_ref` may be `null` on failure, without breaking `status="ok"` when HTML exists

