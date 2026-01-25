/**
 * ⚠️ COLLECTEUR DE FAITS DÉTERMINISTE (SSOT)
 * 
 * Ce module extrait des faits structurés depuis le HTML capturé.
 * 
 * Principe SSOT (Anti-Drift):
 * - **Facts-Only**: Aucune décision, aucun score, aucune recommandation
 * - **Pure Function**: Mêmes entrées → mêmes sorties (déterminisme)
 * - **DOM-First**: Priorité aux faits DOM (pas d'inférence visuelle)
 * - **No Scoring**: Le mapping facts → tickets vit dans scoring engine
 * 
 * Référence:
 * - docs/DETECTORS_SPEC.md (v1.3)
 * - docs/SCORING_AND_DETECTION.md (v2.2)
 * 
 * @version FACTS_COLLECTOR_VERSION = 1.0
 */

import * as cheerio from 'cheerio';
import { SHOPIFY_APPS } from '@/ssot/shopify-apps';

/**
 * Faits PDP (Product Detail Page)
 * 
 * Extraction des informations clés de la page produit Shopify.
 */
export interface PDPFacts {
  // Titre produit
  title: string | null;

  // Prix
  price: string | null;
  currency: string | null;
  hasSalePrice: boolean; // Prix barré détecté
  regularPrice: string | null; // Prix avant réduction
  salePrice: string | null; // Prix réduit

  // Call-to-Action (ATC = Add To Cart)
  hasAtcButton: boolean;
  atcText: string | null;
  atcButtonCount: number; // Nombre de boutons ATC détectés

  // Variants
  hasVariantSelector: boolean;
  variantTypes: string[]; // Ex: ["Size", "Color"]

  // Availability
  inStock: boolean | null; // null si indéterminé
  stockText: string | null; // Ex: "Only 3 left!"

  // Description
  hasDescription: boolean;
  descriptionLength: number; // chars
}

/**
 * Faits Structure (DOM Analysis)
 * 
 * Analyse structurelle de la page (headings, images, sections).
 */
export interface StructureFacts {
  // Headings
  h1Count: number;
  mainH1Text: string | null; // Premier H1 trouvé
  h2Count: number;
  h3Count: number;

  // Images
  imageCount: number;
  imagesWithoutAlt: number;
  imagesWithLazyLoad: number; // loading="lazy" ou data-src

  // Sections importantes
  hasReviewsSection: boolean;
  hasShippingInfo: boolean;
  hasReturnPolicy: boolean;
  hasSocialProof: boolean; // Ex: "X people bought this"

  // Formulaires
  formCount: number;
  hasNewsletterForm: boolean;
}

/**
 * Faits Techniques (Shopify & Apps)
 * 
 * Détection technique: thème, version, apps installées.
 */
export interface TechnicalFacts {
  // Shopify
  isShopify: boolean;
  shopifyVersion: string | null; // Ex: "2.0"
  themeName: string | null; // Ex: "Dawn", "Debut"

  // Apps détectées (via scripts/meta/classes)
  detectedApps: string[];

  // Performance hints (présence de scripts lourds)
  hasGoogleAnalytics: boolean;
  hasFacebookPixel: boolean;
  scriptCount?: number; // Optional
  externalScriptCount?: number; // Optional
  hasKlaviyo: boolean;

  // Accessibilité
  hasSkipLink: boolean;
  hasAriaLabels: boolean;
  langAttribute: string | null;
}

/**
 * Tous les faits collectés
 */
export interface ShopifyFacts {
  pdp: PDPFacts;
  structure: StructureFacts;
  technical: TechnicalFacts;
  meta: {
    parsingDuration: number; // ms
  };
}

/**
 * Collecte tous les faits depuis le HTML
 * 
 * Fonction PURE (déterministe):
 * - Pas d'effets de bord
 * - Pas de randomisation
 * - Pas de dépendances externes
 * 
 * @param html - HTML de la page capturée
 * @param options - Options de collection
 * @returns Faits structurés
 * 
 * @example
 * const facts = collectFacts(html);
 * console.log('Product:', facts.pdp.title);
 * console.log('Apps:', facts.technical.detectedApps);
 */
export function collectFacts(
  html: string,
  _options: {
    strictMode?: boolean; // Éviter heuristiques fragiles
    locale?: string; // Hint pour textes localisés
  } = {}
): ShopifyFacts {
  const startTime = Date.now();
  const { strictMode = true, locale = 'en' } = _options;

  const $ = cheerio.load(html);

  // Collecter les faits par catégorie
  const pdp = collectPDPFacts($, { strictMode, locale });
  const structure = collectStructureFacts($);
  const technical = collectTechnicalFacts($, html);

  const parsingDuration = Date.now() - startTime;

  return {
    pdp,
    structure,
    technical,
    meta: {
      parsingDuration,
    },
  };
}

