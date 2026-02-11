# ShopifyStrategist — API_DOC.md (SSOT)
## Owned Concepts (Canonical)
- API contracts for audit endpoints (SOLO, DUO)
- Request/response envelope formats
- Version headers and deterministic IDs

## Not Owned (References)
- **Persistence**: Prisma with Supabase PostgreSQL
- **Capture**: Playwright-based capture (Desktop/Mobile)
- **Storage**: Supabase Storage Buckets

**API_DOC_VERSION :** 1.2  
**Status :** SSOT (public API contracts)  
**Goal :** lock the audit endpoint contracts (SOLO + DUO), without drift, compatible with the SSOT documentation.

---

## 0) SSOT references (source of truth)
This document **does not redefine**: thresholds, keyword lists, business enums, diversity rules, signal → ticket mapping. It references:
- `docs/SSOT/SPEC.md`
- `docs/SSOT/REPORT_OUTLINE.md` (V3.1)
- `docs/SSOT/SCORING_AND_DETECTION.md` (v2.2)
- `docs/SSOT/AUDIT_PIPELINE_SPEC.md` (spec v1.0)
- `docs/SSOT/DETECTORS_SPEC.md` (v1.3)
- `docs/SSOT/EVIDENCE_PACK_SPEC.md` (v1.2)

---

## 1) Invariants (non-negotiable)
1) **HTML report = SSOT** ; **PDF** strictly derived from the HTML (Playwright).
2) **Evidence-based**: no ticket without `evidence_refs[]` (>= 1).
3) **No RUM**: perf/weight metrics = lab best-effort; never “real user metrics”.
4) **Anti-drift export**: **no new export field** (Ticket v2 / Evidence v2 / CSV v1).
   - Any additional info MUST remain **internal** or in `Evidence.details` (without changing the export schema).
5) **SSOT reasons (6)**: `missing_evidence_reason` is `null` or:
   - `blocked_by_cookie_consent`
   - `blocked_by_popup`
   - `infinite_scroll_or_lazyload`
   - `navigation_intercepted`
   - `timeout`
   - `unknown_render_issue`
6) **SSOT macro stages**: `errors[].stage` ∈ `normalize|capture|detectors|scoring|report|render_pdf|storage|unknown`.
7) **Determinism**: same effective inputs + same versions ⇒ same IDs, same sorting, same truncations, same exports.
8) **DUO**:
   - `evidence_completeness` is computed **per source** (`page_a/page_b/before/after`).
   - the exposed value (`report_meta.evidence_completeness`) is the **worst of sources** (`insufficient > partial > complete`).
   - per-source detail (Missing evidence) remains **HTML-only**.

---

## 2) Versions & anti-drift

### 2.1 Format versions (SSOT)
These versions MUST appear in the API response (`versions`) and on the HTML cover:
- `REPORT_OUTLINE_VERSION = 3.1`
- `TICKET_SCHEMA_VERSION = 2`
- `EVIDENCE_SCHEMA_VERSION = 2`
- `CSV_EXPORT_VERSION = 1`
- `DETECTORS_SPEC_VERSION = 1.3`

### 2.2 Runtime versions
- `NORMALIZE_VERSION`
- `SCORING_VERSION`
- `ENGINE_VERSION`
- `RENDER_VERSION`

### 2.3 Rules
- Any change to signals/thresholds/mapping/merge/dedup/IDs/sorting ⇒ bump `SCORING_VERSION` (see `SCORING_AND_DETECTION`).
- Any change to report structure ⇒ bump `REPORT_OUTLINE_VERSION`.

---

## 3) Endpoints (MVP)

All audit endpoints live under the `/api/audit/` namespace:
- `POST /api/audit/solo` — start a SOLO audit
- `POST /api/audit/duo` — start a DUO audit (AB or Before/After)
- `GET /api/audit/[auditKey]` — poll status of an existing audit

Principle contract:
- HTTP 200 if an **SSOT HTML** was produced (`status="ok"`).
- HTTP 4xx for request errors.
- HTTP 500 only if no SSOT HTML can be produced.

---

## 4) Common contracts

### 4.1 `mode` (response)
- `solo`
- `duo_ab`
- `duo_before_after`

