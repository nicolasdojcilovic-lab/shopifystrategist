/**
 * ⚠️ SSOT CONTRACT — Ticket Schema v2 (SSOT)
 *
 * THIS FILE IS A STABLE CONTRACT.
 * ❌ DO NOT MODIFY without prior SSOT document update:
 *    - docs/REPORT_OUTLINE.md (section 8)
 *    - docs/SCORING_AND_DETECTION.md (section 3.1)
 *
 * Any breaking change requires:
 * 1. Bump TICKET_SCHEMA_VERSION in SSOT docs
 * 2. Update src/ssot/versions.ts
 * 3. Migration of existing data
 *
 * @version TICKET_SCHEMA_VERSION = 2
 * @reference docs/REPORT_OUTLINE.md section 8
 * @reference docs/SCORING_AND_DETECTION.md section 3.1
 */

import { z } from 'zod';

/**
 * Report mode (SOLO vs DUO)
 *
 * Reference: docs/REPORT_OUTLINE.md section 8.1
 *
 * - **solo**: Instant Teardown (1 page audited)
 * - **duo_ab**: AB Battlecard (you vs competitor)
 * - **duo_before_after**: Before/After Diff (measured changes)
 */
export const TicketModeSchema = z.enum(['solo', 'duo_ab', 'duo_before_after']);
export type TicketMode = z.infer<typeof TicketModeSchema>;

/**
 * Business impact (high/medium/low)
 *
 * Reference: docs/SCORING_AND_DETECTION.md section 5.1
 *
 * Mapping for PriorityScore:
 * - high = 3
 * - medium = 2
 * - low = 1
 */
export const TicketImpactSchema = z.enum(['high', 'medium', 'low']);
export type TicketImpact = z.infer<typeof TicketImpactSchema>;

/**
 * Implementation effort (s|m|l — REGISTRY SSOT)
 *
 * Reference: docs/SSOT/REGISTRY.md — effort: s|m|l
 * Reference: docs/SCORING_AND_DETECTION.md section 5.1
 *
 * Mapping for PriorityScore:
 * - s = 1 (<1 day)
 * - m = 2 (1-3 days)
 * - l = 3 (>3 days)
 *
 * Top Actions guardrail:
 * - Max 2 tickets effort=l (except structural changes in before/after)
 */
export const TicketEffortSchema = z.enum(['s', 'm', 'l']);
export type TicketEffort = z.infer<typeof TicketEffortSchema>;

/**
 * Implementation risk (low/medium/high)
 *
 * Reference: docs/SCORING_AND_DETECTION.md section 5.1
 *
 * Mapping for PriorityScore:
 * - low = 1
 * - medium = 2
 * - high = 3
 */
export const TicketRiskSchema = z.enum(['low', 'medium', 'high']);
export type TicketRisk = z.infer<typeof TicketRiskSchema>;

/**
 * Confidence level (high/medium/low)
 *
 * Reference: docs/REPORT_OUTLINE.md section 8.2
 *
 * Mapping for PriorityScore:
 * - high = 3
 * - medium = 2
 * - low = 1
 *
 * Mapping rule from Evidence.level (SSOT):
 * - Evidence A ⇒ confidence=high
 * - Evidence B ⇒ confidence=medium
 * - Evidence C ⇒ confidence=low (Appendix ONLY)
 *
 * Top Actions guardrail:
 * - ⚠️ EXCLUDE confidence=low (reserve for Appendix)
 */
export const TicketConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type TicketConfidence = z.infer<typeof TicketConfidenceSchema>;

/**
 * Ticket categories (SSOT stable)
 *
 * Reference: docs/REPORT_OUTLINE.md section 8.1
 *
 * - **offer_clarity**: Price, CTA, variants, benefits, shipping/returns
 * - **trust**: Reviews, reassurance, guarantees, contact/support
 * - **media**: Gallery, video, image quality
 * - **ux**: Sticky ATC, FAQ, navigation, mobile UX
 * - **performance**: Heavy images, Lighthouse, third-party scripts
 * - **seo_basics**: H1, meta title/description
 * - **accessibility**: Alt text, contrast, labels
 * - **comparison**: DUO comparative tickets (gaps, diffs)
 *
 * Diversity rules (Top Actions):
 * - Min 1 offer_clarity
 * - Min 1 ux
 * - Min 1 performance OR media
 * - Min 1 trust (if signal detected)
 * - Max 4 tickets of same category
 */
export const TicketCategorySchema = z.enum([
  'offer_clarity',
  'trust',
  'media',
  'ux',
  'performance',
  'seo_basics',
  'accessibility',
  'comparison',
]);
export type TicketCategory = z.infer<typeof TicketCategorySchema>;

