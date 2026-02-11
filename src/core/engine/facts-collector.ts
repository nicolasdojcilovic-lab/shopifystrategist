/**
 * ⚠️ DETERMINISTIC FACTS COLLECTOR (SSOT)
 *
 * This module orchestrates the extraction of structured facts from captured HTML
 * via modular detectors (PDP, Structure, Technical).
 *
 * SSOT Principle (Anti-Drift):
 * - **Facts-Only**: No decisions, no scoring, no recommendations
 * - **Pure Function**: Same inputs → same outputs (determinism)
 * - **DOM-First**: Priority to DOM facts (no visual inference)
 * - **No Scoring**: The facts → tickets mapping lives in scoring engine
 *
 * Reference:
 * - docs/DETECTORS_SPEC.md (v1.3)
 * - docs/SCORING_AND_DETECTION.md (v2.2)
 *
 * @version FACTS_COLLECTOR_VERSION = 1.0
 */

import * as cheerio from 'cheerio';
import { extractAllJsonLdProducts, PDPDetector } from './detectors/pdp-detector';
import { StructuralDetector } from './detectors/structural-detector';
import { TechnicalDetector } from './detectors/technical-detector';
import type { ShopifyFacts, PDPFacts, StructureFacts, TechnicalFacts } from './types';

// Re-export types for backward compatibility
export type { ShopifyFacts, PDPFacts, StructureFacts, TechnicalFacts };

export interface CollectFactsOptions {
  strictMode?: boolean;
  locale?: string;
  /** Injected by capture layer when available (e.g. LCP from Playwright Performance API) */
  performanceMetrics?: { lcpMs?: number };
}

/**
 * Collects all facts from HTML (async API)
 *
 * Detectors are executed in parallel via Promise.all to reduce total time.
 * PURE function (deterministic): same inputs → same outputs.
 *
 * @param html - Captured page HTML
 * @param options - Collection options
 * @returns Structured facts
 *
 * @example
 * const facts = await collectFacts(html);
 * console.log('Product:', facts.pdp.title);
 * console.log('Apps:', facts.technical.detectedApps);
 */
export async function collectFacts(
  html: string,
  options: CollectFactsOptions = {}
): Promise<ShopifyFacts> {
  const startTime = Date.now();
  const { strictMode = true, locale = 'en', performanceMetrics } = options;
  const $ = cheerio.load(html);
  const allJsonLdProducts = extractAllJsonLdProducts(html);
  const jsonLdData = allJsonLdProducts.length > 0 && allJsonLdProducts[0] ? allJsonLdProducts[0] : null;

  const pdpDetector = new PDPDetector();
  const structuralDetector = new StructuralDetector();
  const technicalDetector = new TechnicalDetector();

  const [pdpResult, structure, technical] = await Promise.all([
    Promise.resolve().then(() =>
      pdpDetector.extract($, html, allJsonLdProducts, { strictMode, locale })
    ),
    Promise.resolve().then(() => structuralDetector.extract($, jsonLdData)),
    Promise.resolve().then(() => technicalDetector.extract($, html, performanceMetrics)),
  ]);

  const { _meta, ...pdp } = pdpResult;
  const parsingDuration = Date.now() - startTime;
  const meta: ShopifyFacts['meta'] = { parsingDuration };
  if (_meta?.descriptionSource) meta.descriptionSource = _meta.descriptionSource;

  return { pdp, structure, technical, meta };
}

/**
 * Normalizes a price (handles European commas and American dots)
 *
 * This function is exported because it's used by helpers.
 */
export function normalizePrice(priceString: string): number | null {
  if (!priceString) return null;
  let cleaned = priceString.replace(/[€$£¥\s]/g, '');
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  if (hasComma && hasDot) {
    const lastCommaIndex = cleaned.lastIndexOf(',');
    const lastDotIndex = cleaned.lastIndexOf('.');
    if (lastDotIndex > lastCommaIndex) cleaned = cleaned.replace(/,/g, '');
    else cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && !hasDot) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1] && parts[1].length === 2) cleaned = cleaned.replace(',', '.');
    else if (parts.length > 1 && parts[1] && parts[1].length === 3) cleaned = cleaned.replace(/,/g, '');
    else cleaned = cleaned.replace(',', '.');
  }
  const match = cleaned.match(/(\d+\.?\d*)/);
  if (match && match[1]) {
    const result = parseFloat(match[1]);
    return isNaN(result) ? null : result;
  }
  return null;
}

/**
 * Helpers to extract specific facts
 */
export const FactsHelpers = {
  extractNumericPrice(priceString: string): number | null {
    return normalizePrice(priceString);
  },
  normalizeCtaText(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
  },
  hasApp(facts: ShopifyFacts, appName: string): boolean {
    return facts.technical.detectedApps.some((app) =>
      app.toLowerCase().includes(appName.toLowerCase())
    );
  },
};