### 4.2 `source`
- For `Evidence.source` : `page_a|page_b|before|after` (SSOT)
- For `errors[].source` : `page_a|page_b|before|after|na` (pipeline)

> SOLO: the audited page is carried under `source="page_a"`.

### 4.3 Viewports (SSOT)
- Mobile : 390×844
- Desktop : 1440×900

### 4.4 `report_meta.evidence_completeness`
- `complete|partial|insufficient` (Set A/B gating, see `SCORING_AND_DETECTION` v2.2)

### 4.5 `report_meta.alignment_level`
- DUO : `high|medium|low` (see `REPORT_OUTLINE` V3.1)
- SOLO : `null`

### 4.6 `errors[].stage` (macro enum)
`normalize|capture|detectors|scoring|report|render_pdf|storage|unknown`

### 4.7 `missing_evidence_reason` (closed enum)
`null` or one of the 6 SSOT enums (§1.5).

### 4.8 Observability headers (best-effort, non-contractual)
The server **MAY** add debug/perf helper headers (they are not part of the SSOT contract and may be absent):
- `X-Cache`
- `X-Cache-Run`
- `X-Cache-Render`
- `X-Audit-Timing`

QA rule: smoke tests MUST **never** fail if these headers are missing.
+
---

## 5) Response — envelopes (contract)

### 5.1 Success: `status="ok"` (HTTP 200)
```json
{
  "status": "ok",
  "mode": "solo",
  "keys": {
    "product_key": "prod_...",
    "snapshot_key": "snap_...",
    "run_key": "run_...",
    "audit_key": "audit_...",
    "render_key": "render_..."
  },
  "versions": {
    "REPORT_OUTLINE_VERSION": "3.1",
    "TICKET_SCHEMA_VERSION": "2",
    "EVIDENCE_SCHEMA_VERSION": "2",
    "CSV_EXPORT_VERSION": "1",
    "DETECTORS_SPEC_VERSION": "1.3",
    "NORMALIZE_VERSION": "x.y.z",
    "SCORING_VERSION": "x.y.z",
    "ENGINE_VERSION": "x.y.z",
    "RENDER_VERSION": "x.y.z"
  },
  "report_meta": {
    "evidence_completeness": "complete",
    "alignment_level": null
  },
  "artifacts": {
    "html_ref": "storage://.../report.html",
    "pdf_ref": "storage://.../report.pdf",
    "csv_ref": "storage://.../tickets.csv"
  },
  "exports": {
    "tickets": [],
    "evidences": []
  },
  "errors": [],
  "timings_ms": {
    "capture_total": 0,
    "detectors_total": 0,
    "scoring_total": 0,
    "report_total": 0,
    "render_pdf_total": 0,
    "end_to_end": 0
  }
}
```

Normative constraints:
- `exports.tickets[]` is strict **Ticket v2** (see `SCORING_AND_DETECTION` v2.2 §3.1).
- `exports.evidences[]` is strict **Evidence v2** (see `SCORING_AND_DETECTION` v2.2 §3.2 and `EVIDENCE_PACK_SPEC` v1.2).
- `artifacts.html_ref` MUST be present if `status="ok"` (HTML = SSOT).
- `artifacts.pdf_ref` and `artifacts.csv_ref` are **best-effort** and may be `null` if render/storage fails; in that case, add a corresponding entry in `errors[]` (`stage=render_pdf` or `stage=storage`) **without preventing** `status="ok"` as long as `html_ref` exists.
- If `artifacts.csv_ref` is non-null, it points to a strict CSV **CSV_EXPORT_VERSION=1** (no added column).
- If `artifacts.pdf_ref` is non-null, it points to a PDF rendered via Playwright from the SSOT HTML (same `audit_key`).

### 5.2 Request-level error: `status="error"` (HTTP 4xx)
```json
{
  "status": "error",
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: url"
  }
}
```

### 5.3 Fatal run-level error: `status="error"` (HTTP 500)
Only if no SSOT HTML can be produced.
```json
{
  "status": "error",
  "error": {
    "code": "AUDIT_FAILED",
    "message": "Audit failed before SSOT HTML could be produced."
  }
}
```

---

## 6) POST `/api/audit/solo`

### 6.1 Request (URL)
```json
{
  "locale": "fr",
  "url": "https://example.com/products/abc",
  "options": {
    "copy_ready": false
  },
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  }
}
```

