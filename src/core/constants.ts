/**
 * ShopifyStrategist — SSOT Constants
 * 
 * Seuils et valeurs par défaut officiels.
 * Conforme à: docs/SCORING_AND_DETECTION.md section 8
 * 
 * RÈGLE : Tout changement ici doit bump SCORING_VERSION.
 */

/**
 * Viewports Standard (SSOT obligatoires)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 2.1
 */
export const VIEWPORTS = {
  MOBILE: {
    width: 390,
    height: 844,
  },
  DESKTOP: {
    width: 1440,
    height: 900,
  },
} as const;

/**
 * Performance / Poids (SSOT defaults)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 8.1
 */
export const PERF_THRESHOLDS = {
  // Images
  IMG_HEAVY_KB: 300,
  IMG_VERY_HEAVY_KB: 700,

  // Lighthouse Lab Metrics
  LH_PERF_SCORE_BAD: 40,
  LH_LCP_BAD_S: 4.0,
  LH_CLS_BAD: 0.25,
  LH_TBT_BAD_MS: 600,
} as const;

/**
 * UX Heuristiques (déterministes)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 8.2
 */
export const UX_HEURISTICS = {
  // Page longue = 3x viewport height (mobile)
  LONG_PAGE_SCROLL_PX: (viewportHeight: number) => 3 * viewportHeight,
  LONG_PAGE_SCROLL_MOBILE: 3 * VIEWPORTS.MOBILE.height,

  // Galerie minimum
  GALLERY_MIN_IMAGES: 4,
} as const;

/**
 * Third-party (Appendix-first)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 8.3
 */
export const THIRD_PARTY_THRESHOLDS = {
  // Nombre de hosts tiers (seulement si mesure fiable)
  THIRD_PARTY_HOSTS_BAD: 16,
} as const;

/**
 * Screenshots Sets (Gating)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 2.3
 */
export const SCREENSHOT_SETS = {
  // Set A (préféré)
  SET_A: ['above_fold_mobile', 'above_fold_desktop', 'full_page_mobile'],

  // Set B (fallback)
  SET_B: ['above_fold_mobile', 'cta_area_mobile', 'details_section'],

  // Tous les screenshots cibles (best effort)
  ALL_TARGETS: [
    'above_fold_mobile',
    'above_fold_desktop',
    'cta_area_mobile',
    'media_section',
    'trust_section',
    'details_section',
    'full_page_mobile',
    'full_page_desktop',
  ],
} as const;

/**
 * Keywords Lists (SSOT minimal) — FR/EN
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 11
 */
export const KEYWORDS = {
  SHIPPING: {
    FR: [
      'livraison',
      'expédition',
      'envoi',
      'délai',
      'sous 24h',
      'sous 48h',
      'sous 72h',
      'gratuit',
      'frais de port',
      'tracking',
      'point relais',
      'colissimo',
      'chronopost',
    ],
    EN: [
      'shipping',
      'delivery',
      'dispatch',
      'dispatched',
      'ETA',
      'free shipping',
      'returns shipping',
      'tracking',
      'courier',
      'standard',
      'express',
    ],
  },

  RETURNS: {
    FR: [
      'retours',
      'retour gratuit',
      'satisfait ou remboursé',
      'remboursement',
      'échange',
      'politique de retour',
      'retour sous 14 jours',
      'retour sous 30 jours',
    ],
    EN: [
      'returns',
      'refund',
      'exchange',
      'return policy',
      'money-back',
      '14-day returns',
      '30-day returns',
    ],
  },

  TRUST: {
    FR: [
      'paiement sécurisé',
      'sécurisé',
      'garantie',
      'authentique',
      'SAV',
      'support',
      'contact',
      'avis clients',
      // 'vérifié' → ATTENTION: ne jamais affirmer "vérifié" sans preuve explicite
    ],
    EN: [
      'secure checkout',
      'guarantee',
      'warranty',
      'support',
      'contact',
      'authentic',
      'customer reviews',
      // 'verified' → ATTENTION: same rule
    ],
  },

  REVIEWS: {
    FR: ['avis', 'note', 'étoiles', 'commentaires', 'évaluations'],
    EN: ['reviews', 'rating', 'stars', 'testimonials'],
  },
} as const;

/**
 * Diversity Rules (Anti-rapport monocorde)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 5.4
 */
export const DIVERSITY_RULES = {
  // Minimum par catégorie dans Top Actions
  MIN_OFFER_CLARITY: 1,
  MIN_UX: 1,
  MIN_PERF_OR_MEDIA: 1, // Au moins 1 performance OU media
  MIN_TRUST_IF_APPLICABLE: 1, // Si signal trust détecté

  // Maximum tickets d'une même catégorie
  MAX_SAME_CATEGORY: 4,

  // Quick wins cible
  TARGET_QUICK_WINS_MIN: 3,
  TARGET_QUICK_WINS_MAX: 5,

  // Top actions cible
  TARGET_TOP_ACTIONS_MIN: 10,
  TARGET_TOP_ACTIONS_MAX: 14,
} as const;

/**
 * Top Actions Guardrails (SSOT)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 5.3
 */
export const TOP_ACTIONS_GUARDRAILS = {
  // Exclure confidence=low
  EXCLUDE_LOW_CONFIDENCE: true,

  // Max 2 tickets effort=large (sauf changements structurants en before/after)
  MAX_LARGE_EFFORT: 2,

  // Viser 3-5 quick wins
  TARGET_QUICK_WINS_MIN: 3,
  TARGET_QUICK_WINS_MAX: 5,
} as const;

/**
 * DUO Alignment Level (règles)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 14.1
 */
export const DUO_ALIGNMENT_RULES = {
  // Si alignment_level=low
  LOW_ALIGNMENT: {
    MAX_COMPARATIVE_TICKETS: 8,
    MAX_CONFIDENCE: 'medium' as const,
  },
} as const;
