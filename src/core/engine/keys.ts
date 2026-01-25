/**
 * ⚠️ SYSTÈME DE CLÉS DÉTERMINISTES (SSOT)
 * 
 * Ce fichier est le cœur du système de cache multi-couches.
 * Référence: docs/DB_SCHEMA.md sections 3 & 4
 * 
 * Principe fondamental (anti-drift) :
 * - Mêmes entrées effectives + mêmes versions → mêmes clés
 * - Les clés sont dérivées de JSON canoniques (tri stable) + SHA-256
 * - Aucune dépendance à now() ou ordre non-stable
 * 
 * Couches du cache :
 * 1. product_key → Produit normalisé (URL + mode)
 * 2. snapshot_key → Capture (DOM + screenshots + artefacts)
 * 3. run_key → Scoring (facts → evidences + tickets)
 * 4. audit_key → Rapport HTML (SSOT)
 * 5. render_key → Rendus dérivés (PDF + CSV)
 * 
 * @version DB_SCHEMA_VERSION = 1.0
 * @reference docs/DB_SCHEMA.md
 */

import { createHash } from 'node:crypto';
import {
  NORMALIZE_VERSION,
  ENGINE_VERSION,
  DETECTORS_VERSION,
  SCORING_VERSION,
  REPORT_OUTLINE_VERSION,
  RENDER_VERSION,
  CSV_EXPORT_VERSION,
} from '@/ssot/versions';

/**
 * Mode du rapport (SOLO vs DUO)
 */
export type Mode = 'solo' | 'duo_ab' | 'duo_before_after';

/**
 * Source de la page (selon mode)
 */
export type PageSource = 'page_a' | 'page_b' | 'before' | 'after';

/**
 * Normaliser une URL (règle SSOT — Version Radicale pour PDP Shopify)
 * 
 * Transformations appliquées :
 * 1. Conversion en minuscule
 * 2. Suppression de TOUS les query parameters (tout après le ?)
 * 3. Suppression des ancres (#)
 * 4. Suppression du slash final
 * 
 * ⚠️ RÈGLE STRICTE : Une PDP Shopify est identifiée uniquement par :
 * - Son domaine (ex: fr.gymshark.com)
 * - Son chemin (ex: /products/gymshark-crest-straight-leg-joggers-black-aw23)
 * 
 * Les variants, couleurs, tailles sont considérés comme le MÊME produit.
 * 
 * Référence: docs/DB_SCHEMA.md section 4.2
 * 
 * @param url - URL brute à normaliser
 * @returns URL normalisée (déterministe)
 * 
 * @example
 * normalizeUrl('https://Example.com/Product/?variant=123&utm_source=fb#reviews/')
 * // => 'https://example.com/product'
 */
export function normalizeUrl(url: string): string {
  try {
    // Parse URL
    const parsed = new URL(url);

    // 1. Minuscule (host + pathname)
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // 2. Reconstruction : UNIQUEMENT protocol + host + pathname
    // Tous les query params sont supprimés (pas de search, pas d'ancre)
    let normalized = `${parsed.protocol}//${host}${pathname}`;

    // 3. Retirer slash final (sauf si c'est juste le root /)
    if (normalized.endsWith('/') && normalized !== `${parsed.protocol}//${host}/`) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch (error) {
    // Si URL invalide, retourner telle quelle (le caller devra gérer)
    // En production, cela devrait être logué/remonté
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Générer un hash SHA-256 (hex) à partir d'une string
 * 
 * @param input - String à hasher
 * @returns Hash SHA-256 en hexadécimal (64 caractères)
 */
function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Générer un JSON canonique (tri stable des clés)
 * 
 * Garantit que le même objet produit toujours le même JSON.
 * 
 * @param obj - Objet à sérialiser
 * @returns JSON canonique (clés triées)
 */
function canonicalJSON(obj: Record<string, unknown>): string {
  // Trier les clés récursivement
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      const value = obj[key];
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        acc[key] = JSON.parse(canonicalJSON(value as Record<string, unknown>));
      } else if (Array.isArray(value)) {
        // Arrays : préserver l'ordre (supposé sémantique)
        acc[key] = value;
      } else {
        acc[key] = value;
      }
      
      return acc;
    }, {} as Record<string, unknown>);

  return JSON.stringify(sorted);
}

