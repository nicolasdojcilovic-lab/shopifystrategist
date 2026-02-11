/**
 * ⚠️ i18n — Translation Dictionary (SSOT)
 *
 * Central translation keys for UI labels, technical reasons, and enums.
 * Used by report-generator, AI synthesizer prompt, and score_breakdown display.
 *
 * @version i18n 1.0
 */

export type Locale = 'fr' | 'en';

/** UI Labels */
export interface UILabels {
  reportTitle: string;
  executiveSummary: string;
  strategistScore: string;
  totalActions: string;
  topActions: string;
  quickWins: string;
  diagnostic: string;
  plan306090: string;
  quickWins48h: string;
  actionsPrioritaires: string;
  preuvesVisuelles: string;
  preuves: string;
  annexe: string;
  impact: string;
  effort: string;
  impactFacilite: string;
  preuveTechnique: string;
  pourquoi: string;
  commentCorriger: string;
  validation: string;
  j0_30: string;
  j30_60: string;
  j60_90: string;
  focusQuickWins: string;
  scoreParPiliers: string;
  confiance: string;
  category: string;
  responsable: string;
  generatedOn: string;
  capture: string;
  capturedOn: string;
  imageUnavailable: string;
  loadError: string;
  detectionPending: string;
  niveau: string;
  detections: string;
  lowPriorityTickets: string;
  technicalFacts: string;
  gainsRapides: string;
  voirLaPreuve: string;
  desktopView: string;
  mobileView: string;
  fullPage: string;
}

/** Enum labels: impact, effort, confidence */
export interface EnumLabels {
  impact: Record<'high' | 'medium' | 'low', string>;
  effort: Record<'s' | 'm' | 'l', string>;
  confidence: Record<'high' | 'medium' | 'low', string>;
}

/** Pillar axis labels for radar chart */
export interface PillarLabels {
  clarte: string;
  friction: string;
  confiance: string;
  social: string;
  mobile: string;
  perf: string;
  seo: string;
}

/** Technical reasons from Scoring Engine — key = English reason (or rule_id) */
export interface TechnicalReasons {
  [key: string]: string;
}

export interface TranslationBundle {
  ui: UILabels;
  enums: EnumLabels;
  pillars: PillarLabels;
  technicalReasons: TechnicalReasons;
}

/** Technical reasons: EN key → FR value (rule_id or exact reason as key) */
const TECHNICAL_REASONS_FR: TechnicalReasons = {
  'R.PDP.CTA.MISSING_ATF': 'Bouton d\'achat absent au chargement',
  'ATC button not detected on page load': 'Bouton d\'achat absent au chargement',
  'R.PDP.PRICE.MISSING_OR_AMBIGUOUS': 'Prix non détecté sur la page',
  'Price not detected on page': 'Prix non détecté sur la page',
  'R.PDP.BENEFITS.MISSING_SCANNABLE_LIST': 'Description non détectée ou trop courte',
  'Description not detected': 'Description non détectée',
  'Description too short (<50 characters)': 'Description trop courte (<50 caractères)',
  'ATC button present and detected': 'Bouton d\'achat présent et détecté',
  'Variant selector present': 'Sélecteur de variantes présent',
  'Missing H1 heading': 'Balise H1 manquante',
  'ARIA labels not detected': 'Labels ARIA non détectés',
  'Heading structure present': 'Structure de titres présente',
  'R.PDP.STICKY_ATC.MISSING_MOBILE': 'Bouton d\'achat collant absent sur mobile',
  'Missing sticky ATC on mobile reduces conversion by ~12%': 'Bouton d\'achat collant absent sur mobile (-12% conversion)',
  'R.PDP.VARIANTS.CONFUSING_PICKER': 'Sélection de variantes trop complexe',
  'Variant selection complexity high (>3 clicks) increases friction': 'Sélection de variantes trop complexe (>3 clics)',
  'R.PDP.SHIPPING.MISSING_POLICY_AT_PDP': 'Informations livraison/retours non détectées',
  'Shipping/returns visibility not detected (reduces conversion trust by ~8%)': 'Livraison/retours non visibles (-8% confiance)',
  'Shipping information present': 'Informations de livraison présentes',
  'Return policy present': 'Politique de retour présente',
  'R.PDP.TRUST.MISSING_SIGNALS': 'Badges de confiance absents près du CTA',
  'Trust badges missing near ATC button reduces confidence': 'Badges de confiance absents près du bouton d\'achat',
  'R.PDP.REVIEWS.MISSING_OR_HIDDEN': 'Preuve sociale (étoiles) manquante',
  'Social proof (stars near title) missing reduces conversion by ~10%': 'Preuve sociale absente (-10% conversion)',
  'Reviews section detected': 'Section avis détectée',
  'Social proof detected (e.g., X people bought)': 'Preuve sociale détectée (ex. X achats)',
  'Skip-to-content link present (better mobile UX)': 'Lien « passer au contenu » présent',
  'Skip-to-content link missing': 'Lien « passer au contenu » absent',
  'Structured forms detected': 'Formulaires structurés détectés',
  'R.TECH.PERF_LAB.POOR_BUCKET': 'Performance Core Web Vitals dégradée',
  'Lazy-loaded images detected': 'Images en lazy-load détectées',
  'Lang attribute present': 'Attribut lang présent',
  'Missing H1': 'Balise H1 manquante',
  'Multiple or non-unique H1': 'H1 multiple ou non unique',
  'Unique H1 present': 'H1 unique présente',
};