/**
 * Collecte des faits PDP
 */
function collectPDPFacts(
  $: cheerio.CheerioAPI,
  _options: { strictMode: boolean; locale: string }
): PDPFacts {
  // ============================================================================
  // TITRE PRODUIT
  // ============================================================================
  // Heuristiques Shopify (ordre de priorité):
  // 1. .product__title, .product-title
  // 2. h1 dans main ou article
  // 3. Premier h1 de la page
  let title: string | null = null;

  const titleSelectors = [
    '.product__title',
    '.product-title',
    '.product-single__title',
    'main h1',
    'article h1',
    '[itemtype*="Product"] h1',
  ];

  for (const selector of titleSelectors) {
    const el = $(selector).first();
    if (el.length > 0) {
      title = el.text().trim();
      if (title) break;
    }
  }

  if (!title) {
    // Fallback: premier h1
    title = $('h1').first().text().trim() || null;
  }

  // ============================================================================
  // PRIX
  // ============================================================================
  let price: string | null = null;
  let currency: string | null = null;
  let hasSalePrice = false;
  let regularPrice: string | null = null;
  let salePrice: string | null = null;

  // Sélecteurs de prix Shopify (AMÉLIORATION P0: Allbirds + generic)
  const priceSelectors = [
    '[data-price]', // P0: Data attribute (priorité haute)
    '.price-item', // P0: Generic price item
    '.product__price', // Shopify standard
    '.product-price',
    '.price__current', // Spécifique Allbirds
    '[data-product-price]',
    '[itemtype*="Product"] [itemprop="price"]',
    // ⚠️ Éviter '.price' seul (trop large, capture navigation)
  ];

  for (const selector of priceSelectors) {
    const priceEl = $(selector).first();
    if (priceEl.length > 0) {
      // Nettoyer le texte: trim + collapse whitespace
      let rawPrice = priceEl.text().replace(/\s+/g, ' ').trim();
      
      // Vérifier que c'est bien un prix (contient un chiffre + devise)
      // Regex: Au moins 1 chiffre + devise (€$£¥) avec whitespace optionnel
      if (rawPrice && /[\d.,]+\s*[€$£¥]/.test(rawPrice)) {
        price = rawPrice;
        
        // Extraire la devise (€, $, £, etc.)
        const currencyMatch = price.match(/[€$£¥]/);
        if (currencyMatch) {
          currency = currencyMatch[0];
        }
        break;
      }
    }
  }

  // Détecter prix barré (sale)
  const salePriceSelectors = [
    '.price--on-sale',
    '.price__sale',
    '.product__price--sale',
    '.price-item--sale',
  ];

  for (const selector of salePriceSelectors) {
    if ($(selector).length > 0) {
      hasSalePrice = true;
      salePrice = $(selector).first().text().trim() || null;
      break;
    }
  }

  // Prix régulier (si sale détecté)
  if (hasSalePrice) {
    const regularPriceSelectors = [
      '.price--regular',
      '.price__regular',
      '.product__price--regular',
      '.price-item--regular',
      's',
      'del',
    ];

    for (const selector of regularPriceSelectors) {
      const regPriceEl = $(selector).first();
      if (regPriceEl.length > 0) {
        regularPrice = regPriceEl.text().trim() || null;
        break;
      }
    }
  }

  // ============================================================================
  // ADD TO CART BUTTON
  // ============================================================================
  let hasAtcButton = false;
  let atcText: string | null = null;
  let atcButtonCount = 0;

  const atcSelectors = [
    'button[name="add"]',
    'button[type="submit"][name="add"]',
    '.shopify-payment-button button',
    'form[action*="/cart/add"] button[type="submit"]',
    '[data-add-to-cart]',
    '.product-form__submit',
    '.btn--add-to-cart',
  ];

  for (const selector of atcSelectors) {
    const buttons = $(selector);
    if (buttons.length > 0) {
      hasAtcButton = true;
      atcButtonCount = buttons.length;
      atcText = buttons.first().text().trim() || null;
      break;
    }
  }

  // ============================================================================
  // VARIANTS
  // ============================================================================
  let hasVariantSelector = false;
  const variantTypes: string[] = [];

  // Sélecteurs de variants Shopify
  const variantSelectors = [
    '.product-form__input',
    'select[name*="option"]',
    '.variant-input',
    '[data-variant-input]',
  ];

  for (const selector of variantSelectors) {
    const variants = $(selector);
    if (variants.length > 0) {
      hasVariantSelector = true;

      // Extraire les types (Size, Color, etc.)
      variants.each((_, el) => {
        // Stratégie 1: Label adjacent (prev sibling)
        let label = $(el).prev('label').text().trim();

        // Stratégie 2: Label parent (wrapping label)
        if (!label) {
          label = $(el).closest('label').contents().first().text().trim();
        }

        // Stratégie 3: Span voisin avec classe variant-label
        if (!label) {
          label = $(el).siblings('.variant-label, .product-form__label').text().trim();
        }

        // Stratégie 4: Attribut aria-label
        if (!label) {
          label = $(el).attr('aria-label') || '';
        }

        // Stratégie 5: Extraire depuis le name attribute (ex: name="option1" → chercher label associé)
        if (!label) {
          const name = $(el).attr('name');
          if (name) {
            // Chercher un label avec for="name"
            const forLabel = $(`label[for="${name}"]`).text().trim();
            if (forLabel) {
              label = forLabel;
            }
          }
        }

        // Stratégie 6 (Fallback): Chercher texte dans le parent direct
        if (!label) {
          const parentText = $(el).parent().contents().filter(function() {
            return this.type === 'text';
          }).text().trim();
          
          if (parentText && parentText.length < 50) {
            // Seulement si raisonnablement court
            label = parentText;
          }
        }

        if (label && !variantTypes.includes(label)) {
          variantTypes.push(label);
        }
      });

      break;
    }
  }

  // ============================================================================
  // AVAILABILITY
  // ============================================================================
  let inStock: boolean | null = null;
  let stockText: string | null = null;

  // Chercher "Sold Out" / "Out of Stock"
  const outOfStockPatterns = [
    /sold out/i,
    /out of stock/i,
    /épuisé/i,
    /indisponible/i,
  ];

  $('body').find('*').each((_, el) => {
    const text = $(el).text();
    for (const pattern of outOfStockPatterns) {
      if (pattern.test(text)) {
        inStock = false;
        stockText = text.trim();
        return false; // break
      }
    }
  });

  // Si pas "Sold Out" et qu'il y a un bouton ATC → probablement en stock
  if (inStock === null && hasAtcButton) {
    inStock = true;
  }

  // Chercher messages de stock limité
  const lowStockPatterns = [
    /only \d+ left/i,
    /\d+ en stock/i,
    /low stock/i,
    /hurry/i,
  ];

  $('body').find('*').each((_, el) => {
    const text = $(el).text();
    for (const pattern of lowStockPatterns) {
      if (pattern.test(text)) {
        stockText = text.trim();
        return false; // break
      }
    }
  });

  // ============================================================================
  // DESCRIPTION
  // ============================================================================
  let hasDescription = false;
  let descriptionLength = 0;

  const descriptionSelectors = [
    '.product__description',
    '.product-description',
    '.product-single__description',
    '[class*="product"][class*="description"]',
    '[itemtype*="Product"] [itemprop="description"]',
  ];

  for (const selector of descriptionSelectors) {
    const desc = $(selector).first();
    if (desc.length > 0) {
      const text = desc.text().trim();
      if (text.length > 50) {
        // Minimum 50 chars pour être considéré comme description
        hasDescription = true;
        descriptionLength = text.length;
        break;
      }
    }
  }

  return {
    title,
    price,
    currency,
    hasSalePrice,
    regularPrice,
    salePrice,
    hasAtcButton,
    atcText,
    atcButtonCount,
    hasVariantSelector,
    variantTypes,
    inStock,
    stockText,
    hasDescription,
    descriptionLength,
  };
}