/**
 * Owner (REGISTRY.md strict)
 * cro|copy|design|dev|merch|data
 */
export const REGISTRY_OWNERS = ['cro', 'copy', 'design', 'dev', 'merch', 'data'] as const;
export const TicketOwnerSchema = z.enum(REGISTRY_OWNERS);
export type TicketOwner = z.infer<typeof TicketOwnerSchema>;

/** Coerce legacy owner_hint → owner. content|ops → dev (REGISTRY: cro|copy|design|dev|merch|data) */
function normalizeOwner(val: unknown): TicketOwner {
  const s = String(val ?? '').toLowerCase();
  if (REGISTRY_OWNERS.includes(s as TicketOwner)) return s as TicketOwner;
  if (['content', 'ops'].includes(s)) return 'dev';
  return 'dev';
}

/** @deprecated Use owner. Alias for backward compat. */
export const TicketOwnerHintSchema = TicketOwnerSchema;
export type TicketOwnerHint = z.infer<typeof TicketOwnerHintSchema>;

/** rule_id REGISTRY (ex: R.PDP.CTA.MISSING_ATF) */
export const TicketRuleIdSchema = z.string().regex(/^R\.[A-Z]+\.[A-Z_]+(\.[A-Z_]+)*$/).optional();
export type TicketRuleId = z.infer<typeof TicketRuleIdSchema>;

/** criteria_id REGISTRY (ex: C.CORE.CTA) */
export const TicketCriteriaIdSchema = z.string().regex(/^C\.[A-Z]+\.[A-Z_]+$/).optional();
export type TicketCriteriaId = z.infer<typeof TicketCriteriaIdSchema>;

/**
 * Ticket Schema v2 (stable format)
 *
 * ⚠️ HARD RULES (non-negotiable):
 *
 * 1. **Evidence-based**:
 *    - `evidence_refs` MUST contain ≥ 1 evidence_id
 *    - Each referenced evidence_id MUST exist in Evidence pack
 *
 * 2. **Deterministic ticket_id**:
 *    - Format: `T_<mode>_<category>_<signal_id>_<scope>_<idx>`
 *    - e.g.: `T_solo_offer_clarity_SIG_OFFER_02_pdp_01`
 *
 * 3. **Executable how_to**:
 *    - 3–7 steps (bullets)
 *    - Each step must be actionable (no filler)
 *
 * 4. **Required HTML wrapper**:
 *    - Each exported ticket MUST have: `<div id="ticket-<ticket_id>">`
 *
 * @reference docs/REPORT_OUTLINE.md section 8.1
 * @reference docs/SCORING_AND_DETECTION.md section 3.1
 */
