/**
 * ⚠️ AUDIT PIPELINE ORCHESTRATOR (SSOT)
 *
 * State machine: normalize → capture → facts → score → ai → persistence → delivery
 *
 * Reference:
 * - docs/AUDIT_PIPELINE_SPEC.md (v1.0)
 * - docs/DB_SCHEMA.md (v1.0)
 * - docs/SCORING_AND_DETECTION.md (v2.2)
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { collectFacts, type ShopifyFacts } from '@/core/engine/facts-collector';
import { validateArtefactsSafe } from '@/contracts/internal/artefacts.schema';
import { validateScoreRunExports, exportsToPrismaJson, AuditExportsSchema } from '@/contracts/internal/exports.schema';
import { computeAuditScore, type StrategistScoreOutput } from '@/core/engine/scoring-engine';
import { getAiSynthesizer } from '@/core/engine/ai-synthesizer';
import { buildEvidencesFromArtifacts } from '@/core/engine/evidence-builder';
import { generateDeterministicTickets } from '@/core/engine/rules-ticket-engine';
import { sortTicketsStable, filterTopActionsGuardrails } from '@/contracts/export/ticket.v2';
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
import type { EvidenceV2 } from '@/contracts/export/evidence.v2';
import type { TicketV2 } from '@/contracts/export/ticket.v2';
import { type CaptureResult } from '@/adapters/capture/playwright.service';
import { CaptureService } from './services/capture.service';
import { DeliveryService } from './services/delivery.service';

function isCaptureSuccess(r: { success: boolean }): r is CaptureResult {
  return r.success === true;
}

/** Enum macro SSOT: errors[].stage (API_DOC §4.6) */
const STAGE_MACRO = ['normalize', 'capture', 'detectors', 'scoring', 'report', 'render_pdf', 'storage', 'unknown'] as const;
export type StageMacro = (typeof STAGE_MACRO)[number];

export const MISSING_EVIDENCE_REASONS = [
  'blocked_by_cookie_consent',
  'blocked_by_popup',
  'infinite_scroll_or_lazyload',
  'navigation_intercepted',
  'timeout',
  'unknown_render_issue',
] as const;

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

export function normalizeErrors(
  errs: Array<{ stage?: string; code?: string; message?: string; timestamp?: string; missing_evidence_reason?: (typeof MISSING_EVIDENCE_REASONS)[number] | null }>
): Array<{ stage: StageMacro; code: string; message: string; timestamp: string; missing_evidence_reason: (typeof MISSING_EVIDENCE_REASONS)[number] | null }> {
  return errs.map((e) => ({
    stage: mapStageToMacro(e.stage ?? 'unknown'),
    code: e.code ?? '',
    message: e.message ?? '',
    timestamp: e.timestamp ?? new Date().toISOString(),
    missing_evidence_reason: e.missing_evidence_reason ?? inferMissingEvidenceReason(e.stage ?? '', e.code ?? '', e.message ?? ''),
  }));
}

export interface ScoreRunExports {
  tickets: TicketV2[];
  evidences: EvidenceV2[];
  executive_summary?: string;
  plan_30_60_90?: { j0_30: string; j30_60: string; j60_90: string };
  reasoning?: string;
  strategist_score?: number;
  score_breakdown?: Array<{ pillar: string; delta: number; reason: string }>;
  score_reasoning?: string;
}

export interface AuditOptions {
  locale?: string;
  copyReady?: boolean;
  whiteLabel?: { logo?: string; clientName?: string; agencyName?: string } | null;
  captureTimeout?: number;
  blockResources?: boolean;
}