/**
 * Générer une clé avec préfixe
 * 
 * Format: <prefix>_<hash_8_premiers_chars>
 * 
 * @param prefix - Préfixe (ex: 'prod', 'snap', 'run')
 * @param canonical - JSON canonique
 * @returns Clé complète (prefix + hash tronqué)
 */
function generateKey(prefix: string, canonical: string): string {
  const hash = sha256(canonical);
  // Garder 16 caractères du hash (64 bits d'entropie)
  return `${prefix}_${hash.substring(0, 16)}`;
}

/**
 * Générer product_key (couche 1)
 * 
 * Identifie un "même objet" indépendamment des runs.
 * 
 * Canonical input :
 * - mode (solo|duo_ab|duo_before_after)
 * - normalized_urls (selon mode)
 * - NORMALIZE_VERSION
 * 
 * ⚠️ RÈGLE SSOT : locale n'entre PAS dans product_key
 * La séparation par langue vit au niveau snapshot_key
 * 
 * Référence: docs/DB_SCHEMA.md section 4.2
 * 
 * @param params - Paramètres du produit
 * @returns product_key (format: prod_<hash>)
 * 
 * @example
 * // SOLO
 * generateProductKey({
 *   mode: 'solo',
 *   urls: { page_a: 'https://example.com/product' }
 * })
 * // => 'prod_a1b2c3d4e5f67890'
 * 
 * // DUO AB
 * generateProductKey({
 *   mode: 'duo_ab',
 *   urls: {
 *     page_a: 'https://me.com/product',
 *     page_b: 'https://competitor.com/product'
 *   }
 * })
 * // => 'prod_f9e8d7c6b5a43210'
 */
export function generateProductKey(params: {
  mode: Mode;
  urls: Partial<Record<PageSource, string>>;
}): string {
  const { mode, urls } = params;

  // Normaliser toutes les URLs
  const normalizedUrls: Record<string, string> = {};
  
  for (const [source, url] of Object.entries(urls)) {
    if (url) {
      normalizedUrls[source] = normalizeUrl(url);
    }
  }

  // Canonical input
  const canonical = canonicalJSON({
    mode,
    normalized_urls: normalizedUrls,
    normalize_version: NORMALIZE_VERSION,
  });

  return generateKey('prod', canonical);
}

/**
 * Générer snapshot_key (couche 2)
 * 
 * Identifie un pack de capture : DOM + screenshots + artefacts.
 * 
 * Canonical input :
 * - product_key
 * - locale
 * - viewports (mobile 390×844, desktop 1440×900)
 * - engine_version
 * 
 * Référence: docs/DB_SCHEMA.md section 4.3
 * 
 * @param params - Paramètres de snapshot
 * @returns snapshot_key (format: snap_<hash>)
 * 
 * @example
 * generateSnapshotKey({
 *   productKey: 'prod_a1b2c3d4e5f67890',
 *   locale: 'fr',
 *   viewports: {
 *     mobile: { width: 390, height: 844 },
 *     desktop: { width: 1440, height: 900 }
 *   }
 * })
 * // => 'snap_1234567890abcdef'
 */
export function generateSnapshotKey(params: {
  productKey: string;
  locale: string;
  viewports: {
    mobile: { width: number; height: number };
    desktop: { width: number; height: number };
  };
}): string {
  const { productKey, locale, viewports } = params;

  // Canonical input
  const canonical = canonicalJSON({
    product_key: productKey,
    locale,
    viewports,
    engine_version: ENGINE_VERSION,
  });

  return generateKey('snap', canonical);
}