const TicketV2ObjectSchema = z.object({
  /**
   * Unique deterministic identifier
   *
   * Format: T_<mode>_<category>_<signal_id>_<scope>_<idx>
   * 
   * Exemples:
   * - SOLO: T_solo_offer_clarity_SIG_OFFER_02_pdp_01
   * - DUO AB: T_duo_ab_comparison_SIG_DUO_01_gap_01
   * - DUO Before/After: T_duo_before_after_performance_SIG_DUO_03_diff_01
   * 
   * Scope:
   * - SOLO: pdp
   * - DUO AB: page_a | page_b | gap
   * - DUO Before/After: before | after | diff
   * 
   * @reference docs/SCORING_AND_DETECTION.md section 4.1
   */
  ticket_id: z.string(),

  /**
   * Report mode (solo/duo_ab/duo_before_after)
   */
  mode: TicketModeSchema,

  /**
   * Ticket title (short, actionable)
   *
   * Examples:
   * - "Display price in the buybox"
   * - "Add FAQ oriented toward objections"
   * - "Optimize images (formats, compression)"
   */
  title: z.string(),

  /**
   * Impact business (high/medium/low)
   * 
   * Utilisé pour PriorityScore (impact*3)
   */
  impact: TicketImpactSchema,

  /**
   * Implementation effort (s|m|l — REGISTRY SSOT)
   *
   * Used for PriorityScore (effort*-2)
   *
   * ⚠️ Guardrail: Max 2 tickets effort=l in Top Actions
   */
  effort: TicketEffortSchema,

  /**
   * Risque d'implémentation (low/medium/high)
   * 
   * Utilisé pour PriorityScore (risk*-1)
   */
  risk: TicketRiskSchema,

  /**
   * Confidence level (high/medium/low)
   *
   * Mapping rule from Evidence.level:
   * - Preuve A ⇒ confidence=high
   * - Preuve B ⇒ confidence=medium
   * - Preuve C ⇒ confidence=low (Appendix UNIQUEMENT)
   * 
   * Utilisé pour PriorityScore (confidence*2)
   * 
   * ⚠️ Garde-fou : Top Actions EXCLUT confidence=low
   */
  confidence: TicketConfidenceSchema,

  /**
   * Ticket category
   *
   * Diversity rules (Top Actions):
   * - Min 1 offer_clarity
   * - Min 1 ux
   * - Min 1 performance OU media
   * - Min 1 trust (si signal détecté)
   * - Max 4 tickets d'une même catégorie
   */
  category: TicketCategorySchema,

  /**
   * Why this ticket? (context + detected problem)
   *
   * Recommended structure:
   * 1. Detected problem (factual, evidence-based)
   * 2. Business impact (why it matters)
   * 3. Additional context (if relevant)
   *
   * Example:
   * "Price is not visible in the buybox (evidence: screenshot above-fold).
   * This increases friction and may block purchase decision.
   * Visitors must scroll or search for the price, which hurts conversion."
   */
  why: z.string(),

  /**
   * ⚠️ HARD RULE: Evidence references (≥ 1 required)
   *
   * Array of evidence_id (format: E_<source>_<viewport>_<type>_<label>_<idx>)
   *
   * Each referenced evidence_id MUST exist in the Evidence pack.
   * 
   * Exemples:
   * - ["E_page_a_mobile_screenshot_above_fold_01"]
   * - ["E_page_a_mobile_detection_buybox_detect_01", "E_page_a_mobile_screenshot_cta_area_01"]
   * 
   * @reference docs/REPORT_OUTLINE.md section 2.1
   */
  evidence_refs: z.array(z.string()).min(1, {
    message: 'evidence_refs MUST contain at least 1 evidence_id (Evidence-based rule)',
  }),

  /**
   * How to implement? (3–7 executable steps)
   *
   * Each step must be:
   * - Actionable (action verb)
   * - Specific (no generic filler)
   * - Executable (dev/designer knows what to do)
   *
   * Examples:
   * - "Move the price block into form.product-form (above the CTA)"
   * - "Increase price font-size to 28px (mobile) and 32px (desktop)"
   * - "Add bold style and contrasting color (#000 or equivalent)"
   *
   * @reference docs/REPORT_OUTLINE.md section 8.1
   */
  how_to: z.array(z.string()).min(3).max(7, {
    message: 'how_to MUST contain 3-7 executable steps (SSOT rule)',
  }),

  /**
   * Validation (observable checks)
   *
   * Criteria to verify the ticket is properly implemented.
   *
   * Examples:
   * - "Price is visible without scroll on mobile (viewport 390×844)"
   * - "Price is in the same container as the CTA (inspect DOM)"
   * - "Price is readable (contrast ratio ≥ 4.5:1)"
   */
  validation: z.array(z.string()),

  /**
   * Quick win? (effort s + confidence high/medium)
   *
   * Criteria:
   * - effort = s
   * - confidence = high OR medium
   * - impact = high OR medium (preferred)
   *
   * Top Actions target: 3–5 quick wins
   *
   * @reference docs/SCORING_AND_DETECTION.md section 5.3
   */
  quick_win: z.boolean(),

  /**
   * Owner (REGISTRY strict) — cro|copy|design|dev|merch|data
   * Accepts owner_hint (legacy) for backward compat.
   */
  owner: TicketOwnerSchema.optional(),
  owner_hint: z.string().optional(),

  /**
   * rule_id REGISTRY (ex: R.PDP.CTA.MISSING_ATF) — optionnel
   */
  rule_id: z.string().optional(),

  /**
   * affected_criteria_ids REGISTRY (ex: [C.CORE.CTA]) — optionnel
   */
  affected_criteria_ids: z.array(z.string()).optional(),

  /**
   * Additional notes (SSOT Anti-Drift)
   *
   * Supplementary information:
   * - Detection limits
   * - Specific context (e.g.: dynamic content)
   * - Alternative suggestions
   *
   * IMPORTANT: Non-optional field for OpenAI JSON Schema compatibility
   * Use empty string if no note
   */
  notes: z.string().default(''),
});

/** Schema complet avec transform owner_hint → owner */
export const TicketV2Schema = TicketV2ObjectSchema.transform((t: z.infer<typeof TicketV2ObjectSchema>) => {
  const owner = normalizeOwner(t.owner ?? t.owner_hint ?? 'dev');
  const { owner_hint: _h, ...rest } = t;
  return { ...rest, owner };
});

/** Base object schema (sans transform) pour .omit() / .extend() */
export const TicketV2BaseSchema = TicketV2ObjectSchema;

export type TicketV2 = z.infer<typeof TicketV2Schema>;

