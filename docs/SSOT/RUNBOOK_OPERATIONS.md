# ShopifyStrategist — RUNBOOK_OPERATIONS.md (SSOT)

## Owned Concepts (Canonical)
- Operational procedures and release gates
- Fast Contract Check and drift prevention practices

## Not Owned (References)
- **Persistence**: Prisma with Supabase PostgreSQL
- **Capture**: Playwright-based capture (Desktop/Mobile)
- **Storage**: Supabase Storage Buckets

- **RUNBOOK_OPERATIONS_VERSION:** 1.2
- **Objective:** operational runbook to minimize support, prevent drift, and guarantee an “agency-grade” deliverable **even in degraded mode**.
- **Principle:** this document **does not redefine** SSOT rules; it **references** them and locks operational practices.

---

## 0) SSOT references (source of truth)

- `docs/SPEC.md` (product invariants)
- `docs/API_DOC.md` (API contracts, export schemas, enums, errors)
- `docs/REPORT_OUTLINE.md` (HTML SSOT structure)
- `docs/SCORING_AND_DETECTION.md` (sorting/truncations/caps/diversity rules, Ticket/Evidence v2)
- `docs/DETECTORS_SPEC.md` (facts-only, anti-leak)
- `docs/AUDIT_PIPELINE_SPEC.md` (pipeline, degraded mode, keys)
- `docs/EVIDENCE_PACK_SPEC.md` (Evidence.ref, evidence sorting, Missing evidence)
- `docs/DB_SCHEMA.md` (keys, idempotence, drift detection, `html_content_hash`)
- `docs/SMOKE_AND_QA_SPEC.md` (QA gates & smoke scenarios)

### 0.1 Contractual hierarchy (anti-drift)
- **API/deliverables:** `docs/API_DOC.md` is the contractual **authority**.
- **Release gates:** `docs/SMOKE_AND_QA_SPEC.md` is **release-blocking**.
- This runbook is **operational**: in case of divergence, **API_DOC + SMOKE** take precedence.

---

## 1) Operational invariants (reminder)

These rules are **release-blocking** in production.

1. **HTML report = SSOT.** PDF strictly derived from HTML (Playwright). (API_DOC, SPEC)
2. **Evidence-based:** no exported ticket without `evidence_refs[]` (>=1). (API_DOC)
3. **No RUM:** performance/weight metrics = **lab metrics** best-effort. (API_DOC)
4. **Export anti-drift:** no new exported field (Ticket v2 / Evidence v2 / CSV v1). Additional info = internal or `Evidence.details`. (API_DOC)
5. **Degraded mode:** if `artifacts.html_ref` exists, `status="ok"` MUST hold; limitations MUST appear in `errors[]` + “Missing evidence” if applicable. (API_DOC, REPORT_OUTLINE)
6. **SOLO / DUO (contract):**
   - SOLO: `report_meta.alignment_level = null`
   - DUO: `report_meta.alignment_level ∈ {high, medium, low}` (API_DOC)
7. **Anchors / wrappers (contract):**
   - `Evidence.ref` = `#evidence-<evidence_id>`
   - required HTML wrappers: `id="ticket-<ticket_id>"` and `id="evidence-<evidence_id>"` (API_DOC, REPORT_OUTLINE)
8. **DUO evidence:** `evidence_completeness` is computed **per source**; the cover exposes the **worst of sources**; per-source detail appears in “Missing evidence” (**HTML-only**). (API_DOC, EVIDENCE_PACK_SPEC)

### 1.1 Key principle: keys ≠ storage refs
- `keys.*` (e.g., `run_key`, `audit_key`, `render_key`): determinism / idempotence.
- `artifacts.*_ref`: storage references (may vary), **do not** prove determinism.

---

## 2) Support / ops intake (minimum signal)

