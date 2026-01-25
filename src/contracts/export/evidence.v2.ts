/**
 * ⚠️ CONTRAT SSOT — Evidence Schema v2 (SSOT)
 * 
 * CE FICHIER EST UN CONTRAT STABLE.
 * ❌ NE PAS MODIFIER sans mise à jour préalable des documents SSOT :
 *    - docs/REPORT_OUTLINE.md (section 9)
 *    - docs/SCORING_AND_DETECTION.md (section 3.2)
 * 
 * Toute modification breaking nécessite :
 * 1. Bump EVIDENCE_SCHEMA_VERSION dans docs SSOT
 * 2. Mise à jour de src/ssot/versions.ts
 * 3. Migration des données existantes
 * 
 * @version EVIDENCE_SCHEMA_VERSION = 2
 * @reference docs/REPORT_OUTLINE.md section 9
 * @reference docs/SCORING_AND_DETECTION.md section 3.2
 */

import { z } from 'zod';

/**
 * Niveau de preuve (A/B/C)
 * 
 * Référence: docs/REPORT_OUTLINE.md section 2.1
 * 
 * - **A (fort)** : Preuve claire et directement pertinente
 *   - Ex: screenshot net montrant absence/présence, détection non ambiguë, mesure chiffrée avec méthode
 * 
 * - **B (moyen)** : Preuve pertinente mais incomplète
 *   - Ex: lazy-load, popup, section partiellement visible
 * 
 * - **C (faible)** : Inférence plausible sans preuve suffisante
 *   - ⚠️ Autorisé UNIQUEMENT en Appendix
 * 
 * Règle de mapping vers confidence (SSOT) :
 * - Preuve A ⇒ confidence=high
 * - Preuve B ⇒ confidence=medium
 * - Preuve C ⇒ confidence=low (Appendix uniquement)
 */
export const EvidenceLevelSchema = z.enum(['A', 'B', 'C']);
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;

/**
 * Type de preuve
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 3.2
 * 
 * - **screenshot** : Capture d'écran (viewport mobile/desktop)
 * - **measurement** : Mesure chiffrée (perf, poids, métriques)
 * - **detection** : Détection DOM/heuristique (présence/absence élément)
 */
export const EvidenceTypeSchema = z.enum(['screenshot', 'measurement', 'detection']);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

/**
 * Source de la preuve (selon mode SOLO/DUO)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 4.3
 * 
 * - SOLO : `page_a` uniquement
 * - DUO AB : `page_a` (toi) vs `page_b` (concurrent)
 * - DUO Before/After : `before` vs `after`
 * 
 * ⚠️ Note: `gap` et `diff` existent pour `ticket_id.scope` et `csv.url_context`,
 * mais Evidence.source reste strictement `page_a|page_b|before|after`.
 */
export const EvidenceSourceSchema = z.enum(['page_a', 'page_b', 'before', 'after']);
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

/**
 * Viewport (mobile/desktop/na)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 2.1
 * 
 * - **mobile** : 390×844 (viewport standard obligatoire)
 * - **desktop** : 1440×900 (viewport standard obligatoire)
 * - **na** : Non applicable (pour détections DOM sans screenshot)
 */
export const EvidenceViewportSchema = z.enum(['mobile', 'desktop', 'na']);
export type EvidenceViewport = z.infer<typeof EvidenceViewportSchema>;

/**
 * Evidence Schema v2 (format stable)
 * 
 * ⚠️ RÈGLES DURES (non négociables) :
 * 
 * 1. **Ancre HTML obligatoire** :
 *    - `ref` DOIT être au format `#evidence-<evidence_id>`
 *    - Wrapper HTML obligatoire : `<div id="evidence-<evidence_id>">`
 *    - Tout storage path/URL/JSON pointer va dans `details`
 * 
 * 2. **Evidence_id déterministe** :
 *    - Format: `E_<source>_<viewport>_<type>_<label>_<idx>`
 *    - Ex: `E_page_a_mobile_screenshot_above_fold_01`
 * 
 * 3. **Timestamp ISO 8601** :
 *    - Format strict : `YYYY-MM-DDTHH:mm:ss.sssZ`
 * 
 * @reference docs/REPORT_OUTLINE.md section 9.1
 * @reference docs/SCORING_AND_DETECTION.md section 3.2
 */
