/**
 * ShopifyStrategist — SSOT Versions (Anti-Drift)
 * 
 * Ce fichier est la source de vérité unique pour les versions de schémas.
 * Extrait de: docs/REPORT_OUTLINE.md (V3.1) et docs/SCORING_AND_DETECTION.md (v2.2)
 * 
 * RÈGLE : Toute modification de structure/schéma doit incrémenter la version correspondante.
 * Tout changement ici doit être synchronisé avec les docs SSOT.
 */

/**
 * Version du document REPORT_OUTLINE.md
 * Source: docs/REPORT_OUTLINE.md ligne 1
 */
export const REPORT_OUTLINE_VERSION = '3.1' as const;

/**
 * Version du schéma Ticket (format export stable)
 * Source: docs/REPORT_OUTLINE.md ligne 11
 * Champs: ticket_id, mode, title, impact, effort, risk, confidence, category, 
 *         why, evidence_refs, how_to, validation, quick_win, owner_hint, notes
 */
export const TICKET_SCHEMA_VERSION = 2 as const;

/**
 * Version du schéma Evidence (format export stable)
 * Source: docs/REPORT_OUTLINE.md ligne 12
 * Champs: evidence_id, level, type, label, source, viewport, timestamp, ref, details
 */
export const EVIDENCE_SCHEMA_VERSION = 2 as const;

/**
 * Version du format CSV export
 * Source: docs/REPORT_OUTLINE.md ligne 13
 */
export const CSV_EXPORT_VERSION = 1 as const;

/**
 * Version du document SCORING_AND_DETECTION.md
 * Source: docs/SCORING_AND_DETECTION.md ligne 1
 */
export const SCORING_VERSION = '2.2' as const;

/**
 * Version de normalisation des URLs (pour product_key)
 * Source: docs/DB_SCHEMA.md section 4.2
 * Utilisée pour: normalizeUrl() + product_key
 */
export const NORMALIZE_VERSION = '1.0' as const;

/**
 * Version du moteur de capture/orchestration (pour snapshot_key)
 * Source: docs/DB_SCHEMA.md section 4.3
 * Utilisée pour: snapshot_key
 */
export const ENGINE_VERSION = '1.0' as const;

/**
 * Version de la spec des détecteurs (pour run_key)
 * Source: docs/DB_SCHEMA.md section 4.4
 * Utilisée pour: run_key + détection de signals
 */
export const DETECTORS_VERSION = '1.0' as const;

/**
 * Version du rendu PDF/CSV (pour render_key)
 * Source: docs/DB_SCHEMA.md section 4.6
 * Utilisée pour: render_key
 */
export const RENDER_VERSION = '1.0' as const;

/**
 * Objet regroupant toutes les versions pour export unifié
 */
export const SSOT_VERSIONS = {
  report_outline: REPORT_OUTLINE_VERSION,
  ticket_schema: TICKET_SCHEMA_VERSION,
  evidence_schema: EVIDENCE_SCHEMA_VERSION,
  csv_export: CSV_EXPORT_VERSION,
  scoring: SCORING_VERSION,
  normalize: NORMALIZE_VERSION,
  engine: ENGINE_VERSION,
  detectors: DETECTORS_VERSION,
  render: RENDER_VERSION,
} as const;

/**
 * Type pour les versions (utile pour validation runtime)
 */
export type SSOTVersions = typeof SSOT_VERSIONS;

/**
 * Fonction helper pour valider la cohérence des versions
 * Retourne true si toutes les versions sont définies et cohérentes
 */
export function validateVersions(): boolean {
  return (
    typeof REPORT_OUTLINE_VERSION === 'string' &&
    typeof TICKET_SCHEMA_VERSION === 'number' &&
    typeof EVIDENCE_SCHEMA_VERSION === 'number' &&
    typeof CSV_EXPORT_VERSION === 'number' &&
    typeof SCORING_VERSION === 'string'
  );
}