### 6.2 Request (Replay via `snapshot_key`)
```json
{
  "locale": "en",
  "snapshot_key": "snap_...",
  "options": {
    "copy_ready": false
  },
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  }
}
```

Rules:
- `locale` (MVP): `fr|en`, otherwise `400 UNSUPPORTED_LOCALE`.
- Exactly one of: `url` **or** `snapshot_key`.
- If `snapshot_key` is provided, `locale` MUST match the snapshot (otherwise `400 INVALID_REQUEST`).
- `options.copy_ready` is optional (default `false`).
- `timeouts_ms` is optional (default: server values); if present, all values are integers (ms) ≥ 0.
- `options.copy_ready=true`:
  - applies only to the **Top 5 tickets** in the HTML (see `AUDIT_PIPELINE_SPEC` §11),
  - **does not change** tickets/evidences/sorting/IDs/CSV,
  - may change `audit_key` / `render_key` (because the HTML/PDF change),
  - does not change `run_key`.

### 6.3 Response (success “complete”)
Minimal example (1 ticket + 1 evidence).

```json
{
  "status": "ok",
  "mode": "solo",
  "keys": {
    "product_key": "prod_1f...",
    "snapshot_key": "snap_aa...",
    "run_key": "run_31...",
    "audit_key": "audit_9c...",
    "render_key": "render_72..."
  },
  "versions": {
    "REPORT_OUTLINE_VERSION": "3.1",
    "TICKET_SCHEMA_VERSION": "2",
    "EVIDENCE_SCHEMA_VERSION": "2",
    "CSV_EXPORT_VERSION": "1",
    "DETECTORS_SPEC_VERSION": "1.3",
    "NORMALIZE_VERSION": "1.0.0",
    "SCORING_VERSION": "2.2.0",
    "ENGINE_VERSION": "1.0.0",
    "RENDER_VERSION": "1.0.0"
  },
  "report_meta": {
    "evidence_completeness": "complete",
    "alignment_level": null
  },
  "artifacts": {
    "html_ref": "storage://runs/run_31/report.html",
    "pdf_ref": "storage://runs/run_31/report.pdf",
    "csv_ref": "storage://runs/run_31/tickets.csv"
  },
  "exports": {
    "tickets": [
      {
        "ticket_id": "T_solo_offer_clarity_SIG_OFFER_02_pdp_01",
        "mode": "solo",
        "title": "Display price in the buybox",
        "impact": "high",
        "effort": "small",
        "risk": "low",
        "confidence": "high",
        "category": "offer_clarity",
        "why": "Price is not detectable in the purchase zone, which increases friction at decision time.",
        "evidence_refs": ["E_page_a_mobile_detection_buybox_detect_01"],
        "how_to": [
          "Locate the price component in the PDP template.",
          "Display the price in the buybox (near the CTA) on mobile and desktop.",
          "Verify display for variants and promos (compare_at)."
        ],
        "validation": [
          "On mobile, price is visible in the buybox without scroll.",
          "Price is consistent with the selected variant."
        ],
        "quick_win": true,
        "owner_hint": "design",
        "notes": null
      }
    ],
    "evidences": [
      {
        "evidence_id": "E_page_a_mobile_detection_buybox_detect_01",
        "level": "A",
        "type": "detection",
        "label": "buybox_detect",
        "source": "page_a",
        "viewport": "mobile",
        "timestamp": "2026-01-17T21:00:00+01:00",
        "ref": "#evidence-E_page_a_mobile_detection_buybox_detect_01",
        "details": {
          "detector_id": "buybox_detector",
          "method": "dom_strict",
          "data_sources_used": ["dom", "screenshots"],
          "facts_summary": {
            "buybox_detected": true,
            "primary_cta_text": "Add to cart"
          }
        }
      }
    ]
  },
  "errors": [],
  "timings_ms": {
    "capture_total": 12000,
    "detectors_total": 4000,
    "scoring_total": 2500,
    "report_total": 1800,
    "render_pdf_total": 9000,
    "end_to_end": 29300
  }
}
```

### 6.4 Response (success “degraded”)
Rule: if `artifacts.html_ref` exists ⇒ `status="ok"` even if evidence/artifacts are partial (degraded mode).

