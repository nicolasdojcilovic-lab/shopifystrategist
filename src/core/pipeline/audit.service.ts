/**
 * ⚠️ ORCHESTRATEUR PIPELINE AUDIT (SSOT)
 * 
 * Ce service coordonne l'exécution complète d'un audit SOLO.
 * 
 * Référence:
 * - docs/AUDIT_PIPELINE_SPEC.md (v1.0)
 * - docs/DB_SCHEMA.md (v1.0)
 * - docs/SCORING_AND_DETECTION.md (v2.2)
 * 
 * Architecture du Pipeline:
 * 1. Cache Check (via keys déterministes)
 * 2. Capture (Playwright Service)
 * 3. Storage (Supabase Service)
 * 4. Persistence (Prisma + snapshot_sources)
 * 5. Scoring (TODO: détecteurs + scoring engine)
 * 6. Report Generation (TODO: HTML SSOT)
 * 
 * Gestion d'erreurs (SSOT Mode Dégradé):
 * - Si capture échoue → ScoreRun status="failed" + errors[]
 * - Si storage échoue → Mode dégradé avec storage_path=null
 * - Toujours persister l'état pour traçabilité
 * 
 * @version PIPELINE_VERSION = 1.0
 * @reference docs/AUDIT_PIPELINE_SPEC.md
 */

import { PlaywrightService, type CaptureResult, type CaptureError } from '@/adapters/capture/playwright.service';
import { SupabaseStorageService, type UploadResult, type UploadError } from '@/adapters/storage/supabase.service';
import { prisma } from '@/lib/prisma';
import { collectFacts, type ShopifyFacts } from '@/core/engine/facts-collector';
import { validateArtefactsSafe } from '@/contracts/internal/artefacts.schema';
import { getAiSynthesizer } from '@/core/engine/ai-synthesizer';
import { generateHtmlReport } from '@/core/pipeline/report-generator';
import { getPdfGenerator } from '@/core/pipeline/pdf-generator';
import {
  generateProductKey,
  generateSnapshotKey,
  generateRunKey,
  generateAuditKey,
  normalizeUrl,
  type Mode,
} from '@/core/engine/keys';
import {
  NORMALIZE_VERSION,
  ENGINE_VERSION,
  DETECTORS_VERSION,
  SCORING_VERSION,
} from '@/ssot/versions';
import type {
  EvidenceV2,
} from '@/contracts/export/evidence.v2';
import type { TicketV2 } from '@/contracts/export/ticket.v2';

/** Enum macro SSOT: errors[].stage (API_DOC §4.6) */
const STAGE_MACRO = ['normalize', 'capture', 'detectors', 'scoring', 'report', 'render_pdf', 'storage', 'unknown'] as const;
export type StageMacro = (typeof STAGE_MACRO)[number];

/** 6 raisons SSOT: missing_evidence_reason (API_DOC §1.5, §4.7) */
export const MISSING_EVIDENCE_REASONS = [
  'blocked_by_cookie_consent',
  'blocked_by_popup',
  'infinite_scroll_or_lazyload',
  'navigation_intercepted',
  'timeout',
  'unknown_render_issue',
] as const;

/**
 * Mappe un stage "fin" interne vers l'enum macro SSOT.
 * Référence: docs/API_DOC.md §4.6
 */
export function mapStageToMacro(stageFine: string): StageMacro {
  const s = stageFine.toLowerCase();
  if (['normalize'].includes(s)) return 'normalize';
  if (['capture', 'capture_mobile', 'capture_desktop', 'cache_check'].includes(s)) return 'capture';
  if (['facts_collection', 'detectors'].includes(s)) return 'detectors';
  if (['ai_generation', 'validation'].includes(s)) return 'scoring';
  if (['report_generation'].includes(s)) return 'report';
  if (['render_pdf'].includes(s)) return 'render_pdf';
  if (['storage', 'storage_mobile_screenshot', 'storage_mobile_html', 'storage_desktop_screenshot', 'storage_desktop_html'].includes(s)) return 'storage';
  return 'unknown';
}

/**
 * Déduit missing_evidence_reason quand c'est évident (capture/storage).
 * Sinon null. Référence: docs/API_DOC.md §4.7
 */
export function inferMissingEvidenceReason(
  stage: string,
  code: string,
  message: string
): (typeof MISSING_EVIDENCE_REASONS)[number] | null {
  const stageMacro = mapStageToMacro(stage);
  if (stageMacro !== 'capture' && stageMacro !== 'storage') return null;
  const codeL = (code || '').toLowerCase();
  const msgL = (message || '').toLowerCase();
  if (codeL === 'timeout' || msgL.includes('timeout')) return 'timeout';
  if (msgL.includes('cookie') || msgL.includes('consent')) return 'blocked_by_cookie_consent';
  if (msgL.includes('popup') || msgL.includes('modal')) return 'blocked_by_popup';
  if (msgL.includes('navigation') || msgL.includes('intercepted')) return 'navigation_intercepted';
  if (msgL.includes('lazy') || msgL.includes('infinite') || msgL.includes('scroll')) return 'infinite_scroll_or_lazyload';
  if (msgL.includes('render') || codeL === 'unknown' || codeL === 'network_error' || codeL === 'not_found') return 'unknown_render_issue';
  return null;
}

