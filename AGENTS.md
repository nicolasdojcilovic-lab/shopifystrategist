# Repository Guidelines (SSOT Anti-Drift)

## Project posture
- `docs/` is the only source of truth for contracts/specs/gates (SSOT).
- This repository starts documentation-first, then implements tooling strictly in this order:
  **Step 1 fixtures → Step 2 smoke runner → Step 3 CI**.
- Do **NOT** modify SSOT docs unless explicitly requested. If docs appear to conflict, report the conflict and proceed using the safest fallback that does **not** change SSOT.

## Authoritative SSOT Docs (exact list)
- `docs/API_DOC.md`
- `docs/AUDIT_PIPELINE_SPEC.md`
- `docs/DB_SCHEMA.md`
- `docs/DETECTORS_SPEC.md`
- `docs/EVIDENCE_PACK_SPEC.md`
- `docs/FIXTURES_AND_ENV_SPEC.md`
- `docs/REPORT_OUTLINE.md`
- `docs/RUNBOOK_OPERATIONS.md`
- `docs/SCORING_AND_DETECTION.md`
- `docs/SMOKE_AND_QA_SPEC.md`
- `docs/SPEC.md`

## Non-Negotiable SSOT Invariants (anti-drift)
- **HTML report is SSOT**; **PDF is derived strictly from HTML via Playwright only**.
- **Evidence-based**: no exported ticket without `evidence_refs` (>= 1).
- **No new public export fields** (tickets/evidence/csv). Any additional info must be internal-only OR `Evidence.details` **without schema changes**.
- **Never redefine** thresholds / keyword lists / enums: always reference `docs/SCORING_AND_DETECTION.md` (and owning SSOT docs).
- Evidence anchors: `Evidence.ref` must be `#evidence-<evidence_id>`.
- HTML wrappers required: `id="ticket-<ticket_id>"` and `id="evidence-<evidence_id>"`.
- SOLO/DUO alignment: SOLO `report_meta.alignment_level = null`; DUO uses `{high, medium, low}` only.
- Degraded mode: if `artifacts.html_ref` exists ⇒ `status="ok"`. PDF/CSV are best-effort.
- Degraded reporting must include:
  - `errors[]` macro stages (per SSOT),
  - `missing_evidence_reason` with the 6 SSOT reasons,
  - coherent “Missing evidence” messaging (**HTML-only**).
- Determinism: product/snapshot/run/audit/render keys + stable sorting/truncation/caps per SSOT. Keys prove determinism (not storage refs).

## Security & privacy (hard rules)
- **Never commit secrets** (API keys, tokens, service role keys, passwords).
- Do not print secrets to stdout/stderr logs.
- Do not include secrets in `tmp/` artifacts or uploaded CI artifacts.
- Use environment variables for all sensitive configuration.

## Dependency & refactor policy (anti-debt)
- **Minimal diff only**: no refactor, no “cleanup”, no reformatting, no dependency churn unless explicitly requested.
- **No new dependencies** unless strictly required by the current step and justified in the contract-first plan.
- Prefer Node built-ins; keep scripts portable and deterministic.

## Working Rules (contract-first, no drift)
- Before any code: identify the authoritative SSOT doc(s) for the change.
- Contract-first output is mandatory **BEFORE** implementation:
  1) file plan (exact paths),
  2) validation commands + expected outputs,
  3) minimal diff approach (no refactor),
  4) drift risks + explicit mitigations,
  5) SSOT references used (doc name + relevant section/heading).
- If any ambiguity exists (URLs, base_url, auth, fixtures targets), choose the safest fallback and continue **without changing SSOT**.

## Step fences (scope boundaries)
These steps must be implemented in order, and each step must not touch unrelated paths.

### Step 1 — Pack fixtures (ONLY)
Allowed changes:
- `fixtures/smoke/**`
- `AGENTS.md` (if tightening rules)

Disallowed:
- Any edits to `docs/**`
- Any API/server implementation

### Step 2 — Smoke runner (ONLY)
Allowed changes:
- `scripts/smoke.mjs` (and minimal helper modules under `scripts/**` if necessary)
- `tmp/smoke/**` must be runtime output only (never committed)
- Minimal `package.json` scripts if needed (no refactor)

Must implement:
- Reads `fixtures/smoke/fixtures.index.json` + fixture files
- Calls API per `docs/API_DOC.md` using `SMOKE_BASE_URL`
- If `SMOKE_FETCH_HTML=true`: fetch HTML and validate required wrappers/anchors per SSOT
- Applies gates exactly per `docs/SMOKE_AND_QA_SPEC.md` + Fast Contract Check per `docs/RUNBOOK_OPERATIONS.md`
- Writes `tmp/smoke/...` artifacts + `fingerprint.json` + `fixture_contract_hash`
- PR gate fail-fast on P0

### Step 3 — CI (ONLY)
Allowed changes:
- `.github/workflows/**` (smoke workflow)
- Minimal wiring needed to run smoke + upload artifacts on failure

## Change management (to minimize rework)
- **1 PR = 1 step** (no mixing).
- Keep commits small and reviewable.
- Always provide clear validation commands that a non-dev can copy/paste.