```json
{
  "status": "ok",
  "mode": "solo",
  "keys": {
    "product_key": "prod_1f...",
    "snapshot_key": "snap_aa...",
    "run_key": "run_32...",
    "audit_key": "audit_9d...",
    "render_key": "render_73..."
  },
  "versions": {
    "REPORT_OUTLINE_VERSION": "3.1",
    "TICKET_SCHEMA_VERSION": "2",
    "EVIDENCE_SCHEMA_VERSION": "2",
    "CSV_EXPORT_VERSION": "1",
    "DETECTORS_SPEC_VERSION": "1.3",
    "NORMALIZE_VERSION": "1.0.0",
    "SCORING_VERSION": "2.2.0",
    "ENGINE_VERSION": "1.0.0",
    "RENDER_VERSION": "1.0.0"
  },
  "report_meta": {
    "evidence_completeness": "partial",
    "alignment_level": null
  },
  "artifacts": {
    "html_ref": "storage://runs/run_32/report.html",
    "pdf_ref": "storage://runs/run_32/report.pdf",
    "csv_ref": "storage://runs/run_32/tickets.csv"
  },
  "exports": { "tickets": [], "evidences": [] },
  "errors": [
    {
      "code": "CAPTURE_BLOCKED_BY_COOKIE_CONSENT",
      "stage": "capture",
      "message": "Cookie consent overlay blocked screenshot capture on mobile viewport.",
      "missing_evidence_reason": "blocked_by_cookie_consent",
      "source": "page_a"
    }
  ],
  "timings_ms": {
    "capture_total": 45000,
    "detectors_total": 3000,
    "scoring_total": 2000,
    "report_total": 1500,
    "render_pdf_total": 10000,
    "end_to_end": 61500
  }
}
```

---

## 7) POST `/api/audit/duo`

### 7.1 Request (AB)
```json
{
  "compare_type": "ab",
  "locale": "en",
  "urls": {
    "page_a": "https://brand-a.com/products/x",
    "page_b": "https://brand-b.com/products/y"
  },
  "options": {
    "copy_ready": true
  },
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  }
}
```

### 7.2 Request (Before/After)
```json
{
  "compare_type": "before_after",
  "locale": "fr",
  "urls": {
    "before": "https://example.com/products/abc?v=2026-12-01",
    "after": "https://example.com/products/abc?v=2026-01-10"
  },
  "options": {
    "copy_ready": false
  },
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  }
}
```

### 7.3 Request (Replay via `snapshot_key`)
```json
{
  "compare_type": "ab",
  "locale": "en",
  "snapshot_key": "snap_...",
  "options": { "copy_ready": false },
  "timeouts_ms": {
    "capture_per_source": 45000,
    "detectors_per_source": 8000,
    "scoring_total": 12000,
    "report_total": 8000,
    "render_pdf_total": 45000
  }
}
```

Rules:
- `compare_type` ∈ `ab|before_after`, otherwise `400 UNSUPPORTED_COMPARE_TYPE`.
- If `snapshot_key` is present, `urls` MUST be absent.
- If `snapshot_key` is present, `compare_type` MUST be consistent with that snapshot (otherwise `400 INVALID_REQUEST`).
- AB: `urls.page_a` and `urls.page_b` required.
- Before/After: `urls.before` and `urls.after` required.
- `options.copy_ready` and `timeouts_ms` follow the same rules as SOLO (§6.2).

### 7.4 Response (DUO success)
```json
{
  "status": "ok",
  "mode": "duo_ab",
  "keys": {
    "product_key": "prod_2a...",
    "snapshot_key": "snap_bb...",
    "run_key": "run_90...",
    "audit_key": "audit_11...",
    "render_key": "render_aa..."
  },
  "versions": {
    "REPORT_OUTLINE_VERSION": "3.1",
    "TICKET_SCHEMA_VERSION": "2",
    "EVIDENCE_SCHEMA_VERSION": "2",
    "CSV_EXPORT_VERSION": "1",
    "DETECTORS_SPEC_VERSION": "1.3",
    "NORMALIZE_VERSION": "1.0.0",
    "SCORING_VERSION": "2.2.0",
    "ENGINE_VERSION": "1.0.0",
    "RENDER_VERSION": "1.0.0"
  },
  "report_meta": {
    "evidence_completeness": "complete",
    "alignment_level": "medium"
  },
  "artifacts": {
    "html_ref": "storage://runs/run_90/report.html",
    "pdf_ref": "storage://runs/run_90/report.pdf",
    "csv_ref": "storage://runs/run_90/tickets.csv"
  },
  "exports": { "tickets": [], "evidences": [] },
  "errors": [],
  "timings_ms": {
    "capture_total": 22000,
    "detectors_total": 7000,
    "scoring_total": 9000,
    "report_total": 4000,
    "render_pdf_total": 10000,
    "end_to_end": 52000
  }
}
```