/**
 * Normalise errors[]: stage → macro, ajoute missing_evidence_reason.
 * À appeler avant persistance (ScoreRun) et avant retour API.
 */
export function normalizeErrors(
  errs: Array<{ stage?: string; code?: string; message?: string; timestamp?: string; missing_evidence_reason?: (typeof MISSING_EVIDENCE_REASONS)[number] | null }>
): Array<{ stage: StageMacro; code: string; message: string; timestamp: string; missing_evidence_reason: (typeof MISSING_EVIDENCE_REASONS)[number] | null }> {
  return errs.map((e) => {
    const stage = e.stage ?? 'unknown';
    const code = e.code ?? '';
    const message = e.message ?? '';
    return {
      stage: mapStageToMacro(stage),
      code,
      message,
      timestamp: e.timestamp ?? new Date().toISOString(),
      missing_evidence_reason: e.missing_evidence_reason ?? inferMissingEvidenceReason(stage, code, message),
    };
  });
}

/**
 * Options d'audit
 */
export interface AuditOptions {
  locale?: string; // Défaut: 'fr'
  copyReady?: boolean; // Défaut: false
  whiteLabel?: {
    logo?: string;
    clientName?: string;
    agencyName?: string;
  } | null;
  captureTimeout?: number; // ms (défaut: 15000)
  blockResources?: boolean; // Défaut: true
}

/**
 * Résultat d'un audit
 */
export interface AuditResult {
  // Clés déterministes générées
  keys: {
    productKey: string;
    snapshotKey: string;
    runKey: string;
    auditKey: string;
  };

  // Status du pipeline
  status: 'ok' | 'degraded' | 'failed';

  // Temps d'exécution (ms)
  duration: number;

  // Cache hit ?
  fromCache: boolean;

  // Exports (Ticket v2 + Evidence v2)
  exports?: {
    tickets: TicketV2[];
    evidences: EvidenceV2[];
  };

  // URLs des rapports générés
  reportUrls?: {
    html?: string;
    pdf?: string;
  };

  // Erreurs rencontrées (stage macro SSOT + missing_evidence_reason)
  errors: Array<{
    stage: string;
    code: string;
    message: string;
    timestamp: string;
    missing_evidence_reason?: typeof MISSING_EVIDENCE_REASONS[number] | null;
  }>;

  // Metadata du rapport (pour HTML)
  reportMeta?: {
    mode: Mode;
    evidence_completeness: 'complete' | 'partial' | 'insufficient';
    alignment_level: null; // SOLO = null
    url: string;
    normalized_url: string;
    locale: string;
    captured_at: string;
  };

  // Artifacts storage refs (pour HTML)
  artifacts?: {
    screenshots: {
      mobile?: {
        above_fold?: string;
        full_page?: string;
      };
      desktop?: {
        above_fold?: string;
        full_page?: string;
      };
    };
    html_refs?: {
      mobile?: string;
      desktop?: string;
    };
  };
}

/**
 * Type guards pour discriminer les résultats
 */
function isCaptureSuccess(
  result: CaptureResult | CaptureError
): result is CaptureResult {
  return result.success === true;
}

function isUploadSuccess(
  result: UploadResult | UploadError
): result is UploadResult {
  return result.success === true;
}

/**
 * Calcule evidence_completeness selon SSOT (EVIDENCE_PACK_SPEC §13)
 * 
 * Set A (complete): above_fold_mobile + above_fold_desktop + full_page_mobile
 * Set B (partial): above_fold_mobile + cta_area_mobile + details_section
 * Insufficient: Aucun set atteint
 * 
 * @param artifacts - Les artifacts disponibles (screenshots)
 * @param facts - Les facts collectés depuis le HTML
 * @returns 'complete' | 'partial' | 'insufficient'
 */
function calculateEvidenceCompleteness(
  artifacts: {
    mobile?: { screenshot?: string; html?: string };
    desktop?: { screenshot?: string; html?: string };
  },
  facts: ShopifyFacts | null
): 'complete' | 'partial' | 'insufficient' {
  // Set A (préféré): above_fold_mobile + above_fold_desktop + full_page_mobile
  // Note: Pour MVP, on considère que les screenshots capturés sont "above_fold"
  // et qu'on a le HTML complet (équivalent "full_page")
  const hasAboveFoldMobile = !!artifacts.mobile?.screenshot;
  const hasAboveFoldDesktop = !!artifacts.desktop?.screenshot;
  const hasFullPageMobile = !!artifacts.mobile?.html;

  // Set A atteint ?
  if (hasAboveFoldMobile && hasAboveFoldDesktop && hasFullPageMobile) {
    return 'complete';
  }

  // Set B (fallback): above_fold_mobile + cta_area_mobile + details_section
  // Pour MVP, on considère qu'on a cta_area et details si on a:
  // - Screenshot mobile (contient le CTA en above fold)
  // - Facts montrant qu'on a extrait des infos clés (ATC button, price, etc.)
  const hasCtaAreaMobile = hasAboveFoldMobile && facts?.pdp.hasAtcButton;
  const hasDetailsSection = hasAboveFoldMobile && facts?.pdp.hasDescription;

  // Set B atteint ?
  if (hasAboveFoldMobile && hasCtaAreaMobile && hasDetailsSection) {
    return 'partial';
  }

  // Aucun set atteint
  return 'insufficient';
}