/**
 * PriorityScore Calculation (SSOT)
 * 
 * Formule : impact*3 + confidence*2 - effort*2 - risk*1
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 5.1
 * 
 * @param ticket - Ticket v2
 * @returns PriorityScore (decimal number)
 */
export function calculatePriorityScore(ticket: TicketV2): number {
  const impactMap: Record<TicketImpact, number> = { high: 3, medium: 2, low: 1 };
  const effortMap: Record<TicketEffort, number> = { s: 1, m: 2, l: 3 };
  const riskMap: Record<TicketRisk, number> = { low: 1, medium: 2, high: 3 };
  const confidenceMap: Record<TicketConfidence, number> = { high: 3, medium: 2, low: 1 };

  return (
    impactMap[ticket.impact] * 3 +
    confidenceMap[ticket.confidence] * 2 -
    effortMap[ticket.effort] * 2 -
    riskMap[ticket.risk] * 1
  );
}

/**
 * Stable sorting of tickets (SSOT)
 *
 * Order (all descending except effort/risk ascending):
 * 1) PriorityScore descending
 * 2) impact descending
 * 3) confidence descending
 * 4) effort ascending
 * 5) risk ascending
 * 6) ticket_id (stable, alphabetical)
 *
 * ⚠️ Determinism: Same inputs → same order
 *
 * Reference: docs/SCORING_AND_DETECTION.md section 5.2
 *
 * @param tickets - Array of tickets v2
 * @returns Sorted array (copy, no mutation)
 */
export function sortTicketsStable(tickets: TicketV2[]): TicketV2[] {
  const impactOrder: Record<TicketImpact, number> = { high: 3, medium: 2, low: 1 };
  const confidenceOrder: Record<TicketConfidence, number> = { high: 3, medium: 2, low: 1 };
  const effortOrder: Record<TicketEffort, number> = { s: 1, m: 2, l: 3 };
  const riskOrder: Record<TicketRisk, number> = { low: 1, medium: 2, high: 3 };

  return [...tickets].sort((a, b) => {
    // 1) PriorityScore descending
    const scoreA = calculatePriorityScore(a);
    const scoreB = calculatePriorityScore(b);
    if (scoreA !== scoreB) return scoreB - scoreA;

    // 2) impact descending
    if (impactOrder[a.impact] !== impactOrder[b.impact]) {
      return impactOrder[b.impact] - impactOrder[a.impact];
    }

    // 3) confidence descending
    if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    }

    // 4) effort ascending
    if (effortOrder[a.effort] !== effortOrder[b.effort]) {
      return effortOrder[a.effort] - effortOrder[b.effort];
    }

    // 5) risk ascending
    if (riskOrder[a.risk] !== riskOrder[b.risk]) {
      return riskOrder[a.risk] - riskOrder[b.risk];
    }

    // 6) ticket_id (stable, alphabetical)
    return a.ticket_id.localeCompare(b.ticket_id);
  });
}

/**
 * Filter tickets for Top Actions (SSOT Guardrails)
 *
 * Guardrails:
 * - Exclude confidence=low (reserve for Appendix)
 * - Max 2 tickets effort=l (except structural changes in before/after)
 *
 * Reference: docs/SCORING_AND_DETECTION.md section 5.3
 *
 * @param tickets - Array of tickets v2 (pre-sorted)
 * @param maxLargeEffort - Max number of tickets effort=l (default: 2)
 * @returns Filtered array for Top Actions
 */
export function filterTopActionsGuardrails(
  tickets: TicketV2[],
  maxLargeEffort: number = 2
): TicketV2[] {
  const filtered: TicketV2[] = [];
  let largeEffortCount = 0;

  for (const ticket of tickets) {
    // Guard 1: Exclude confidence=low
    if (ticket.confidence === 'low') continue;

    // Guard 2: Max 2 tickets effort=l
    if (ticket.effort === 'l') {
      if (largeEffortCount >= maxLargeEffort) continue;
      largeEffortCount++;
    }

    filtered.push(ticket);
  }

  return filtered;
}

/**
 * Extract Quick Wins (SSOT)
 *
 * Criteria:
 * - quick_win = true
 * - effort = s
 * - confidence = high OR medium
 *
 * Target: 3–5 quick wins in Top Actions
 *
 * Reference: docs/SCORING_AND_DETECTION.md section 5.3
 *
 * @param tickets - Array of tickets v2
 * @returns Array of quick wins
 */
export function extractQuickWins(tickets: TicketV2[]): TicketV2[] {
  return tickets.filter(
    (ticket) =>
      ticket.quick_win === true &&
      ticket.effort === 's' &&
      (ticket.confidence === 'high' || ticket.confidence === 'medium')
  );
}
