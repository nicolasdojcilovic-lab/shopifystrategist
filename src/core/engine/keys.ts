/**
 * ⚠️ DETERMINISTIC KEYS SYSTEM (SSOT)
 * 
 * This file is the core of the multi-layer cache system.
 * Reference: docs/DB_SCHEMA.md sections 3 & 4
 * 
 * Fundamental principle (anti-drift):
 * - Same effective inputs + same versions → same keys
 * - Keys are derived from canonical JSON (stable sort) + SHA-256
 * - No dependency on now() or non-stable order
 * 
 * Cache layers:
 * 1. product_key → Normalized product (URL + mode)
 * 2. snapshot_key → Capture (DOM + screenshots + artifacts)
 * 3. run_key → Scoring (facts → evidences + tickets)
 * 4. audit_key → HTML report (SSOT)
 * 5. render_key → Derived renders (PDF + CSV)
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
 * Normalizes a URL (SSOT rule — Radical Version for Shopify PDP)
 * 
 * Applied transformations:
 * 1. Convert to lowercase
 * 2. Remove ALL query parameters (everything after ?)
 * 3. Remove anchors (#)
 * 4. Remove trailing slash
 * 
 * ⚠️ STRICT RULE: A Shopify PDP is identified solely by:
 * - Its domain (e.g., fr.gymshark.com)
 * - Its path (e.g., /products/gymshark-crest-straight-leg-joggers-black-aw23)
 * 
 * Variants, colors, sizes are considered the SAME product.
 * 
 * Reference: docs/DB_SCHEMA.md section 4.2
 * 
 * @param url - Raw URL to normalize
 * @returns Normalized URL (deterministic)
 * 
 * @example
 * normalizeUrl('https://Example.com/Product/?variant=123&utm_source=fb#reviews/')
 * // => 'https://example.com/product'
 */
export function normalizeUrl(url: string): string {
  try {
    // Parse URL
    const parsed = new URL(url);

    // 1. Lowercase (host + pathname)
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // 2. Reconstruction: ONLY protocol + host + pathname
    // All query params are removed (no search, no anchor)
    let normalized = `${parsed.protocol}//${host}${pathname}`;

    // 3. Remove trailing slash (except if it's just root /)
    if (normalized.endsWith('/') && normalized !== `${parsed.protocol}//${host}/`) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch (error) {
    // If invalid URL, return as-is (caller must handle)
    // In production, this should be logged/reported
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Generates SHA-256 hash (hex) from a string
 * 
 * @param input - String to hash
 * @returns SHA-256 hash in hexadecimal (64 characters)
 */
function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Generates canonical JSON (stable key sort)
 * 
 * Ensures the same object always produces the same JSON.
 * 
 * @param obj - Object to serialize
 * @returns Canonical JSON (sorted keys)
 */
function canonicalJSON(obj: Record<string, unknown>): string {
  // Sort keys recursively
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      const value = obj[key];
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        acc[key] = JSON.parse(canonicalJSON(value as Record<string, unknown>));
      } else if (Array.isArray(value)) {
        // Arrays: preserve order (assumed semantic)
        acc[key] = value;
      } else {
        acc[key] = value;
      }
      
      return acc;
    }, {} as Record<string, unknown>);

  return JSON.stringify(sorted);
}

/**
 * Generates a key with prefix
 * 
 * Format: <prefix>_<hash_first_8_chars>
 * 
 * @param prefix - Prefix (e.g., 'prod', 'snap', 'run')
 * @param canonical - Canonical JSON
 * @returns Complete key (prefix + truncated hash)
 */
function generateKey(prefix: string, canonical: string): string {
  const hash = sha256(canonical);
  // Keep 16 characters of hash (64 bits entropy)
  return `${prefix}_${hash.substring(0, 16)}`;
}

/**
 * Generates product_key (layer 1)
 * 
 * Identifies a "same object" independently of runs.
 * 
 * Canonical input:
 * - mode (solo|duo_ab|duo_before_after)
 * - normalized_urls (according to mode)
 * - NORMALIZE_VERSION
 * 
 * ⚠️ SSOT RULE: locale does NOT enter product_key
 * Language separation lives at snapshot_key level
 * 
 * Reference: docs/DB_SCHEMA.md section 4.2
 * 
 * @param params - Product parameters
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

  // Normalize all URLs
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
 * Generates snapshot_key (layer 2)
 * 
 * Identifies a capture pack: DOM + screenshots + artifacts.
 * 
 * Canonical input:
 * - product_key
 * - locale
 * - viewports (mobile 390×844, desktop 1440×900)
 * - engine_version
 * 
 * Reference: docs/DB_SCHEMA.md section 4.3
 * 
 * @param params - Snapshot parameters
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
 * Generates run_key (layer 3)
 * 
 * Identifies a scoring result: facts → evidences v2 + tickets v2.
 * 
 * Canonical input:
 * - snapshot_key
 * - detectors_version
 * - scoring_version
 * - mode
 * 
 * Reference: docs/DB_SCHEMA.md section 4.4
 * 
 * @param params - Run parameters
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
 * Generates audit_key (layer 4)
 * 
 * Identifies an SSOT HTML report (V3.1 structure + content).
 * 
 * Canonical input:
 * - run_key
 * - report_outline_version
 * - copy_ready (because it changes HTML)
 * - white_label (if enabled)
 * 
 * Reference: docs/DB_SCHEMA.md section 4.5
 * 
 * @param params - Audit parameters
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
 * Generates render_key (layer 5)
 * 
 * Identifies derived renders: PDF + CSV.
 * 
 * Canonical input:
 * - audit_key
 * - render_version
 * - csv_export_version
 * 
 * Reference: docs/DB_SCHEMA.md section 4.6
 * 
 * @param params - Render parameters
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
 * Extracts canonical input from a key (for debug/audit)
 * 
 * ⚠️ Impossible to recover original input from hash!
 * This function is a placeholder for documentation.
 * In production, store `canonical_input` in DB.
 * 
 * @param key - Key to analyze
 * @returns Key information
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