export interface AuditResult {
  keys: { productKey: string; snapshotKey: string; runKey: string; auditKey: string };
  status: 'ok' | 'degraded' | 'failed';
  duration: number;
  fromCache: boolean;
  exports?: ScoreRunExports;
  reportUrls?: { html?: string; pdf?: string };
  errors: Array<{ stage: string; code: string; message: string; timestamp: string; missing_evidence_reason?: (typeof MISSING_EVIDENCE_REASONS)[number] | null }>;
  reportMeta?: { mode: Mode; evidence_completeness: 'complete' | 'partial' | 'insufficient'; alignment_level: null; url: string; normalized_url: string; locale: string; captured_at: string };
  artifacts?: {
    screenshots: { mobile?: { above_fold?: string }; desktop?: { above_fold?: string } };
    html_refs?: { mobile?: string; desktop?: string };
  };
}

function calculateEvidenceCompleteness(
  artifacts: { mobile?: { screenshot?: string; html?: string }; desktop?: { screenshot?: string; html?: string } },
  facts: ShopifyFacts | null
): 'complete' | 'partial' | 'insufficient' {
  const hasAboveFoldMobile = !!artifacts.mobile?.screenshot;
  const hasAboveFoldDesktop = !!artifacts.desktop?.screenshot;
  const hasFullPageMobile = !!artifacts.mobile?.html;
  if (hasAboveFoldMobile && hasAboveFoldDesktop && hasFullPageMobile) return 'complete';
  const hasCtaAreaMobile = hasAboveFoldMobile && facts?.pdp.hasAtcButton;
  const hasDetailsSection = hasAboveFoldMobile && facts?.pdp.hasDescription;
  if (hasAboveFoldMobile && hasCtaAreaMobile && hasDetailsSection) return 'partial';
  return 'insufficient';
}

function extractArtifactsFromSnapshotSource(artefacts: Record<string, unknown>): AuditResult['artifacts'] {
  const screenshotRefs = artefacts.screenshot_refs as { mobile?: { screenshot?: string }; desktop?: { screenshot?: string } } | undefined;
  const htmlRefs = artefacts.html_refs as { mobile?: string; desktop?: string } | undefined;
  const hasScreenshots = screenshotRefs?.mobile?.screenshot || screenshotRefs?.desktop?.screenshot;
  const hasHtmlRefs = htmlRefs?.mobile || htmlRefs?.desktop;
  if (!hasScreenshots && !hasHtmlRefs) return undefined;
  return {
    screenshots: {
      ...(screenshotRefs?.mobile?.screenshot ? { mobile: { above_fold: screenshotRefs.mobile.screenshot } } : {}),
      ...(screenshotRefs?.desktop?.screenshot ? { desktop: { above_fold: screenshotRefs.desktop.screenshot } } : {}),
    },
    ...(hasHtmlRefs ? { html_refs: { ...(htmlRefs?.mobile ? { mobile: htmlRefs.mobile } : {}), ...(htmlRefs?.desktop ? { desktop: htmlRefs.desktop } : {}) } } : {}),
  };
}

export class AuditService {
  private captureService = new CaptureService();
  private deliveryService = new DeliveryService();

  async runSoloAudit(url: string, options: AuditOptions = {}): Promise<AuditResult> {
    const startTime = Date.now();
    const errors: Array<{ stage?: string; code?: string; message?: string; timestamp?: string; missing_evidence_reason?: (typeof MISSING_EVIDENCE_REASONS)[number] | null }> = [];

    const { locale = 'fr', copyReady = false, whiteLabel = null, captureTimeout = 15000, blockResources = true } = options;
    const normalizedUrl = normalizeUrl(url);
    const mode: Mode = 'solo';

    const productKey = generateProductKey({ mode, urls: { page_a: normalizedUrl } });
    const snapshotKey = generateSnapshotKey({ productKey, locale, viewports: { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } } });
    const runKey = generateRunKey({ snapshotKey, mode });
    const auditKey = generateAuditKey({ runKey, copyReady, whiteLabel });
    const keys = { productKey, snapshotKey, runKey, auditKey };

