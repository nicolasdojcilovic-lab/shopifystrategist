# contracts/export/ — Stable Export Schemas (Public API)

This directory contains Zod schemas for **stable** export formats (anti-drift).

## Files

### `ticket.v2.ts`
Ticket schema (TICKET_SCHEMA_VERSION = 2).

**Fields (stable format)**:
- `ticket_id` : `T_<mode>_<category>_<signal_id>_<scope>_<idx>`
- `mode` : `solo | duo_ab | duo_before_after`
- `title`
- `impact` : `high | medium | low`
- `effort` : `s | m | l` (REGISTRY SSOT)
- `risk` : `low | medium | high`
- `confidence` : `high | medium | low`
- `category` : `offer_clarity | trust | media | ux | performance | seo_basics | accessibility | comparison`
- `why`
- `evidence_refs` : `string[]` (≥ 1)
- `how_to` : `string[]` (3–7 steps)
- `validation` : `string[]`
- `quick_win` : `boolean`
- `owner` : `cro | copy | design | dev | merch | data` (REGISTRY SSOT)
- `notes` : `string` (optional)

**SSOT Reference**: `docs/REPORT_OUTLINE.md` section 8.

### `evidence.v2.ts`
Evidence schema (EVIDENCE_SCHEMA_VERSION = 2).

**Fields (stable format)**:
- `evidence_id` : `E_<source>_<viewport>_<type>_<label>_<idx>`
- `level` : `A | B | C`
- `type` : `screenshot | measurement | detection`
- `label`
- `source` : `page_a | page_b | before | after`
- `viewport` : `mobile | desktop | na`
- `timestamp` : ISO 8601
- `ref` : **HTML anchor** `#evidence-<evidence_id>` (hard rule)
- `details` : flexible object (metric, value, method, threshold)

**SSOT Reference**: `docs/REPORT_OUTLINE.md` section 9.

**HARD RULE**: `Evidence.ref` MUST point to anchor `#evidence-<evidence_id>`.
Any storage path/URL/JSON pointer goes in `details`.

### `csv.v1.ts`
CSV Export schema (CSV_EXPORT_VERSION = 1).

**Columns (stable format)**:
- `ticket_id`, `mode`, `title`, `impact`, `effort`, `risk`, `confidence`, `category`
- `why`, `evidence_refs` (separator `|`)
- `how_to` (separator `|`), `validation` (separator `|`)
- `quick_win`, `owner`, `url_context`

**SSOT Reference**: `docs/REPORT_OUTLINE.md` section 12.

---

## Anti-Drift Rules (Non-Negotiable)

1. **No new export field** without:
   - Corresponding version bump (major if breaking)
   - SSOT docs update
   - Contract-first validation

2. **HTML report = SSOT**: PDF/CSV are derived from HTML.

3. **Evidence-based**: Each ticket MUST have `evidence_refs.length >= 1`.

4. **Required HTML wrappers**:
   - Ticket: `id="ticket-<ticket_id>"`
   - Evidence: `id="evidence-<evidence_id>"`

5. **Determinism**: Same inputs + same versions → same IDs + same sort order.

Any modification to this directory MUST be preceded by SSOT validation.

*Last Updated: 2026-02-08*
