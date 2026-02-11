/**
 * ⚠️ TYPES SSOT — Faits Shopify (SSOT)
 *
 * Interfaces centralisées pour les détecteurs et le facts-collector.
 * Référence: docs/DETECTORS_SPEC.md, docs/SCORING_AND_DETECTION.md
 */

/**
 * Objet Product extrait de JSON-LD
 */
export interface JsonLdProduct {
  name?: string;
  price?: string | number;
  priceCurrency?: string;
  availability?: string;
  description?: string;
  ratingValue?: number;
  reviewCount?: number;
  offers?: Array<{ availability?: string }> | { availability?: string };
}

/**
 * Faits PDP (Product Detail Page)
 */
export interface PDPFacts {
  title: string | null;
  price: string | null;
  currency: string | null;
  hasSalePrice: boolean;
  regularPrice: string | null;
  salePrice: string | null;
  hasAtcButton: boolean;
  atcText: string | null;
  atcButtonCount: number;
  hasVariantSelector: boolean;
  variantTypes: string[];
  inStock: boolean | null;
  stockText: string | null;
  hasDescription: boolean;
  descriptionLength: number;
  /** Sticky ATC presence on mobile (scoring: friction). When false, -15. */
  stickyAtcPresenceMobile?: boolean;
  /** Variant selection complexity: estimated clicks to select (e.g. > 3 = high). Proxy: variantTypes.length. */
  variantSelectionComplexityClicks?: number;
}

/**
 * Meta interne pour tracking (descriptionSource)
 */
export interface PDPDetectorMeta {
  descriptionSource?: string;
}

/**
 * Faits Structure (DOM Analysis)
 */
export interface StructureFacts {
  h1Count: number;
  mainH1Text: string | null;
  h2Count: number;
  h3Count: number;
  imageCount: number;
  imagesWithoutAlt: number;
  imagesWithLazyLoad: number;
  hasReviewsSection: boolean;
  hasShippingInfo: boolean;
  hasReturnPolicy: boolean;
  hasSocialProof: boolean;
  formCount: number;
  hasNewsletterForm: boolean;
  /** Trust badges visible near ATC (scoring: trust). When false, -10. */
  trustBadgesNearAtc?: boolean;
}

/**
 * Faits Techniques (Shopify & Apps)
 */
export interface TechnicalFacts {
  isShopify: boolean;
  shopifyVersion: string | null;
  themeName: string | null;
  detectedApps: string[];
  hasGoogleAnalytics: boolean;
  hasFacebookPixel: boolean;
  hasKlaviyo: boolean;
  hasSkipLink: boolean;
  hasAriaLabels: boolean;
  langAttribute: string | null;
  scriptCount?: number;
  externalScriptCount?: number;
  /** LCP in ms (scoring: perf). When > 2500, -20. */
  lcpMs?: number;
  /** Count of blocking scripts (scoring: perf). When > 3, -10. Proxy: externalScriptCount. */
  networkBlockingScriptCount?: number;
}

/**
 * Tous les faits collectés
 */
export interface ShopifyFacts {
  pdp: PDPFacts;
  structure: StructureFacts;
  technical: TechnicalFacts;
  meta: {
    parsingDuration: number;
    descriptionSource?: string;
  };
}
