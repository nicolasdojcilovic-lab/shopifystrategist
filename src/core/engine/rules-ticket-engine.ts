/**
 * ⚠️ RULES TICKET ENGINE — Deterministic Tickets (No AI)
 *
 * Generates actionable tickets from facts + score using fixed rules.
 * Used as primary output when AI is unavailable; AI enriches on top.
 *
 * Rules: CTA, images alt, above fold, trust badges, reviews, performance,
 * description structure, variants.
 *
 * @version 1.0
 */

import type { ShopifyFacts } from '@/core/engine/facts-collector';
import type { StrategistScoreOutput } from '@/core/engine/scoring-engine';
import type { TicketV2 } from '@/contracts/export/ticket.v2';
import type { EvidenceV2 } from '@/contracts/export/evidence.v2';
import type { Locale } from '@/core/i18n/translations';
import { sortTicketsStable, filterTopActionsGuardrails } from '@/contracts/export/ticket.v2';

export interface RulesTicketInput {
  facts: ShopifyFacts;
  scoreOutput: StrategistScoreOutput | null;
  evidences: EvidenceV2[];
  locale: Locale;
}

type RuleDef = {
  id: string;
  category: TicketV2['category'];
  impact: TicketV2['impact'];
  effort: TicketV2['effort'];
  rule_id: string;
  affected_criteria_ids: string[];
  owner: TicketV2['owner'];
  matches: (input: RulesTicketInput) => boolean;
  content: (input: RulesTicketInput) => { title: string; why: string; how_to: string[]; validation: string[] };
};

const RULES_FR: Record<string, RuleDef['content']> = {
  cta_missing: () => ({
    title: 'CTA Ajouter au panier absent ou non détecté',
    why: "Sans bouton d'achat visible, la conversion est impossible. Bloqueur majeur.",
    how_to: [
      "Ajouter un bouton ATC visible au-dessus de la ligne de flottaison",
      "Vérifier que le DOM expose l'élément (aria-label, data-testid)",
      'Tester sur mobile et desktop',
    ],
    validation: ['Bouton ATC visible sans scroll', 'Clic fonctionnel'],
  }),
  images_alt: (i) => ({
    title: 'Images produit sans attribut alt',
    why: `Détecté ${i.facts.structure.imagesWithoutAlt} image(s) sans alt. SEO et accessibilité impactés.`,
    how_to: [
      'Ajouter des attributs alt descriptifs à toutes les images',
      'Prioriser la galerie produit',
      'Éviter alt vide ou générique',
    ],
    validation: ['Toutes les images ont un alt pertinent', 'Vérification Lighthouse Accessibility'],
  }),
  above_fold: (i) => ({
    title: "Contenu excessif au-dessus de la ligne de flottaison",
    why: `Description très longue (${i.facts.pdp.descriptionLength ?? 0} caractères). Le CTA risque d'être hors écran sur mobile.`,
    how_to: [
      'Réduire le bloc texte initial à 300-500 caractères',
      'Déplacer le détail en accordéon ou onglets',
      'Mettre le CTA au-dessus ou juste après le prix',
    ],
    validation: ['CTA visible sans scroll sur mobile 390px', 'Temps au premier CTA < 2s'],
  }),
  trust_badges: () => ({
    title: 'Signaux de confiance absents (livraison, retours)',
    why: "Livraison et politique de retours non détectés. Augmente l'abandon et les questions support.",
    how_to: [
      'Afficher délai et frais de livraison près du CTA',
      'Lien vers politique de retours',
      'Ajouter garanties si pertinent',
    ],
    validation: ['Info livraison visible', 'Accès rapide à la politique retours'],
  }),
  reviews: () => ({
    title: 'Section avis clients absente',
    why: 'Aucune preuve sociale détectée. Les avis augmentent la confiance et le taux de conversion.',
    how_to: [
      'Installer une app avis (Loox, Judge.me, Yotpo)',
      'Intégrer les avis au-dessus de la ligne de flottaison si possible',
      'Afficher la note moyenne et le nombre d\'avis',
    ],
    validation: ['Section avis visible sur PDP', 'Note et compte affichés'],
  }),
  performance: (i) => ({
    title: 'Performance LCP à améliorer',
    why:
      (i.facts.technical?.lcpMs
        ? `LCP mesuré à ${i.facts.technical.lcpMs}ms (objectif <2500ms). Impact sur bounce et Core Web Vitals.`
        : 'Déductions performance détectées dans le scoring.') as string,
    how_to: [
      'Optimiser les images (WebP, lazy-load)',
      'Différer les scripts tiers (chat, analytics)',
      'Prioriser le contenu above-the-fold',
    ],
    validation: ['LCP < 2500ms', 'Lighthouse Performance > 80'],
  }),
  description: () => ({
    title: 'Description produit insuffisante ou peu structurée',
    why: "Description courte ou absente. Les acheteurs ont besoin d'infos pour trancher.",
    how_to: [
      'Rédiger au moins 200 caractères de bénéfices clés',
      'Utiliser des sous-titres H2/H3',
      'Inclure dimensions, matériaux, garanties',
    ],
    validation: ['Description > 200 caractères', 'Hiérarchie H2/H3 présente'],
  }),
  variants: (i) => ({
    title: 'Sélection de variantes complexe',
    why: `Plusieurs types de variantes (${(i.facts.pdp.variantTypes ?? []).join(', ') || 'multiple'}). Risque de friction sur mobile.`,
    how_to: [
      'Limiter les options visibles par défaut',
      'Grouper taille/couleur de façon lisible',
      'Tester le parcours sur mobile',
    ],
    validation: ['Moins de 4 clics pour sélectionner variante', 'Interface lisible sur 390px'],
  }),
};

