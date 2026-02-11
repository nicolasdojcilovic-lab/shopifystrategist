/**
 * ⚠️ SCORING ENGINE — Deterministic Strategist Score
 *
 * Calculates the Strategist Score from facts (ShopifyFacts).
 * 100% logic engine — no API or AI calls.
 *
 * Reference: docs/schemas/tickets_and_score.v1.json
 * Reference: docs/SSOT/SCORING_AND_DETECTION.md
 *
 * @version SCORING_ENGINE_VERSION = 1.1
 */

import type { ShopifyFacts } from '@/core/engine/facts-collector';
import { SHOPIFY_APPS } from '@/ssot/shopify-apps';

// ============================================================================
// Pillar weights (sum = 1.0)
// ============================================================================

export const PILLAR_WEIGHTS = {
  clarte: 0.25,
  friction: 0.2,
  confiance: 0.15,
  social: 0.15,
  mobile: 0.1,
  perf: 0.1,
  seo: 0.05,
} as const;

export type Pillar = keyof typeof PILLAR_WEIGHTS;

// ============================================================================
// Internal fact for scoring (derived from ShopifyFacts)
// ============================================================================

/** REGISTRY rule_id / criteria_ids for deterministic traceability (docs/SSOT/REGISTRY.md) */
export interface ScoringFact {
  type: 'app_signature_detected' | 'missing_element' | 'present_element' | 'technical_signal';
  value: string;
  pillar: Pillar;
  delta: number;
  reason: string;
  /** rule_id from REGISTRY §3 (e.g. R.PDP.STICKY_ATC.MISSING_MOBILE) */
  rule_id?: string;
  /** criteria_ids from REGISTRY §2 (e.g. C.CORE.CTA) */
  criteria_ids?: string[];
  /** Fact keys that triggered this rule (e.g. ["sticky_atc_presence_mobile"]) */
  fact_ids?: string[];
}

/** Premium review apps: +5 bonus on top of review-app detection (REGISTRY-aligned) */
const PREMIUM_REVIEW_APPS = ['Loox', 'Okendo', 'Yotpo'];

/**
 * Converts ShopifyFacts into a list of ScoringFact for the rules engine
 */
