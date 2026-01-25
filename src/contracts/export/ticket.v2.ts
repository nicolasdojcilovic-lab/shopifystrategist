/**
 * ⚠️ CONTRAT SSOT — Ticket Schema v2 (SSOT)
 * 
 * CE FICHIER EST UN CONTRAT STABLE.
 * ❌ NE PAS MODIFIER sans mise à jour préalable des documents SSOT :
 *    - docs/REPORT_OUTLINE.md (section 8)
 *    - docs/SCORING_AND_DETECTION.md (section 3.1)
 * 
 * Toute modification breaking nécessite :
 * 1. Bump TICKET_SCHEMA_VERSION dans docs SSOT
 * 2. Mise à jour de src/ssot/versions.ts
 * 3. Migration des données existantes
 * 
 * @version TICKET_SCHEMA_VERSION = 2
 * @reference docs/REPORT_OUTLINE.md section 8
 * @reference docs/SCORING_AND_DETECTION.md section 3.1
 */

import { z } from 'zod';

/**
 * Mode du rapport (SOLO vs DUO)
 * 
 * Référence: docs/REPORT_OUTLINE.md section 8.1
 * 
 * - **solo** : Instant Teardown (1 page auditée)
 * - **duo_ab** : AB Battlecard (toi vs concurrent)
 * - **duo_before_after** : Before/After Diff (changements mesurés)
 */
export const TicketModeSchema = z.enum(['solo', 'duo_ab', 'duo_before_after']);
export type TicketMode = z.infer<typeof TicketModeSchema>;

/**
 * Impact business (HIGH/MEDIUM/LOW)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 5.1
 * 
 * Mapping pour PriorityScore :
 * - high = 3
 * - medium = 2
 * - low = 1
 */
export const TicketImpactSchema = z.enum(['high', 'medium', 'low']);
export type TicketImpact = z.infer<typeof TicketImpactSchema>;

/**
 * Effort d'implémentation (SMALL/MEDIUM/LARGE)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 5.1
 * 
 * Mapping pour PriorityScore :
 * - small = 1
 * - medium = 2
 * - large = 3
 * 
 * Garde-fou Top Actions :
 * - Max 2 tickets effort=large (sauf changements structurants en before/after)
 */
export const TicketEffortSchema = z.enum(['small', 'medium', 'large']);
export type TicketEffort = z.infer<typeof TicketEffortSchema>;

/**
 * Risque d'implémentation (LOW/MEDIUM/HIGH)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 5.1
 * 
 * Mapping pour PriorityScore :
 * - low = 1
 * - medium = 2
 * - high = 3
 */
export const TicketRiskSchema = z.enum(['low', 'medium', 'high']);
export type TicketRisk = z.infer<typeof TicketRiskSchema>;

/**
 * Niveau de confiance (HIGH/MEDIUM/LOW)
 * 
 * Référence: docs/REPORT_OUTLINE.md section 8.2
 * 
 * Mapping pour PriorityScore :
 * - high = 3
 * - medium = 2
 * - low = 1
 * 
 * Règle de mapping depuis Evidence.level (SSOT) :
 * - Preuve A ⇒ confidence=high
 * - Preuve B ⇒ confidence=medium
 * - Preuve C ⇒ confidence=low (Appendix UNIQUEMENT)
 * 
 * Garde-fou Top Actions :
 * - ⚠️ EXCLURE confidence=low (réserver à Appendix)
 */
export const TicketConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type TicketConfidence = z.infer<typeof TicketConfidenceSchema>;

/**
 * Catégories de tickets (SSOT stable)
 * 
 * Référence: docs/REPORT_OUTLINE.md section 8.1
 * 
 * - **offer_clarity** : Prix, CTA, variants, bénéfices, shipping/returns
 * - **trust** : Avis, réassurance, garanties, contact/support
 * - **media** : Galerie, vidéo, qualité images
 * - **ux** : Sticky ATC, FAQ, navigation, mobile UX
 * - **performance** : Images lourdes, Lighthouse, scripts tiers
 * - **seo_basics** : H1, meta title/description
 * - **accessibility** : Alt text, contraste, labels
 * - **comparison** : Tickets comparatifs DUO (gaps, diffs)
 * 
 * Règles de diversité (Top Actions) :
 * - Min 1 offer_clarity
 * - Min 1 ux
 * - Min 1 performance OU media
 * - Min 1 trust (si signal détecté)
 * - Max 4 tickets d'une même catégorie
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
 * Owner hint (design/dev/content/ops)
 * 
 * Référence: docs/REPORT_OUTLINE.md section 8.1
 * 
 * Hint (non prescriptif) sur qui doit s'occuper du ticket :
 * - **design** : Changements UI/UX, layout, couleurs, typographie
 * - **dev** : Code, perf, scripts, accessibilité technique
 * - **content** : Textes, images, vidéos, copy
 * - **ops** : Config, outils, process, support
 */
export const TicketOwnerHintSchema = z.enum(['design', 'dev', 'content', 'ops']);
export type TicketOwnerHint = z.infer<typeof TicketOwnerHintSchema>;

