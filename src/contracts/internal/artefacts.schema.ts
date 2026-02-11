/**
 * ⚠️ ARTEFACTS SCHEMA (SSOT Internal)
 *
 * This Zod schema defines the exact structure of the JSON `artefacts` field
 * in the `snapshot_sources` table (Prisma).
 *
 * Purpose:
 * - Runtime validation before persistence
 * - Type safety for artefacts
 * - Reusable by ScoringEngine and Detectors
 *
 * Reference:
 * - docs/DB_SCHEMA.md (SnapshotSource.artefacts)
 * - src/core/engine/facts-collector.ts (ShopifyFacts)
 *
 * @version ARTEFACTS_SCHEMA_VERSION = 1.0
 */

import { z } from 'zod';

/**
 * Screenshots refs (storage URLs)
 */
const ScreenshotRefsSchema = z.object({
  mobile: z
    .object({
      screenshot: z.string().url().optional(),
      html: z.string().url().optional(),
    })
    .optional(),
  desktop: z
    .object({
      screenshot: z.string().url().optional(),
      html: z.string().url().optional(),
    })
    .optional(),
});

/**
 * HTML refs (storage URLs)
 */
const HtmlRefsSchema = z.object({
  mobile: z.string().url().optional(),
  desktop: z.string().url().optional(),
});

/**
 * PDP Facts (aligned with facts-collector.ts)
 */
const PDPFactsSchema = z.object({
  title: z.string().nullable(),
  price: z.string().nullable(),
  currency: z.string().nullable(),
  hasSalePrice: z.boolean(),
  regularPrice: z.string().nullable(),
  salePrice: z.string().nullable(),
  hasAtcButton: z.boolean(),
  atcText: z.string().nullable(),
  atcButtonCount: z.number().int().min(0),
  hasVariantSelector: z.boolean(),
  variantTypes: z.array(z.string()),
  inStock: z.boolean().nullable(),
  stockText: z.string().nullable(),
  hasDescription: z.boolean(),
  descriptionLength: z.number().int().min(0),
});

/**
 * Structure Facts
 */
const StructureFactsSchema = z.object({
  h1Count: z.number().int().min(0),
  mainH1Text: z.string().nullable(),
  h2Count: z.number().int().min(0),
  h3Count: z.number().int().min(0),
  imageCount: z.number().int().min(0),
  imagesWithoutAlt: z.number().int().min(0),
  imagesWithLazyLoad: z.number().int().min(0),
  hasReviewsSection: z.boolean(),
  hasShippingInfo: z.boolean(),
  hasReturnPolicy: z.boolean(),
  hasSocialProof: z.boolean(),
  formCount: z.number().int().min(0),
});

/**
 * Technical Facts
 */
const TechnicalFactsSchema = z.object({
  isShopify: z.boolean(),
  shopifyVersion: z.string().nullable(),
  themeName: z.string().nullable(),
  detectedApps: z.array(z.string()),
  hasGoogleAnalytics: z.boolean(),
  hasFacebookPixel: z.boolean(),
  scriptCount: z.number().int().min(0).optional(), // Optional to avoid crash if counter missing
  externalScriptCount: z.number().int().min(0).optional(), // Optional to avoid crash
});

/**
 * Meta Facts
 */
const MetaFactsSchema = z.object({
  parsingDuration: z.number().int().min(0).optional(), // Optional
});

/**
 * Shopify Facts (complet)
 */
export const ShopifyFactsSchema = z.object({
  pdp: PDPFactsSchema,
  structure: StructureFactsSchema,
  technical: TechnicalFactsSchema,
  meta: MetaFactsSchema,
});

/**
 * Artefacts Schema (SSOT)
 *
 * Complete structure of the JSON `artefacts` field in DB.
 */
export const ArtefactsSchema = z.object({
  screenshot_refs: ScreenshotRefsSchema,
  html_refs: HtmlRefsSchema,
  
  // Collected facts (optional if collection fails)
  facts: ShopifyFactsSchema.nullable(),
  facts_version: z.string().nullable(),
  facts_collected_at: z.string().datetime().nullable(),
  
  // Additional metadata (optional)
  html_hash: z.string().optional(),
  capture_metadata: z
    .object({
      user_agent: z.string().optional(),
      timeout: z.number().optional(),
      block_resources: z.boolean().optional(),
    })
    .optional(),
});

/**
 * TypeScript type derived from schema
 */
export type Artefacts = z.infer<typeof ArtefactsSchema>;
export type ShopifyFacts = z.infer<typeof ShopifyFactsSchema>;

/**
 * Validation helper
 */
export function validateArtefacts(data: unknown): Artefacts {
  return ArtefactsSchema.parse(data);
}

/**
 * Safe validation helper (does not throw)
 */
export function validateArtefactsSafe(
  data: unknown
): { success: true; data: Artefacts } | { success: false; error: z.ZodError } {
  const result = ArtefactsSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