### 7.5 Response (DUO degraded — insufficient evidence + alignment low)
```json
{
  "status": "ok",
  "mode": "duo_before_after",
  "keys": {
    "product_key": "prod_2b...",
    "snapshot_key": "snap_cc...",
    "run_key": "run_91...",
    "audit_key": "audit_12...",
    "render_key": "render_ab..."
  },
  "versions": {
    "REPORT_OUTLINE_VERSION": "3.1",
    "TICKET_SCHEMA_VERSION": "2",
    "EVIDENCE_SCHEMA_VERSION": "2",
    "CSV_EXPORT_VERSION": "1",
    "DETECTORS_SPEC_VERSION": "1.3",
    "NORMALIZE_VERSION": "1.0.0",
    "SCORING_VERSION": "2.2.0",
    "ENGINE_VERSION": "1.0.0",
    "RENDER_VERSION": "1.0.0"
  },
  "report_meta": {
    "evidence_completeness": "insufficient",
    "alignment_level": "low"
  },
  "artifacts": {
    "html_ref": "storage://runs/run_91/report.html",
    "pdf_ref": "storage://runs/run_91/report.pdf",
    "csv_ref": "storage://runs/run_91/tickets.csv"
  },
  "exports": { "tickets": [], "evidences": [] },
  "errors": [
    {
      "code": "CAPTURE_TIMEOUT",
      "stage": "capture",
      "message": "Navigation timed out on desktop viewport.",
      "missing_evidence_reason": "timeout",
      "source": "after"
    },
    {
      "code": "CAPTURE_NAVIGATION_INTERCEPTED",
      "stage": "capture",
      "message": "Navigation was intercepted (redirect/anti-bot).",
      "missing_evidence_reason": "navigation_intercepted",
      "source": "before"
    }
  ],
  "timings_ms": {
    "capture_total": 90000,
    "detectors_total": 6000,
    "scoring_total": 9000,
    "report_total": 5000,
    "render_pdf_total": 12000,
    "end_to_end": 122000
  }
}
```

---

## 8) Errors (contract)

### 8.1 HTTP status
- **200**: `status="ok"` (including degraded) if SSOT HTML is produced.
- **400**: invalid payload / invalid enum.
- **401**: `UNAUTHORIZED` (if auth enabled).
- **403**: `FORBIDDEN_URL` (SSRF / forbidden host/protocol).
- **429**: `RATE_LIMITED`.
- **500**: `AUDIT_FAILED` (no SSOT HTML possible).

### 8.2 Request-level codes (minimum)
- `INVALID_REQUEST` (400)
- `UNSUPPORTED_LOCALE` (400)
- `UNSUPPORTED_COMPARE_TYPE` (400)
- `FORBIDDEN_URL` (403)
- `RATE_LIMITED` (429)
- `UNAUTHORIZED` (401)

### 8.3 `errors[]` (run-level)
Minimal (stable) format:
- `code` (codified string)
- `stage` (macro enum)
- `message` (string)
- `missing_evidence_reason` (6 enums or `null`)
- `source` (`page_a|page_b|before|after|na`)

Note: `missing_evidence_reason` is filled only for evidence/capture-related errors; otherwise it MUST remain `null`.

### 8.4 Minimal mapping codes → reasons (SSOT)
| code | missing_evidence_reason |
|---|---|
| `CAPTURE_BLOCKED_BY_COOKIE_CONSENT` | `blocked_by_cookie_consent` |
| `CAPTURE_BLOCKED_BY_POPUP` | `blocked_by_popup` |
| `CAPTURE_INFINITE_SCROLL_OR_LAZYLOAD` | `infinite_scroll_or_lazyload` |
| `CAPTURE_NAVIGATION_INTERCEPTED` | `navigation_intercepted` |
| `CAPTURE_TIMEOUT` | `timeout` |
| `CAPTURE_UNKNOWN_RENDER_ISSUE` | `unknown_render_issue` |