/**
 * Collecte des faits Structure
 */
function collectStructureFacts($: cheerio.CheerioAPI): StructureFacts {
  // ============================================================================
  // HEADINGS
  // ============================================================================
  const h1Count = $('h1').length;
  const mainH1Text = $('h1').first().text().trim() || null;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;

  // ============================================================================
  // IMAGES
  // ============================================================================
  const images = $('img');
  const imageCount = images.length;

  let imagesWithoutAlt = 0;
  let imagesWithLazyLoad = 0;

  images.each((_, img) => {
    const alt = $(img).attr('alt');
    if (!alt || alt.trim() === '') {
      imagesWithoutAlt++;
    }

    const loading = $(img).attr('loading');
    const dataSrc = $(img).attr('data-src');
    if (loading === 'lazy' || dataSrc) {
      imagesWithLazyLoad++;
    }
  });

  // ============================================================================
  // SECTIONS IMPORTANTES
  // ============================================================================
  // Reviews
  const hasReviewsSection =
    $('.product-reviews').length > 0 ||
    $('[class*="review"]').length > 5 || // Au moins 5 éléments avec "review"
    $('[id*="review"]').length > 0;

  // Shipping Info
  const shippingKeywords = [
    /free shipping/i,
    /livraison gratuite/i,
    /shipping/i,
    /delivery/i,
    /livraison/i,
  ];

  let hasShippingInfo = false;
  $('body').find('*').each((_, el) => {
    const text = $(el).text();
    for (const pattern of shippingKeywords) {
      if (pattern.test(text)) {
        hasShippingInfo = true;
        return false;
      }
    }
  });

  // Return Policy
  const returnKeywords = [
    /return policy/i,
    /returns/i,
    /politique de retour/i,
    /retours/i,
    /satisfaction guaranteed/i,
  ];

  let hasReturnPolicy = false;
  $('body').find('*').each((_, el) => {
    const text = $(el).text();
    for (const pattern of returnKeywords) {
      if (pattern.test(text)) {
        hasReturnPolicy = true;
        return false;
      }
    }
  });

  // Social Proof
  const socialProofPatterns = [
    /\d+ people (bought|purchased|viewing)/i,
    /\d+ (customers|buyers)/i,
    /\d+ (personnes|clients)/i,
    /trending/i,
    /bestseller/i,
    /hot item/i,
  ];

  let hasSocialProof = false;
  $('body').find('*').each((_, el) => {
    const text = $(el).text();
    for (const pattern of socialProofPatterns) {
      if (pattern.test(text)) {
        hasSocialProof = true;
        return false;
      }
    }
  });

  // ============================================================================
  // FORMULAIRES
  // ============================================================================
  const formCount = $('form').length;
  const hasNewsletterForm =
    $('form[action*="newsletter"]').length > 0 ||
    $('input[type="email"][placeholder*="email" i]').length > 0;

  return {
    h1Count,
    mainH1Text,
    h2Count,
    h3Count,
    imageCount,
    imagesWithoutAlt,
    imagesWithLazyLoad,
    hasReviewsSection,
    hasShippingInfo,
    hasReturnPolicy,
    hasSocialProof,
    formCount,
    hasNewsletterForm,
  };
}

