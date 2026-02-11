/**
 * ⚠️ SSOT CONTRACT — Evidence Schema v2 (SSOT)
 *
 * THIS FILE IS A STABLE CONTRACT.
 * ❌ DO NOT MODIFY without prior SSOT document update:
 *    - docs/REPORT_OUTLINE.md (section 9)
 *    - docs/SCORING_AND_DETECTION.md (section 3.2)
 *
 * Any breaking change requires:
 * 1. Bump EVIDENCE_SCHEMA_VERSION in SSOT docs
 * 2. Update src/ssot/versions.ts
 * 3. Migration of existing data
 *
 * @version EVIDENCE_SCHEMA_VERSION = 2
 * @reference docs/REPORT_OUTLINE.md section 9
 * @reference docs/SCORING_AND_DETECTION.md section 3.2
 */

import { z } from 'zod';

/**
 * Evidence level (A/B/C)
 *
 * Reference: docs/REPORT_OUTLINE.md section 2.1
 *
 * - **A (strong)**: Clear and directly relevant evidence
 *   - e.g.: clear screenshot showing presence/absence, unambiguous detection, measured value with method
 *
 * - **B (medium)**: Relevant but incomplete evidence
 *   - e.g.: lazy-load, popup, partially visible section
 *
 * - **C (weak)**: Plausible inference without sufficient evidence
 *   - ⚠️ Allowed ONLY in Appendix
 *
 * Mapping rule to confidence (SSOT):
 * - Evidence A ⇒ confidence=high
 * - Evidence B ⇒ confidence=medium
 * - Evidence C ⇒ confidence=low (Appendix only)
 */
export const EvidenceLevelSchema = z.enum(['A', 'B', 'C']);
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;

/**
 * Evidence type
 *
 * Reference: docs/SCORING_AND_DETECTION.md section 3.2
 *
 * - **screenshot**: Screenshot (mobile/desktop viewport)
 * - **measurement**: Measured value (perf, weight, metrics)
 * - **detection**: DOM/heuristic detection (element presence/absence)
 */
export const EvidenceTypeSchema = z.enum(['screenshot', 'measurement', 'detection']);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

/**
 * Evidence source (per SOLO/DUO mode)
 *
 * Reference: docs/SCORING_AND_DETECTION.md section 4.3
 *
 * - SOLO: `page_a` only
 * - DUO AB: `page_a` (you) vs `page_b` (competitor)
 * - DUO Before/After: `before` vs `after`
 *
 * ⚠️ Note: `gap` and `diff` exist for `ticket_id.scope` and `csv.url_context`,
 * but Evidence.source remains strictly `page_a|page_b|before|after`.
 */
export const EvidenceSourceSchema = z.enum(['page_a', 'page_b', 'before', 'after']);
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

/**
 * Viewport (mobile/desktop/na)
 *
 * Reference: docs/SCORING_AND_DETECTION.md section 2.1
 *
 * - **mobile**: 390×844 (mandatory standard viewport)
 * - **desktop**: 1440×900 (mandatory standard viewport)
 * - **na**: Not applicable (for DOM detections without screenshot)
 */
export const EvidenceViewportSchema = z.enum(['mobile', 'desktop', 'na']);
export type EvidenceViewport = z.infer<typeof EvidenceViewportSchema>;

/**
 * Evidence Schema v2 (stable format)
 *
 * ⚠️ HARD RULES (non-negotiable):
 *
 * 1. **Required HTML anchor**:
 *    - `ref` MUST be in format `#evidence-<evidence_id>`
 *    - Required HTML wrapper: `<div id="evidence-<evidence_id>">`
 *    - Any storage path/URL/JSON pointer goes in `details`
 *
 * 2. **Deterministic evidence_id**:
 *    - Format: `E_<source>_<viewport>_<type>_<label>_<idx>`
 *    - e.g.: `E_page_a_mobile_screenshot_above_fold_01`
 *
 * 3. **ISO 8601 timestamp**:
 *    - Strict format: `YYYY-MM-DDTHH:mm:ss.sssZ`
 *
 * @reference docs/REPORT_OUTLINE.md section 9.1
 * @reference docs/SCORING_AND_DETECTION.md section 3.2
 */
export const EvidenceV2Schema = z.object({
  /**
   * Unique deterministic identifier
   * Format: E_<source>_<viewport>_<type>_<label>_<idx>
   * e.g.: E_page_a_mobile_screenshot_above_fold_01
   */
  evidence_id: z.string(),

  /**
   * Evidence level (A=strong, B=medium, C=weak)
   * ⚠️ C allowed ONLY in Appendix
   */
  level: EvidenceLevelSchema,

  /**
   * Evidence type
   */
  type: EvidenceTypeSchema,

  /**
   * Short descriptive label
   * e.g.: "Above fold (mobile)", "LCP measurement", "Buybox detection"
   */
  label: z.string(),

  /**
   * Source (page_a/page_b/before/after)
   */
  source: EvidenceSourceSchema,

  /**
   * Viewport (mobile/desktop/na)
   */
  viewport: EvidenceViewportSchema,

  /**
   * ISO 8601 timestamp (when evidence was captured)
   * Format: YYYY-MM-DDTHH:mm:ss.sssZ
   */
  timestamp: z.string().datetime(),

  /**
   * ⚠️ HARD RULE: Stable HTML anchor
   *
   * Required format: `#evidence-<evidence_id>`
   * e.g.: `#evidence-E_page_a_mobile_screenshot_above_fold_01`
   *
   * Any storage path, URL, or JSON pointer goes in `details`.
   */
  ref: z.string().regex(/^#evidence-E_/, {
    message: "ref MUST start with '#evidence-E_' (format: #evidence-<evidence_id>)",
  }),

  /**
   * Flexible details object
   *
   * May contain (per type):
   *
   * - **screenshot**:
   *   - storage_path: string (actual storage path)
   *   - full_url: string (full URL if CDN)
   *   - width: number
   *   - height: number
   *   - selector?: string (captured DOM selector)
   *
   * - **measurement**:
   *   - metric: string (e.g.: "LCP", "CLS", "image_size")
   *   - value: number | string
   *   - unit?: string (e.g.: "ms", "KB", "score")
   *   - method: string (e.g.: "Lighthouse Lab", "DOM API")
   *   - threshold?: number (exceeded threshold)
   *   - notes?: string
   *
   * - **detection**:
   *   - selector?: string (DOM selector)
   *   - found: boolean
   *   - count?: number (if multiple)
   *   - text_snippet?: string
   *   - notes?: string
   *
   * ⚠️ No fixed schema here (flexibility for evolution without version bump).
   * Never add stable export fields here (use top-level fields only).
   */
  details: z.record(z.unknown()).optional(),
});