const TECHNICAL_REASONS_EN: TechnicalReasons = {
  // EN is identity (reasons are already in English)
};

/** Pattern-based reason translation (dynamic content like LCP 3000ms, X images) */
const REASON_PATTERNS_FR: Array<{ pattern: RegExp; template: string }> = [
  { pattern: /^LCP (\d+)ms > 2500ms hurts Core Web Vitals and conversion$/, template: 'LCP $1ms > 2500ms dégrade les Core Web Vitals et la conversion' },
  { pattern: /^Network\/blocking script count \((\d+)\) > 3 impacts load time$/, template: 'Scripts bloquants ($1) > 3 impactent le temps de chargement' },
  { pattern: /^(\d+) image\(s\) without alt attribute$/, template: '$1 image(s) sans attribut alt' },
  { pattern: /^Review app detected: (.+)$/, template: 'Application d\'avis détectée : $1' },
  { pattern: /^Premium review app \(Loox\/Okendo\/Yotpo\) detected: (.+)$/, template: 'Application d\'avis premium (Loox/Okendo/Yotpo) détectée : $1' },
  { pattern: /^Third-party tracking scripts detected \(potential LCP impact\)$/, template: 'Scripts de tracking tiers détectés (impact LCP potentiel)' },
];


/** TRANSLATIONS — fr | en */
export const TRANSLATIONS: Record<Locale, TranslationBundle> = {
  fr: {
    ui: {
      reportTitle: 'Rapport CRO',
      executiveSummary: 'Synthèse Décisionnelle',
      strategistScore: 'Score de Performance E-commerce',
      totalActions: 'Actions totales',
      topActions: 'Actions prioritaires',
      quickWins: 'Gains Rapides',
      diagnostic: 'Diagnostic par piliers',
      plan306090: "Calendrier d'Exécution 30 / 60 / 90 jours",
      quickWins48h: 'Gains Rapides (48h)',
      actionsPrioritaires: "Plan d'Optimisation",
      preuvesVisuelles: 'Preuves visuelles',
      preuves: 'Preuves',
      annexe: 'Annexe',
      impact: 'Impact',
      effort: 'Facilité',
      impactFacilite: 'Impact / Facilité',
      preuveTechnique: 'Preuve technique',
      pourquoi: 'Pourquoi',
      commentCorriger: 'Comment corriger',
      validation: 'Validation',
      j0_30: 'J0–30',
      j30_60: 'J30–60',
      j60_90: 'J60–90',
      focusQuickWins: 'Gains Rapides prioritaires',
      scoreParPiliers: 'Score par piliers',
      confiance: 'Confiance',
      category: 'Catégorie',
      responsable: 'Responsable',
      generatedOn: 'Généré le',
      capture: 'Capture',
      capturedOn: 'Capturé le',
      imageUnavailable: 'Image non disponible',
      loadError: 'Erreur de chargement',
      detectionPending: 'En attente',
      niveau: 'Niveau',
      detections: 'Détections',
      lowPriorityTickets: 'Tickets basse priorité',
      technicalFacts: 'Faits techniques',
      gainsRapides: 'Gains Rapides',
      voirLaPreuve: 'Voir la preuve',
      desktopView: 'Vue Desktop',
      mobileView: 'Vue Mobile',
      fullPage: 'Page complète',
    },
    enums: {
      impact: { high: 'Élevé', medium: 'Moyen', low: 'Faible' },
      effort: { s: 'Rapide', m: 'Modéré', l: 'Complexe' },
      confidence: { high: 'Élevée', medium: 'Moyenne', low: 'Faible' },
    },
    pillars: {
      clarte: 'Clarté',
      friction: 'Friction',
      confiance: 'Confiance',
      social: 'Preuve Sociale',
      mobile: 'Mobile',
      perf: 'Performance',
      seo: 'SEO',
    },
    technicalReasons: TECHNICAL_REASONS_FR,
  },
  en: {
    ui: {
      reportTitle: 'CRO Report',
      executiveSummary: 'Executive Summary',
      strategistScore: 'E-commerce Performance Score',
      totalActions: 'Total actions',
      topActions: 'Priority actions',
      quickWins: 'Quick Wins',
      diagnostic: 'Pillar diagnostic',
      plan306090: 'Execution Roadmap 30 / 60 / 90 days',
      quickWins48h: 'Quick Wins (48h)',
      actionsPrioritaires: 'Optimization Plan',
      preuvesVisuelles: 'Visual evidence',
      preuves: 'Evidence',
      annexe: 'Appendix',
      impact: 'Impact',
      effort: 'Effort',
      impactFacilite: 'Impact / Effort',
      preuveTechnique: 'Technical evidence',
      pourquoi: 'Why',
      commentCorriger: 'How to fix',
      validation: 'Validation',
      j0_30: 'D0–30',
      j30_60: 'D30–60',
      j60_90: 'D60–90',
      focusQuickWins: 'Focus Quick Wins',
      scoreParPiliers: 'Score by pillars',
      confiance: 'Confidence',
      category: 'Category',
      responsable: 'Owner',
      generatedOn: 'Generated on',
      capture: 'Capture',
      capturedOn: 'Captured on',
      imageUnavailable: 'Image unavailable',
      loadError: 'Load error',
      detectionPending: 'Pending',
      niveau: 'Level',
      detections: 'Detections',
      lowPriorityTickets: 'Low priority tickets',
      technicalFacts: 'Technical facts',
      gainsRapides: 'Quick Wins',
      voirLaPreuve: 'View evidence',
      desktopView: 'Desktop View',
      mobileView: 'Mobile View',
      fullPage: 'Full Page',
    },
    enums: {
      impact: { high: 'High', medium: 'Medium', low: 'Low' },
      effort: { s: 'Quick', m: 'Moderate', l: 'Complex' },
      confidence: { high: 'High', medium: 'Medium', low: 'Low' },
    },
    pillars: {
      clarte: 'Clarity',
      friction: 'Friction',
      confiance: 'Trust',
      social: 'Social Proof',
      mobile: 'Mobile',
      perf: 'Performance',
      seo: 'SEO',
    },
    technicalReasons: TECHNICAL_REASONS_EN,
  },
};

