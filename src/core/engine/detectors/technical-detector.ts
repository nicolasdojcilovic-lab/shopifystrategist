/**
 * ⚠️ TECHNICAL DETECTOR — Shopify, Theme, Apps, Perf
 *
 * System detection: Shopify, theme version, apps, analytics, accessibility.
 */

import type * as cheerio from 'cheerio';
import { SHOPIFY_APPS } from '@/ssot/shopify-apps';
import type { TechnicalFacts } from '../types';

export type CheerioAPI = cheerio.CheerioAPI;

export interface TechnicalDetectorOptions {
  /** LCP in ms (from browser Performance API); injected by capture layer when available */
  lcpMs?: number;
}

/**
 * Technical Detector — extracts system facts
 */
export class TechnicalDetector {
  extract($: CheerioAPI, html: string, options?: TechnicalDetectorOptions): TechnicalFacts {
    const isShopify =
      html.includes('Shopify.') ||
      html.includes('shopify') ||
      $('[data-shopify]').length > 0 ||
      $('script[src*="shopify"]').length > 0;

    let shopifyVersion: string | null = null;
    const versionMatch = html.match(/Shopify\.theme.*version["']\s*:\s*["']([^"']+)/i);
    if (versionMatch && versionMatch[1]) shopifyVersion = versionMatch[1];

    let themeName: string | null = null;
    const themePatterns = [
      /theme["']\s*:\s*["']([^"']+)/i,
      /shopify-theme-([a-z0-9-]+)/i,
      /"theme_name"\s*:\s*"([^"]+)"/i,
    ];
    for (const pattern of themePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) { themeName = match[1]; break; }
    }

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
        if (theme.pattern.test(html)) { themeName = theme.name; break; }
      }
    }

    const detectedApps: string[] = [];
    for (const app of SHOPIFY_APPS) {
      for (const pattern of app.patterns) {
        if (pattern.test(html)) { detectedApps.push(app.name); break; }
      }
    }

    const hasGoogleAnalytics =
      html.includes('google-analytics.com') ||
      html.includes('googletagmanager.com') ||
      html.includes('gtag(');
    const hasFacebookPixel =
      html.includes('facebook.net') || html.includes('fbevents.js') || html.includes('fbq(');
    const hasKlaviyo = detectedApps.includes('Klaviyo');

    const hasSkipLink =
      $('a[href="#main"]').length > 0 ||
      $('a[href="#content"]').length > 0 ||
      $('.skip-link').length > 0;
    const hasAriaLabels = $('[aria-label]').length > 5;
    const langAttribute = $('html').attr('lang') || null;

    // Blocking scripts in <head>: no defer/async (Scoring Engine v1.1)
    let networkBlockingScriptCount = 0;
    $('head script').each((_, el) => {
      const e = $(el);
      if (!e.attr('defer') && !e.attr('async')) networkBlockingScriptCount++;
    });

    return {
      isShopify,
      shopifyVersion,
      themeName,
      detectedApps: [...new Set(detectedApps)].sort(),
      hasGoogleAnalytics,
      hasFacebookPixel,
      hasKlaviyo,
      hasSkipLink,
      hasAriaLabels,
      langAttribute,
      scriptCount: $('script').length || 0,
      externalScriptCount: $('script[src]').length || 0,
      networkBlockingScriptCount,
      ...(options?.lcpMs != null && { lcpMs: options.lcpMs }),
    };
  }
}