function factsToScoringFacts(facts: ShopifyFacts): ScoringFact[] {
  const items: ScoringFact[] = [];
  const { pdp, structure, technical } = facts;

  // --- Clarity (REGISTRY: C.CORE.CTA, C.CORE.PRICE_CLARITY, etc.) ---
  if (!pdp.hasAtcButton) {
    items.push({
      type: 'missing_element',
      value: 'atc_button',
      pillar: 'clarte',
      delta: -30,
      reason: 'ATC button not detected on page load',
      rule_id: 'R.PDP.CTA.MISSING_ATF',
      criteria_ids: ['C.CORE.CTA'],
      fact_ids: ['atc_button'],
    });
  }
  if (!pdp.price && !pdp.regularPrice && !pdp.salePrice) {
    items.push({
      type: 'missing_element',
      value: 'price',
      pillar: 'clarte',
      delta: -25,
      reason: 'Price not detected on page',
      rule_id: 'R.PDP.PRICE.MISSING_OR_AMBIGUOUS',
      criteria_ids: ['C.CORE.PRICE_CLARITY'],
      fact_ids: ['price'],
    });
  }
  if (!pdp.hasDescription || pdp.descriptionLength < 50) {
    items.push({
      type: 'missing_element',
      value: 'description',
      pillar: 'clarte',
      delta: -15,
      reason: !pdp.hasDescription ? 'Description not detected' : 'Description too short (<50 characters)',
      rule_id: 'R.PDP.BENEFITS.MISSING_SCANNABLE_LIST',
      criteria_ids: ['C.PERS.BENEFITS'],
      fact_ids: ['description'],
    });
  }
  if (pdp.hasAtcButton && pdp.atcButtonCount >= 1) {
    items.push({
      type: 'present_element',
      value: 'atc_button',
      pillar: 'clarte',
      delta: 10,
      reason: 'ATC button present and detected',
      fact_ids: ['atc_button'],
    });
  }
  if (pdp.hasVariantSelector && pdp.variantTypes.length > 0) {
    items.push({
      type: 'present_element',
      value: 'variant_selector',
      pillar: 'clarte',
      delta: 5,
      reason: 'Variant selector present',
      fact_ids: ['variant_selector'],
    });
  }

  // --- Friction ---
  if (structure.h1Count === 0) {
    items.push({
      type: 'missing_element',
      value: 'h1',
      pillar: 'friction',
      delta: -20,
      reason: 'Missing H1 heading',
      fact_ids: ['h1_count'],
    });
  }
  if (structure.imagesWithoutAlt > 0 && structure.imageCount > 0) {
    const ratio = structure.imagesWithoutAlt / structure.imageCount;
    const penalty = Math.min(-10, Math.round(-20 * ratio));
    items.push({
      type: 'missing_element',
      value: 'image_alt',
      pillar: 'friction',
      delta: penalty,
      reason: `${structure.imagesWithoutAlt} image(s) without alt attribute`,
      fact_ids: ['images_without_alt', 'image_count'],
    });
  }
  if (!technical.hasAriaLabels) {
    items.push({
      type: 'missing_element',
      value: 'aria_labels',
      pillar: 'friction',
      delta: -10,
      reason: 'ARIA labels not detected',
      fact_ids: ['aria_labels'],
    });
  }
  if (structure.h1Count >= 1 && structure.mainH1Text) {
    items.push({
      type: 'present_element',
      value: 'h1',
      pillar: 'friction',
      delta: 5,
      reason: 'Heading structure present',
    });
  }

  // --- Friction (advanced): sticky ATC mobile, variant complexity ---
  if (pdp.stickyAtcPresenceMobile === false) {
    items.push({
      type: 'missing_element',
      value: 'sticky_atc_mobile',
      pillar: 'friction',
      delta: -15,
      reason: 'Missing sticky ATC on mobile reduces conversion by ~12%',
      rule_id: 'R.PDP.STICKY_ATC.MISSING_MOBILE',
      criteria_ids: ['C.CORE.CTA', 'C.TECH.MOBILE_UX'],
      fact_ids: ['sticky_atc_presence_mobile'],
    });
  }
  const variantComplexityHigh = (pdp.variantSelectionComplexityClicks ?? pdp.variantTypes.length) > 3;
  if (variantComplexityHigh) {
    items.push({
      type: 'missing_element',
      value: 'variant_picker_simple',
      pillar: 'friction',
      delta: -10,
      reason: 'Variant selection complexity high (>3 clicks) increases friction',
      rule_id: 'R.PDP.VARIANTS.CONFUSING_PICKER',
      criteria_ids: ['C.CORE.VARIANTS'],
      fact_ids: ['variant_selection_complexity'],
    });
  }

  // --- Confiance ---
  const shippingReturnsVisibility = structure.hasShippingInfo || structure.hasReturnPolicy;
  if (!shippingReturnsVisibility) {
    items.push({
      type: 'missing_element',
      value: 'shipping_returns_visibility',
      pillar: 'confiance',
      delta: -15,
      reason: 'Shipping/returns visibility not detected (reduces conversion trust by ~8%)',
      rule_id: 'R.PDP.SHIPPING.MISSING_POLICY_AT_PDP',
      criteria_ids: ['C.CORE.SHIPPING_RETURNS'],
      fact_ids: ['shipping_returns_visibility'],
    });
  } else {
    if (structure.hasShippingInfo) {
      items.push({
        type: 'present_element',
        value: 'shipping_info',
        pillar: 'confiance',
        delta: 10,
        reason: 'Shipping information present',
      });
    }
    if (structure.hasReturnPolicy) {
      items.push({
        type: 'present_element',
        value: 'return_policy',
        pillar: 'confiance',
        delta: 10,
        reason: 'Return policy present',
      });
    }
  }
  if (structure.trustBadgesNearAtc === false) {
    items.push({
      type: 'missing_element',
      value: 'trust_badges_near_atc',
      pillar: 'confiance',
      delta: -10,
      reason: 'Trust badges missing near ATC button reduces confidence',
      rule_id: 'R.PDP.TRUST.MISSING_SIGNALS',
      criteria_ids: ['C.CORE.TRUST'],
      fact_ids: ['trust_badges_near_atc'],
    });
  }

  // --- Social (reviews, UGC, apps) — SSOT: SHOPIFY_APPS category 'reviews' ---
  const socialProofPresence = structure.hasReviewsSection || structure.hasSocialProof;
  if (!socialProofPresence) {
    items.push({
      type: 'missing_element',
      value: 'social_proof_presence',
      pillar: 'social',
      delta: -20,
      reason: 'Social proof (stars near title) missing reduces conversion by ~10%',
      rule_id: 'R.PDP.REVIEWS.MISSING_OR_HIDDEN',
      criteria_ids: ['C.PERS.SOCIAL_PROOF'],
      fact_ids: ['social_proof_presence'],
    });
  }
  const reviewAppNames = SHOPIFY_APPS.filter((a) => a.category === 'reviews').map((a) => a.name);
  const detectedReviewApps = technical.detectedApps.filter((app) =>
    reviewAppNames.some((r) => app.toLowerCase().includes(r.toLowerCase()))
  );
  for (const app of detectedReviewApps) {
    items.push({
      type: 'app_signature_detected',
      value: app,
      pillar: 'social',
      delta: 10,
      reason: `Review app detected: ${app}`,
    });
    if (PREMIUM_REVIEW_APPS.some((p) => app.toLowerCase().includes(p.toLowerCase()))) {
      items.push({
        type: 'app_signature_detected',
        value: `${app}_premium`,
        pillar: 'social',
        delta: 5,
        reason: `Premium review app (Loox/Okendo/Yotpo) detected: ${app}`,
        fact_ids: ['app_signature_detected'],
      });
    }
  }
  if (structure.hasReviewsSection) {
    items.push({
      type: 'present_element',
      value: 'reviews_section',
      pillar: 'social',
      delta: 15,
      reason: 'Reviews section detected',
    });
  }
  if (structure.hasSocialProof) {
    items.push({
      type: 'present_element',
      value: 'social_proof',
      pillar: 'social',
      delta: 10,
      reason: 'Social proof detected (e.g., X people bought)',
    });
  }

  // --- Mobile (indicateurs proxy: structure, skip link) ---
  if (technical.hasSkipLink) {
    items.push({
      type: 'technical_signal',
      value: 'skip_link',
      pillar: 'mobile',
      delta: 10,
      reason: 'Skip-to-content link present (better mobile UX)',
    });
  }
  if (!technical.hasSkipLink) {
    items.push({
      type: 'missing_element',
      value: 'skip_link',
      pillar: 'mobile',
      delta: -5,
      reason: 'Skip-to-content link missing',
    });
  }
  if (structure.formCount > 0) {
    items.push({
      type: 'present_element',
      value: 'forms',
      pillar: 'mobile',
      delta: 5,
      reason: 'Structured forms detected',
    });
  }

  // --- Performance (LCP, blocking scripts, heavy apps) ---
  const lcpMs = technical.lcpMs;
  if (lcpMs != null && lcpMs > 2500) {
    items.push({
      type: 'technical_signal',
      value: 'lcp_poor',
      pillar: 'perf',
      delta: -20,
      reason: `LCP ${lcpMs}ms > 2500ms hurts Core Web Vitals and conversion`,
      rule_id: 'R.TECH.PERF_LAB.POOR_BUCKET',
      criteria_ids: ['C.TECH.PERF_LAB'],
      fact_ids: ['lcp_ms'],
    });
  }
  const blockingCount = technical.networkBlockingScriptCount ?? technical.externalScriptCount ?? 0;
  if (blockingCount > 3) {
    items.push({
      type: 'technical_signal',
      value: 'network_blocking_scripts',
      pillar: 'perf',
      delta: -10,
      reason: `Network/blocking script count (${blockingCount}) > 3 impacts load time`,
      rule_id: 'R.TECH.PERF_LAB.POOR_BUCKET',
      criteria_ids: ['C.TECH.PERF_LAB'],
      fact_ids: ['network_blocking_script_count'],
    });
  }
  const heavyApps = technical.hasGoogleAnalytics || technical.hasFacebookPixel || technical.hasKlaviyo;
  if (heavyApps) {
    let penalty = 0;
    if (technical.hasGoogleAnalytics) penalty -= 5;
    if (technical.hasFacebookPixel) penalty -= 5;
    if (technical.hasKlaviyo) penalty -= 3;
    items.push({
      type: 'technical_signal',
      value: 'tracking_scripts',
      pillar: 'perf',
      delta: penalty,
      reason: 'Third-party tracking scripts detected (potential LCP impact)',
    });
  }
  if (structure.imagesWithLazyLoad > 0) {
    items.push({
      type: 'present_element',
      value: 'lazy_load',
      pillar: 'perf',
      delta: 5,
      reason: 'Lazy-loaded images detected',
    });
  }

  // --- SEO ---
  if (structure.h1Count !== 1) {
    items.push({
      type: 'missing_element',
      value: 'h1_unique',
      pillar: 'seo',
      delta: structure.h1Count === 0 ? -15 : -5,
      reason: structure.h1Count === 0 ? 'Missing H1' : 'Multiple or non-unique H1',
    });
  }
  if (structure.h1Count === 1) {
    items.push({
      type: 'present_element',
      value: 'h1_unique',
      pillar: 'seo',
      delta: 10,
      reason: 'Unique H1 present',
    });
  }
  if (technical.langAttribute) {
    items.push({
      type: 'present_element',
      value: 'lang_attribute',
      pillar: 'seo',
      delta: 5,
      reason: 'Lang attribute present',
    });
  }

  return items;
}