/**
 * Ticket Schema v2 (format stable)
 * 
 * ⚠️ RÈGLES DURES (non négociables) :
 * 
 * 1. **Evidence-based** :
 *    - `evidence_refs` DOIT contenir ≥ 1 evidence_id
 *    - Chaque evidence_id référencé DOIT exister dans Evidence pack
 * 
 * 2. **Ticket_id déterministe** :
 *    - Format: `T_<mode>_<category>_<signal_id>_<scope>_<idx>`
 *    - Ex: `T_solo_offer_clarity_SIG_OFFER_02_pdp_01`
 * 
 * 3. **How_to exécutable** :
 *    - 3–7 étapes (bullets)
 *    - Chaque étape doit être actionnable (pas de blabla)
 * 
 * 4. **Wrapper HTML obligatoire** :
 *    - Chaque ticket exporté DOIT avoir : `<div id="ticket-<ticket_id>">`
 * 
 * @reference docs/REPORT_OUTLINE.md section 8.1
 * @reference docs/SCORING_AND_DETECTION.md section 3.1
 */
export const TicketV2Schema = z.object({
  /**
   * Identifiant déterministe unique
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
   * Mode du rapport (solo/duo_ab/duo_before_after)
   */
  mode: TicketModeSchema,

  /**
   * Titre du ticket (court, actionnable)
   * 
   * Exemples:
   * - "Afficher le prix dans le bloc d'achat"
   * - "Ajouter une FAQ orientée objections"
   * - "Optimiser les images (formats, compression)"
   */
  title: z.string(),

  /**
   * Impact business (high/medium/low)
   * 
   * Utilisé pour PriorityScore (impact*3)
   */
  impact: TicketImpactSchema,

  /**
   * Effort d'implémentation (small/medium/large)
   * 
   * Utilisé pour PriorityScore (effort*-2)
   * 
   * ⚠️ Garde-fou : Max 2 tickets effort=large en Top Actions
   */
  effort: TicketEffortSchema,

  /**
   * Risque d'implémentation (low/medium/high)
   * 
   * Utilisé pour PriorityScore (risk*-1)
   */
  risk: TicketRiskSchema,

  /**
   * Niveau de confiance (high/medium/low)
   * 
   * Règle de mapping depuis Evidence.level :
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
   * Catégorie du ticket
   * 
   * Règles de diversité (Top Actions) :
   * - Min 1 offer_clarity
   * - Min 1 ux
   * - Min 1 performance OU media
   * - Min 1 trust (si signal détecté)
   * - Max 4 tickets d'une même catégorie
   */
  category: TicketCategorySchema,

  /**
   * Pourquoi ce ticket ? (contexte + problème détecté)
   * 
   * Structure recommandée :
   * 1. Problème détecté (factuel, basé sur evidence)
   * 2. Impact business (pourquoi c'est important)
   * 3. Contexte additionnel (si pertinent)
   * 
   * Exemple:
   * "Le prix n'est pas visible dans le bloc d'achat (evidence: screenshot above-fold).
   * Cela augmente les frictions et peut bloquer la décision d'achat.
   * Les visiteurs doivent scroller ou chercher le prix, ce qui nuit à la conversion."
   */
  why: z.string(),

  /**
   * ⚠️ RÈGLE DURE : Références aux preuves (≥ 1 obligatoire)
   * 
   * Tableau d'evidence_id (format: E_<source>_<viewport>_<type>_<label>_<idx>)
   * 
   * Chaque evidence_id référencé DOIT exister dans le Evidence pack.
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
   * Comment faire ? (3–7 étapes exécutables)
   * 
   * Chaque étape doit être :
   * - Actionnable (verbe d'action)
   * - Spécifique (pas de blabla générique)
   * - Exécutable (le dev/designer sait quoi faire)
   * 
   * Exemples:
   * - "Déplacer le bloc prix dans le form.product-form (au-dessus du CTA)"
   * - "Augmenter la font-size du prix à 28px (mobile) et 32px (desktop)"
   * - "Ajouter un style bold et une couleur contrastée (#000 ou équivalent)"
   * 
   * @reference docs/REPORT_OUTLINE.md section 8.1
   */
  how_to: z.array(z.string()).min(3).max(7, {
    message: 'how_to MUST contain 3-7 executable steps (SSOT rule)',
  }),

  /**
   * Validation (checks observables)
   * 
   * Critères pour vérifier que le ticket est bien implémenté.
   * 
   * Exemples:
   * - "Le prix est visible sans scroll sur mobile (viewport 390×844)"
   * - "Le prix est dans le même conteneur que le CTA (inspect DOM)"
   * - "Le prix est lisible (contrast ratio ≥ 4.5:1)"
   */
  validation: z.array(z.string()),

  /**
   * Quick win ? (effort small + confidence high/medium)
   * 
   * Critères:
   * - effort = small
   * - confidence = high OU medium
   * - impact = high OU medium (préféré)
   * 
   * Cible Top Actions : 3–5 quick wins
   * 
   * @reference docs/SCORING_AND_DETECTION.md section 5.3
   */
  quick_win: z.boolean(),

  /**
   * Qui doit s'en occuper ? (hint seulement)
   * 
   * - design : UI/UX, layout, couleurs
   * - dev : Code, perf, accessibilité technique
   * - content : Textes, images, vidéos
   * - ops : Config, outils, process
   */
  owner_hint: TicketOwnerHintSchema,

  /**
   * Notes additionnelles (SSOT Anti-Drift)
   * 
   * Informations complémentaires :
   * - Limites de la détection
   * - Contexte spécifique (ex: contenu dynamique)
   * - Suggestions alternatives
   * 
   * IMPORTANT: Champ non-optionnel pour compatibilité OpenAI JSON Schema
   * Utiliser string vide si aucune note
   */
  notes: z.string().default(''),
});

