# TRACEABILITY_MATRIX.md (v1.0)

## Purpose
Single source to track **end-to-end alignment**:
Product Final Spec (REPORT_ELITE_REQUIREMENTS) → Registry IDs → SSOT contracts → Code → Smoke/QA → Evidence.

Status values:
- OK: requirement is fully covered + tested
- GAP: missing coverage and/or test
- CONFLICT: contradiction between SSOT sources
- TBD: not reviewed yet

---

## Scope
Modes:
- SOLO_INSTANT
- SOLO_CLIENT_READY
- DUO_AB
- DUO_BEFORE_AFTER

---

## Legend (how to reference)
- SSOT anchors: `docs/SSOT/<FILE>.md#<heading-slug>` (or exact heading text)
- Code: repo-relative paths (e.g. `src/engine/...`)
- Smoke/QA: scenario IDs from `SMOKE_AND_QA_SPEC.md`
- Registry: IDs from `REGISTRY.md` (`criteria_id`, `rule_id`, `template_id`, etc.)

---

## Matrix

| ReqID | Requirement (short) | Source (Final Spec anchor) | SSOT coverage (docs+anchors) | Registry IDs | Code (paths) | Tests (Smoke/QA) | Status | Notes / Patch plan |
|------:|----------------------|----------------------------|------------------------------|-------------|--------------|------------------|--------|--------------------|
| REQ-001 | HTML is SSOT; PDF derived via Playwright | REPORT_ELITE_REQUIREMENTS.md#0-global-contracts-must | SPEC.md#..., REPORT_OUTLINE.md#..., AUDIT_PIPELINE_SPEC.md#... | (n/a) | src/render/... | SMOKE-... | TBD | |
| REQ-002 | No ticket without evidence_refs >=1 | REPORT_ELITE_REQUIREMENTS.md#0-global-contracts-must | EVIDENCE_PACK_SPEC.md#..., SCORING_AND_DETECTION.md#... | EV-... | src/score/... | SMOKE-... | TBD | |
| REQ-003 | Degraded mode remains client-safe | REPORT_ELITE_REQUIREMENTS.md#... | AUDIT_PIPELINE_SPEC.md#..., REPORT_OUTLINE.md#... | (n/a) | src/pipeline/... | SMOKE-... | TBD | |
| REQ-004 | Registry is closed-list, unknown IDs rejected/handled | REPORT_ELITE_REQUIREMENTS.md#... + REGISTRY.md#... | SCORING_AND_DETECTION.md#..., DETECTORS_SPEC.md#... | RULE-..., CRIT-... | src/registry/... | SMOKE-... | TBD | |
| REQ-005 | DUO: compare logic + winner gating rules | REPORT_ELITE_REQUIREMENTS.md#... | SCORING_AND_DETECTION.md#..., REPORT_OUTLINE.md#... | CRIT-..., RULE-... | src/duo/... | SMOKE-DUO-... | TBD | |

> Add as many rows as needed. Keep requirements atomic.

---

## Conflicts log (only if Status=CONFLICT)
| ConflictID | Topic | Sources in conflict | Decision (winner) | Patch target(s) | Owner | Date |
|-----------:|-------|--------------------|-------------------|-----------------|-------|------|
| CONFLICT-001 | (example) | SPEC.md#... vs API_DOC.md#... | REPORT_ELITE_REQUIREMENTS wins | API_DOC.md | | |

---

## Gaps backlog (only if Status=GAP)
| GapID | Missing piece | Where it should live | Patch size (S/M/L) | Dependencies | Owner | Date |
|------:|---------------|----------------------|--------------------|--------------|-------|------|
| GAP-001 | (example) | SMOKE_AND_QA_SPEC.md | S | | | |

---

## Completion criteria
Alignment is considered “done” when:
- No CONFLICT remains unresolved.
- All P0 requirements are OK for SOLO_INSTANT + SOLO_CLIENT_READY.
- DUO requirements are OK for at least one DUO mode.
- Drift gates are in place and passing in CI (or at minimum runnable locally).
