# REQUIREMENTS_CANON_P0.md

Purpose: Canonical P0 requirements (vendable agences) used to drive Pass 1 (code + smoke + gates) and prevent drift.
Source of truth: this file. Other SSOT docs must map to these REQs via TRACEABILITY_MATRIX.

Status values:
- Pending: not triaged
- GAP: missing code and/or tests and/or registry alignment
- OK: fully implemented + passing smoke/gates

---

## Canonical P0 Requirements (v0.1)

| ReqID | Priority | Module | Requirement (short) | Acceptance (smoke/gates) | Status | Source (Final Spec anchor) | SSOT anchors | Code paths | Smoke IDs | Notes |
|------:|:--------:|--------|---------------------|---------------------------|:------:|----------------------------|-------------|-----------|----------|------|
| REQ-P0-001 | P0 | Render | HTML is SSOT; PDF strictly derived from HTML via Playwright | SMOKE-RENDER-001 + SMOKE-RENDER-002 | Pending |  |  |  |  |  |
| REQ-P0-002 | P0 | Contracts | Export schemas strict + versioned; no breaking drift | GATE-SCHEMA-001 | Pending |  |  |  |  |  |
| REQ-P0-003 | P0 | Registry | Registry closed-lists enforced at runtime | GATE-REG-001 | Pending |  |  |  |  |  |
| REQ-P0-004 | P0 | Determinism | Deterministic keys product/snapshot/run/audit/render | GATE-DET-001 | Pending |  |  |  |  |  |
| REQ-P0-005 | P0 | Determinism | Deterministic ordering & truncation for outputs | GATE-DET-002 | Pending |  |  |  |  |  |
| REQ-P0-006 | P0 | Safety | No AI in final client-facing outputs | GATE-AI-001 | Pending |  |  |  |  |  |
| REQ-P0-007 | P0 | Evidence | Every client-facing ticket has evidence_refs[] ≥ 1 | GATE-EVID-001 | Pending |  |  |  |  |  |
| REQ-P0-008 | P0 | Evidence | Evidence refs resolvable to HTML anchors/wrappers | SMOKE-EVID-001 | Pending |  |  |  |  |  |
| REQ-P0-009 | P0 | Evidence | Evidence completeness computed & exposed | SMOKE-EVID-002 | Pending |  |  |  |  |  |
| REQ-P0-010 | P0 | Evidence | Missing evidence reasons closed enum | GATE-EVID-002 | Pending |  |  |  |  |  |
| REQ-P0-011 | P0 | Degraded | If html_ref exists → status OK allowed | SMOKE-DEG-001 | Pending |  |  |  |  |  |
| REQ-P0-012 | P0 | Degraded | PDF/CSV best-effort; errors[] stable codes | SMOKE-DEG-002 | Pending |  |  |  |  |  |
| REQ-P0-013 | P0 | Degraded | Limitations section when completeness != complete | SMOKE-DEG-003 | Pending |  |  |  |  |  |
| REQ-P0-014 | P0 | SOLO | SOLO Instant produces html (+pdf optional) | SMOKE-SOLO-001 | Pending |  |  |  |  |  |
| REQ-P0-015 | P0 | SOLO | Client-safe: no unsupported claims | GATE-EVID-* + review gates | Pending |  |  |  |  |  |
| REQ-P0-016 | P0 | SOLO | Client-Ready contains prioritized tickets + guidance (template-based) | SMOKE-SOLO-002 | Pending |  |  |  |  |  |
| REQ-P0-017 | P0 | Report | Required report sections per outline | SMOKE-REPORT-001 | Pending |  |  |  |  |  |
| REQ-P0-018 | P0 | DUO | DUO AB winner + rationale evidence-based | SMOKE-DUO-AB-001 | Pending |  |  |  |  |  |
| REQ-P0-019 | P0 | DUO | DUO AB alignment_level in {high,medium,low} | SMOKE-DUO-AB-002 | Pending |  |  |  |  |  |
| REQ-P0-020 | P0 | DUO | DUO Before/After improvements + regressions | SMOKE-DUO-BA-001 | Pending |  |  |  |  |  |
| REQ-P0-021 | P0 | Tickets | Detectors map to registry criteria/rules | GATE-REG-002 | Pending |  |  |  |  |  |
| REQ-P0-022 | P0 | Tickets | Ticket export format stable (Ticket v2) | GATE-TICKET-001 | Pending |  |  |  |  |  |
| REQ-P0-023 | P0 | Tickets | Ticket ordering deterministic | GATE-DET-003 | Pending |  |  |  |  |  |
| REQ-P0-024 | P0 | Tickets | Severity/priority closed enums | GATE-TICKET-002 | Pending |  |  |  |  |  |
| REQ-P0-025 | P0 | Cache | Cache at render_key level (HTML/PDF reuse) | SMOKE-CACHE-001 | Pending |  |  |  |  |  |
| REQ-P0-026 | P0 | Storage | Deterministic versioned storage paths | GATE-STORAGE-001 | Pending |  |  |  |  |  |
| REQ-P0-027 | P0 | Storage | Artifact URLs retrievable when present | SMOKE-STORAGE-001 | Pending |  |  |  |  |  |
| REQ-P0-028 | P0 | Language | report_language fr|en; no mixing | GATE-LANG-001 | Pending |  |  |  |  |  |
| REQ-P0-029 | P0 | Language | report_locale tracked; formatting consistent | GATE-LANG-002 | Pending |  |  |  |  |  |
| REQ-P0-030 | P0 | EvidencePack | Evidence pack produced (deterministic naming) | SMOKE-EVP-001 | Pending |  |  |  |  |  |
| REQ-P0-031 | P0 | Ops | Failure reasons closed list in appendix | GATE-OPS-001 | Pending |  |  |  |  |  |
| REQ-P0-032 | P0 | QA | Minimal smoke suite covers SOLO+DUO+degraded+cache | `npm run smoke` | Pending |  |  |  |  |  |
| REQ-P0-033 | P0 | Drift | Drift gates: EN-only SSOT, registry, evidence, determinism | `npm run ssot:validate` + gates | Pending |  |  |  |  |  |

---

## Owned Concepts
This document owns:
- The canonical list of **P0 requirement IDs** (`REQ-P0-xxx`)
- The definition of P0 scope (sellable agency-grade baseline)
- The acceptance criteria identifiers (Smoke/Gates names) at requirement level

## Not Owned
This document does NOT own:
- Final product contracts text (owned by `REPORT_ELITE_REQUIREMENTS.md`)
- Registry values and allowed IDs (owned by `REGISTRY.md`)
- Export schema definitions (owned by `src/contracts/**` + `API_DOC.md`)
- Pipeline implementation details (owned by code + `AUDIT_PIPELINE_SPEC.md`)
- Smoke implementation mechanics (owned by `SMOKE_AND_QA_SPEC.md`)

---

## Change log
- v0.1: initial canonical P0 list extracted from product sellable scope
