/**
 * ⚠️ PLAYWRIGHT SERVICE — Capture Adapter (SSOT)
 * 
 * Service de capture de pages web via Playwright.
 * Prépare les métadonnées pour EvidenceV2 selon contrats SSOT.
 * 
 * Référence:
 * - docs/AUDIT_PIPELINE_SPEC.md (capture stage)
 * - src/contracts/export/evidence.v2.ts (ScreenshotMetadata)
 * - docs/DB_SCHEMA.md (SnapshotSource.artefacts)
 * 
 * @version ENGINE_VERSION = 1.0
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import type { EvidenceViewport } from '@/contracts/export/evidence.v2';
import { getErrorCode } from '@/lib/error-utils';

/**
 * Viewports standards Shopify (SSOT)
 * 
 * Référence: docs/SCORING_AND_DETECTION.md section 2.1
 */
export const VIEWPORTS = {
  mobile: {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
} as const;

/**
 * Résultat de capture (succès)
 */
export interface CaptureResult {
  success: true;
  url: string;
  viewport: EvidenceViewport;
  timestamp: string; // ISO 8601
  screenshot: Buffer; // PNG
  html: string;
  metadata: {
    width: number;
    height: number;
    deviceScaleFactor: number;
    loadDurationMs: number;
    fullPageHeight: number;
    /** LCP in ms (Scoring Engine v1.1), from Performance API when available */
    lcpMs?: number;
  };
}

/**
 * Résultat de capture (échec)
 */
export interface CaptureError {
  success: false;
  url: string;
  viewport: EvidenceViewport;
  error: {
    type: 'timeout' | 'not_found' | 'network_error' | 'unknown';
    message: string;
    code?: string;
  };
  timestamp: string; // ISO 8601
}

/**
 * Options de capture
 */
export interface CaptureOptions {
  /** Timeout en ms (default: 30000) */
  timeout?: number;
  
  /** Activer le blocage de ressources (default: true) */
  blockResources?: boolean;
  
  /** User-Agent personnalisé (optionnel) */
  userAgent?: string;
  
  /** Headers HTTP additionnels (optionnel) */
  extraHeaders?: Record<string, string>;
}

/**
 * ⚡ AGGRESSIVE BLOCKLIST — Performance Extrême (<12s objectif)
 * 
 * Domaines et patterns à bloquer pour performance maximale.
 * Version ultra-agressive pour atteindre <12s en double capture.
 */
const BLOCKED_DOMAINS = [
  // Analytics & Tracking (Core)
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'facebook.com/tr',
  'connect.facebook.net',
  'klaviyo.com',
  'hotjar.com',
  'intercom.io',
  'segment.com',
  'mixpanel.com',
  'analytics.tiktok.com',
  'doubleclick.net',
  'pinterest.com/v3',
  // Ads & Marketing
  'googleadservices.com',
  'googlesyndication.com',
  'adroll.com',
  'criteo.com',
  'outbrain.com',
  'taboola.com',
  // Social widgets
  'platform.twitter.com',
  'connect.facebook.net',
  'platform.instagram.com',
  // Chat widgets (⚡ AGGRESSIVE)
  'tawk.to',
  'zendesk.com',
  'drift.com',
  'gorgias.chat',
  'gorgias.com',
  // Reviews & UGC (⚡ AGGRESSIVE)
  'yotpo.com',
  'stamped.io',
  'judge.me',
  'loox.io',
  // Analytics (⚡ AGGRESSIVE)
  'fullstory.com',
  'mouseflow.com',
  'luckyorange.com',
  // Maps
  'maps.googleapis.com',
  'maps.google.com',
  // CDN tracking
  'cdn.jsdelivr.net/npm/analytics',
  'unpkg.com/analytics',
];

const BLOCKED_PATTERNS = [
  'track',
  'pixel',
  'ads',
  'analytics',
  'beacon',
  'telemetry',
  'conversion',
  'gtm.js',
  'ga.js',
  'fbevents.js',
  'klaviyo',
  'yotpo',
  'gorgias',
];

/**
 * ⚡ AGGRESSIVE — Vérifier si une URL/ressource doit être bloquée
 * 
 * Mode ultra-agressif : bloque fonts, media, images, stylesheets pour performance maximale
 * On ne veut que le HTML Structurel pour extraction facts
 */
function shouldBlockResource(url: string, resourceType: string): boolean {
  const urlLower = url.toLowerCase();
  
  // ⚡ AGGRESSIVE: Block ALL media (videos) - non-negotiable
  if (resourceType === 'media') {
    return true;
  }
  
  // ⚡ AGGRESSIVE: Bloquer TOUTES les fonts (gain cumulatif)
  if (resourceType === 'font') {
    return true;
  }
  
  // ⚡ AGGRESSIVE: Block ALL images (except if needed for critical layout)
  // Pour extraction facts, on n'a besoin que du HTML structurel
  if (resourceType === 'image') {
    return true; // Bloquer toutes les images pour performance maximale
  }
  
  // ⚠️ ASSOUPLISSEMENT: Ne PAS bloquer stylesheets (CSS)
  // Some sites (e.g. Gymshark) need them to trigger React component rendering
  // Stylesheets are required for correct rendering of critical elements
  // if (resourceType === 'stylesheet') {
  //   return true; // DÉSACTIVÉ pour Gymshark et sites React
  // }
  
  // ⚡ AGGRESSIVE: Bloquer "other" (souvent du tracking)
  if (resourceType === 'other') {
    return true;
  }
  
  // Bloquer extensions vidéo
  if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.ogg')) {
    return true;
  }
  
  // Bloquer domaines tracking/analytics (google-analytics, facebook-pixel via regex)
  if (BLOCKED_DOMAINS.some(domain => urlLower.includes(domain))) {
    return true;
  }
  
  // Bloquer patterns tracking (google-analytics, facebook-pixel)
  if (BLOCKED_PATTERNS.some(pattern => urlLower.includes(pattern))) {
    return true;
  }
  
  // Bloquer explicitement google-analytics et facebook-pixel via regex
  if (/google-analytics|googletagmanager|facebook\.net|fbevents/i.test(urlLower)) {
    return true;
  }
  
  return false;
}

