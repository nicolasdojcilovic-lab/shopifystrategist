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
<!-- GENERATED: TRACEABILITY_DRAFT_BEGIN -->
| REQ-001 | HTML report is SSOT; PDF is strictly derived from HTML via Playwright. | docs/SSOT/SPEC.md#1-ssot-rules-non-negotiable | docs/SSOT/REPORT_ELITE_REQUIREMENTS.md#objective, docs/SSOT/API_DOC.md#1-invariants-non-negotiable, docs/SSOT/AUDIT_PIPELINE_SPEC.md#0-invariants-non-negotiable, docs/SSOT/REPORT_OUTLINE.md#purpose, docs/SSOT/RUNBOOK_OPERATIONS.md#1-operational-invariants-reminder |  |  | docs/SSOT/SMOKE_AND_QA_SPEC.md#3-qa-anti-drift-gates-release-blocking, docs/SSOT/SMOKE_AND_QA_SPEC.md#7-rules-html-ssot-ok-allowed-nulls | TBD |  |
| REQ-002 | Evidence-based: no exported ticket without evidence_refs (>=1). | docs/SSOT/SPEC.md#1-ssot-rules-non-negotiable | docs/SSOT/API_DOC.md#1-invariants-non-negotiable, docs/SSOT/REPORT_OUTLINE.md#2-1-evidence-based-evidence-levels-abc, docs/SSOT/EVIDENCE_PACK_SPEC.md#3-invariants-non-negotiable, docs/SSOT/SCORING_AND_DETECTION.md#1-2-evidence-based-anti-hallucination, docs/SSOT/RUNBOOK_OPERATIONS.md#1-operational-invariants-reminder |  |  | docs/SSOT/SMOKE_AND_QA_SPEC.md#3-1-export-schemas-strict, docs/SSOT/DRIFT_GATES.md#gate-p0-003-evidence-required | TBD |  |
| REQ-003 | No new public export fields (Ticket v2 / Evidence v2 / CSV v1); extra info only internal or Evidence.details without schema change. |  | docs/SSOT/API_DOC.md#1-invariants-non-negotiable, docs/SSOT/AUDIT_PIPELINE_SPEC.md#0-invariants-non-negotiable, docs/SSOT/SCORING_AND_DETECTION.md#0-versions-anti-drift, docs/SSOT/EVIDENCE_PACK_SPEC.md#3-invariants-non-negotiable, docs/SSOT/RUNBOOK_OPERATIONS.md#1-operational-invariants-reminder |  |  | docs/SSOT/SMOKE_AND_QA_SPEC.md#3-1-export-schemas-strict | TBD |  |
| REQ-004 | Determinism: same effective inputs + same versions => same IDs, ordering, truncations, keys, and outputs. | docs/SSOT/SPEC.md#1-ssot-rules-non-negotiable | docs/SSOT/AUDIT_PIPELINE_SPEC.md#0-invariants-non-negotiable, docs/SSOT/DB_SCHEMA.md#2-invariants-non-negotiable, docs/SSOT/DB_SCHEMA.md#4-deterministic-keys-where-they-live-what-they-are-for, docs/SSOT/SCORING_AND_DETECTION.md#0-versions-anti-drift, docs/SSOT/RUNBOOK_OPERATIONS.md#1-1-key-principle-keys-storage-refs |  |  | docs/SSOT/SMOKE_AND_QA_SPEC.md#3-3-determinism-ids-sorting-truncations-diversity-normative, docs/SSOT/SMOKE_AND_QA_SPEC.md#2-required-smoke-scenarios-minimum, docs/SSOT/DRIFT_GATES.md#gate-p0-005-determinism | TBD |  |
| REQ-005 | Evidence.ref anchor format and required HTML wrappers for tickets and evidences. |  | docs/SSOT/EVIDENCE_PACK_SPEC.md#6-hard-rule-evidence-ref-html-wrappers, docs/SSOT/SCORING_AND_DETECTION.md#4-4-html-anchors-strong-recommendation, docs/SSOT/REPORT_OUTLINE.md#7-common-report-structure-all-modes, docs/SSOT/RUNBOOK_OPERATIONS.md#1-operational-invariants-reminder |  |  | docs/SSOT/SMOKE_AND_QA_SPEC.md#3-2-html-wrappers-anchors-ssot | TBD |  |
| REQ-006 | Missing evidence reasons are a closed enum of 6 SSOT reasons; used consistently in errors[] and HTML Missing evidence section. |  | docs/SSOT/API_DOC.md#1-invariants-non-negotiable, docs/SSOT/API_DOC.md#4-7-missing-evidence-reason-closed-enum, docs/SSOT/REPORT_OUTLINE.md#3-4-standard-failure-reasons-for-logs-appendix, docs/SSOT/SCORING_AND_DETECTION.md#2-4-standard-failure-reasons-for-logs-appendix, docs/SSOT/EVIDENCE_PACK_SPEC.md#3-invariants-non-negotiable, docs/SSOT/RUNBOOK_OPERATIONS.md#3-1-fast-contract-check-release-blocking |  |  | docs/SSOT/SMOKE_AND_QA_SPEC.md#4-2-reasons-vocabulary-6-reasons, docs/SSOT/SMOKE_AND_QA_SPEC.md#6-degraded-case-matrix-mandatory | TBD |  |
| REQ-007 | Degraded mode: if artifacts.html_ref exists then status='ok'; PDF/CSV are best-effort; errors[] must reflect limitations and HTML Missing evidence shown when completeness != complete. | docs/SSOT/SPEC.md#1-ssot-rules-non-negotiable | docs/SSOT/API_DOC.md#5-1-success-status-ok-http-200, docs/SSOT/AUDIT_PIPELINE_SPEC.md#0-invariants-non-negotiable, docs/SSOT/REPORT_OUTLINE.md#2-3-degraded-mode-graceful-degradation, docs/SSOT/RUNBOOK_OPERATIONS.md#1-operational-invariants-reminder, docs/SSOT/SMOKE_AND_QA_SPEC.md#6-degraded-case-matrix-mandatory |  |  | docs/SSOT/SMOKE_AND_QA_SPEC.md#6-degraded-case-matrix-mandatory, docs/SSOT/SMOKE_AND_QA_SPEC.md#7-rules-html-ssot-ok-allowed-nulls | TBD |  |
| REQ-008 | SOLO vs DUO alignment_level contract: SOLO null; DUO in {high, medium, low}. |  | docs/SSOT/API_DOC.md#4-5-report-meta-alignment-level, docs/SSOT/REPORT_OUTLINE.md#4-1-alignment-level, docs/SSOT/RUNBOOK_OPERATIONS.md#1-operational-invariants-reminder |  |  | docs/SSOT/SMOKE_AND_QA_SPEC.md#3-6-solo-vs-duo-alignment-level-contract | TBD |  |
| REQ-009 | Evidence completeness mapping (Set A/B) and DUO worst-of-sources aggregation. |  | docs/SSOT/SCORING_AND_DETECTION.md#2-3-minimum-guaranteed-gating, docs/SSOT/REPORT_OUTLINE.md#3-2-standard-screenshot-set-best-effort-guaranteed-minimum, docs/SSOT/AUDIT_PIPELINE_SPEC.md#4-1-gating-screenshots-evidence-completeness-ssot, docs/SSOT/RUNBOOK_OPERATIONS.md#1-operational-invariants-reminder |  |  | docs/SSOT/SMOKE_AND_QA_SPEC.md#5-evidence-completeness-gates-ssot | TBD |  |
| REQ-010 | Registry closed lists: rule_id/criteria_id/subject_key/root_cause_key/template_id must be allowed by REGISTRY; unknowns rejected/handled. |  | docs/SSOT/REPORT_ELITE_REQUIREMENTS.md#1-registry-contract-anti-drift-must, docs/SSOT/DRIFT_GATES.md#gate-p0-002-registry-closed-lists | docs/SSOT/REGISTRY.md#role, docs/SSOT/REGISTRY.md#1-taxonomy-must, docs/SSOT/REGISTRY.md#2-criteria-registry-must |  |  | TBD |  |
| REQ-011 | Client-facing report language: report_language is fr\|en with no mixing; report_locale tracked. |  | docs/SSOT/REPORT_ELITE_REQUIREMENTS.md#0-1-language-locale-anti-mix | docs/SSOT/REGISTRY.md#languages |  |  | TBD |  |
| REQ-012 | SSOT documents are English-only (no FR/EN mixing). |  | docs/SSOT/SSOT_CONVENTIONS.md#ssot-documents-language, docs/SSOT/DRIFT_GATES.md#gate-p0-001-en-only-ssot |  |  |  | CONFLICT | docs/SSOT/FIXTURES_AND_ENV_SPEC.md is written in French, which conflicts with the SSOT English-only rule. |
<!-- GENERATED: TRACEABILITY_DRAFT_END -->

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