/**
 * Collecte des faits Techniques
 */
function collectTechnicalFacts(
  $: cheerio.CheerioAPI,
  html: string
): TechnicalFacts {
  // ============================================================================
  // SHOPIFY DETECTION
  // ============================================================================
  const isShopify =
    html.includes('Shopify.') ||
    html.includes('shopify') ||
    $('[data-shopify]').length > 0 ||
    $('script[src*="shopify"]').length > 0;

  let shopifyVersion: string | null = null;
  const versionMatch = html.match(/Shopify\.theme.*version["']\s*:\s*["']([^"']+)/i);
  if (versionMatch && versionMatch[1]) {
    shopifyVersion = versionMatch[1];
  }

  // ============================================================================
  // THEME NAME
  // ============================================================================
  let themeName: string | null = null;

  // Heuristiques pour détecter le thème
  const themePatterns = [
    /theme["']\s*:\s*["']([^"']+)/i,
    /shopify-theme-([a-z0-9-]+)/i,
    /"theme_name"\s*:\s*"([^"]+)"/i,
  ];

  for (const pattern of themePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      themeName = match[1];
      break;
    }
  }

  // Thèmes populaires (détection par classes CSS)
  const popularThemes = [
    { name: 'Dawn', pattern: /dawn/i },
    { name: 'Debut', pattern: /debut/i },
    { name: 'Brooklyn', pattern: /brooklyn/i },
    { name: 'Narrative', pattern: /narrative/i },
    { name: 'Venture', pattern: /venture/i },
    { name: 'Simple', pattern: /simple/i },
  ];

  if (!themeName) {
    for (const theme of popularThemes) {
      if (theme.pattern.test(html)) {
        themeName = theme.name;
        break;
      }
    }
  }

  // ============================================================================
  // APPS DÉTECTÉES (via SSOT shopify-apps.ts)
  // ============================================================================
  const detectedApps: string[] = [];

  for (const app of SHOPIFY_APPS) {
    for (const pattern of app.patterns) {
      if (pattern.test(html)) {
        detectedApps.push(app.name);
        break; // Passer à l'app suivante dès qu'un pattern match
      }
    }
  }

  // ============================================================================
  // ANALYTICS & TRACKING
  // ============================================================================
  const hasGoogleAnalytics =
    html.includes('google-analytics.com') ||
    html.includes('googletagmanager.com') ||
    html.includes('gtag(');

  const hasFacebookPixel =
    html.includes('facebook.net') || html.includes('fbevents.js') || html.includes('fbq(');

  const hasKlaviyo = detectedApps.includes('Klaviyo');

  // ============================================================================
  // ACCESSIBILITÉ
  // ============================================================================
  const hasSkipLink =
    $('a[href="#main"]').length > 0 ||
    $('a[href="#content"]').length > 0 ||
    $('.skip-link').length > 0;

  const hasAriaLabels = $('[aria-label]').length > 5; // Au moins 5 aria-label

  const langAttribute = $('html').attr('lang') || null;

  return {
    isShopify,
    shopifyVersion,
    themeName,
    detectedApps: [...new Set(detectedApps)].sort(), // Unique + tri pour déterminisme
    hasGoogleAnalytics,
    hasFacebookPixel,
    hasKlaviyo,
    hasSkipLink,
    hasAriaLabels,
    langAttribute,
    // Compteurs optionnels (éviter crash si manquants)
    scriptCount: $('script').length || 0,
    externalScriptCount: $('script[src]').length || 0,
  };
}

