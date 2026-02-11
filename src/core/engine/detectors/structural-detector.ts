/**
 * ⚠️ STRUCTURAL DETECTOR — DOM (H1, Images, Sections, Forms)
 *
 * Structural page analysis: headings, images, important sections.
 * Uses JSON-LD for reviews (ratingValue, reviewCount) as priority.
 */

import type * as cheerio from 'cheerio';
import type { JsonLdProduct, StructureFacts } from '../types';

export type CheerioAPI = cheerio.CheerioAPI;

/**
 * Structural Detector — extracts DOM facts
 */
export class StructuralDetector {
  extract($: CheerioAPI, jsonLdData: JsonLdProduct | null): StructureFacts {
    const h1Count = $('h1').length;
    const mainH1Text = $('h1').first().text().trim() || null;
    const h2Count = $('h2').length;
    const h3Count = $('h3').length;

    const images = $('img');
    const imageCount = images.length;
    let imagesWithoutAlt = 0;
    let imagesWithLazyLoad = 0;
    images.each((_, img) => {
      const alt = $(img).attr('alt');
      if (!alt || alt.trim() === '') imagesWithoutAlt++;
      const loading = $(img).attr('loading');
      const dataSrc = $(img).attr('data-src');
      if (loading === 'lazy' || dataSrc) imagesWithLazyLoad++;
    });

    let hasReviewsSection = false;
    if (jsonLdData?.ratingValue || jsonLdData?.reviewCount) {
      hasReviewsSection = true;
    }
    if (!hasReviewsSection) {
      hasReviewsSection =
        $('[id*="yotpo"]').length > 0 ||
        $('[class*="review"]').length > 5 ||
        $('[id*="review"]').length > 0 ||
        $('.star-rating').length > 0 ||
        $('.product-reviews').length > 0 ||
        $('[data-testid*="review"]').length > 0;
    }

    const shippingKeywords = [/free shipping/i, /livraison gratuite/i, /shipping/i, /delivery/i, /livraison/i];
    let hasShippingInfo = false;
    $('body').find('*').each((_, el) => {
      const text = $(el).text();
      for (const pattern of shippingKeywords) {
        if (pattern.test(text)) { hasShippingInfo = true; return false; }
      }
    });

    const returnKeywords = [/return policy/i, /returns/i, /politique de retour/i, /retours/i, /satisfaction guaranteed/i];
    let hasReturnPolicy = false;
    $('body').find('*').each((_, el) => {
      const text = $(el).text();
      for (const pattern of returnKeywords) {
        if (pattern.test(text)) { hasReturnPolicy = true; return false; }
      }
    });

    let hasSocialProof = false;
    if (jsonLdData?.reviewCount && jsonLdData.reviewCount > 0) hasSocialProof = true;
    if (!hasSocialProof) {
      const socialProofPatterns = [
        /\d+ people (bought|purchased|viewing)/i,
        /\d+ (customers|buyers)/i,
        /\d+ (personnes|clients)/i,
        /trending/i,
        /bestseller/i,
        /hot item/i,
      ];
      $('body').find('*').each((_, el) => {
        const text = $(el).text();
        for (const pattern of socialProofPatterns) {
          if (pattern.test(text)) { hasSocialProof = true; return false; }
        }
      });
    }

    const formCount = $('form').length;
    const hasNewsletterForm =
      $('form[action*="newsletter"]').length > 0 ||
      $('input[type="email"][placeholder*="email" i]').length > 0;

    // Trust badges near ATC (Scoring Engine v1.1): payment icons, security, "money back" in same container as ATC
    let trustBadgesNearAtc: boolean | undefined;
    const atcSelectors = [
      'button[name="add"]',
      'button[type="submit"]',
      '[data-testid*="add-to-cart"]',
      '[data-testid*="addToCart"]',
      '[data-action="add-to-cart"]',
      '.product-form__submit',
      'form[action*="/cart/add"] button[type="submit"]',
    ];
    const trustBadgeKeywords = [
      /visa|mastercard|amex|paypal|payment|secure|ssl|money back|satisfaction|guarantee|guarantie|100%|refund|retours/i,
      /lock|shield|secure checkout|paiement sécurisé/i,
    ];
    for (const sel of atcSelectors) {
      const atcEl = $(sel).first();
      if (atcEl.length === 0) continue;
      const container = atcEl.closest('form, .product-form, .product__form, [class*="product-form"], [class*="ProductForm"]').length
        ? atcEl.closest('form, .product-form, .product__form, [class*="product-form"], [class*="ProductForm"]')
        : atcEl.parent().parent();
      const containerText = container.length ? container.text().replace(/\s+/g, ' ') : '';
      const hasTrustInContainer = trustBadgeKeywords.some((p) => p.test(containerText));
      if (hasTrustInContainer) {
        trustBadgesNearAtc = true;
        break;
      }
    }
    if (trustBadgesNearAtc !== true) {
      trustBadgesNearAtc = false;
    }

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
      ...(trustBadgesNearAtc !== undefined && { trustBadgesNearAtc }),
    };
  }
}