### 2.1 Always ask for (copy/paste)
- **Type:** SOLO Instant / SOLO Client-Ready / DUO AB / DUO Before/After
- **Full Request JSON (redacted)** (API payload)
- **Full Response JSON (redacted)** (including `versions`, `keys`, `errors`, `artifacts`, `exports`)
- **Keys:** `product_key`, `snapshot_key`, `run_key`, `audit_key`, `render_key`
- **Artifacts:** `html_ref`, `pdf_ref`, `csv_ref`
- **In DUO:** `compare_type` + URLs `page_a/page_b` or `before/after`
- **Time / timezone**
- **If possible:** access to the HTML (because it is the SSOT)

### 2.2 Anti-support (what we refuse)
- “It doesn’t work” without payload/response → not actionable.
- Screenshot of the PDF only → insufficient (SSOT = HTML + JSON).

### 2.3 Redaction / security (mandatory)
Before sharing:
- mask tokens, cookies, sensitive headers, signed URLs, personal identifiers.
- if the URL contains sensitive parameters: provide a masked version + the `keys.*`.
- never share HTML content containing personal information that is not necessary (prefer proof via `keys.*` + contractual checks).

---

## 3) Triage (P0/P1/P2) — 90-second routine

### 3.1 Fast Contract Check (release-blocking)
To run **on every incident** (and before any “deliverable is OK” conclusion):

1. **Status ↔ HTML**
   - if `html_ref != null` ⇒ `status` MUST be `"ok"`
   - if `status="error"` ⇒ `html_ref` MUST be `null`

2. **Exports (strict)**
   - no ticket without `evidence_refs[]` (>=1)
   - no additional exported field (Ticket v2 / Evidence v2 / CSV v1)

3. **Anchors / wrappers**
   - `Evidence.ref` exact = `#evidence-<evidence_id>`
   - HTML wrappers: `ticket-*` and `evidence-*` exist

4. **Closed enums**
   - `errors[].stage`: macro enum (API_DOC)
   - `missing_evidence_reason`: 6-reasons enum (API_DOC)
   - `alignment_level`: SOLO `null`, DUO `{high, medium, low}`

5. **Sources (anti-drift)**
   - SOLO: `errors[].source` MUST always be **`na`**
   - DUO: `errors[].source` in `{page_a,page_b,before,after,na}` depending on the mode

6. **Errors ↔ HTML consistency**
   - if `missing_evidence_reason` is present → “Missing evidence” MUST explain it (SSOT vocabulary)
   - DUO: per-source detail in the HTML

7. **Versions & keys**
   - `versions` present (per API_DOC)
   - no situation where “identical keys but different versions” (key drift)

> If a single point fails → **P0** (even if HTML exists).

### 3.2 Severity
- **P0 (blocking):** HTML missing, status/html mismatch, contractual drift (cf. Fast Contract Check), or keys/versions inconsistency.
- **P1 (degraded but deliverable):** HTML ok + explicit limitations (capture issues, completeness < complete, missing best-effort PDF/CSV).
- **P2 (optimization):** timings, missing best-effort headers, `artifacts.*_ref` variations, non-contractual micro-diffs.

---

## 4) Reading `errors[]` (macro stages) — interpretation

`errors[].stage` is a **macro** enum (authority = API_DOC). Typical operational reading:
- `normalize`: input normalization
- `capture`: navigation + screenshots + DOM collection
- `detectors`: facts-only detectors
- `scoring`: scoring + sorting + truncations
- `report`: HTML assembly
- `render_pdf`: HTML → PDF
- `storage`: upload/storage references
- `unknown`: unclassified

Rules (ops gates):
- `missing_evidence_reason` only for evidence/capture, and within the 6-reasons enum.
- **SOLO:** `errors[].source = na` only.
- **DUO:** `errors[].source` within the mode enum.
- Forbidden: internal leak (sub-stages, detector names, traces) in `errors[]`. (DETECTORS_SPEC)

### 4.1 “errors[]” ↔ HTML “Missing evidence” consistency
If `errors[]` contains a `missing_evidence_reason`:
- the HTML “Missing evidence” section MUST reflect the reason(s) (SSOT vocabulary),
- in DUO: detail **per source** (HTML-only).