const RULES_EN: Record<string, RuleDef['content']> = {
  cta_missing: () => ({
    title: 'Add to Cart button missing or not detected',
    why: "Without a visible purchase button, conversion is impossible. Major blocker.",
    how_to: [
      'Add a visible ATC button above the fold',
      'Ensure the DOM exposes the element (aria-label, data-testid)',
      'Test on mobile and desktop',
    ],
    validation: ['ATC button visible without scroll', 'Click works'],
  }),
  images_alt: (i) => ({
    title: 'Product images missing alt attribute',
    why: `Detected ${i.facts.structure.imagesWithoutAlt} image(s) without alt. SEO and accessibility impacted.`,
    how_to: [
      'Add descriptive alt attributes to all images',
      'Prioritize product gallery',
      'Avoid empty or generic alt',
    ],
    validation: ['All images have relevant alt', 'Lighthouse Accessibility check'],
  }),
  above_fold: (i) => ({
    title: 'Excessive content above the fold',
    why: `Very long description (${i.facts.pdp.descriptionLength ?? 0} chars). CTA may be off-screen on mobile.`,
    how_to: [
      'Reduce initial text block to 300-500 characters',
      'Move detail to accordion or tabs',
      'Place CTA above or right after price',
    ],
    validation: ['CTA visible without scroll on 390px mobile', 'Time to first CTA < 2s'],
  }),
  trust_badges: () => ({
    title: 'Trust signals missing (shipping, returns)',
    why: 'Shipping and return policy not detected. Increases abandonment and support questions.',
    how_to: [
      'Display delivery time and fees near CTA',
      'Link to return policy',
      'Add guarantees if relevant',
    ],
    validation: ['Shipping info visible', 'Quick access to return policy'],
  }),
  reviews: () => ({
    title: 'Customer reviews section missing',
    why: 'No social proof detected. Reviews increase trust and conversion rate.',
    how_to: [
      'Install a reviews app (Loox, Judge.me, Yotpo)',
      'Integrate reviews above the fold if possible',
      'Display average rating and review count',
    ],
    validation: ['Reviews section visible on PDP', 'Rating and count displayed'],
  }),
  performance: (i) => ({
    title: 'LCP performance needs improvement',
    why:
      (i.facts.technical?.lcpMs
        ? `LCP measured at ${i.facts.technical.lcpMs}ms (target <2500ms). Impact on bounce and Core Web Vitals.`
        : 'Performance deductions detected in scoring.') as string,
    how_to: [
      'Optimize images (WebP, lazy-load)',
      'Defer third-party scripts (chat, analytics)',
      'Prioritize above-the-fold content',
    ],
    validation: ['LCP < 2500ms', 'Lighthouse Performance > 80'],
  }),
  description: () => ({
    title: 'Product description insufficient or poorly structured',
    why: 'Short or missing description. Buyers need info to decide.',
    how_to: [
      'Write at least 200 characters of key benefits',
      'Use H2/H3 subheadings',
      'Include dimensions, materials, warranties',
    ],
    validation: ['Description > 200 characters', 'H2/H3 hierarchy present'],
  }),
  variants: (i) => ({
    title: 'Variant selection too complex',
    why: `Multiple variant types (${(i.facts.pdp.variantTypes ?? []).join(', ') || 'multiple'}). Friction risk on mobile.`,
    how_to: [
      'Limit visible options by default',
      'Group size/color in a readable way',
      'Test flow on mobile',
    ],
    validation: ['Fewer than 4 clicks to select variant', 'Interface readable on 390px'],
  }),
};