/**
 * Service de Capture Playwright
 * 
 * Singleton pour gérer le navigateur Playwright.
 * Implémente le pattern adapter pour isoler la logique de capture.
 */
export class PlaywrightService {
  private static instance: PlaywrightService | null = null;
  private browser: Browser | null = null;
  private isInitialized = false;

  /**
   * Private constructor pour forcer l'utilisation du singleton
   */
  private constructor() {}

  /**
   * Obtenir l'instance singleton
   */
  static getInstance(): PlaywrightService {
    if (!PlaywrightService.instance) {
      PlaywrightService.instance = new PlaywrightService();
    }
    return PlaywrightService.instance;
  }

  /**
   * Initialiser le navigateur
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Playwright: ${error}`);
    }
  }

  /**
   * Fermer le navigateur
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
    }
  }

  /**
   * ⚡ ULTRA-AGGRESSIVE — Capturer une page (Performance Extrême)
   * 
   * Optimisations:
   * - domcontentloaded (ultra rapide)
   * - Smart Waiting (attente sélective des éléments critiques)
   * - Fast-Scroll (force lazy-load en 500ms)
   * - Hard Timeout 15s (Mode Dégradé SSOT)
   * 
   * Objectif: <6s par viewport, <12s en double capture
   * 
   * @param url - URL à capturer
   * @param viewport - Viewport (mobile|desktop)
   * @param options - Options de capture
   * @returns Résultat de capture (succès ou erreur)
   */
  async capturePage(
    url: string,
    viewport: Extract<EvidenceViewport, 'mobile' | 'desktop'>,
    options: CaptureOptions = {}
  ): Promise<CaptureResult | CaptureError> {
    // Ensure browser is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.browser) {
      return {
        success: false,
        url,
        viewport,
        error: {
          type: 'unknown',
          message: 'Browser not initialized',
        },
        timestamp: new Date().toISOString(),
      };
    }

