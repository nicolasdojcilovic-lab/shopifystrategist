/**
 * ⚠️ PDP DETECTOR — Product (Title, Price, Stock, ATC, Variants, JSON-LD)
 *
 * Extracts product page facts.
 * Preserves Allbirds/Gymshark fixes (multi-JSON-LD, headless selectors).
 */

import type * as cheerio from 'cheerio';
import type { JsonLdProduct, PDPFacts, PDPDetectorMeta } from '../types';

export type CheerioAPI = cheerio.CheerioAPI;

/**
 * Extracts ALL Product objects from ALL JSON-LD scripts.
 * Allbirds fix: parse ALL scripts (Allbirds often has multiple).
 */
export function extractAllJsonLdProducts(html: string): JsonLdProduct[] {
  const products: JsonLdProduct[] = [];

  try {
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
    if (!jsonLdMatches) return products;

    for (const match of jsonLdMatches) {
      const jsonContent = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim();
      try {
        const data = JSON.parse(jsonContent);
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          if (item['@type'] === 'Product' || item['@type'] === 'http://schema.org/Product' || item['@type'] === 'https://schema.org/Product') {
            const aggregateRating = item.aggregateRating || item.review?.[0]?.reviewRating;
            const ratingValue = aggregateRating?.ratingValue || item.ratingValue;
            const reviewCount = aggregateRating?.reviewCount || item.reviewCount || (Array.isArray(item.review) ? item.review.length : undefined);

            let description = item.description;
            if (description && typeof description === 'string') {
              description = description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            }

            const product: JsonLdProduct = {
              name: item.name,
              price: item.offers?.price || item.price,
              priceCurrency: item.offers?.priceCurrency || item.priceCurrency,
              availability: item.offers?.availability || item.availability,
              description,
              offers: item.offers,
            };
            if (typeof ratingValue === 'number') product.ratingValue = ratingValue;
            if (typeof reviewCount === 'number') product.reviewCount = reviewCount;
            products.push(product);
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // ignore
  }

  return products;
}

export interface PDPDetectorOptions {
  strictMode?: boolean;
  locale?: string;
}

/**
 * PDP Detector — extracts product facts
 */
export class PDPDetector {
  extract(
    $: CheerioAPI,
    _html: string,
    allJsonLdProducts: JsonLdProduct[],
    _options: PDPDetectorOptions = {}
  ): PDPFacts & { _meta?: PDPDetectorMeta } {
    const jsonLdData = allJsonLdProducts.length > 0 && allJsonLdProducts[0] ? allJsonLdProducts[0] : null;
    let descriptionSource: string | undefined;

    // ========== TITRE ==========
    let title: string | null = null;
    if (jsonLdData?.name) {
      title = String(jsonLdData.name).replace(/\s+/g, ' ').trim();
    }
    if (!title) {
      const titleSelectors = [
        '.product__title',
        '.product-title',
        '.product-single__title',
        'main h1',
        'article h1',
        '[itemtype*="Product"] h1',
        '[data-testid*="product-title"]',
      ];
      for (const selector of titleSelectors) {
        const el = $(selector).first();
        if (el.length > 0) {
          title = el.text().replace(/\s+/g, ' ').trim();
          if (title) break;
        }
      }
    }
    if (!title) {
      const h1Text = $('h1').first().text();
      title = h1Text ? h1Text.replace(/\s+/g, ' ').trim() : null;
    }

    // ========== PRIX ==========
    const extractPriceToken = (raw: string): { token: string; currency: string | null } | null => {
      if (!raw) return null;
      let normalized = raw
        .replace(/\r?\n/g, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      normalized = normalized.replace(/\.{3,}/g, '');
      normalized = normalized.replace(/^(Home|View|See|More|Less|Read|Show|Hide)\s*/i, '');
      const match = normalized.match(/([€$£¥]\s?[\d.,]+)|([\d.,]+\s?[€$£¥])/);
      if (!match || !match[0]) return null;
      const token = match[0].replace(/\s+/g, '');
      const currencyMatch = token.match(/[€$£¥]/);
      return { token, currency: currencyMatch ? currencyMatch[0] : null };
    };

    let price: string | null = null;
    let currency: string | null = null;
    let hasSalePrice = false;
    let regularPrice: string | null = null;
    let salePrice: string | null = null;

    // PRIORITY 1: Multi-JSON-LD
    if (!price) {
      for (const product of allJsonLdProducts) {
        if (product.price) {
          const jsonPrice = String(product.price);
          const jsonCurrency = product.priceCurrency || null;
          const priceNumber = typeof product.price === 'number'
            ? product.price
            : parseFloat(jsonPrice.replace(/[^\d.,]/g, '').replace(',', '.'));
          if (!isNaN(priceNumber) && priceNumber > 0) {
            const currencyMap: Record<string, string> = {
              EUR: '€', USD: '$', GBP: '£', JPY: '¥', CAD: 'C$', AUD: 'A$',
            };
            const currencySymbol = jsonCurrency && currencyMap[jsonCurrency] ? currencyMap[jsonCurrency] : jsonCurrency || '';
            const useComma = jsonCurrency === 'EUR' || jsonCurrency === null;
            const formattedPrice = useComma ? priceNumber.toFixed(2).replace('.', ',') : priceNumber.toFixed(2);
            price = `${currencySymbol}${formattedPrice}`;
            currency = currencySymbol || jsonCurrency || null;
            break;
          }
        }
      }
    }

    // PRIORITY 2: CSS selectors + Headless
    if (!price) {
      const priceSelectors = [
        '[data-price]', '[data-testid="product-price"]', '.price-item',
        '.product__price', '.product-price', '.price__current', '[data-product-price]',
        '[itemtype*="Product"] [itemprop="price"]',
      ];
      for (const selector of priceSelectors) {
        const priceEl = $(selector).first();
        if (priceEl.length > 0) {
          const token = extractPriceToken(priceEl.text());
          if (token) { price = token.token; currency = token.currency; break; }
        }
      }
    }

    // PRIORITY 3: Meta tags
    if (!price) {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
        $('meta[property="og:price:amount"]').attr('content') ||
        $('meta[name="twitter:data1"]').attr('content');
      const metaCurrency = $('meta[property="product:price:currency"]').attr('content') ||
        $('meta[property="og:price:currency"]').attr('content');
      if (metaPrice) {
        const priceMatch = metaPrice.match(/([\d.,]+)/);
        if (priceMatch && priceMatch[1]) {
          const priceNumber = parseFloat(priceMatch[1].replace(',', '.'));
          if (!isNaN(priceNumber) && priceNumber > 0) {
            const currencySymbol = metaCurrency === 'EUR' ? '€' : metaCurrency === 'USD' ? '$' : metaCurrency === 'GBP' ? '£' : metaCurrency || '';
            const useComma = metaCurrency === 'EUR' || metaCurrency === null;
            const formattedPrice = useComma ? priceNumber.toFixed(2).replace('.', ',') : priceNumber.toFixed(2);
            price = `${currencySymbol}${formattedPrice}`;
            currency = currencySymbol || metaCurrency || null;
          }
        }
      }
    }

    // PRIORITY 4: Regex main scan
    if (!price) {
      const mainContainer = $('main').length > 0 ? $('main') : $('.product-info').length > 0 ? $('.product-info') : $('body');
      const excludedSelectors = 'nav, header, footer, [class*="nav"], [class*="header"], [class*="footer"], [class*="breadcrumb"], [id*="nav"], [id*="header"], [id*="footer"]';
      const mainText = mainContainer.not(excludedSelectors).text();
      const pricePatterns = [
        /([€$£¥])\s*([\d.,]+)/,
        /([\d.,]+)\s*([€$£¥])/,
        /\$\s*([\d.,]+)/,
        /([\d.,]+)\s*€/,
      ];
      if (mainText) {
        for (const pattern of pricePatterns) {
          const match = mainText.match(pattern);
          if (match && match[0]) {
            const token = extractPriceToken(match[0].replace(/\s+/g, ''));
            if (token) { price = token.token; currency = token.currency; break; }
          }
        }
      }
    }

    // Sale price
    const salePriceSelectors = ['.price--on-sale', '.price__sale', '.product__price--sale', '.price-item--sale'];
    for (const selector of salePriceSelectors) {
      const el = $(selector).first();
      if (el.length > 0) {
        const token = extractPriceToken(el.text());
        if (token) { hasSalePrice = true; salePrice = token.token; if (!currency && token.currency) currency = token.currency; break; }
      }
    }

    if (hasSalePrice) {
      const regularSelectors = ['.price--regular', '.price__regular', '.product__price--regular', '.price-item--regular', 's', 'del'];
      for (const selector of regularSelectors) {
        const regEl = $(selector).first();
        if (regEl.length > 0) {
          const token = extractPriceToken(regEl.text());
          if (token) { regularPrice = token.token; if (!currency && token.currency) currency = token.currency; break; }
        }
      }
    }

    // ========== ADD TO CART ==========
    let hasAtcButton = false;
    let atcText: string | null = null;
    let atcButtonCount = 0;
    const atcSelectors = [
      '[data-testid*="add-to-cart"]', '[data-testid*="addToCart"]',
      'button[aria-label*="Ajouter"]', 'button[aria-label*="Add"]', 'button[aria-label*="add"]',
      '[data-action="add-to-cart"]', 'button[name="add"]', 'button[type="submit"][name="add"]',
      '.shopify-payment-button button', 'form[action*="/cart/add"] button[type="submit"]',
      '[data-add-to-cart]', '.product-form__submit', '.btn--add-to-cart',
      'button:not([disabled])[class*="sticky"]', 'button:not([disabled])[class*="add"]',
    ];
    for (const selector of atcSelectors) {
      const buttons = $(selector);
      if (buttons.length > 0) {
        const filteredButtons = buttons.filter((_, el) => {
          const buttonText = $(el).text().toLowerCase();
          const buttonAriaLabel = $(el).attr('aria-label')?.toLowerCase() || '';
          return /add|cart|bag|panier/i.test(`${buttonText} ${buttonAriaLabel}`);
        });
        if (filteredButtons.length > 0 || buttons.length > 0) {
          const targetButtons = filteredButtons.length > 0 ? filteredButtons : buttons;
          hasAtcButton = true;
          atcButtonCount = targetButtons.length;
          const rawAtcText = targetButtons.first().text();
          atcText = rawAtcText ? rawAtcText.replace(/\s+/g, ' ').trim() : null;
          break;
        }
      }
    }
    if (!hasAtcButton) {
      const atcTextPatterns = [/ajouter au panier/i, /add to cart/i, /add to bag/i, /buy now/i, /acheter/i];
      $('button:not([disabled]), a, [role="button"]').each((_, el) => {
        const rawText = $(el).text();
        const text = rawText ? rawText.replace(/\s+/g, ' ').trim() : '';
        for (const pattern of atcTextPatterns) {
          if (pattern.test(text)) {
            hasAtcButton = true;
            atcButtonCount += 1;
            if (!atcText) atcText = text;
            return false;
          }
        }
      });
    }

    // ========== STICKY ATC (mobile viewport proxy — Scoring Engine v1.1) ==========
    let stickyAtcPresenceMobile: boolean | undefined;
    const stickyAtcPatterns = [
      /sticky|fixed|bottom-0|top-0/,
      /product-form__sticky|sticky-atc|sticky-atc-bar|add-to-cart-sticky/,
    ];
    const atcTextPatternsSticky = [/add to cart|ajouter au panier|add to bag|buy now/i];
    $('[class*="sticky"], [class*="fixed"], [style*="position: fixed"], [style*="position:fixed"]').each((_, el) => {
      const $el = $(el);
      const text = $el.text().replace(/\s+/g, ' ').trim();
      const hasAtcText = atcTextPatternsSticky.some((p) => p.test(text));
      const looksLikeStickyBar = stickyAtcPatterns.some((p) => p.test($el.attr('class') || '') || p.test($el.attr('style') || ''));
      if (hasAtcText && (looksLikeStickyBar || text.length < 200)) {
        stickyAtcPresenceMobile = true;
        return false;
      }
    });
    if (stickyAtcPresenceMobile !== true && hasAtcButton) {
      stickyAtcPresenceMobile = false;
    }

    // ========== VARIANTS (Gymshark headless) ==========
    let hasVariantSelector = false;
    const variantTypes: string[] = [];
    const variantSelectors = [
      '[data-testid*="size"]', '[data-testid*="Size"]', 'button[aria-label*="Size"]', 'button[aria-label*="size"]',
      '[data-testid*="variant"]', '[data-testid*="option"]',
      '.product-form__input', 'select[name*="option"]', '.variant-input', '[data-variant-input]',
    ];
    for (const selector of variantSelectors) {
      const variants = $(selector);
      if (variants.length > 0) {
        hasVariantSelector = true;
        variants.each((_, el) => {
          let label = $(el).prev('label').text().trim();
          if (!label) label = $(el).closest('label').contents().first().text().trim();
          if (!label) label = $(el).siblings('.variant-label, .product-form__label').text().trim();
          if (!label) label = $(el).attr('aria-label') || '';
          if (!label) {
            const name = $(el).attr('name');
            if (name) {
              const forLabel = $(`label[for="${name}"]`).text().trim();
              if (forLabel) label = forLabel;
            }
          }
          if (!label) {
            const parentText = $(el).parent().contents().filter(function () { return this.type === 'text'; }).text().trim();
            if (parentText && parentText.length < 50) label = parentText;
          }
          if (label && !variantTypes.includes(label)) variantTypes.push(label);
        });
        break;
      }
    }

    // ========== VARIANT COMPLEXITY (estimated clicks — Scoring Engine v1.1) ==========
    let variantSelectionComplexityClicks: number | undefined;
    if (hasVariantSelector && variantTypes.length > 0) {
      variantSelectionComplexityClicks = Math.min(10, 1 + variantTypes.length * 2);
    }

    // ========== AVAILABILITY ==========
    let inStock: boolean | null = null;
    let stockText: string | null = null;
    if (jsonLdData?.offers) {
      const offers = jsonLdData.offers;
      if (Array.isArray(offers)) {
        const hasInStock = offers.some((o) => {
          const a = String(o.availability || '').toLowerCase();
          return a.includes('instock') || a.includes('in stock') || a.includes('http://schema.org/instock');
        });
        if (hasInStock) inStock = true;
        else {
          const hasOut = offers.some((o) => {
            const a = String(o.availability || '').toLowerCase();
            return a.includes('outofstock') || a.includes('out of stock') || a.includes('http://schema.org/outofstock');
          });
          if (hasOut) inStock = false;
        }
      } else if (typeof offers === 'object' && offers.availability) {
        const a = String(offers.availability).toLowerCase();
        if (a.includes('instock') || a.includes('in stock') || a.includes('http://schema.org/instock')) inStock = true;
        else if (a.includes('outofstock') || a.includes('out of stock') || a.includes('http://schema.org/outofstock')) inStock = false;
      }
    }
    if (inStock === null && jsonLdData?.availability) {
      const a = String(jsonLdData.availability).toLowerCase();
      if (a.includes('instock') || a.includes('in stock') || a.includes('http://schema.org/instock')) inStock = true;
      else if (a.includes('outofstock') || a.includes('out of stock') || a.includes('http://schema.org/outofstock')) inStock = false;
    }
    if (inStock === null && hasAtcButton && atcText) {
      const atcLower = atcText.toLowerCase();
      if (/add to cart|ajouter au panier|add to bag|buy now/i.test(atcLower)) inStock = true;
    }
    if (inStock === null) {
      const productContainer = $('main').length > 0 ? $('main') : $('.product-info').length > 0 ? $('.product-info') : $('body');
      const excluded = 'nav, header, footer, [class*="nav"], [class*="header"], [class*="footer"], [class*="breadcrumb"], [id*="nav"], [id*="header"], [id*="footer"]';
      productContainer.find('*').not(excluded).each((_, el) => {
        const rawText = $(el).text();
        const text = rawText ? rawText.replace(/\s+/g, ' ').trim() : '';
        if (/sold out|out of stock|épuisé|indisponible/i.test(text)) {
          inStock = false;
          stockText = text.length > 300 ? 'Cleaned Data (truncated)' : (text.trim().startsWith('{') || text.trim().startsWith('[')) ? 'Cleaned Data (JSON detected)' : text.replace(/\s+/g, ' ').trim();
          return false;
        }
      });
    }
    if (inStock === null && hasAtcButton) inStock = true;

    const productContainer2 = $('main').length > 0 ? $('main') : $('.product-info').length > 0 ? $('.product-info') : $('body');
    const excluded2 = 'nav, header, footer, [class*="nav"], [class*="header"], [class*="footer"], [class*="breadcrumb"], [id*="nav"], [id*="header"], [id*="footer"]';
    productContainer2.find('*').not(excluded2).each((_, el) => {
      const rawText = $(el).text();
      const text = rawText ? rawText.replace(/\s+/g, ' ').trim() : '';
      if (/only \d+ left|\d+ en stock|low stock|hurry/i.test(text)) {
        stockText = text.length > 300 ? 'Cleaned Data (too long)' : (text.trim().startsWith('{') || text.trim().startsWith('[')) ? 'Cleaned Data (JSON detected)' : text;
        return false;
      }
    });

    // ========== DESCRIPTION (Allbirds fix: #details-section, .product-details__description) ==========
    let hasDescription = false;
    let descriptionLength = 0;
    const metaDescription = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
    if (metaDescription) {
      const descText = metaDescription.replace(/\s+/g, ' ').trim();
      if (descText.length > 50) { hasDescription = true; descriptionLength = descText.length; descriptionSource = 'Meta-Tag'; }
    }
    if (!hasDescription) {
      const pc = $('main').length > 0 ? $('main') : $('.product-info').length > 0 ? $('.product-info') : $('body');
      const exc = 'nav, header, footer, [class*="nav"], [class*="header"], [class*="footer"], [class*="breadcrumb"], [id*="nav"], [id*="header"], [id*="footer"]';
      const descSelectors = [
        '#details-section', '.product-details__description',
        '[data-testid="product-description"]', '[data-testid*="description"]',
        '[class*="accordion"][class*="description"]', '[class*="description"][class*="accordion"]',
        '.product__description', '.product-description', '.product-single__description',
        '[class*="product"][class*="description"]', '[itemtype*="Product"] [itemprop="description"]',
      ];
      for (const selector of descSelectors) {
        const desc = pc.find(selector).not(exc).first();
        if (desc.length > 0) {
          const text = desc.text().replace(/\s+/g, ' ').trim();
          if (text.length > 50) {
            hasDescription = true;
            descriptionLength = text.length;
            descriptionSource = (selector.includes('#details-section') || selector.includes('.product-details__description')) ? 'Allbirds-Specific' : 'CSS-Selector';
            break;
          }
        }
      }
    }
    if (!hasDescription) {
      for (const product of allJsonLdProducts) {
        if (product.description) {
          const descText = String(product.description).replace(/\s+/g, ' ').trim();
          if (descText.length > 0) { hasDescription = true; descriptionLength = descText.length; descriptionSource = 'JSON-LD'; break; }
        }
      }
    }

    const result: PDPFacts & { _meta?: PDPDetectorMeta } = {
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
      ...(stickyAtcPresenceMobile !== undefined && { stickyAtcPresenceMobile }),
      ...(variantSelectionComplexityClicks !== undefined && { variantSelectionComplexityClicks }),
    };
    if (descriptionSource) result._meta = { descriptionSource };
    return result;
  }
}