// ============================================================================
// Rules per pillar
// ============================================================================

const PILLAR_MAX = 100;

/** Breakdown item (tickets_and_score.v1 + REGISTRY traceability) */
export interface ScoreBreakdownItemExtended {
  pillar: Pillar;
  delta: number;
  reason: string;
  rule_id?: string;
  criteria_ids?: string[];
  fact_ids?: string[];
}

/**
 * Calculates each pillar score (0-100) from facts.
 * Each pillar starts at 50 (neutral) and receives bonuses/penalties.
 * Pillar scores are clamped to [0, 100].
 */
export function calculatePillarScores(facts: ShopifyFacts): {
  pillarScores: Record<Pillar, number>;
  breakdown: ScoreBreakdownItemExtended[];
} {
  const scoringFacts = factsToScoringFacts(facts);
  const breakdown: ScoreBreakdownItemExtended[] = [];
  const pillarSums: Record<Pillar, number> = {
    clarte: 50,
    friction: 50,
    confiance: 50,
    social: 50,
    mobile: 50,
    perf: 50,
    seo: 50,
  };

  for (const f of scoringFacts) {
    pillarSums[f.pillar] += f.delta;
    breakdown.push({
      pillar: f.pillar,
      delta: f.delta,
      reason: f.reason,
      ...(f.rule_id != null && { rule_id: f.rule_id }),
      ...(f.criteria_ids != null && f.criteria_ids.length > 0 && { criteria_ids: f.criteria_ids }),
      ...(f.fact_ids != null && f.fact_ids.length > 0 && { fact_ids: f.fact_ids }),
    });
  }

  // Clamp each pillar to 0-100 (deterministic)
  const pillarScores = {} as Record<Pillar, number>;
  for (const p of Object.keys(PILLAR_WEIGHTS) as Pillar[]) {
    pillarScores[p] = Math.max(0, Math.min(PILLAR_MAX, Math.round(pillarSums[p])));
  }

  return { pillarScores, breakdown };
}