    const startTime = Date.now();
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      // ⚡ AGGRESSIVE: Timeout réduit à 15s (Hard Timeout)
      const {
        timeout = 15000, // 15s max (Mode Dégradé si dépassé)
        blockResources = true,
        userAgent,
        extraHeaders,
      } = options;

      // Viewport config
      const viewportConfig = VIEWPORTS[viewport];

      // Create navigation context with optimized headers
      const defaultHeaders = {
        'Accept-Encoding': 'gzip, deflate, br', // Compression to speed up HTML transfer
        ...(extraHeaders || {}),
      };

      context = await this.browser.newContext({
        viewport: {
          width: viewportConfig.width,
          height: viewportConfig.height,
        },
        deviceScaleFactor: viewportConfig.deviceScaleFactor,
        isMobile: viewportConfig.isMobile,
        hasTouch: viewportConfig.hasTouch,
        ...(userAgent ? { userAgent } : {}),
        extraHTTPHeaders: defaultHeaders,
      });

      // Create page
      page = await context.newPage();

      // Set timeout (Hard Timeout)
      page.setDefaultTimeout(timeout);

      // ⚡ AGGRESSIVE RESOURCE BLOCKING
      if (blockResources) {
        await page.route('**/*', async (route) => {
          const request = route.request();
          const resourceType = request.resourceType();
          const requestUrl = request.url();

          if (shouldBlockResource(requestUrl, resourceType)) {
            await route.abort('blockedbyclient');
          } else {
            await route.continue();
          }
        });
      }

