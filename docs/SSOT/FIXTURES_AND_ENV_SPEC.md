# ShopifyStrategist — FIXTURES_AND_ENV_SPEC.md (SSOT)

## Owned Concepts (Canonical)
- Fixtures pack structure and naming conventions
- Environment variables and smoke execution interface

## Not Owned (References)
- **Persistence**: Prisma with Supabase PostgreSQL
- **Capture**: Playwright-based capture (Desktop/Mobile)
- **Storage**: Supabase Storage Buckets

- **FIXTURES_AND_ENV_SPEC_VERSION:** 1.2
- **Objective:** define a stable fixtures pack + an environment interface to run smoke tests deterministically, anti-flaky, and anti-drift.
- **Scope:** fixtures + execution conventions + expected artifacts. No code.
- **Non-goal:** redefine schemas/enums/thresholds already SSOT.

---

## 0) SSOT references

- `docs/API_DOC.md`
- `docs/SMOKE_AND_QA_SPEC.md`
- `docs/RUNBOOK_OPERATIONS.md`
- `docs/REPORT_OUTLINE.md`
- `docs/SCORING_AND_DETECTION.md`
- `docs/EVIDENCE_PACK_SPEC.md`
- `docs/DB_SCHEMA.md`
- `docs/AUDIT_PIPELINE_SPEC.md`
- `docs/DETECTORS_SPEC.md`

### 0.1 Hierarchy
- API payloads: compliant with `API_DOC.md`.
- Gates/Assertions: compliant with `SMOKE_AND_QA_SPEC.md` + `RUNBOOK_OPERATIONS.md`.
- Authority of this doc: pack structure, fixtures format, anti-flaky, env, artifacts.

---

## 1) Fixtures pack structure

### 1.1 Location
- `fixtures/smoke/`
  - `README.md`
  - `fixtures.index.json`
  - `<fixture_id>.json`

### 1.2 Canonical index (`fixtures.index.json`)
Required fields:
- `fixture_id`
- `category` ∈ `solo|duo|degraded`
- `scenario`
- `enabled` (bool)
- `tier` ∈ `gold|silver|bronze`
- `profiles`: list ∈ `pr_gate|nightly`
- `tags`: list (convention: include `solo`, `duo_ab`, `duo_before_after`, `degraded`)

Rules:
- stable order in the index = default execution order.
- `bronze` ∉ `pr_gate`.
- The 4 `pr_gate` baselines MUST be primarily **controlled/owned** (see §4.4).

---

## 2) Fixture format (internal contract)

### 2.1 Metadata
- `fixture_id`
- `name`
- `category`
- `tier`
- `profiles`
- `notes` (optional)
- `serial_only` (bool, default false) — forces sequential execution of this fixture

### 2.2 API request
- `endpoint` ∈ `/api/audit/solo|/api/audit/duo`
- `request`: payload compliant `API_DOC.md`
- `render`: `{ "pdf": bool, "csv": bool }`

### 2.3 Internal assertions (closed schema)
`expect`:
- `status`: `"ok"|"error"`
- `mode`: `"solo"|"duo_ab"|"duo_before_after"`
- `alignment_level`: `"null_in_solo"|"enum_in_duo"`
- `evidence_completeness`: `"complete"|"partial"|"insufficient"|"any"`
- `missing_evidence`:
  - `must_exist_if_not_complete` (bool)
  - `must_detail_by_source_in_duo` (bool)
- `errors`:
  - `allowed_stages`: `"any"` or list (SSOT macro stages)
  - `required_stage`: `"none"` or one macro stage
  - `allowed_missing_evidence_reasons`: `"any"` or list (6 reasons)
  - `required_missing_evidence_reason`: `"none"` or one reason (6 reasons)
  - `source_policy`:
    - `solo_source_must_be_na` (bool)
    - `duo_sources_allowed`: `"by_mode"` or list
- `determinism`:
  - `runs`: integer (default 2)
  - `must_match`: list ∈ `{exports, keys, report_meta, html_hash, ticket_order, evidence_order}`
  - `must_not_use`: MUST include `artifacts_refs`
- `html_fetch_policy`:
  - `required` (bool)
- `skip_conditions`:
  - `skip_pdf_assertions_if_render_pdf_disabled` (bool, default true)
  - `skip_csv_assertions_if_render_csv_disabled` (bool, default true)

Rules:
- Any field outside the schema is forbidden.
- In **PR gate**, `html_fetch_policy.required` MUST be `true` (no HTML skip).
- `skip_conditions` only allows skips related to `render.pdf=false` / `render.csv=false` (no contractual bypass).

---

## 3) Mandatory minimal catalog

### 3.1 Baselines (must-pass, `pr_gate`)
1. `solo_ok_instant`
2. `solo_ok_copyready` (same URLs as `solo_ok_instant`)
3. `duo_ab_ok`
4. `duo_before_after_ok`

### 3.2 Degraded (6 reasons, `nightly`)
5. `degraded_cookie` → `blocked_by_cookie_consent`
6. `degraded_popup` → `blocked_by_popup`
7. `degraded_timeout` → `timeout`
8. `degraded_navigation_intercepted` → `navigation_intercepted`
9. `degraded_infinite_scroll_or_lazyload` → `infinite_scroll_or_lazyload`
10. `degraded_unknown_render_issue` → `unknown_render_issue`

Degraded rules:
- `expect.errors.required_stage = "capture"`
- `expect.errors.required_missing_evidence_reason` = targeted reason (never `"any"`)
- `expect.evidence_completeness` MUST be **`partial` or `insufficient`** (forbidden: `complete`)
- `expect.missing_evidence.must_exist_if_not_complete = true`

---

## 4) Anti-flaky rules (URLs)