/**
 * Générer run_key (couche 3)
 * 
 * Identifie un résultat de scoring : facts → evidences v2 + tickets v2.
 * 
 * Canonical input :
 * - snapshot_key
 * - detectors_version
 * - scoring_version
 * - mode
 * 
 * Référence: docs/DB_SCHEMA.md section 4.4
 * 
 * @param params - Paramètres de run
 * @returns run_key (format: run_<hash>)
 * 
 * @example
 * generateRunKey({
 *   snapshotKey: 'snap_1234567890abcdef',
 *   mode: 'solo'
 * })
 * // => 'run_fedcba0987654321'
 */
export function generateRunKey(params: {
  snapshotKey: string;
  mode: Mode;
}): string {
  const { snapshotKey, mode } = params;

  // Canonical input
  const canonical = canonicalJSON({
    snapshot_key: snapshotKey,
    detectors_version: DETECTORS_VERSION,
    scoring_version: SCORING_VERSION,
    mode,
  });

  return generateKey('run', canonical);
}

/**
 * Générer audit_key (couche 4)
 * 
 * Identifie un rapport HTML SSOT (structure V3.1 + contenus).
 * 
 * Canonical input :
 * - run_key
 * - report_outline_version
 * - copy_ready (car change le HTML)
 * - white_label (si activé)
 * 
 * Référence: docs/DB_SCHEMA.md section 4.5
 * 
 * @param params - Paramètres d'audit
 * @returns audit_key (format: audit_<hash>)
 * 
 * @example
 * generateAuditKey({
 *   runKey: 'run_fedcba0987654321',
 *   copyReady: false,
 *   whiteLabel: null
 * })
 * // => 'audit_abcdef1234567890'
 */
export function generateAuditKey(params: {
  runKey: string;
  copyReady?: boolean;
  whiteLabel?: {
    logo?: string;
    clientName?: string;
    agencyName?: string;
  } | null;
}): string {
  const { runKey, copyReady = false, whiteLabel = null } = params;

  // Canonical input
  const canonical = canonicalJSON({
    run_key: runKey,
    report_outline_version: REPORT_OUTLINE_VERSION,
    copy_ready: copyReady,
    white_label: whiteLabel,
  });

  return generateKey('audit', canonical);
}

/**
 * Générer render_key (couche 5)
 * 
 * Identifie les rendus dérivés : PDF + CSV.
 * 
 * Canonical input :
 * - audit_key
 * - render_version
 * - csv_export_version
 * 
 * Référence: docs/DB_SCHEMA.md section 4.6
 * 
 * @param params - Paramètres de render
 * @returns render_key (format: render_<hash>)
 * 
 * @example
 * generateRenderKey({
 *   auditKey: 'audit_abcdef1234567890'
 * })
 * // => 'render_0fedcba987654321'
 */
export function generateRenderKey(params: {
  auditKey: string;
}): string {
  const { auditKey } = params;

  // Canonical input
  const canonical = canonicalJSON({
    audit_key: auditKey,
    render_version: RENDER_VERSION,
    csv_export_version: CSV_EXPORT_VERSION,
  });

  return generateKey('render', canonical);
}

/**
 * Extraire le canonical input d'une clé (pour debug/audit)
 * 
 * ⚠️ Impossible de retrouver l'input original depuis le hash !
 * Cette fonction est un placeholder pour documentation.
 * En production, stocker `canonical_input` en DB.
 * 
 * @param key - Clé à analyser
 * @returns Informations sur la clé
 */
export function analyzeKey(key: string): {
  prefix: string;
  hash: string;
  isValid: boolean;
} {
  const parts = key.split('_');
  
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return {
      prefix: '',
      hash: '',
      isValid: false,
    };
  }

  const [prefix, hash] = parts;
  const validPrefixes = ['prod', 'snap', 'run', 'audit', 'render'];

  return {
    prefix,
    hash,
    isValid: validPrefixes.includes(prefix) && hash.length === 16,
  };
}
