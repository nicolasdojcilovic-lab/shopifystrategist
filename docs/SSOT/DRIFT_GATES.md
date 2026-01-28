# DRIFT_GATES.md (v1.0)

## Purpose
Prevent SSOT ↔ code ↔ QA drift with **fast, automatable gates**.

Priority:
- P0: must be enforced before shipping
- P1: should be enforced soon
- P2: nice-to-have

---

## P0 gates (ship-blocking)

### GATE-P0-001 — EN-only SSOT
- Rule: all SSOT docs in `docs/SSOT/` are English-only.
- Check: no obvious FR markers in SSOT files (basic heuristic).
- Outcome: fail if detected.

### GATE-P0-002 — Registry closed lists
- Rule: outputs may only use known `criteria_id`, `rule_id`, `template_id` from REGISTRY.
- Check: scan report JSON/HTML artifacts and ensure IDs exist in REGISTRY.
- Outcome: fail if unknown IDs appear (or must trigger approved degraded behavior).

### GATE-P0-003 — Evidence required
- Rule: no ticket without `evidence_refs` >= 1.
- Check: validate generated artifacts (JSON) after `npm run smoke`.
- Outcome: fail if any ticket violates.

### GATE-P0-004 — HTML is SSOT; PDF derived only
- Rule: PDF must be generated from HTML via Playwright (no content changes).
- Check: pipeline logs + presence of HTML artifact for each PDF artifact.
- Outcome: fail if PDF exists without corresponding HTML or wrong generator.

### GATE-P0-005 — Determinism
- Rule: same input snapshot + same versions => same output keys + stable ordering.
- Check: run the same smoke twice; diff artifacts must be empty or within approved nondeterministic fields.
- Outcome: fail if unstable.

---

## P1 gates (strongly recommended)

### GATE-P1-001 — SSOT manifest completeness
- Rule: every SSOT doc must be listed in SSOT_MANIFEST.json and vice versa.
- Check: compare folder listing with manifest list.

### GATE-P1-002 — Required headers / structure
- Rule: each SSOT doc has a single H1 title and standard sections (Role/Purpose, Scope, Contracts, Versioning).
- Check: lint-like scan.

### GATE-P1-003 — Traceability coverage threshold
- Rule: all P0 requirements have entries in TRACEABILITY_MATRIX with Status=OK.
- Check: count P0 rows, ensure no GAP/CONFLICT.

---

## P2 gates (later)

- Glossary consistency (single glossary source)
- Link checker (anchors are valid)
- Schema validation (JSON Schema for API/report DB representations)
- Performance budgets (TTFV thresholds in smoke)

---

## Minimal local workflow
- Update SSOT doc(s)
- Update TRACEABILITY_MATRIX row(s)
- Run smoke
- Run drift gates
- Commit together