---

## 9) Determinism (contract)

### 9.1 IDs (reminder)
ID formats are SSOT and MUST match `SCORING_AND_DETECTION` v2.2:
- `ticket_id = T_<mode>_<category>_<signal_id>_<scope>_<idx>`
- `evidence_id = E_<source>_<viewport>_<type>_<label>_<idx>`

### 9.2 Stable sorting (tickets) (normative)
Per `SCORING_AND_DETECTION` v2.2 §5.2:
1) `PriorityScore` descending  
2) `impact` descending  
3) `confidence` descending  
4) `effort` ascending  
5) `risk` ascending  
6) `ticket_id` asc

### 9.2bis Stable sorting (evidences) (normative)
Per `EVIDENCE_PACK_SPEC` v1.2 §14:
1) `source` (page_a, page_b, before, after)
2) `type` (screenshot, measurement, detection)
3) `viewport` (mobile, desktop, na)
4) `label`
5) `evidence_id`

### 9.3 Truncation (hard rule)
- Always **sort** then truncate (N). Never sample.
- If truncation is applied to internal lists, the annotation MUST remain internal (e.g., `Evidence.details.truncated=true`).

### 9.4 Timestamps (hard rule)
Per `EVIDENCE_PACK_SPEC` v1.2 §8:
- `exports.evidences[].timestamp` MUST come from the **snapshot/capture timestamp** of the source (or from the artefact if more precise).
- Forbidden: `now()` at render time.

---

## 10) Deliverable compatibility (HTML = SSOT)

### 10.1 Evidence pack: anchoring (hard rule)
Per `EVIDENCE_PACK_SPEC` v1.2 §6:
- `Evidence.ref = "#evidence-<evidence_id>"`
- evidence HTML wrapper: `id="evidence-<evidence_id>"`
- ticket HTML wrapper: `id="ticket-<ticket_id>"`

Any storage/path/json pointer is allowed only in `Evidence.details`.

### 10.2 Missing evidence (HTML-only)
- The detailed “Missing evidence” table is in the HTML (SSOT).
- The API exposes only:
  - `report_meta.evidence_completeness` (worst of sources in DUO)
  - `errors[]` with `source` + `missing_evidence_reason`

### 10.3 Copy-ready
Per `AUDIT_PIPELINE_SPEC` §11:
- `options.copy_ready=true` applies only to the **Top 5 tickets** (HTML).
- Exports `tickets/evidences/csv` remain identical (IDs/order/export content).

---

## 11) DoD (Definition of Done) — API (release gate)
- [ ] Endpoints: `POST /api/audit/solo` + `POST /api/audit/duo` (AB + Before/After).
- [ ] Strict payload validation: 400 on invalid payload / invalid enum.
- [ ] `versions` exposed and consistent: 3.1 / 2 / 2 / 1 / 1.3 + runtime versions.
- [ ] `report_meta.evidence_completeness` matches Set A/B gating; DUO = worst of sources.
- [ ] `report_meta.alignment_level=null` in SOLO; `high|medium|low` in DUO.
- [ ] Strict exports: Ticket v2 / Evidence v2 / CSV v1; **no added field/column**.
- [ ] `Evidence.ref` and HTML wrappers compliant (`evidence-*`, `ticket-*`).
- [ ] Stable ticket sorting per `SCORING_AND_DETECTION` §5.2.
- [ ] Stable evidence sorting per `EVIDENCE_PACK_SPEC` §14.
- [ ] `exports.evidences[].timestamp` from snapshot/capture (never `now()` at render).
- [ ] `missing_evidence_reason` ∈ 6 SSOT enums (or `null`), never anything else.
- [ ] Degraded mode: if SSOT HTML produced ⇒ `status="ok"` + `errors[]` (explicit limitations).
- [ ] Smoke: SOLO + DUO AB + DUO BA; cookie/popup/timeout/navigation_intercept cases; rerun via `snapshot_key` ⇒ same IDs/order.

*Last Updated: 2026-02-08*