/**
 * Normalise un prix (gère virgules européennes et points américains)
 * 
 * Cette fonction est exportée car utilisée par les helpers.
 * 
 * Règles:
 * - Virgule seule = séparateur décimal européen (ex: "45,50" → 45.5)
 * - Point seul = séparateur décimal américain (ex: "45.50" → 45.5)
 * - Virgule + Point = virgule = milliers, point = décimal (ex: "1,234.50" → 1234.5)
 * - Point + Virgule = point = milliers, virgule = décimal (ex: "1.234,50" → 1234.5)
 * 
 * @param priceString - String de prix avec symboles
 * @returns Prix numérique ou null
 * 
 * @example
 * normalizePrice('$29.99');    // → 29.99
 * normalizePrice('€45,50');    // → 45.5
 * normalizePrice('1.234,56');  // → 1234.56
 * normalizePrice('1,234.56');  // → 1234.56
 */
export function normalizePrice(priceString: string): number | null {
  if (!priceString) return null;

  // Supprimer symboles monétaires, espaces, et caractères non numériques (sauf . et ,)
  let cleaned = priceString.replace(/[€$£¥\s]/g, '');

  // Détecter le format (virgule vs point)
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    // Les deux présents : détecter lequel est le séparateur décimal
    const lastCommaIndex = cleaned.lastIndexOf(',');
    const lastDotIndex = cleaned.lastIndexOf('.');

    if (lastDotIndex > lastCommaIndex) {
      // Format américain: 1,234.56
      // Supprimer virgules (milliers), garder point (décimal)
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // Format européen: 1.234,56
      // Supprimer points (milliers), remplacer virgule (décimal) par point
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma && !hasDot) {
    // Virgule seule : probablement décimal européen (45,50)
    // MAIS vérifier si c'est un millier (ex: 1,234 en format US)
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1] && parts[1].length === 2) {
      // Probablement décimal (45,50)
      cleaned = cleaned.replace(',', '.');
    } else if (parts.length > 1 && parts[1] && parts[1].length === 3) {
      // Probablement millier américain (1,234)
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // Par défaut, traiter comme décimal
      cleaned = cleaned.replace(',', '.');
    }
  }
  // Si point seul : rien à faire (format US standard)

  // Extraire le premier nombre
  const match = cleaned.match(/(\d+\.?\d*)/);
  if (match && match[1]) {
    const result = parseFloat(match[1]);
    return isNaN(result) ? null : result;
  }

  return null;
}

/**
 * Helpers pour extraire des faits spécifiques
 */
export const FactsHelpers = {
  /**
   * Extrait le prix numérique depuis une string
   * 
   * @deprecated Utilisez normalizePrice() à la place
   */
  extractNumericPrice(priceString: string): number | null {
    return normalizePrice(priceString);
  },

  /**
   * Normalise le texte d'un CTA
   */
  normalizeCtaText(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  },

  /**
   * Vérifie si une app est présente
   */
  hasApp(facts: ShopifyFacts, appName: string): boolean {
    return facts.technical.detectedApps.some((app) =>
      app.toLowerCase().includes(appName.toLowerCase())
    );
  },
};