export type TicketV2 = z.infer<typeof TicketV2Schema>;

/**
 * PriorityScore Calculation (SSOT)
 * 
 * Formule : impact*3 + confidence*2 - effort*2 - risk*1
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 5.1
 * 
 * @param ticket - Ticket v2
 * @returns PriorityScore (nombre décimal)
 */
export function calculatePriorityScore(ticket: TicketV2): number {
  const impactMap: Record<TicketImpact, number> = { high: 3, medium: 2, low: 1 };
  const effortMap: Record<TicketEffort, number> = { small: 1, medium: 2, large: 3 };
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
 * Tri Stable des Tickets (SSOT)
 * 
 * Ordre (tous décroissants sauf effort/risk croissants) :
 * 1) PriorityScore décroissant
 * 2) impact décroissant
 * 3) confidence décroissant
 * 4) effort croissant
 * 5) risk croissant
 * 6) ticket_id (stable, alphabétique)
 * 
 * ⚠️ Déterminisme : Mêmes inputs → même ordre
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 5.2
 * 
 * @param tickets - Array de tickets v2
 * @returns Array trié (copie, pas mutation)
 */
export function sortTicketsStable(tickets: TicketV2[]): TicketV2[] {
  const impactOrder: Record<TicketImpact, number> = { high: 3, medium: 2, low: 1 };
  const confidenceOrder: Record<TicketConfidence, number> = { high: 3, medium: 2, low: 1 };
  const effortOrder: Record<TicketEffort, number> = { small: 1, medium: 2, large: 3 };
  const riskOrder: Record<TicketRisk, number> = { low: 1, medium: 2, high: 3 };

  return [...tickets].sort((a, b) => {
    // 1) PriorityScore décroissant
    const scoreA = calculatePriorityScore(a);
    const scoreB = calculatePriorityScore(b);
    if (scoreA !== scoreB) return scoreB - scoreA;

    // 2) impact décroissant
    if (impactOrder[a.impact] !== impactOrder[b.impact]) {
      return impactOrder[b.impact] - impactOrder[a.impact];
    }

    // 3) confidence décroissant
    if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    }

    // 4) effort croissant
    if (effortOrder[a.effort] !== effortOrder[b.effort]) {
      return effortOrder[a.effort] - effortOrder[b.effort];
    }

    // 5) risk croissant
    if (riskOrder[a.risk] !== riskOrder[b.risk]) {
      return riskOrder[a.risk] - riskOrder[b.risk];
    }

    // 6) ticket_id (stable, alphabétique)
    return a.ticket_id.localeCompare(b.ticket_id);
  });
}

/**
 * Filtrer les tickets pour Top Actions (SSOT Guardrails)
 * 
 * Garde-fous :
 * - Exclure confidence=low (réserver à Appendix)
 * - Max 2 tickets effort=large (sauf changements structurants en before/after)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 5.3
 * 
 * @param tickets - Array de tickets v2 (pré-triés)
 * @param maxLargeEffort - Nombre max de tickets effort=large (default: 2)
 * @returns Array filtré pour Top Actions
 */
export function filterTopActionsGuardrails(
  tickets: TicketV2[],
  maxLargeEffort: number = 2
): TicketV2[] {
  const filtered: TicketV2[] = [];
  let largeEffortCount = 0;

  for (const ticket of tickets) {
    // Garde-fou 1: Exclure confidence=low
    if (ticket.confidence === 'low') continue;

    // Garde-fou 2: Max 2 tickets effort=large
    if (ticket.effort === 'large') {
      if (largeEffortCount >= maxLargeEffort) continue;
      largeEffortCount++;
    }

    filtered.push(ticket);
  }

  return filtered;
}

/**
 * Extraire les Quick Wins (SSOT)
 * 
 * Critères :
 * - quick_win = true
 * - effort = small
 * - confidence = high OU medium
 * 
 * Cible : 3–5 quick wins en Top Actions
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 5.3
 * 
 * @param tickets - Array de tickets v2
 * @returns Array de quick wins
 */
export function extractQuickWins(tickets: TicketV2[]): TicketV2[] {
  return tickets.filter(
    (ticket) =>
      ticket.quick_win === true &&
      ticket.effort === 'small' &&
      (ticket.confidence === 'high' || ticket.confidence === 'medium')
  );
}