/**
 * Translation helper: fetches string from dictionary by key path.
 * @param key - Dot-notation key (e.g. "ui.reportTitle", "enums.impact.high")
 * @param locale - Target locale
 */
export function t<K extends string>(key: K, locale: Locale): string {
  const bundle = TRANSLATIONS[locale];
  const parts = key.split('.');
  let current: unknown = bundle;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : key;
}

/**
 * Translate score_breakdown reason using rule_id, patterns, or exact match.
 */
export function translateReason(reason: string, ruleId: string | undefined, locale: Locale): string {
  if (locale === 'en') return reason;
  const bundle = TRANSLATIONS[locale];
  // 1. Try rule_id
  if (ruleId && bundle.technicalReasons[ruleId]) return bundle.technicalReasons[ruleId];
  // 2. Try exact reason
  if (bundle.technicalReasons[reason]) return bundle.technicalReasons[reason];
  // 3. Try patterns (fr only)
  for (const { pattern, template } of REASON_PATTERNS_FR) {
    const m = reason.match(pattern);
    if (m) {
      return template.replace(/\$(\d+)/g, (_, i) => m[parseInt(i, 10)] ?? '');
    }
  }
  return humanReadable(reason);
}

/** Converts technical strings to human-readable (remove underscores, capitalize words). */
export function humanReadable(str: string): string {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}