/**
 * Service d'orchestration du pipeline d'audit
 */
export class AuditService {
  private playwrightService: PlaywrightService;
  private storageService: SupabaseStorageService;

  constructor() {
    this.playwrightService = PlaywrightService.getInstance();
    this.storageService = SupabaseStorageService.getInstance();
  }

  /**
   * Exécute un audit SOLO
   * 
   * @param url - URL de la page à auditer
   * @param options - Options d'audit
   * @returns Résultat de l'audit
   */
  async runSoloAudit(
    url: string,
    options: AuditOptions = {}
  ): Promise<AuditResult> {
    const startTime = Date.now();
    const errors: AuditResult['errors'] = [];

    // Variables pour cleanup
    let playwrightCaptureNeedsCleanup = false;
    let pdfGeneratorNeedsCleanup = false;

    try {
      // ============================================================================
      // ÉTAPE 1: Configuration & normalisation
      // ============================================================================
    const {
      locale = 'fr',
      copyReady = false,
      whiteLabel = null,
      captureTimeout = 15000,
      blockResources = true,
    } = options;

    const normalizedUrl = normalizeUrl(url);
    const mode: Mode = 'solo';

    console.log('🔧 Configuration audit SOLO');
    console.log('   • URL:', url);
    console.log('   • Normalized:', normalizedUrl);
    console.log('   • Locale:', locale);
    console.log('   • Copy Ready:', copyReady);

    // ============================================================================
    // ÉTAPE 2: Génération des clés déterministes
    // ============================================================================
    console.log('\n🔑 Génération des clés déterministes...');

    const productKey = generateProductKey({
      mode,
      urls: { page_a: normalizedUrl },
    });

    const snapshotKey = generateSnapshotKey({
      productKey,
      locale,
      viewports: {
        mobile: { width: 390, height: 844 },
        desktop: { width: 1440, height: 900 },
      },
    });

    const runKey = generateRunKey({
      snapshotKey,
      mode,
    });

    const auditKey = generateAuditKey({
      runKey,
      copyReady,
      whiteLabel,
    });

    console.log('   • Product Key:', productKey);
    console.log('   • Snapshot Key:', snapshotKey);
    console.log('   • Run Key:', runKey);
    console.log('   • Audit Key:', auditKey);

    const keys = { productKey, snapshotKey, runKey, auditKey };

    // ============================================================================
    // ÉTAPE 3: Cache Check (SSOT Anti-Drift)
    // ============================================================================
    console.log('\n💾 Vérification du cache...');

    try {
      const existingRun = await prisma.scoreRun.findUnique({
        where: { runKey },
        include: {
          snapshot: {
            include: {
              sources: true,
            },
          },
        },
      });

      if (existingRun && existingRun.status === 'ok') {
        console.log('✅ CACHE HIT! Résultat déjà disponible');

        const duration = Date.now() - startTime;
        const exports = existingRun.exports as {
          tickets: TicketV2[];
          evidences: EvidenceV2[];
        };

        // Récupérer les artifacts depuis SnapshotSources
        const pageASource = existingRun.snapshot.sources.find(
          (s) => s.source === 'page_a'
        );

        const artifacts = pageASource
          ? this.extractArtifactsFromSnapshotSource(
              pageASource.artefacts as Record<string, unknown>
            )
          : undefined;

        // Récupérer evidenceCompleteness depuis SnapshotSource (SSOT)
        const evidenceCompleteness = pageASource?.evidenceCompleteness as
          | 'complete'
          | 'partial'
          | 'insufficient'
          | undefined;

        return {
          keys,
          status: existingRun.status as 'ok' | 'degraded' | 'failed',
          duration,
          fromCache: true,
          exports,
          errors: normalizeErrors((existingRun.errors as AuditResult['errors']) || []),
          reportMeta: {
            mode: mode,
            evidence_completeness: evidenceCompleteness || 'insufficient', // ✅ Depuis DB
            alignment_level: null, // SOLO
            url,
            normalized_url: normalizedUrl,
            locale,
            captured_at: pageASource?.capturedAt.toISOString() || new Date().toISOString(),
          },
          ...(artifacts ? { artifacts } : {}),
        };
      } else if (existingRun) {
        console.log('⚠️  Run existant mais status !== ok, nouvelle exécution');
      } else {
        console.log('❌ Cache miss, exécution du pipeline');
      }
    } catch (error) {
      console.error('⚠️  Erreur lors du cache check:', error);
      errors.push({
        stage: 'cache_check',
        code: 'CACHE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown cache error',
        timestamp: new Date().toISOString(),
      });
    }

    // ============================================================================
    // ÉTAPE 4: Capture (Playwright)
    // ============================================================================
    console.log('\n📸 Lancement des captures Playwright...');

    let captureResults: {
      mobile: CaptureResult | CaptureError;
      desktop: CaptureResult | CaptureError;
    };

    try {
      const results = await this.playwrightService.captureBothViewports(url, {
        timeout: captureTimeout,
        blockResources,
      });

      captureResults = results;

      // Vérifier les erreurs avec type guards
      if (!isCaptureSuccess(results.mobile) || !isCaptureSuccess(results.desktop)) {
        console.error('❌ Échec de capture:');
        if (!isCaptureSuccess(results.mobile)) {
          console.error('   • Mobile:', results.mobile.error.message);
          errors.push({
            stage: 'capture_mobile',
            code: results.mobile.error.type,
            message: results.mobile.error.message,
            timestamp: new Date().toISOString(),
          });
        }
        if (!isCaptureSuccess(results.desktop)) {
          console.error('   • Desktop:', results.desktop.error.message);
          errors.push({
            stage: 'capture_desktop',
            code: results.desktop.error.type,
            message: results.desktop.error.message,
            timestamp: new Date().toISOString(),
          });
        }

        // Échec total, retourner erreur
        return this.createFailedResult({
          keys,
          errors: normalizeErrors(errors),
          duration: Date.now() - startTime,
        });
      }

      console.log('✅ Captures réussies');
      console.log(
        `   • Mobile: ${(Buffer.byteLength(results.mobile.screenshot) / 1024).toFixed(2)} KB`
      );
      console.log(
        `   • Desktop: ${(Buffer.byteLength(results.desktop.screenshot) / 1024).toFixed(2)} KB`
      );
    } catch (error) {
      console.error('❌ Erreur fatale lors de la capture:', error);
      errors.push({
        stage: 'capture',
        code: 'CAPTURE_FATAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown capture error',
        timestamp: new Date().toISOString(),
      });

      return this.createFailedResult({
        keys,
        errors: normalizeErrors(errors),
        duration: Date.now() - startTime,
      });
    }

    // ============================================================================
    // ÉTAPE 4.5: Facts Collection (NOUVEAU)
    // ============================================================================
    console.log('\n🔍 Extraction des faits depuis le HTML capturé...');

    let facts: ShopifyFacts | null = null;

    try {
      // Collecter les faits depuis le HTML mobile (source primaire)
      if (isCaptureSuccess(captureResults.mobile)) {
        facts = collectFacts(captureResults.mobile.html, {
          strictMode: true,
          locale: locale,
        });

        console.log('✅ Facts collectés:');
        console.log('   • Titre:', facts.pdp.title || 'N/A');
        console.log('   • Prix:', facts.pdp.price || 'N/A');
        console.log('   • ATC Button:', facts.pdp.hasAtcButton ? '✓' : '✗');
        console.log('   • Variants:', facts.pdp.variantTypes.length);
        console.log('   • Apps détectées:', facts.technical.detectedApps.length);
        console.log('   • IsShopify:', facts.technical.isShopify ? '✓' : '✗');
      } else {
        console.warn('⚠️  Pas de HTML mobile disponible pour facts collection');
      }
    } catch (error) {
      console.error('⚠️  Erreur lors de facts collection:', error);
      errors.push({
        stage: 'facts_collection',
        code: 'FACTS_COLLECTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown facts collection error',
        timestamp: new Date().toISOString(),
      });
      // Non bloquant, on continue sans facts
    }

    // ============================================================================
    // ÉTAPE 4.6: AI Ticket Generation (NOUVEAU)
    // ============================================================================
    // Note: Cette étape doit se faire APRÈS le storage pour avoir les URLs

    // ============================================================================
    // ÉTAPE 5: Storage (Supabase)
    // ============================================================================
    console.log('\n☁️  Upload des artifacts vers Supabase...');

    const storageRefs: {
      mobile: { screenshot?: string; html?: string };
      desktop: { screenshot?: string; html?: string };
    } = {
      mobile: {},
      desktop: {},
    };

    try {
      // Initialize storage service
      await this.storageService.initialize();

      // Upload Mobile Screenshot
      if (isCaptureSuccess(captureResults.mobile)) {
        const mobileScreenshotResult = await this.storageService.uploadScreenshot(
          auditKey,
          'mobile',
          captureResults.mobile.screenshot
        );

        if (!isUploadSuccess(mobileScreenshotResult)) {
          console.error('⚠️  Échec upload mobile screenshot:', mobileScreenshotResult.error.message);
          errors.push({
            stage: 'storage_mobile_screenshot',
            code: mobileScreenshotResult.error.type,
            message: mobileScreenshotResult.error.message,
            timestamp: new Date().toISOString(),
          });
        } else {
          storageRefs.mobile.screenshot = mobileScreenshotResult.publicUrl;
          console.log('✅ Mobile screenshot:', mobileScreenshotResult.publicUrl);
        }

        // Upload Mobile HTML
        const mobileHtmlResult = await this.storageService.uploadHtml(
          auditKey,
          'mobile',
          captureResults.mobile.html
        );

        if (!isUploadSuccess(mobileHtmlResult)) {
          console.error('⚠️  Échec upload mobile HTML:', mobileHtmlResult.error.message);
          errors.push({
            stage: 'storage_mobile_html',
            code: mobileHtmlResult.error.type,
            message: mobileHtmlResult.error.message,
            timestamp: new Date().toISOString(),
          });
        } else {
          storageRefs.mobile.html = mobileHtmlResult.publicUrl;
          console.log('✅ Mobile HTML:', mobileHtmlResult.publicUrl);
        }
      }

      // Upload Desktop Screenshot
      if (isCaptureSuccess(captureResults.desktop)) {
        const desktopScreenshotResult = await this.storageService.uploadScreenshot(
          auditKey,
          'desktop',
          captureResults.desktop.screenshot
        );

        if (!isUploadSuccess(desktopScreenshotResult)) {
          console.error('⚠️  Échec upload desktop screenshot:', desktopScreenshotResult.error.message);
          errors.push({
            stage: 'storage_desktop_screenshot',
            code: desktopScreenshotResult.error.type,
            message: desktopScreenshotResult.error.message,
            timestamp: new Date().toISOString(),
          });
        } else {
          storageRefs.desktop.screenshot = desktopScreenshotResult.publicUrl;
          console.log('✅ Desktop screenshot:', desktopScreenshotResult.publicUrl);
        }

        // Upload Desktop HTML
        const desktopHtmlResult = await this.storageService.uploadHtml(
          auditKey,
          'desktop',
          captureResults.desktop.html
        );

        if (!isUploadSuccess(desktopHtmlResult)) {
          console.error('⚠️  Échec upload desktop HTML:', desktopHtmlResult.error.message);
          errors.push({
            stage: 'storage_desktop_html',
            code: desktopHtmlResult.error.type,
            message: desktopHtmlResult.error.message,
            timestamp: new Date().toISOString(),
          });
        } else {
          storageRefs.desktop.html = desktopHtmlResult.publicUrl;
          console.log('✅ Desktop HTML:', desktopHtmlResult.publicUrl);
        }
      }
    } catch (error) {
      console.error('⚠️  Erreur lors du storage:', error);
      errors.push({
        stage: 'storage',
        code: 'STORAGE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown storage error',
        timestamp: new Date().toISOString(),
      });
    }

    // ============================================================================
    // ÉTAPE 5.5: AI Ticket Generation (NOUVEAU - après storage)
    // ============================================================================
    console.log('\n🤖 Génération intelligente des tickets via AI...');

    let aiTickets: TicketV2[] = [];
    let aiEvidences: EvidenceV2[] = [];
    let aiReasoning = '';

    try {
      if (facts) {
        // Construire les artefacts pour l'AI
        const artefactsForAI = {
          screenshot_refs: storageRefs,
          html_refs: {
            mobile: storageRefs.mobile.html,
            desktop: storageRefs.desktop.html,
          },
          facts: JSON.parse(JSON.stringify(facts)),
          facts_version: '1.0',
          facts_collected_at: new Date().toISOString(),
        };

        const synthesizer = getAiSynthesizer();
        const aiResult = await synthesizer.generateTickets(facts, artefactsForAI);

        aiTickets = aiResult.tickets;
        aiEvidences = aiResult.evidences;
        aiReasoning = aiResult.reasoning;

        console.log(`✅ AI génération réussie: ${aiTickets.length} tickets`);
        console.log(`   Reasoning: ${aiReasoning}`);
        aiTickets.forEach((ticket, idx) => {
          console.log(
            `   ${idx + 1}. ${ticket.title} (${ticket.category}, impact: ${ticket.impact})`
          );
        });
      } else {
        console.warn('⚠️  Pas de facts disponibles, skip AI génération');
      }
    } catch (error) {
      console.error('⚠️  Erreur lors de l\'AI génération:', error);
      errors.push({
        stage: 'ai_generation',
        code: 'AI_GENERATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown AI generation error',
        timestamp: new Date().toISOString(),
      });
      // Non bloquant, on continue avec tickets vides
    }

    // ============================================================================
    // ÉTAPE 6: Persistence (Prisma)
    // ============================================================================
    console.log('\n💾 Persistence dans la base de données...');

    try {
      // 1. Product
      await prisma.product.upsert({
        where: { productKey },
        update: {
          lastSeenAt: new Date(),
        },
        create: {
          productKey,
          mode,
          normalizedUrls: { page_a: normalizedUrl },
          versions: { NORMALIZE_VERSION },
          canonicalInput: {
            mode,
            normalized_urls: { page_a: normalizedUrl },
            normalize_version: NORMALIZE_VERSION,
          },
        },
      });

      console.log('✅ Product créé/mis à jour');

      // 2. Snapshot
      const capturedAt = new Date();
      await prisma.snapshot.upsert({
        where: { snapshotKey },
        update: {},
        create: {
          snapshotKey,
          productKey,
          locale,
          viewports: {
            mobile: { width: 390, height: 844 },
            desktop: { width: 1440, height: 900 },
          },
          captureMeta: {
            user_agent: 'Mozilla/5.0 (compatible; ShopifyStrategist/1.0)',
            capture_timeout: captureTimeout,
            block_resources: blockResources,
          },
          versions: {
            ENGINE_VERSION,
            NORMALIZE_VERSION,
          },
          canonicalInput: {
            product_key: productKey,
            locale,
            viewports: {
              mobile: { width: 390, height: 844 },
              desktop: { width: 1440, height: 900 },
            },
            engine_version: ENGINE_VERSION,
          },
          status: 'ok',
          completedAt: capturedAt,
        },
      });

      console.log('✅ Snapshot créé/mis à jour');

      // 3. SnapshotSource (page_a) — AVEC FACTS + VALIDATION
      const artefactsRaw = {
        screenshot_refs: storageRefs,
        html_refs: {
          mobile: storageRefs.mobile.html,
          desktop: storageRefs.desktop.html,
        },
        // ✅ Ajout des facts collectés (Prisma JsonValue compatible)
        facts: facts ? JSON.parse(JSON.stringify(facts)) : null,
        facts_version: facts ? '1.0' : null,
        facts_collected_at: facts ? new Date().toISOString() : null,
      };

      // ✅ VALIDATION RUNTIME (SSOT)
      console.log('🔍 Validation des artefacts avant persistence...');
      const artefactsValidation = validateArtefactsSafe(artefactsRaw);

      if (!artefactsValidation.success) {
        console.error('❌ Erreur de validation artefacts:', artefactsValidation.error.errors);
        errors.push({
          stage: 'validation',
          code: 'ARTEFACTS_VALIDATION_ERROR',
          message: `Artefacts validation failed: ${artefactsValidation.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', ')}`,
          timestamp: new Date().toISOString(),
        });

        // Mode dégradé : on continue avec artefactsRaw (sans validation stricte)
        // mais on marque le run comme 'degraded'
      }

      const artefacts: any = artefactsValidation.success
        ? artefactsValidation.data
        : artefactsRaw;

      console.log('✅ Artefacts validés');

      // Calculer evidenceCompleteness selon SSOT
      const evidenceCompleteness = calculateEvidenceCompleteness(
        {
          mobile: {
            ...(storageRefs.mobile.screenshot ? { screenshot: storageRefs.mobile.screenshot } : {}),
            ...(storageRefs.mobile.html ? { html: storageRefs.mobile.html } : {}),
          },
          desktop: {
            ...(storageRefs.desktop.screenshot ? { screenshot: storageRefs.desktop.screenshot } : {}),
            ...(storageRefs.desktop.html ? { html: storageRefs.desktop.html } : {}),
          },
        },
        facts
      );

      console.log(`📊 Evidence Completeness: ${evidenceCompleteness}`);

      await prisma.snapshotSource.upsert({
        where: {
          snapshotKey_source: {
            snapshotKey,
            source: 'page_a',
          },
        },
        update: {},
        create: {
          snapshotKey,
          source: 'page_a',
          url: normalizedUrl,
          capturedAt,
          artefacts,
          evidenceCompleteness, // ✅ Calculé dynamiquement
          missingEvidence: [],
        },
      });

      console.log('✅ SnapshotSource (page_a) créé/mis à jour');

      // 4. ScoreRun (avec tickets AI générés)
      const exports: any = {
        tickets: aiTickets.length > 0 ? aiTickets : [],
        evidences: aiEvidences.length > 0 ? aiEvidences : [],
      };

      console.log(`📦 Exports: ${exports.tickets.length} tickets, ${exports.evidences.length} evidences`);

      await prisma.scoreRun.upsert({
        where: { runKey },
        update: {},
        create: {
          runKey,
          snapshotKey,
          mode,
          versions: {
            DETECTORS_VERSION,
            SCORING_VERSION,
          },
          canonicalInput: {
            snapshot_key: snapshotKey,
            detectors_version: DETECTORS_VERSION,
            scoring_version: SCORING_VERSION,
            mode,
          },
          exports,
          status: errors.length === 0 ? 'ok' : 'degraded',
          errors: normalizeErrors(errors),
          completedAt: new Date(),
        },
      });

      // AuditJob créé après ScoreRun (runKey NOT NULL, SSOT DB_SCHEMA §5.5)
      await prisma.auditJob.create({
        data: {
          auditKey,
          runKey,
          mode,
          reportMeta: {
            mode,
            evidence_completeness: evidenceCompleteness,
            alignment_level: null,
            url,
            normalized_url: normalizedUrl,
            locale,
            captured_at: capturedAt.toISOString(),
          },
          versions: {
            NORMALIZE_VERSION,
            ENGINE_VERSION,
            DETECTORS_VERSION,
            SCORING_VERSION,
          },
          canonicalInput: {
            mode,
            url,
            locale,
            copyReady,
          },
          htmlRef: '',
          htmlContentHash: '',
          status: 'PENDING',
        },
      });

      console.log('✅ ScoreRun et AuditJob créés/mis à jour');
    } catch (error) {
      console.error('❌ Erreur lors de la persistence:', error);
      errors.push({
        stage: 'persistence',
        code: 'DB_ERROR',
        message: error instanceof Error ? error.message : 'Unknown database error',
        timestamp: new Date().toISOString(),
      });

      return this.createFailedResult({
        keys,
        errors: normalizeErrors(errors),
        duration: Date.now() - startTime,
      });
    }

    // ============================================================================
    // ÉTAPE 6.5: Génération HTML + PDF (NOUVEAU)
    // ============================================================================
    console.log('\n📄 Génération des rapports (HTML + PDF)...');

    let htmlUrl: string | undefined;
    let pdfUrl: string | undefined;

    try {
      // Récupérer le ScoreRun complet avec relations
      const scoreRun = await prisma.scoreRun.findUnique({
        where: { runKey },
        include: {
          snapshot: {
            include: {
              sources: true,
            },
          },
        },
      });

      if (!scoreRun) {
        throw new Error('ScoreRun introuvable pour génération rapport');
      }

      // Mettre à jour le status de l'AuditJob
      await prisma.auditJob.update({
        where: { auditKey },
        data: { status: 'GENERATING_REPORT' },
      });

      // Génération HTML
      console.log('📝 Génération du rapport HTML...');
      const htmlReport = generateHtmlReport(scoreRun, {
        locale: locale as 'fr' | 'en',
        darkMode: true,
        ...(whiteLabel ? { whiteLabel } : {}),
      });

      console.log(`✅ HTML généré: ${(htmlReport.metadata.fileSize / 1024).toFixed(2)} KB`);

      // Upload HTML rapport final vers Supabase (bucket html-reports, path reports/{auditKey}.html)
      await this.storageService.initialize();
      const htmlPath = `reports/${auditKey}.html`;
      const { error: htmlError } = await this.storageService
        .getClient().storage.from('html-reports')
        .upload(htmlPath, htmlReport.html, {
          contentType: 'text/html',
          upsert: true,
        });

      if (htmlError) {
        console.warn('⚠️  Échec upload HTML:', htmlError.message);
      } else {
        const { data: htmlUrlData } = this.storageService.getClient().storage
          .from('html-reports')
          .getPublicUrl(htmlPath);

        htmlUrl = htmlUrlData.publicUrl;
        console.log(`✅ HTML uploadé: ${htmlUrl}`);
      }

      // Génération PDF
      console.log('🖨️  Génération du PDF avec Playwright...');
      const pdfGenerator = getPdfGenerator();
      pdfGeneratorNeedsCleanup = true;
      const pdfResult = await pdfGenerator.generateAndUpload(
        htmlReport.html,
        auditKey,
        { format: 'A4' }
      );

      pdfUrl = pdfResult.publicUrl;
      console.log(
        `✅ PDF ${pdfResult.fromCache ? 'récupéré du cache' : 'généré'}: ${pdfUrl}`
      );

      // Mettre à jour le ScoreRun avec les URLs (dans exports)
      const updatedExports = {
        ...((scoreRun.exports as object) || {}),
        reportUrls: {
          html: htmlUrl,
          pdf: pdfUrl,
        },
      };

      await prisma.scoreRun.update({
        where: { runKey },
        data: {
          exports: updatedExports as any,
        },
      });

      // Mettre à jour le status et htmlRef de l'AuditJob
      await prisma.auditJob.update({
        where: { auditKey },
        data: {
          status: 'COMPLETED',
          ...(htmlUrl ? { htmlRef: htmlUrl } : {}),
        },
      });

      console.log('✅ Rapports générés et URLs sauvegardées');
    } catch (error) {
      console.error('⚠️  Erreur lors de la génération des rapports:', error);
      errors.push({
        stage: 'report_generation',
        code: 'REPORT_GENERATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown report generation error',
        timestamp: new Date().toISOString(),
      });

      // Marquer l'AuditJob comme terminé malgré l'erreur de rapport
      try {
        await prisma.auditJob.update({
          where: { auditKey },
          data: { status: 'COMPLETED' },
        });
      } catch (updateError) {
        console.error('⚠️  Erreur lors de la mise à jour du status:', updateError);
      }

      // Non bloquant: continuer avec le résultat
    }

    // ============================================================================
    // ÉTAPE 7: Résultat
    // ============================================================================
    const duration = Date.now() - startTime;
    const status = errors.length === 0 ? 'ok' : 'degraded';

    // Recalculer evidenceCompleteness pour le résultat final
    const finalEvidenceCompleteness = calculateEvidenceCompleteness(
      {
        mobile: {
          ...(storageRefs.mobile.screenshot ? { screenshot: storageRefs.mobile.screenshot } : {}),
          ...(storageRefs.mobile.html ? { html: storageRefs.mobile.html } : {}),
        },
        desktop: {
          ...(storageRefs.desktop.screenshot ? { screenshot: storageRefs.desktop.screenshot } : {}),
          ...(storageRefs.desktop.html ? { html: storageRefs.desktop.html } : {}),
        },
      },
      facts
    );

    console.log(`\n✅ Audit terminé en ${duration}ms (status: ${status})`);

    return {
      keys,
      status,
      duration,
      fromCache: false,
      exports: {
        tickets: aiTickets.length > 0 ? aiTickets : [],
        evidences: aiEvidences.length > 0 ? aiEvidences : [],
      },
      ...(htmlUrl || pdfUrl
        ? {
            reportUrls: {
              ...(htmlUrl ? { html: htmlUrl } : {}),
              ...(pdfUrl ? { pdf: pdfUrl } : {}),
            },
          }
        : {}),
      errors: normalizeErrors(errors),
      reportMeta: {
        mode,
        evidence_completeness: finalEvidenceCompleteness, // ✅ Utilise la valeur recalculée
        alignment_level: null, // SOLO
        url,
        normalized_url: normalizedUrl,
        locale,
        captured_at: new Date().toISOString(),
      },
      ...(storageRefs.mobile.screenshot || storageRefs.desktop.screenshot
        ? {
            artifacts: {
              screenshots: {
                ...(storageRefs.mobile.screenshot
                  ? { mobile: { above_fold: storageRefs.mobile.screenshot } }
                  : {}),
                ...(storageRefs.desktop.screenshot
                  ? { desktop: { above_fold: storageRefs.desktop.screenshot } }
                  : {}),
              },
              ...(storageRefs.mobile.html || storageRefs.desktop.html
                ? {
                    html_refs: {
                      ...(storageRefs.mobile.html ? { mobile: storageRefs.mobile.html } : {}),
                      ...(storageRefs.desktop.html ? { desktop: storageRefs.desktop.html } : {}),
                    },
                  }
                : {}),
            },
          }
        : {}),
    };
    } catch (error) {
      // Erreur générale non gérée
      console.error('❌ Erreur inattendue dans runSoloAudit:', error);
      
      const keys = {
        productKey: '',
        snapshotKey: '',
        runKey: '',
        auditKey: '',
      };

      return {
        keys,
        status: 'failed',
        duration: Date.now() - startTime,
        fromCache: false,
        errors: normalizeErrors([
          {
            stage: 'unknown',
            code: 'UNEXPECTED_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
        ]),
      };
    } finally {
      // ============================================================================
      // CLEANUP: Fermer les navigateurs Playwright
      // ============================================================================
      console.log('\n🧹 Cleanup...');

      if (playwrightCaptureNeedsCleanup) {
        try {
          await this.playwrightService.close();
          console.log('✅ Navigateur Playwright (capture) fermé');
        } catch (cleanupError) {
          console.error('⚠️  Erreur lors de la fermeture du navigateur capture:', cleanupError);
        }
      }

      if (pdfGeneratorNeedsCleanup) {
        try {
          const { closePdfGenerator } = await import('@/core/pipeline/pdf-generator');
          await closePdfGenerator();
          console.log('✅ Navigateur Playwright (PDF) fermé');
        } catch (cleanupError) {
          console.error('⚠️  Erreur lors de la fermeture du navigateur PDF:', cleanupError);
        }
      }

      console.log('✅ Cleanup terminé');
    }
  }

  /**
   * Crée un résultat d'échec
   */
  private createFailedResult(params: {
    keys: AuditResult['keys'];
    errors: AuditResult['errors'];
    duration: number;
  }): AuditResult {
    return {
      keys: params.keys,
      status: 'failed',
      duration: params.duration,
      fromCache: false,
      errors: params.errors,
    };
  }

  /**
   * Extrait les artifacts depuis SnapshotSource.artefacts
   */
  private extractArtifactsFromSnapshotSource(
    artefacts: Record<string, unknown>
  ): AuditResult['artifacts'] {
    const screenshotRefs = artefacts.screenshot_refs as {
      mobile?: { screenshot?: string };
      desktop?: { screenshot?: string };
    };

    const htmlRefs = artefacts.html_refs as {
      mobile?: string;
      desktop?: string;
    };

    // ✅ Construire l'objet artifacts seulement si on a des données
    const hasScreenshots = screenshotRefs?.mobile?.screenshot || screenshotRefs?.desktop?.screenshot;
    const hasHtmlRefs = htmlRefs?.mobile || htmlRefs?.desktop;

    if (!hasScreenshots && !hasHtmlRefs) {
      return undefined;
    }

    return {
      screenshots: {
        ...(screenshotRefs?.mobile?.screenshot
          ? { mobile: { above_fold: screenshotRefs.mobile.screenshot } }
          : {}),
        ...(screenshotRefs?.desktop?.screenshot
          ? { desktop: { above_fold: screenshotRefs.desktop.screenshot } }
          : {}),
      },
      ...(hasHtmlRefs
        ? {
            html_refs: {
              ...(htmlRefs?.mobile ? { mobile: htmlRefs.mobile } : {}),
              ...(htmlRefs?.desktop ? { desktop: htmlRefs.desktop } : {}),
            },
          }
        : {}),
    };
  }
}