    // ─── CACHE CHECK ─── Set to true to force full pipeline (e.g. AI validation); false = use cache when available
    const CACHE_CHECK_DISABLED_FOR_AI_TEST = true; // Force fresh audit (bypass cache)
    if (!CACHE_CHECK_DISABLED_FOR_AI_TEST) {
      try {
        const existingRun = await prisma.scoreRun.findUnique({
          where: { runKey },
          include: { snapshot: { include: { sources: true } } },
        });

        if (existingRun && existingRun.status === 'ok') {
          const validatedExports = validateScoreRunExports(existingRun.exports);
          if (!validatedExports) {
            errors.push({ stage: 'cache_check', code: 'EXPORTS_VALIDATION_FAILED', message: 'Invalid exports in cache', timestamp: new Date().toISOString() });
          } else {
            const exports = validatedExports as ScoreRunExports;
            const pageASource = existingRun.snapshot.sources.find((s) => s.source === 'page_a');
            const artifacts = pageASource ? extractArtifactsFromSnapshotSource(pageASource.artefacts as Record<string, unknown>) : undefined;
            const evidenceCompleteness = pageASource?.evidenceCompleteness as 'complete' | 'partial' | 'insufficient' | undefined;

            return {
              keys,
              status: existingRun.status as 'ok' | 'degraded' | 'failed',
              duration: Date.now() - startTime,
              fromCache: true,
              exports,
              errors: normalizeErrors((existingRun.errors as AuditResult['errors']) || []),
              reportMeta: { mode, evidence_completeness: evidenceCompleteness || 'insufficient', alignment_level: null, url, normalized_url: normalizedUrl, locale, captured_at: pageASource?.capturedAt.toISOString() || new Date().toISOString() },
              ...(artifacts ? { artifacts } : {}),
            };
          }
        }
      } catch (error) {
        console.error('DEBUG: Audit step failed:', 'cache_check', error);
        errors.push({ stage: 'cache_check', code: 'CACHE_ERROR', message: error instanceof Error ? error.message : 'Unknown cache error', timestamp: new Date().toISOString() });
      }
    }

    // ─── CAPTURE (Playwright + Storage) ───
    const captureResult = await this.captureService.runCapture(url, auditKey, { timeout: captureTimeout, blockResources });
    errors.push(...captureResult.errors);

    if (!captureResult.success || !captureResult.captureResults) {
      return this.createFailedResult({ keys, errors: normalizeErrors(errors), duration: Date.now() - startTime });
    }

    const { captureResults, storageRefs } = captureResult;
    if (!isCaptureSuccess(captureResults.mobile) || !isCaptureSuccess(captureResults.desktop)) {
      return this.createFailedResult({ keys, errors: normalizeErrors(errors), duration: Date.now() - startTime });
    }

    // ─── FACTS ───
    let facts: ShopifyFacts | null = null;
    try {
      const lcpMs = captureResults.mobile.metadata?.lcpMs;
      facts = await collectFacts(captureResults.mobile.html, {
        strictMode: true,
        locale,
        ...(lcpMs != null && { performanceMetrics: { lcpMs } }),
      });
    } catch (error) {
      console.error('DEBUG: Audit step failed:', 'facts_collection', error);
      errors.push({ stage: 'facts_collection', code: 'FACTS_COLLECTION_ERROR', message: error instanceof Error ? error.message : 'Unknown', timestamp: new Date().toISOString() });
    }

    // ─── SCORING ───
    let strategistScore: number | null = null;
    let scoreBreakdown: Array<{ pillar: string; delta: number; reason: string }> = [];
    let scoreReasoning = '';
    let fullScoreOutput: StrategistScoreOutput | null = null;
    if (facts) {
      try {
        const scoreOutput = computeAuditScore(facts);
        strategistScore = scoreOutput.strategist_score;
        scoreBreakdown = scoreOutput.breakdown;
        scoreReasoning = scoreOutput.reasoning;
        fullScoreOutput = scoreOutput;
      } catch (error) {
        console.error('DEBUG: Audit step failed:', 'scoring', error);
        errors.push({ stage: 'scoring', code: 'SCORING_ERROR', message: error instanceof Error ? error.message : 'Scoring error', timestamp: new Date().toISOString() });
      }
    }