const RULE_DEFS: RuleDef[] = [
  {
    id: 'cta_missing',
    category: 'offer_clarity',
    impact: 'high',
    effort: 's',
    rule_id: 'R.PDP.CTA.MISSING_ATF',
    affected_criteria_ids: ['C.CORE.CTA'],
    owner: 'dev',
    matches: (i) => !i.facts.pdp.hasAtcButton,
    content: (i) => (i.locale === 'fr' ? RULES_FR.cta_missing!(i) : RULES_EN.cta_missing!(i)),
  },
  {
    id: 'images_alt',
    category: 'accessibility',
    impact: 'medium',
    effort: 's',
    rule_id: 'R.PDP.ACCESSIBILITY.MISSING_ALT',
    affected_criteria_ids: ['C.PERS.BENEFITS'],
    owner: 'copy',
    matches: (i) => (i.facts.structure.imagesWithoutAlt ?? 0) > 0,
    content: (i) => (i.locale === 'fr' ? RULES_FR.images_alt!(i) : RULES_EN.images_alt!(i)),
  },
  {
    id: 'above_fold',
    category: 'ux',
    impact: 'medium',
    effort: 'm',
    rule_id: 'R.PDP.STICKY_ATC.MISSING_MOBILE',
    affected_criteria_ids: ['C.CORE.CTA', 'C.TECH.MOBILE_UX'],
    owner: 'design',
    matches: (i) =>
      i.facts.pdp.hasAtcButton && (i.facts.pdp.descriptionLength ?? 0) > 800,
    content: (i) => (i.locale === 'fr' ? RULES_FR.above_fold!(i) : RULES_EN.above_fold!(i)),
  },
  {
    id: 'trust_badges',
    category: 'trust',
    impact: 'high',
    effort: 's',
    rule_id: 'R.PDP.TRUST.MISSING_SIGNALS',
    affected_criteria_ids: ['C.CORE.TRUST'],
    owner: 'copy',
    matches: (i) => !i.facts.structure.hasShippingInfo && !i.facts.structure.hasReturnPolicy,
    content: (i) => (i.locale === 'fr' ? RULES_FR.trust_badges!(i) : RULES_EN.trust_badges!(i)),
  },
  {
    id: 'reviews',
    category: 'trust',
    impact: 'high',
    effort: 'm',
    rule_id: 'R.PDP.REVIEWS.MISSING',
    affected_criteria_ids: ['C.CORE.TRUST'],
    owner: 'merch',
    matches: (i) => !i.facts.structure.hasReviewsSection,
    content: (i) => (i.locale === 'fr' ? RULES_FR.reviews!(i) : RULES_EN.reviews!(i)),
  },
  {
    id: 'performance',
    category: 'performance',
    impact: 'medium',
    effort: 'm',
    rule_id: 'R.TECH.PERF_LAB.POOR_BUCKET',
    affected_criteria_ids: ['C.TECH.PERF_LAB'],
    owner: 'dev',
    matches: (i) => {
      const lcp = i.facts.technical?.lcpMs;
      const perfDeductions =
        i.scoreOutput?.breakdown?.filter((b) => b.pillar === 'perf' && b.delta < 0) ?? [];
      return (lcp != null && lcp > 2500) || perfDeductions.length > 0;
    },
    content: (i) => (i.locale === 'fr' ? RULES_FR.performance!(i) : RULES_EN.performance!(i)),
  },
  {
    id: 'description',
    category: 'offer_clarity',
    impact: 'medium',
    effort: 's',
    rule_id: 'R.PDP.BENEFITS.MISSING_SCANNABLE_LIST',
    affected_criteria_ids: ['C.PERS.BENEFITS'],
    owner: 'copy',
    matches: (i) =>
      !i.facts.pdp.hasDescription || (i.facts.pdp.descriptionLength ?? 0) < 100,
    content: (i) => (i.locale === 'fr' ? RULES_FR.description!(i) : RULES_EN.description!(i)),
  },
  {
    id: 'variants',
    category: 'ux',
    impact: 'medium',
    effort: 'm',
    rule_id: 'R.PDP.VARIANTS.COMPLEXITY',
    affected_criteria_ids: ['C.CORE.CTA', 'C.TECH.MOBILE_UX'],
    owner: 'dev',
    matches: (i) =>
      i.facts.pdp.hasVariantSelector &&
      (i.facts.pdp.variantTypes?.length ?? 0) > 3,
    content: (i) => (i.locale === 'fr' ? RULES_FR.variants!(i) : RULES_EN.variants!(i)),
  },
];