export const EvidenceV2Schema = z.object({
  /**
   * Identifiant déterministe unique
   * Format: E_<source>_<viewport>_<type>_<label>_<idx>
   * Ex: E_page_a_mobile_screenshot_above_fold_01
   */
  evidence_id: z.string(),

  /**
   * Niveau de preuve (A=fort, B=moyen, C=faible)
   * ⚠️ C autorisé UNIQUEMENT en Appendix
   */
  level: EvidenceLevelSchema,

  /**
   * Type de preuve
   */
  type: EvidenceTypeSchema,

  /**
   * Label descriptif (court)
   * Ex: "Above fold (mobile)", "LCP measurement", "Buybox detection"
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
   * Timestamp ISO 8601 (quand la preuve a été capturée)
   * Format: YYYY-MM-DDTHH:mm:ss.sssZ
   */
  timestamp: z.string().datetime(),

  /**
   * ⚠️ RÈGLE DURE : Ancre HTML stable
   * 
   * Format obligatoire : `#evidence-<evidence_id>`
   * Ex: `#evidence-E_page_a_mobile_screenshot_above_fold_01`
   * 
   * Tout storage path, URL, ou JSON pointer va dans `details`.
   */
  ref: z.string().regex(/^#evidence-E_/, {
    message: "ref MUST start with '#evidence-E_' (format: #evidence-<evidence_id>)",
  }),

  /**
   * Détails libres (objet flexible)
   * 
   * Peut contenir (selon type) :
   * 
   * - **screenshot** :
   *   - storage_path: string (chemin de stockage réel)
   *   - full_url: string (URL complète si CDN)
   *   - width: number
   *   - height: number
   *   - selector?: string (sélecteur DOM capturé)
   * 
   * - **measurement** :
   *   - metric: string (ex: "LCP", "CLS", "image_size")
   *   - value: number | string
   *   - unit?: string (ex: "ms", "KB", "score")
   *   - method: string (ex: "Lighthouse Lab", "DOM API")
   *   - threshold?: number (seuil dépassé)
   *   - notes?: string
   * 
   * - **detection** :
   *   - selector?: string (sélecteur DOM)
   *   - found: boolean
   *   - count?: number (si multiple)
   *   - text_snippet?: string
   *   - notes?: string
   * 
   * ⚠️ Pas de schéma fixe ici (flexibilité pour évolution sans version bump).
   * Mais JAMAIS de champ export stable ici (utiliser top-level fields uniquement).
   */
  details: z.record(z.unknown()).optional(),
});

export type EvidenceV2 = z.infer<typeof EvidenceV2Schema>;

/**
 * Helper: Générer un evidence_id déterministe
 * 
 * Format: E_<source>_<viewport>_<type>_<label>_<idx>
 * 
 * @param source - Source (page_a/page_b/before/after)
 * @param viewport - Viewport (mobile/desktop/na)
 * @param type - Type (screenshot/measurement/detection)
 * @param label - Label descriptif (sera slugifié)
 * @param idx - Index (1-based, padded à 2 chiffres)
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
  // Pad index à 2 chiffres
  const paddedIdx = idx.toString().padStart(2, '0');

  // Slugify label (lowercase, remplacer non-alphanum par underscore)
  const slugLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  return `E_${source}_${viewport}_${type}_${slugLabel}_${paddedIdx}`;
}

/**
 * Helper: Générer l'ancre HTML correspondante
 * 
 * Format obligatoire : #evidence-<evidence_id>
 * 
 * @param evidenceId - Evidence ID
 * @returns Ancre HTML au format SSOT
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
 * Indicateur de complétude du pack de preuves.
 * 
 * Référence: docs/REPORT_OUTLINE.md section 3.2
 * 
 * - **complete** : Set A atteint
 *   - `above_fold_mobile` + `above_fold_desktop` + `full_page_mobile`
 * 
 * - **partial** : Set B atteint (mais pas Set A)
 *   - `above_fold_mobile` + `cta_area_mobile` + `details_section`
 * 
 * - **insufficient** : Aucun set atteint
 *   - Badge "Evidence incomplete" en cover
 *   - Déplacer tickets dépendants en Appendix
 * 
 * DUO (AB / Before-After) — règle conservatrice :
 * - Calculer completeness **par source**
 * - Cover affiche = **pire des sources** (insufficient > partial > complete)
 */
export const EvidenceCompletenessSchema = z.enum(['complete', 'partial', 'insufficient']);
export type EvidenceCompleteness = z.infer<typeof EvidenceCompletenessSchema>;

/**
 * Raisons d'échec standard (SSOT)
 * 
 * Utilisées pour expliquer les preuves manquantes dans "Missing evidence" table.
 * 
 * Référence: docs/REPORT_OUTLINE.md section 3.4
 * 
 * - **blocked_by_cookie_consent** : Popup cookies bloquante
 * - **blocked_by_popup** : Popup/modal bloquante (autre que cookies)
 * - **infinite_scroll_or_lazyload** : Contenu lazy-load non chargeable
 * - **navigation_intercepted** : Navigation interceptée (SPA, redirection)
 * - **timeout** : Timeout atteint avant render complet
 * - **unknown_render_issue** : Problème de rendu non identifié
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
 * Screenshot metadata (optionnel, pour details)
 * 
 * Structure recommandée (non imposée) pour details.screenshot_metadata
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
 * Measurement metadata (optionnel, pour details)
 * 
 * Structure recommandée (non imposée) pour details.measurement_metadata
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