    // ─── TICKETS (Rules first, AI optional enrichment) ───
    let aiTickets: TicketV2[] = [];
    let aiEvidences: EvidenceV2[] = [];
    let aiReasoning = '';
    let aiExecutiveSummary = '';
    let aiPlan306090: { j0_30: string; j30_60: string; j60_90: string } | null = null;

    if (facts) {
      const artefactsForEvidence = {
        screenshot_refs: storageRefs,
        html_refs: { mobile: storageRefs.mobile.html, desktop: storageRefs.desktop.html },
        facts: JSON.parse(JSON.stringify(facts)),
        facts_version: '1.0',
        facts_collected_at: new Date().toISOString(),
      };

      // 1. Build evidences (shared, no AI dependency)
      aiEvidences = buildEvidencesFromArtifacts(artefactsForEvidence);

      // 2. Rules tickets (always, deterministic)
      const rulesTickets = generateDeterministicTickets(facts, fullScoreOutput, aiEvidences, locale as 'fr' | 'en');

      // 3. AI enrichment (optional, must not remove rules tickets)
      let aiOnlyTickets: TicketV2[] = [];
      try {
        const aiResult = await getAiSynthesizer().generateTickets(facts, artefactsForEvidence, locale as 'fr' | 'en');
        aiOnlyTickets = aiResult.tickets;
        aiEvidences = aiResult.evidences;
        aiReasoning = aiResult.reasoning;
        aiExecutiveSummary = aiResult.executive_summary;
        aiPlan306090 = aiResult.plan_30_60_90;

        // Filter AI tickets that duplicate rules (by ticket_id)
        const rulesIds = new Set(rulesTickets.map((t) => t.ticket_id));
        aiOnlyTickets = aiOnlyTickets.filter((t) => !rulesIds.has(t.ticket_id));
      } catch (error) {
        console.error('DEBUG: Audit step failed:', 'ai_generation', error);
        errors.push({ stage: 'ai_generation', code: 'AI_GENERATION_ERROR', message: error instanceof Error ? error.message : 'Unknown', timestamp: new Date().toISOString() });
      }

      // 4. Merge: rules first, then AI-only, max 5 total
      const merged = [...rulesTickets, ...aiOnlyTickets];
      const sorted = sortTicketsStable(merged);
      const guarded = filterTopActionsGuardrails(sorted, 1);
      aiTickets = guarded.slice(0, 5);
    }

    // ─── PERSISTENCE ───
    const capturedAt = new Date();
    const artefactsRaw = {
      screenshot_refs: storageRefs,
      html_refs: { mobile: storageRefs.mobile.html, desktop: storageRefs.desktop.html },
      facts: facts ? JSON.parse(JSON.stringify(facts)) : null,
      facts_version: facts ? '1.0' : null,
      facts_collected_at: facts ? new Date().toISOString() : null,
    };
    const artefactsValidation = validateArtefactsSafe(artefactsRaw);
    const artefacts = (artefactsValidation.success ? artefactsValidation.data : artefactsRaw) as Prisma.InputJsonValue;
    const artifactsForCompleteness: Parameters<typeof calculateEvidenceCompleteness>[0] = {};
    if (storageRefs.mobile.screenshot) {
      artifactsForCompleteness.mobile = { screenshot: storageRefs.mobile.screenshot, ...(storageRefs.mobile.html ? { html: storageRefs.mobile.html } : {}) };
    }
    if (storageRefs.desktop.screenshot) {
      artifactsForCompleteness.desktop = { screenshot: storageRefs.desktop.screenshot, ...(storageRefs.desktop.html ? { html: storageRefs.desktop.html } : {}) };
    }
    const evidenceCompleteness = calculateEvidenceCompleteness(artifactsForCompleteness, facts);