---

## 5) Playbooks (no code)

### 5.1 P0 — HTML SSOT missing
**Symptoms**
- `status="error"` and `html_ref=null`
- or `status="ok"` but `html_ref=null`

**Checks**
- `errors[].stage` (include `normalize`)
- presence/consistency of `versions`

**Conclusion**
- Run not deliverable: controlled rerun or fix before delivery.

---

### 5.2 P0 — Export schema drift / anchors / enums / leak
**Symptoms**
- ticket without `evidence_refs`
- incorrect `Evidence.ref`
- missing HTML wrappers
- closed enums violated
- internal leak in `errors[]`

**Conclusion**
- Contractual drift: release blocked (even if HTML exists).

---

### 5.3 P1 — Degraded “capture” (incomplete evidence)
**Symptoms**
- `status="ok"` + `errors[].stage="capture"`
- `missing_evidence_reason` present
- `evidence_completeness` = `partial` or `insufficient`

**Checks**
- SOLO: `errors[].source=na` only.
- DUO: `errors[].source` within the mode sources.
- HTML:
  - “Missing evidence” exists if completeness != complete
  - vocabulary = 6 reasons
  - DUO: per-source detail, cover = worst of sources (`insufficient > partial > complete`)

**Conclusion**
- Deliverable acceptable if HTML SSOT exists and limitations are explicitly exposed.

---

### 5.4 P1 — Missing PDF/CSV (best-effort)
**Symptoms**
- `status="ok"` + non-null `html_ref`, but `pdf_ref=null` and/or `csv_ref=null`
- `errors[]` contains `stage=render_pdf` and/or `stage=storage`

**Checks**
- If `render.pdf=false` or `render.csv=false` → not an incident.
- Otherwise, explicit failure in `errors[]` (SSOT macro stage).

**Conclusion**
- SSOT deliverable = HTML.
- Derived backfill allowed under conditions (§7).

---

### 5.5 P0 — Keys/versions inconsistent (drift)
**Symptoms**
- keys “look” identical but `versions` differ
- or drift detected via `html_content_hash` for the same `audit_key`

**Conclusion**
- P0: versions MUST be encoded into keys; otherwise idempotence is broken. (DB_SCHEMA)

---

## 6) Flakiness & reruns (ops policy v1)

Goal: avoid cost/support inflation while reducing false negatives.

- For `capture`/`storage`/`render_pdf`: **maximum 1 controlled rerun** (same payload) is acceptable.
- If the rerun fails in the same way → escalate to P0/P1 per Fast Contract Check.
- For `detectors`/`scoring`/`report`: no endless reruns (likely drift/bug).

> Reruns must never overwrite an existing SSOT output for the same key (DB_SCHEMA).

---

## 7) Retry / idempotence / backfill (no drift)

References: DB_SCHEMA + AUDIT_PIPELINE_SPEC.

### 7.1 Hard rules (immutable SSOT)
- Never modify an **HTML SSOT** already produced for the same `audit_key`.
- Never modify the **exports** already produced for the same `audit_key`.
- A retry is acceptable only if the previous execution was `failed` (or equivalent internal), and we do not rewrite a “successful” SSOT.

### 7.2 Allowed backfill (derived only)
Backfill for `pdf_ref`/`csv_ref` allowed only if:
- the reference HTML is unchanged (**same `html_content_hash`**),
- the reference exports are unchanged,
- the PDF is strictly derived from the HTML,
- the CSV is strictly derived from the JSON exports (CSV v1, without additional columns),
- and above all: **never overwrite a non-null ref**.
  - allowed transitions: `null → non-null`
  - forbidden transitions: `non-null → other non-null`

> Goal: repair a `render_pdf`/`storage` outage without touching the SSOT and without creating variability.

### 7.3 Case “new render version”
If `RENDER_VERSION` changes, we do not “fix” history: we produce a **new render_key** (new output) without overwriting older ones.

---

## 8) Retention & regeneration (internal policy v1)