### 4.1 Gold criteria
- public, stable, no login/paywall/geo gating
- relatively stable DOM
- avoid unstable anti-bot

### 4.2 Exclusions
- auth/checkout
- flash promos / “today-only” content
- sites that block automation

### 4.3 Tiering qualification
- PR gate validation: 2 consecutive runs without P0.
- Promotion to `gold`: 5 runs over ≥ 2 days (nightly), without violating Fast Contract Check.

### 4.4 “Owned baseline” rule (strongly recommended)
- The 4 `pr_gate` baselines SHOULD ideally target a **controlled test shop** (owned) to minimize external risk.
- External pages remain recommended for `nightly` (detect external drifts).

---

## 5) Change governance

### 5.1 Change a URL
- If the scenario is identical: keep `fixture_id`, document in `notes`, re-qualify tier.
- If the scenario changes: new `fixture_id`, old `enabled=false`.

### 5.2 Change trace (anti-support)
The runner MUST produce a fixture hash:
- `fixture_contract_hash = SHA256(canonical_json(fixture_file))`
and write it into the artifacts (§8).

---

## 6) Execution profiles

- Local: fast
- CI PR gate: strict, `profiles=pr_gate`, fail fast
- Nightly: `profiles=nightly` (includes bronze)

Rules:
- Fixtures marked `serial_only=true` always run sequentially, even if `SMOKE_CONCURRENCY>1`.

---

## 7) Environment variables

### 7.1 Network / API
- `SMOKE_BASE_URL`
- `SMOKE_TIMEOUT_MS` (recommended: 120000)
- `SMOKE_CONCURRENCY` (recommended PR gate: 1)

### 7.2 Execution
- `SMOKE_OUT_DIR` (default `tmp/smoke`)
- `SMOKE_RUNS_PER_FIXTURE` (default 2)
- `SMOKE_MAX_RERUN_TRANSIENT` (default 1)
- `SMOKE_FAIL_FAST` (default true in PR gate)
- `SMOKE_PROFILE` ∈ `pr_gate|nightly|all` (default `pr_gate`)

### 7.3 Fetch HTML (hard rule)
- `SMOKE_FETCH_HTML` (bool, default true)
Rules:
- In PR gate: `SMOKE_FETCH_HTML=true` is mandatory.
- In nightly: `SMOKE_FETCH_HTML` may be true/false, but if false the runner MUST explicitly mark “no html fetch” and MUST NOT validate the wrappers/anchors gates.

### 7.4 Auth (optional)
- `SMOKE_AUTH_HEADER_NAME`
- `SMOKE_AUTH_HEADER_VALUE`

---

## 8) Expected artifacts

### 8.1 Layout
- `tmp/smoke/<fixture_id>/run_<n>/request.json`
- `tmp/smoke/<fixture_id>/run_<n>/response.json`
- `tmp/smoke/<fixture_id>/run_<n>/assertions.json`
- `tmp/smoke/<fixture_id>/run_<n>/fingerprint.json`
- `tmp/smoke/<fixture_id>/run_<n>/fixture_contract_hash.txt`
- `tmp/smoke/<fixture_id>/run_<n>/errors.txt` (if FAIL)
- `tmp/smoke/<fixture_id>/run_<n>/report.html` (if fetch)
- `tmp/smoke/<fixture_id>/run_<n>/report.pdf` (if `pdf_ref` non-null)
- `tmp/smoke/<fixture_id>/run_<n>/tickets.csv` (if `csv_ref` non-null)

### 8.2 Fingerprint (quick comparison)
`fingerprint.json` includes at minimum:
- `fixture_id`, `fixture_contract_hash`
- `keys.*`
- `versions`
- `report_meta`
- HTML hash (if fetch) + artifact sizes
- counters: `tickets_count`, `evidences_count`, `errors_count`

---

## 9) DoD

- [ ] pack present (README + index + fixtures)
- [ ] stable index with `tier` + `profiles` + conventional tags
- [ ] 10 minimal fixtures (4 baselines pr_gate + 6 degraded nightly)
- [ ] `expect` respects the closed schema
- [ ] degraded fixtures locked: stage=capture + targeted reason + completeness not complete
- [ ] gold qualification defined (5 runs / ≥2 days)
- [ ] `SMOKE_FETCH_HTML` mandatory in PR gate
- [ ] `serial_only` supported for fragile fixtures
- [ ] artifacts include fingerprint + fixture_contract_hash
- [ ] explicit alignment with SMOKE_AND_QA_SPEC + RUNBOOK

## No-drift audit

- Verified no changes to identifiers, enums, keys, paths, filenames, or inline code:
  - Paths and filenames: `fixtures/smoke/`, `fixtures.index.json`, `<fixture_id>.json`, `tmp/smoke/<fixture_id>/run_<n>/...`
  - Enums/literals: `solo|duo|degraded`, `gold|silver|bronze`, `pr_gate|nightly|all`, `"ok"|"error"`, `"solo"|"duo_ab"|"duo_before_after"`, `"complete"|"partial"|"insufficient"|"any"`, the 6 `missing_evidence_reason` values, `SMOKE_*` env vars, `/api/audit/solo|/api/audit/duo`
  - Hash expression preserved exactly: `fixture_contract_hash = SHA256(canonical_json(fixture_file))`
- Verified Markdown structure preserved exactly (same headings, numbering, list order).
- `[CHECK]`: none.

## Minimal patch proposal

- **SSOT path drift risk:** the references in §0 use `docs/<NAME>.md` while the locked SSOT directory uses `docs/SSOT/<NAME>.md`. Minimal patch: update only those inline-code reference paths to `docs/SSOT/<NAME>.md` (no other changes).