    try {
      await prisma.product.upsert({
        where: { productKey },
        update: { lastSeenAt: new Date() },
        create: { productKey, mode, normalizedUrls: { page_a: normalizedUrl }, versions: { NORMALIZE_VERSION }, canonicalInput: { mode, normalized_urls: { page_a: normalizedUrl }, normalize_version: NORMALIZE_VERSION } },
      });
      await prisma.snapshot.upsert({
        where: { snapshotKey },
        update: {},
        create: {
          snapshotKey,
          productKey,
          locale,
          viewports: { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } },
          captureMeta: { user_agent: 'Mozilla/5.0 (compatible; ShopifyStrategist/1.0)', capture_timeout: captureTimeout, block_resources: blockResources },
          versions: { ENGINE_VERSION, NORMALIZE_VERSION },
          canonicalInput: { product_key: productKey, locale, viewports: { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } }, engine_version: ENGINE_VERSION },
          status: 'ok',
          completedAt: capturedAt,
        },
      });
      await prisma.snapshotSource.upsert({
        where: { snapshotKey_source: { snapshotKey, source: 'page_a' } },
        update: {},
        create: { snapshotKey, source: 'page_a', url: normalizedUrl, capturedAt, artefacts, evidenceCompleteness, missingEvidence: [] },
      });

      const scoreRunExports: ScoreRunExports = {
        tickets: aiTickets,
        evidences: aiEvidences,
        ...(aiExecutiveSummary ? { executive_summary: aiExecutiveSummary } : {}),
        ...(aiPlan306090 ? { plan_30_60_90: aiPlan306090 } : {}),
        ...(aiReasoning ? { reasoning: aiReasoning } : {}),
        ...(strategistScore != null ? { strategist_score: strategistScore } : {}),
        ...(scoreBreakdown.length > 0 ? { score_breakdown: scoreBreakdown } : {}),
        ...(scoreReasoning ? { score_reasoning: scoreReasoning } : {}),
      };

      const exportsValidation = AuditExportsSchema.safeParse(scoreRunExports);
      const exportsForDb = exportsValidation.success ? exportsToPrismaJson(exportsValidation.data) : JSON.parse(JSON.stringify(scoreRunExports));

      await prisma.scoreRun.upsert({
        where: { runKey },
        update: {},
        create: {
          runKey,
          snapshotKey,
          mode,
          versions: { DETECTORS_VERSION, SCORING_VERSION },
          canonicalInput: { snapshot_key: snapshotKey, detectors_version: DETECTORS_VERSION, scoring_version: SCORING_VERSION, mode },
          exports: exportsForDb,
          status: errors.length === 0 ? 'ok' : 'degraded',
          errors: normalizeErrors(errors),
          completedAt: new Date(),
        },
      });
      await prisma.auditJob.upsert({
        where: { auditKey },
        create: {
          auditKey,
          runKey,
          mode,
          reportMeta: { mode, evidence_completeness: evidenceCompleteness, alignment_level: null, url, normalized_url: normalizedUrl, locale, captured_at: capturedAt.toISOString() },
          versions: { NORMALIZE_VERSION, ENGINE_VERSION, DETECTORS_VERSION, SCORING_VERSION },
          canonicalInput: { mode, url, locale, copyReady },
          htmlRef: '',
          htmlContentHash: '',
          status: 'PENDING',
        },
        update: {
          runKey,
          mode,
          reportMeta: { mode, evidence_completeness: evidenceCompleteness, alignment_level: null, url, normalized_url: normalizedUrl, locale, captured_at: capturedAt.toISOString() },
          versions: { NORMALIZE_VERSION, ENGINE_VERSION, DETECTORS_VERSION, SCORING_VERSION },
          canonicalInput: { mode, url, locale, copyReady },
          status: 'PENDING',
        },
      });
    } catch (error) {
      console.error('DEBUG: Audit step failed:', 'persistence', error);
      errors.push({ stage: 'persistence', code: 'DB_ERROR', message: error instanceof Error ? error.message : 'Unknown', timestamp: new Date().toISOString() });
      return this.createFailedResult({ keys, errors: normalizeErrors(errors), duration: Date.now() - startTime });
    }

    // ─── DELIVERY (HTML + PDF) ───
    let htmlUrl: string | undefined;
    let pdfUrl: string | undefined;
    try {
      const deliveryResult = await this.deliveryService.deliverReport(runKey, auditKey, { locale: locale as 'fr' | 'en', whiteLabel });
      htmlUrl = deliveryResult.htmlUrl;
      pdfUrl = deliveryResult.pdfUrl;
      errors.push(...deliveryResult.errors);
    } catch (error) {
      console.error('DEBUG: Audit step failed:', 'report_generation', error);
      errors.push({ stage: 'report_generation', code: 'REPORT_GENERATION_ERROR', message: error instanceof Error ? error.message : 'Unknown', timestamp: new Date().toISOString() });
      try {
        await prisma.auditJob.update({ where: { auditKey }, data: { status: 'COMPLETED' } });
      } catch {
        // ignore
      }
    } finally {
      await this.deliveryService.closePdfGenerator();
    }

    const finalExports: ScoreRunExports = {
      tickets: aiTickets,
      evidences: aiEvidences,
      ...(aiExecutiveSummary ? { executive_summary: aiExecutiveSummary } : {}),
      ...(aiPlan306090 ? { plan_30_60_90: aiPlan306090 } : {}),
      ...(aiReasoning ? { reasoning: aiReasoning } : {}),
      ...(strategistScore != null ? { strategist_score: strategistScore } : {}),
      ...(scoreBreakdown.length > 0 ? { score_breakdown: scoreBreakdown } : {}),
      ...(scoreReasoning ? { score_reasoning: scoreReasoning } : {}),
    };

    const finalArtifactsForCompleteness: Parameters<typeof calculateEvidenceCompleteness>[0] = {};
    if (storageRefs.mobile.screenshot) {
      finalArtifactsForCompleteness.mobile = { screenshot: storageRefs.mobile.screenshot, ...(storageRefs.mobile.html ? { html: storageRefs.mobile.html } : {}) };
    }
    if (storageRefs.desktop.screenshot) {
      finalArtifactsForCompleteness.desktop = { screenshot: storageRefs.desktop.screenshot, ...(storageRefs.desktop.html ? { html: storageRefs.desktop.html } : {}) };
    }
    const finalEvidenceCompleteness = calculateEvidenceCompleteness(finalArtifactsForCompleteness, facts);

    return {
      keys,
      status: errors.length === 0 ? 'ok' : 'degraded',
      duration: Date.now() - startTime,
      fromCache: false,
      exports: finalExports,
      ...(htmlUrl || pdfUrl ? { reportUrls: { ...(htmlUrl ? { html: htmlUrl } : {}), ...(pdfUrl ? { pdf: pdfUrl } : {}) } } : {}),
      errors: normalizeErrors(errors),
      reportMeta: { mode, evidence_completeness: finalEvidenceCompleteness, alignment_level: null, url, normalized_url: normalizedUrl, locale, captured_at: new Date().toISOString() },
      artifacts: {
        screenshots: {
          ...(storageRefs.mobile.screenshot ? { mobile: { above_fold: storageRefs.mobile.screenshot } } : {}),
          ...(storageRefs.desktop.screenshot ? { desktop: { above_fold: storageRefs.desktop.screenshot } } : {}),
        },
        ...(storageRefs.mobile.html || storageRefs.desktop.html ? { html_refs: { ...(storageRefs.mobile.html ? { mobile: storageRefs.mobile.html } : {}), ...(storageRefs.desktop.html ? { desktop: storageRefs.desktop.html } : {}) } } : {}),
      },
    };
  }

  private createFailedResult(params: { keys: AuditResult['keys']; errors: AuditResult['errors']; duration: number }): AuditResult {
    return { keys: params.keys, status: 'failed', duration: params.duration, fromCache: false, errors: params.errors };
  }
}