/**
 * Calculates the total Strategist Score (weighted sum of pillars).
 */
function computeWeightedScore(pillarScores: Record<Pillar, number>): number {
  let total = 0;
  for (const p of Object.keys(PILLAR_WEIGHTS) as Pillar[]) {
    total += pillarScores[p] * PILLAR_WEIGHTS[p];
  }
  return Math.round(total);
}

// ============================================================================
// Output conforms to tickets_and_score.v1 (breakdown + score) + REGISTRY
// ============================================================================

/** Backward-compatible breakdown item (pillar, delta, reason required; REGISTRY fields optional) */
export type ScoreBreakdownItem = ScoreBreakdownItemExtended;

export interface StrategistScoreOutput {
  strategist_score: number;
  pillar_scores: Record<Pillar, number>;
  breakdown: ScoreBreakdownItem[];
  reasoning: string;
}

/**
 * Calculates the complete audit score (100% deterministic).
 */
export function computeAuditScore(facts: ShopifyFacts): StrategistScoreOutput {
  const { pillarScores, breakdown } = calculatePillarScores(facts);
  const strategist_score = computeWeightedScore(pillarScores);

  const reasoning = breakdown
    .filter((b) => b.delta !== 0)
    .map((b) => `[${b.pillar}] ${b.delta > 0 ? '+' : ''}${b.delta}: ${b.reason}`)
    .join('; ');

  return {
    strategist_score,
    pillar_scores: pillarScores,
    breakdown,
    reasoning: reasoning || 'No deductions or bonuses applied.',
  };
}