      // ⚡ ULTRA-FAST NAVIGATION — domcontentloaded only
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded', // Ultra rapide (~1-2s)
        timeout,
      });

      // Check HTTP status
      if (!response) {
        return {
          success: false,
          url,
          viewport,
          error: {
            type: 'network_error',
            message: 'No response received',
          },
          timestamp: new Date().toISOString(),
        };
      }

      const status = response.status();
      if (status === 404) {
        return {
          success: false,
          url,
          viewport,
          error: {
            type: 'not_found',
            message: `Page not found (HTTP ${status})`,
            code: status.toString(),
          },
          timestamp: new Date().toISOString(),
        };
      }

      if (status >= 400) {
        return {
          success: false,
          url,
          viewport,
          error: {
            type: 'network_error',
            message: `HTTP error ${status}`,
            code: status.toString(),
          },
          timestamp: new Date().toISOString(),
        };
      }

      // ⚡ SMART WAITING — Attendre les éléments critiques Shopify
      // Timeout court (8s) pour ne pas bloquer si élément absent
      try {
        await page.waitForSelector('main, h1, .shopify-section, [data-section-type]', {
          state: 'visible',
          timeout: 8000, // 8s max
        });
      } catch {
        // If timeout, continue anyway (Degraded Mode)
        console.warn(`[WARN] Smart waiting timeout for ${viewport} - continuing anyway`);
      }

      // ⚡ READINESS CHECK — Stratégie "First Match" (Gymshark, etc.)
      // Attendre le titre (h1) OU le bouton ATC - dès que l'un est là, on commence l'extraction
      // Cela garantit que React a commencé à afficher les données critiques
      try {
        await Promise.race([
          page.waitForSelector('h1, [data-testid="product-title"]', {
            state: 'visible',
            timeout: 5000,
          }),
          page.waitForSelector('button[name="add"], [data-testid*="add-to-cart"], button[aria-label*="Add"], button[aria-label*="Ajouter"]', {
            state: 'visible',
            timeout: 5000,
          }),
        ]);
      } catch {
        // If timeout, continue anyway (Degraded Mode)
        // Le site peut être lent ou utiliser un autre pattern
      }

      // ⚡ FAST-SCROLL — Force lazy-load images en 500ms
      // Scroll rapide jusqu'en bas puis retour en haut
      try {
        await page.evaluate(async () => {
          // Scroll vers le bas
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(resolve => setTimeout(resolve, 250));
          
          // Scroll vers le haut
          window.scrollTo(0, 0);
          await new Promise(resolve => setTimeout(resolve, 250));
        });
      } catch {
        // If JS error, continue anyway (Degraded Mode)
        console.warn(`[WARN] Fast-scroll failed for ${viewport} - continuing anyway`);
      }

      // Timestamp de capture (ISO 8601)
      const timestamp = new Date().toISOString();

      // Capturer le screenshot (PNG buffer)
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false, // Above-the-fold uniquement (plus rapide)
      });

      // LCP (Scoring Engine v1.1) — from Performance API before content extraction
      let lcpMs: number | undefined;
      try {
        lcpMs = await page.evaluate(() => {
          const entries = performance.getEntriesByType?.('largest-contentful-paint');
          if (entries?.length) {
            const last = entries[entries.length - 1];
            return last && 'startTime' in last ? Math.round((last as { startTime: number }).startTime) : undefined;
          }
          return undefined;
        });
      } catch {
        // LCP not supported or error — leave undefined
      }

      // Get HTML
      const html = await page.content();

      // Measure full page height
      const fullPageHeight = await page.evaluate(() => {
        return Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );
      });

      // Load duration
      const loadDurationMs = Date.now() - startTime;

      // Fermer la page et le contexte
      await page.close();
      await context.close();

      // Return result (success)
      return {
        success: true,
        url,
        viewport,
        timestamp,
        screenshot,
        html,
        metadata: {
          width: viewportConfig.width,
          height: viewportConfig.height,
          deviceScaleFactor: viewportConfig.deviceScaleFactor,
          loadDurationMs,
          fullPageHeight,
          ...(lcpMs != null && { lcpMs }),
        },
      };
    } catch (error: unknown) {
      // Cleanup
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});

      const err = error instanceof Error ? error : new Error(String(error));
      let errorType: CaptureError['error']['type'] = 'unknown';
      let errorMessage = err.message || 'Unknown error';

      if (err.message?.includes('Timeout') || err.message?.includes('timeout')) {
        errorType = 'timeout';
        errorMessage = `Hard timeout after ${options.timeout || 15000}ms (Mode Dégradé SSOT)`;
      } else if (err.message?.includes('net::')) {
        errorType = 'network_error';
      } else if (err.message?.includes('404')) {
        errorType = 'not_found';
      }

      const code = getErrorCode(err);
      return {
        success: false,
        url,
        viewport,
        error: {
          type: errorType,
          message: errorMessage,
          ...(code ? { code } : {}),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Capturer une page sur les 2 viewports (mobile + desktop)
   * 
   * @param url - URL à capturer
   * @param options - Options de capture
   * @returns Résultats pour mobile et desktop
   * 
   * @example
   * const service = new PlaywrightService();
   * await service.initialize();
   * 
   * const results = await service.captureBothViewports('https://shop.com/product');
   * 
   * if (results.mobile.success) {
   *   console.log('Mobile OK');
   * }
   * if (results.desktop.success) {
   *   console.log('Desktop OK');
   * }
   * 
   * await service.close();
   */
  async captureBothViewports(
    url: string,
    options: CaptureOptions = {}
  ): Promise<{
    mobile: CaptureResult | CaptureError;
    desktop: CaptureResult | CaptureError;
  }> {
    const [mobile, desktop] = await Promise.all([
      this.capturePage(url, 'mobile', options),
      this.capturePage(url, 'desktop', options),
    ]);

    return { mobile, desktop };
  }

  /**
   * Vérifier si le service est prêt
   */
  isReady(): boolean {
    return this.isInitialized && this.browser !== null;
  }
}

/**
 * Singleton instance (optionnel)
 * 
 * Utiliser cette instance globale pour éviter de créer
 * plusieurs navigateurs en parallèle.
 */
let globalService: PlaywrightService | null = null;

export function getPlaywrightService(): PlaywrightService {
  if (!globalService) {
    globalService = PlaywrightService.getInstance();
  }
  return globalService;
}

export async function closeGlobalPlaywrightService(): Promise<void> {
  if (globalService) {
    await globalService.close();
    globalService = null;
  }
}