export type EvidenceV2 = z.infer<typeof EvidenceV2Schema>;

/**
 * Helper: Generate a deterministic evidence_id
 *
 * Format: E_<source>_<viewport>_<type>_<label>_<idx>
 *
 * @param source - Source (page_a/page_b/before/after)
 * @param viewport - Viewport (mobile/desktop/na)
 * @param type - Type (screenshot/measurement/detection)
 * @param label - Descriptive label (will be slugified)
 * @param idx - Index (1-based, padded to 2 digits)
 *
 * @example
 * generateEvidenceId('page_a', 'mobile', 'screenshot', 'Above Fold', 1)
 * // => "E_page_a_mobile_screenshot_above_fold_01"
 *
 * @reference docs/SCORING_AND_DETECTION.md section 4.3
 */
export function generateEvidenceId(
  source: EvidenceSource,
  viewport: EvidenceViewport,
  type: EvidenceType,
  label: string,
  idx: number = 1
): string {
  // Pad index to 2 digits
  const paddedIdx = idx.toString().padStart(2, '0');

  // Slugify label (lowercase, replace non-alphanum with underscore)
  const slugLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  return `E_${source}_${viewport}_${type}_${slugLabel}_${paddedIdx}`;
}

/**
 * Helper: Generate the corresponding HTML anchor
 *
 * Required format: #evidence-<evidence_id>
 *
 * @param evidenceId - Evidence ID
 * @returns HTML anchor in SSOT format
 *
 * @example
 * generateEvidenceAnchor('E_page_a_mobile_screenshot_above_fold_01')
 * // => "#evidence-E_page_a_mobile_screenshot_above_fold_01"
 *
 * @reference docs/REPORT_OUTLINE.md section 9.1.1
 */
export function generateEvidenceAnchor(evidenceId: string): string {
  return `#evidence-${evidenceId}`;
}

/**
 * Evidence Completeness (SSOT)
 *
 * Indicator of evidence pack completeness.
 *
 * Reference: docs/REPORT_OUTLINE.md section 3.2
 *
 * - **complete**: Set A reached
 *   - `above_fold_mobile` + `above_fold_desktop` + `full_page_mobile`
 *
 * - **partial**: Set B reached (but not Set A)
 *   - `above_fold_mobile` + `cta_area_mobile` + `details_section`
 *
 * - **insufficient**: No set reached
 *   - "Evidence incomplete" badge on cover
 *   - Move dependent tickets to Appendix
 *
 * DUO (AB / Before-After) — conservative rule:
 * - Compute completeness **per source**
 * - Cover displays = **worst of sources** (insufficient > partial > complete)
 */
export const EvidenceCompletenessSchema = z.enum(['complete', 'partial', 'insufficient']);
export type EvidenceCompleteness = z.infer<typeof EvidenceCompletenessSchema>;

/**
 * Standard failure reasons (SSOT)
 *
 * Used to explain missing evidence in "Missing evidence" table.
 *
 * Reference: docs/REPORT_OUTLINE.md section 3.4
 *
 * - **blocked_by_cookie_consent**: Cookie consent popup blocking
 * - **blocked_by_popup**: Popup/modal blocking (other than cookies)
 * - **infinite_scroll_or_lazyload**: Lazy-load content not loadable
 * - **navigation_intercepted**: Navigation intercepted (SPA, redirect)
 * - **timeout**: Timeout reached before full render
 * - **unknown_render_issue**: Unidentified render issue
 */
export const MissingEvidenceReasonSchema = z.enum([
  'blocked_by_cookie_consent',
  'blocked_by_popup',
  'infinite_scroll_or_lazyload',
  'navigation_intercepted',
  'timeout',
  'unknown_render_issue',
]);
export type MissingEvidenceReason = z.infer<typeof MissingEvidenceReasonSchema>;

/**
 * Screenshot metadata (optional, for details)
 *
 * Recommended (non-enforced) structure for details.screenshot_metadata
 */
export const ScreenshotMetadataSchema = z.object({
  storage_path: z.string().optional(),
  full_url: z.string().url().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  selector: z.string().optional(),
  scroll_y: z.number().optional(),
}).optional();

export type ScreenshotMetadata = z.infer<typeof ScreenshotMetadataSchema>;

/**
 * Measurement metadata (optional, for details)
 *
 * Recommended (non-enforced) structure for details.measurement_metadata
 */
export const MeasurementMetadataSchema = z.object({
  metric: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  method: z.string(),
  threshold: z.number().optional(),
  notes: z.string().optional(),
}).optional();

export type MeasurementMetadata = z.infer<typeof MeasurementMetadataSchema>;