function pickEvidenceRef(evidences: EvidenceV2[]): string {
  const screenshot = evidences.find((e) => e.type === 'screenshot');
  if (screenshot) return screenshot.evidence_id;
  if (evidences[0]) return evidences[0].evidence_id;
  return '';
}

function buildTicket(
  rule: RuleDef,
  input: RulesTicketInput,
  evidenceRef: string
): TicketV2 {
  const content = rule.content(input);
  return {
    ticket_id: `T_solo_rules_${rule.id}_pdp_01`,
    mode: 'solo',
    category: rule.category,
    impact: rule.impact,
    effort: rule.effort,
    risk: 'low',
    confidence: 'high',
    title: content.title,
    why: content.why,
    how_to: content.how_to,
    evidence_refs: [evidenceRef],
    validation: content.validation,
    quick_win: rule.effort === 's' && rule.impact === 'high',
    owner: rule.owner,
    notes: 'Rules Ticket Engine',
    rule_id: rule.rule_id,
    affected_criteria_ids: rule.affected_criteria_ids,
  };
}

/**
 * Generates deterministic tickets from facts and score.
 * Returns 3-5 tickets. Never uses placeholder evidence IDs.
 * If no evidences exist, returns [].
 */
export function generateDeterministicTickets(
  facts: ShopifyFacts,
  scoreOutput: StrategistScoreOutput | null,
  evidences: EvidenceV2[],
  locale: Locale = 'fr'
): TicketV2[] {
  const evidenceIds = evidences.map((e) => e.evidence_id);
  if (evidenceIds.length === 0) return [];

  const input: RulesTicketInput = { facts, scoreOutput, evidences, locale };
  const tickets: TicketV2[] = [];

  const evidenceRef = pickEvidenceRef(evidences);
  if (!evidenceRef) return [];

  for (const rule of RULE_DEFS) {
    if (!rule.matches(input)) continue;
    const ticket = buildTicket(rule, input, evidenceRef);
    tickets.push(ticket);
    if (tickets.length >= 5) break;
  }

  const sorted = sortTicketsStable(tickets);
  const guarded = filterTopActionsGuardrails(sorted, 1);
  return guarded.slice(0, 5);
}
