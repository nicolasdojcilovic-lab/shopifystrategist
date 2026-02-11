<!-- GENERATED: ssot:sync -->
# SSOT_INDEX.md (v1.0)

## Purpose
Navigation + governance index for the SSOT set.
Generated from `SSOT_MANIFEST.json`.

Generated at: 2026-02-04T09:43:04.859Z

---

## Folder
- SSOT folder: `docs/SSOT`
- Language: `en`

---

## Authority & precedence (anti-drift)
When two docs conflict, higher authority wins.

1. **REPORT_ELITE_REQUIREMENTS.md** — Product Final Spec (elite report acceptance contracts)
2. **REGISTRY.md** — Registry (closed lists: taxonomy/criteria/rules/templates + gating)
3. **SPEC.md** — System spec (global invariants and architecture contracts)
4. **SCORING_AND_DETECTION.md** — Scoring + traceability contract
5. **DETECTORS_SPEC.md** — Detectors contract
6. **EVIDENCE_PACK_SPEC.md** — Evidence + proof pack contract
7. **REPORT_OUTLINE.md** — Report structure contract (HTML as SSOT output shape)
8. **AUDIT_PIPELINE_SPEC.md** — Pipeline stages + budgets + degradation contract
9. **API_DOC.md** — Public API contract
10. **DB_SCHEMA.md** — Persistence + deterministic keys contract
11. **SMOKE_AND_QA_SPEC.md** — QA + non-regression gates contract
12. **FIXTURES_AND_ENV_SPEC.md** — Fixtures + environment reproducibility contract
13. **RUNBOOK_OPERATIONS.md** — Operations runbook (operational guidance) _(non-normative)_
14. **SSOT_CONVENTIONS.md** — SSOT conventions (meta rules)

Conflict policy:
- Rule: Higher rank wins
- Tie-breaker: If same rank, more specific contract wins; otherwise create an explicit patch/decision entry
- Unresolved action: Add a decision to DECISIONS.md and patch the losing doc(s) to remove ambiguity

---

## Inventory (15 docs)
| DocID | File | Title | Category | Normative | Authority | Version |
|------:|------|-------|----------|:---------:|----------:|:-------:|
| SSOT-001 | REPORT_ELITE_REQUIREMENTS.md | Report Elite Requirements | core_product_contract | Yes | 1 | 1.9 |
| SSOT-002 | REGISTRY.md | Registry | core_product_contract | Yes | 2 | 1.0 |
| SSOT-003 | SPEC.md | System Spec | system_contract | Yes | 3 |  |
| SSOT-004 | SCORING_AND_DETECTION.md | Scoring and Detection | scoring_detection | Yes | 4 | 2.3 |
| SSOT-005 | DETECTORS_SPEC.md | Detectors Spec | scoring_detection | Yes | 5 |  |
| SSOT-006 | EVIDENCE_PACK_SPEC.md | Evidence Pack Spec | evidence_output | Yes | 6 |  |
| SSOT-007 | REPORT_OUTLINE.md | Report Outline | evidence_output | Yes | 7 | 3.1 |
| SSOT-008 | AUDIT_PIPELINE_SPEC.md | Audit Pipeline Spec | pipeline_execution | Yes | 8 |  |
| SSOT-009 | API_DOC.md | API Doc | interfaces_storage | Yes | 9 |  |
| SSOT-010 | DB_SCHEMA.md | DB Schema | interfaces_storage | Yes | 10 |  |
| SSOT-011 | SMOKE_AND_QA_SPEC.md | Smoke and QA Spec | qa_validation | Yes | 11 |  |
| SSOT-012 | FIXTURES_AND_ENV_SPEC.md | Fixtures and Environment Spec | qa_validation | Yes | 12 |  |
| SSOT-013 | RUNBOOK_OPERATIONS.md | Runbook Operations | operations | No | 13 |  |
| SSOT-014 | SSOT_CONVENTIONS.md | SSOT Conventions | meta | Yes | 14 | 1.0 |
| SSOT-015 | REQUIREMENTS_CANON_P0.md | Requirements Canon P0 | requirements | Yes |  |  |

---

## Fast routing (what to update)
- Product acceptance contracts → **REPORT_ELITE_REQUIREMENTS.md**
- Closed lists / IDs / taxonomy → **REGISTRY.md**
- Architecture / invariants → **SPEC.md**
- Scoring interpretation → **SCORING_AND_DETECTION.md**
- Detector I/O contracts → **DETECTORS_SPEC.md**
- Evidence contracts → **EVIDENCE_PACK_SPEC.md**
- Report structure / sections → **REPORT_OUTLINE.md**
- Pipeline / budgets / degradation / TTFV → **AUDIT_PIPELINE_SPEC.md**
- Public API contract → **API_DOC.md**
- DB contracts / deterministic keys → **DB_SCHEMA.md**
- QA scenarios / gates → **SMOKE_AND_QA_SPEC.md**
- Fixtures / env reproducibility → **FIXTURES_AND_ENV_SPEC.md**
- Operations only → **RUNBOOK_OPERATIONS.md**
- Meta conventions → **DECISIONS.md**