> Internal policy (does not change export schemas). Durations are **targets** (not external guarantees).

### 8.1 Principles
- Priority: HTML SSOT.
- PDF can be regenerated from HTML.
- CSV can be regenerated from JSON exports.
- `Evidence.details` is **internal** (may become stale if assets are purged); this must not be treated as an incident as long as SSOT (HTML + exports) is OK.

### 8.2 Targets (v1)
- DB (keys + exports): retain (auditability + idempotence).
- HTML: long target (e.g., >= 12 months).
- PDF/CSV: shorter target acceptable (e.g., >= 6 months).
- Capture assets (screenshots/internal traces): short target (e.g., >= 3 months).

---

## 9) “Agency-grade” support communication

### 9.1 What we promise
- An HTML SSOT that explains what is observed **and** what could not be proven.
- Actionable, evidence-based tickets.

### 9.2 What we do not promise
- No RUM.
- No certainty when `evidence_completeness != complete`.

### 9.3 Recommended framing (degraded)
Always include:
- `evidence_completeness`,
- standard reason (6 reasons) if applicable,
- in DUO: impacted source(s).
Forbidden: inventing a new reason / label.

---

## 10) Release discipline & versioning (mini-spec)

### 10.1 Governance “API_DOC first”
- Any change impacting API/deliverables is described **first** in `docs/API_DOC.md`.
- Then align the other SSOT docs (including SMOKE and this runbook).

### 10.2 Release gates
Release allowed only if:
- `SMOKE_AND_QA_SPEC.md` (DoD) passes (4 scenarios + degraded matrix),
- no schema/anchors/enums drift,
- no internal leak in `errors[]`.

---

## 11) Templates (copy/paste)

### 11.1 Template “support incident”
**Summary (1 sentence):**

**Type:** SOLO Instant / SOLO Client-Ready / DUO AB / DUO Before/After

**Request JSON (redacted):**

**Response JSON (redacted):**

**Keys:** product_key=… snapshot_key=… run_key=… audit_key=… render_key=…

**Artifacts:** html_ref=… pdf_ref=… csv_ref=…

**Fast Contract Check:** PASS / FAIL (specify which)

**Observed:** (what the client sees)

**Expected:** (what is expected)

**Severity:** P0 / P1 / P2

### 11.2 Template “client message (degraded)”
- The HTML report is deliverable (SSOT).
- Evidence is **{complete|partial|insufficient}**.
- Limitation encountered: **{blocked_by_cookie_consent|blocked_by_popup|infinite_scroll_or_lazyload|navigation_intercepted|timeout|unknown_render_issue}**.
- Impacted source(s) (DUO): **{page_a/page_b/before/after}**.
- Consequence: some findings are presented with the corresponding evidence limitation (section “Missing evidence”).

---

## 12) DoD — RUNBOOK_OPERATIONS
- [ ] Explicit contractual hierarchy (API_DOC + SMOKE take precedence).
- [ ] Operational Fast Contract Check (P0 even if HTML exists in case of drift).
- [ ] Flakiness policy (max 1 rerun for capture/storage/render_pdf).
- [ ] Strict backfill: immutable SSOT, derived only, `null → non-null` only.
- [ ] Redaction / security included.
- [ ] Consistency `errors[]` ↔ “Missing evidence” locked.
## No-drift audit

- Verified unchanged identifiers/versions: `RUNBOOK_OPERATIONS_VERSION: 1.2`.
- Verified all inline code, identifiers, enums, keys, and literals preserved exactly (paths in `docs/...`, `errors[]`, `errors[].stage`, `missing_evidence_reason`, `alignment_level`, `evidence_completeness`, `artifacts.*_ref`, `keys.*`, `render.pdf=false`, `render.csv=false`, `null`, `na`, `page_a/page_b/before/after`).
- Verified Markdown structure preserved (same headings levels, numbering, list order, and section order).
- Verified no code blocks were altered or introduced (none exist in the source document).
- `[CHECK]`: none.
- Source: :contentReference[oaicite:0]{index=0}
