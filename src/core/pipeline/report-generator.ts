/**
 * ⚠️ HTML REPORT GENERATOR (SSOT-Driven) — Agency-Grade
 *
 * Generates the agency-grade HTML report from a ScoreRun.
 * Client-facing labels: French. Internal logic: English.
 *
 * SSOT: HTML = source of truth; PDF = Playwright render.
 * Anchors: #cover, #summary, #radar, #diagnostic, #top-actions, #evidences, #plan-30-60-90, #appendix
 * IDs: id="ticket-{ticket_id}", id="evidence-{evidence_id}"
 *
 * Design: Hero + circular gauge, Radar (7 pillars), Diagnostic cards, 30/60/90 timeline.
 * Tailwind CSS + Outfit via CDN. Self-contained for PDF export.
 *
 * @version REPORT_GENERATOR_VERSION = 2.0
 */

import type { ScoreRun, Snapshot, SnapshotSource } from '@prisma/client';
import type { TicketV2 } from '@/contracts/export/ticket.v2';
import type { EvidenceV2 } from '@/contracts/export/evidence.v2';
import type { ShopifyFacts } from '@/core/engine/facts-collector';
import type { Pillar } from '@/core/engine/scoring-engine';
import { t, translateReason, humanReadable, type Locale } from '@/core/i18n/translations';

/**
 * Type pour ScoreRun avec relations
 */
type ScoreRunWithRelations = ScoreRun & {
  snapshot: Snapshot & {
    sources: SnapshotSource[];
  };
};

/**
 * Options de génération du rapport
 */
export interface ReportOptions {
  locale?: 'fr' | 'en';
  darkMode?: boolean;
  copyReady?: boolean;
  whiteLabel?: {
    logo?: string;
    brandName?: string;
    brandColor?: string;
  };
}

/**
 * Résultat de génération
 */
export interface ReportResult {
  html: string;
  metadata: {
    reportVersion: string;
    ticketVersion: string;
    evidenceVersion: string;
    generatedAt: string;
    fileSize: number;
  };
}

/**
 * SSOT Versions
 */
const VERSIONS = {
  REPORT_OUTLINE: '3.1',
  TICKET_SCHEMA: '2',
  EVIDENCE_SCHEMA: '2',
  CSV_EXPORT: '1',
  GENERATOR: '2.0',
} as const;

/** Breakdown item from scoring engine (optional REGISTRY fields) */
type ScoreBreakdownItem = {
  pillar: string;
  delta: number;
  reason: string;
  rule_id?: string;
  criteria_ids?: string[];
  fact_ids?: string[];
};

/** Resolved locale for report (fr | en) */

/**
 * Derives pillar scores (0–100) from score_breakdown for radar chart.
 * Each pillar starts at 50, receives deltas, then clamped.
 */
function computePillarScoresFromBreakdown(
  breakdown: ScoreBreakdownItem[]
): Record<Pillar, number> {
  const PILLARS: Pillar[] = ['clarte', 'friction', 'confiance', 'social', 'mobile', 'perf', 'seo'];
  const sums: Record<Pillar, number> = {
    clarte: 50,
    friction: 50,
    confiance: 50,
    social: 50,
    mobile: 50,
    perf: 50,
    seo: 50,
  };
  for (const b of breakdown) {
    if (PILLARS.includes(b.pillar as Pillar)) {
      sums[b.pillar as Pillar] += b.delta;
    }
  }
  const out = {} as Record<Pillar, number>;
  for (const p of PILLARS) {
    out[p] = Math.max(0, Math.min(100, Math.round(sums[p])));
  }
  return out;
}

/** Impact level from delta magnitude for diagnostic cards */
function deltaToImpact(delta: number): 'high' | 'medium' | 'low' {
  const abs = Math.abs(delta);
  if (abs >= 15) return 'high';
  if (abs >= 5) return 'medium';
  return 'low';
}

/**
 * Cleans a string for display (trim + collapse whitespace)
 * USED for evidence labels and other texts
 */
function cleanString(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Calculates ticket priority score (SSOT)
 * 
 * Formula: impact*3 + confidence*2 - effort*2 - risk*1
 */
function calculatePriorityScore(ticket: TicketV2): number {
  const impactMap = { high: 3, medium: 2, low: 1 };
  const effortMap = { s: 1, m: 2, l: 3 };
  const riskMap = { low: 1, medium: 2, high: 3 };
  const confidenceMap = { high: 3, medium: 2, low: 1 };

  return (
    impactMap[ticket.impact] * 3 +
    confidenceMap[ticket.confidence] * 2 -
    effortMap[ticket.effort] * 2 -
    riskMap[ticket.risk] * 1
  );
}

/**
 * Sorts tickets by priority score (SSOT)
 */
function sortTicketsByPriority(tickets: TicketV2[]): TicketV2[] {
  return [...tickets].sort((a, b) => {
    const scoreA = calculatePriorityScore(a);
    const scoreB = calculatePriorityScore(b);
    
    if (scoreB !== scoreA) return scoreB - scoreA;
    
    // Tie-breaker: alphabetical on ticket_id
    return a.ticket_id.localeCompare(b.ticket_id);
  });
}

/** System/fallback tickets must never appear in Top Actions (client-facing) */
function isSystemOrFallbackTicket(ticket: TicketV2): boolean {
  const id = ticket.ticket_id.toLowerCase();
  return id.includes('fallback') || id.includes('missing_data');
}

/**
 * Filters Top Actions (confidence != low, A/B evidence).
 * Excludes system/fallback tickets (AI unavailable, missing data).
 */
function filterTopActions(tickets: TicketV2[], evidences: EvidenceV2[]): TicketV2[] {
  return tickets.filter((ticket) => {
    if (isSystemOrFallbackTicket(ticket)) return false;
    if (ticket.confidence === 'low') return false;

    const ticketEvidences = evidences.filter((e) =>
      ticket.evidence_refs.includes(e.evidence_id)
    );
    return ticketEvidences.some((e) => e.level === 'A' || e.level === 'B');
  });
}

/**
 * Filters Quick Wins (effort s + impact high + quick_win flag)
 */
function filterQuickWins(tickets: TicketV2[]): TicketV2[] {
  return tickets.filter(
    (t) => t.quick_win && t.effort === 's' && t.impact === 'high'
  );
}

/**
 * Generates complete HTML report
 */
export function generateHtmlReport(
  run: ScoreRunWithRelations,
  options: ReportOptions = {}
): ReportResult {
  const {
    locale = 'fr',
    whiteLabel,
  } = options;
  const loc: Locale = locale === 'en' ? 'en' : 'fr';
  const darkMode = false;

  // Parse exports (strict typing)
  const runExports = run.exports as {
    tickets?: TicketV2[];
    evidences?: EvidenceV2[];
    executive_summary?: string;
    plan_30_60_90?: { j0_30: string; j30_60: string; j60_90: string };
    strategist_score?: number;
    score_breakdown?: ScoreBreakdownItem[];
    pillar_scores?: Record<string, number>;
  } | null;
  const tickets: TicketV2[] = runExports?.tickets || [];
  const evidences: EvidenceV2[] = runExports?.evidences || [];
  const executiveSummary: string | undefined = runExports?.executive_summary;
  const plan306090 = runExports?.plan_30_60_90;
  const strategistScore: number | undefined = runExports?.strategist_score;
  const scoreBreakdown: ScoreBreakdownItem[] = runExports?.score_breakdown || [];
  const pillarScores =
    runExports?.pillar_scores && Object.keys(runExports.pillar_scores).length >= 7
      ? (runExports.pillar_scores as Record<Pillar, number>)
      : computePillarScoresFromBreakdown(scoreBreakdown);

  // Sorting and filtering (exclude system/fallback tickets from client-facing sections)
  const clientTickets = tickets.filter((t) => !isSystemOrFallbackTicket(t));
  const sortedTickets = sortTicketsByPriority(clientTickets);
  const topActions = filterTopActions(sortedTickets, evidences);
  const quickWins = filterQuickWins(topActions);
  const appendixTickets = sortedTickets.filter((t) => !topActions.includes(t));

  // Snapshot metadata
  const snapshot = run.snapshot;
  const pageASource = snapshot.sources.find((s) => s.source === 'page_a');
  const artefacts = pageASource?.artefacts as Record<string, unknown> | null | undefined;
  const facts = artefacts?.facts;
  const evidenceCompleteness = pageASource?.evidenceCompleteness || 'unknown';

  // Diagnostic items from breakdown (non-zero delta) for cards
  const diagnosticItems = scoreBreakdown.filter((b) => b.delta !== 0);

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('ui.reportTitle', loc)} — ${whiteLabel?.brandName || 'ShopifyStrategist'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; }
    html { scroll-behavior: smooth; }
    body { background: #f8fafc; color: #0f172a; }
    .hero-bg { background: linear-gradient(165deg, #eef2ff 0%, #e0e7ff 40%, #c7d2fe 100%); }
    .gauge-circle { transform: rotate(-90deg); }
    .gauge-value { stroke-dasharray: 0 314; transition: stroke-dasharray 0.8s ease-out; }
    .card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .card-paper { background: #fff; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); }
    .badge { display: inline-flex; align-items: center; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; }
    .badge-high { background: rgba(239,68,68,0.12); color: #b91c1c; border: 1px solid rgba(239,68,68,0.3); }
    .badge-medium { background: rgba(234,179,8,0.12); color: #a16207; border: 1px solid rgba(234,179,8,0.3); }
    .badge-low { background: rgba(100,116,139,0.12); color: #475569; border: 1px solid rgba(100,116,139,0.3); }
    .badge-s { background: rgba(34,197,94,0.12); color: #15803d; border: 1px solid rgba(34,197,94,0.3); }
    .badge-m { background: rgba(234,179,8,0.12); color: #a16207; border: 1px solid rgba(234,179,8,0.3); }
    .badge-l { background: rgba(249,115,22,0.12); color: #c2410c; border: 1px solid rgba(249,115,22,0.3); }
    .badge-evidence { background: rgba(79,70,229,0.12); color: #4f46e5; border: 1px solid rgba(79,70,229,0.3); font-size: 0.75rem; }
    .screenshot-container { position: relative; overflow: hidden; border-radius: 0.5rem; border: 1px solid #e2e8f0; }
    .screenshot-container img { width: 100%; height: auto; }
    .timeline-focus { border-width: 2px; box-shadow: 0 0 0 3px rgba(34,197,94,0.2); }
    .section-why, .section-how { font-size: 1.0625rem; line-height: 1.75; }
    .evidence-modal { display: none; position: fixed; inset: 0; z-index: 9999; background: rgba(15,23,42,0.8); align-items: center; justify-content: center; padding: 1rem; }
    .evidence-modal.active { display: flex; }
    .evidence-modal img { max-width: 100%; max-height: 90vh; border-radius: 0.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
    .evidence-modal-close { position: absolute; top: 1rem; right: 1rem; width: 2.5rem; height: 2.5rem; border-radius: 9999px; background: rgba(255,255,255,0.9); color: #334155; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.5rem; line-height: 1; }
    @media print {
      @page { margin: 2cm; }
      body { background: #fff; color: #0f172a; }
      .no-print { display: none; }
      .page-break { page-break-before: always; }
      .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
      .card-hover { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body class="antialiased">

  <!-- HERO + CIRCULAR GAUGE (#cover) -->
  <section id="cover" class="hero-bg min-h-[90vh] flex flex-col justify-center items-center p-8 text-slate-900">
    <div class="max-w-4xl w-full text-center">
      ${whiteLabel?.logo ? `<img src="${whiteLabel.logo}" alt="Logo" class="h-14 mx-auto mb-6">` : ''}
      <h1 class="text-4xl md:text-5xl font-bold tracking-tight mb-2">${t('ui.reportTitle', loc)}</h1>
      <p class="text-lg opacity-90 mb-10">${run.mode === 'solo' ? 'Analyse Teardown' : 'Analyse comparative'}</p>

      ${strategistScore !== undefined ? `
      <div class="inline-flex flex-col items-center mb-10">
        <div class="relative w-48 h-48 md:w-56 md:h-56">
          <svg class="w-full h-full gauge-circle" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(79,70,229,0.2)" stroke-width="6"/>
            <circle class="gauge-value" id="gauge-value" cx="50" cy="50" r="48" fill="none" stroke="url(#gaugeGrad)" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${(strategistScore / 100) * 301.6} 301.6"/>
            <defs><linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#6366f1"/></linearGradient></defs>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-4xl md:text-5xl font-bold">${strategistScore}</span>
            <span class="text-2xl font-light text-slate-600 ml-0.5">/100</span>
          </div>
        </div>
        <p class="text-sm font-medium text-slate-600 mt-3">${t('ui.strategistScore', loc)}</p>
      </div>
      ` : ''}

      <div class="flex flex-wrap justify-center gap-6 text-sm">
        <span class="flex items-center gap-2"><svg class="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg> ${(snapshot.canonicalInput as { product_key?: string } | null)?.product_key || 'N/A'}</span>
        <span class="flex items-center gap-2"><svg class="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> ${new Date().toLocaleString(locale, { timeZone: 'Europe/Paris', dateStyle: 'medium', timeStyle: 'short' })}</span>
        <span class="flex items-center gap-2">${t('ui.preuves', loc)} : <strong class="${evidenceCompleteness === 'complete' ? 'text-emerald-600' : evidenceCompleteness === 'partial' ? 'text-amber-600' : 'text-red-600'}">${evidenceCompleteness}</strong></span>
      </div>
      <div class="mt-8 pt-6 border-t border-slate-300 text-xs text-slate-600">Expertise délivrée par ShopifyStrategist</div>
    </div>
  </section>

  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

    <!-- SYNTHÈSE DÉCISIONNELLE + STATS -->
    <section id="summary" class="mb-16">
      <h2 class="text-3xl font-bold mb-6 text-slate-900">${t('ui.executiveSummary', loc)}</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="rounded-xl p-5 border border-slate-200 bg-white shadow-sm card-hover">
          <div class="text-sm text-slate-500 mb-1">${t('ui.totalActions', loc)}</div>
          <div class="text-3xl font-bold text-slate-900">${tickets.length}</div>
        </div>
        <div class="rounded-xl p-5 border border-slate-200 bg-white shadow-sm card-hover">
          <div class="text-sm text-slate-500 mb-1">${t('ui.topActions', loc)}</div>
          <div class="text-3xl font-bold text-slate-900">${topActions.length}</div>
        </div>
        <div class="rounded-xl p-5 border border-slate-200 bg-white shadow-sm card-hover">
          <div class="text-sm text-slate-500 mb-1">${t('ui.quickWins', loc)}</div>
          <div class="text-3xl font-bold text-indigo-600">${quickWins.length}</div>
        </div>
      </div>
      <div class="prose max-w-none">
        <p class="text-lg text-slate-700">
          ${executiveSummary
            ? executiveSummary.replace(/\n/g, '<br>')
            : `Cette analyse a identifié <strong>${topActions.length} actions prioritaires</strong> pour optimiser votre page produit. Parmi elles, <strong>${quickWins.length} quick wins</strong> peuvent être mises en œuvre sous 48h pour un impact immédiat sur les conversions.`
          }
        </p>
      </div>
    </section>

    <!-- RADAR CHART (7 piliers) -->
    <section id="radar" class="mb-16">
      <h2 class="text-3xl font-bold mb-6 text-slate-900">${t('ui.scoreParPiliers', loc)}</h2>
      <div class="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 flex justify-center break-inside-avoid">
        <div class="w-full max-w-md">
          <canvas id="radarChart" width="400" height="400"></canvas>
        </div>
      </div>
      <script>
        (function(){
          var pillars = ${JSON.stringify((['clarte','friction','confiance','social','mobile','perf','seo'] as Pillar[]).map((p) => t('pillars.' + p, loc)))};
          var values = ${JSON.stringify((['clarte','friction','confiance','social','mobile','perf','seo'] as Pillar[]).map(p => pillarScores[p]))};
          var ctx = document.getElementById('radarChart');
          if (ctx && typeof Chart !== 'undefined') {
            new Chart(ctx, {
              type: 'radar',
              data: {
                labels: pillars,
                datasets: [{
                  label: 'Score',
                  data: values,
                  fill: true,
                  backgroundColor: 'rgba(79, 70, 229, 0.25)',
                  borderColor: 'rgb(79, 70, 229)',
                  pointBackgroundColor: 'rgb(79, 70, 229)',
                  pointBorderColor: '#fff',
                  pointHoverBackgroundColor: '#fff',
                  pointHoverBorderColor: 'rgb(79, 70, 229)'
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: { r: { min: 0, max: 100 } },
                plugins: { legend: { display: false } }
              }
            });
          }
        })();
      </script>
    </section>

    <!-- DIAGNOSTIC CARDS (breakdown avec delta + rule_id / fact_ids) -->
    ${diagnosticItems.length > 0 ? generateDiagnosticCardsSection(diagnosticItems, loc, darkMode) : ''}

    ${quickWins.length > 0 ? generateQuickWinsSection(quickWins, evidences, loc, darkMode) : ''}
    ${generateTopActionsSection(topActions, evidences, loc, darkMode)}
    ${generateEvidencesSection(evidences, artefacts ?? {}, loc, darkMode)}
    ${appendixTickets.length > 0 || facts ? generateAppendixSection(appendixTickets, facts as ShopifyFacts | null | undefined, evidences, loc, darkMode) : ''}

    ${(plan306090 || topActions.length > 0) ? generatePlan306090Section(plan306090, topActions, quickWins.length > 0, loc, darkMode) : ''}

  </div>

  <footer class="mt-20 py-8 border-t border-slate-200">
    <div class="max-w-6xl mx-auto px-4 text-center">
      <p class="text-sm text-slate-500">Expertise délivrée par ShopifyStrategist</p>
    </div>
  </footer>

  <!-- Evidence modal (Visual First) -->
  <div id="evidence-modal" class="evidence-modal no-print" aria-hidden="true">
    <button type="button" class="evidence-modal-close" aria-label="Close">&times;</button>
    <img id="evidence-modal-img" src="" alt="" />
  </div>
  <script>
    (function(){
      var modal = document.getElementById('evidence-modal');
      var modalImg = document.getElementById('evidence-modal-img');
      var closeBtn = modal && modal.querySelector('.evidence-modal-close');
      function openModal(src, alt) {
        if (!modal || !modalImg) return;
        modalImg.src = src; modalImg.alt = alt || ''; modal.classList.add('active'); modal.setAttribute('aria-hidden','false');
      }
      function closeModal() { if (modal) { modal.classList.remove('active'); modal.setAttribute('aria-hidden','true'); } }
      document.addEventListener('click', function(e) {
        var el = e.target.closest('.evidence-thumb-link');
        if (el && el.dataset.modalSrc) { e.preventDefault(); openModal(el.dataset.modalSrc, el.dataset.modalAlt || ''); }
      });
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
      document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });
    })();
  </script>
</body>
</html>`;

  return {
    html,
    metadata: {
      reportVersion: VERSIONS.REPORT_OUTLINE,
      ticketVersion: VERSIONS.TICKET_SCHEMA,
      evidenceVersion: VERSIONS.EVIDENCE_SCHEMA,
      generatedAt: new Date().toISOString(),
      fileSize: Buffer.byteLength(html, 'utf8'),
    },
  };
}

/**
 * Generates Diagnostic Cards section (from score_breakdown: delta, impact, rule_id, fact_ids)
 */
function generateDiagnosticCardsSection(
  items: ScoreBreakdownItem[],
  loc: Locale,
  _darkMode: boolean
): string {
  return `
    <section id="diagnostic" class="mb-16 page-break">
      <h2 class="text-3xl font-bold mb-6 text-slate-900">${t('ui.diagnostic', loc)}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${items.map((b) => {
          const impact = deltaToImpact(b.delta);
          const pillarLabel = t('pillars.' + b.pillar, loc) || b.pillar;
          const translatedReason = translateReason(b.reason, b.rule_id, loc);
          return `
          <div class="rounded-xl border border-slate-200 p-5 bg-white shadow-sm card-hover break-inside-avoid">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="badge badge-${impact}">${t('ui.impact', loc)} / ${t('enums.impact.' + impact, loc)}</span>
              <span class="text-sm text-slate-500">${pillarLabel}</span>
              <span class="font-semibold ${b.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}">${b.delta >= 0 ? '+' : ''}${b.delta} pts</span>
            </div>
            <p class="text-slate-700 text-sm mb-3">${escapeHtml(translatedReason)}</p>
          </div>
        `;
        }).join('\n')}
      </div>
    </section>
  `;
}

function escapeHtml(s: string): string {
  const m: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return s.replace(/[&<>"']/g, (c) => m[c] ?? c);
}

/**
 * Generates Quick Wins section
 */
function generateQuickWinsSection(
  quickWins: TicketV2[],
  evidences: EvidenceV2[],
  loc: Locale,
  _darkMode: boolean
): string {
  return `
    <section id="quick-wins" class="mb-16">
      <h2 class="text-3xl font-bold mb-6 text-slate-900">⚡ ${t('ui.quickWins48h', loc)}</h2>
      <div class="space-y-6">
        ${quickWins.map((ticket) => generateTicketCard(ticket, evidences, loc, false, true)).join('\n')}
      </div>
    </section>
  `;
}

/**
 * Generates 30/60/90 roadmap with visual timeline.
 * Injects Top 3 ticket titles into J0-30, J30-60, J60-90 when available.
 */
function generatePlan306090Section(
  plan: { j0_30: string; j30_60: string; j60_90: string } | null | undefined,
  topActions: TicketV2[],
  hasQuickWins: boolean,
  loc: Locale,
  _darkMode: boolean
): string {
  const t1 = topActions[0];
  const t2 = topActions[1];
  const t3 = topActions[2];
  const j0_30 = (t1?.title ? escapeHtml(t1.title) : plan?.j0_30) || '—';
  const j30_60 = (t2?.title ? escapeHtml(t2.title) : plan?.j30_60) || '—';
  const j60_90 = (t3?.title ? escapeHtml(t3.title) : plan?.j60_90) || '—';
  const focusClass = hasQuickWins ? 'timeline-focus border-emerald-500/50' : '';
  return `
    <section id="plan-30-60-90" class="mb-16 page-break">
      <h2 class="text-3xl font-bold mb-6 text-slate-900">${t('ui.plan306090', loc)}</h2>
      <div class="relative">
        <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 rounded-full"></div>
        <div class="space-y-6 pl-12">
          <div class="relative rounded-xl border border-amber-200 p-6 bg-amber-50 shadow-sm ${focusClass} break-inside-avoid">
            <div class="absolute -left-8 top-6 w-4 h-4 rounded-full bg-amber-400 border-4 border-white"></div>
            <div class="text-sm font-semibold text-amber-700 mb-2">${t('ui.j0_30', loc)}${hasQuickWins ? ` · ${t('ui.focusQuickWins', loc)}` : ''}</div>
            <div class="text-sm text-slate-700">${j0_30.replace(/\n/g, '<br>')}</div>
          </div>
          <div class="relative rounded-xl border border-slate-200 p-6 bg-blue-50 shadow-sm break-inside-avoid">
            <div class="absolute -left-8 top-6 w-4 h-4 rounded-full bg-blue-400 border-4 border-white"></div>
            <div class="text-sm font-semibold text-blue-700 mb-2">${t('ui.j30_60', loc)}</div>
            <div class="text-sm text-slate-700">${j30_60.replace(/\n/g, '<br>')}</div>
          </div>
          <div class="relative rounded-xl border border-slate-200 p-6 bg-emerald-50 shadow-sm break-inside-avoid">
            <div class="absolute -left-8 top-6 w-4 h-4 rounded-full bg-emerald-400 border-4 border-white"></div>
            <div class="text-sm font-semibold text-emerald-700 mb-2">${t('ui.j60_90', loc)}</div>
            <div class="text-sm text-slate-700">${j60_90.replace(/\n/g, '<br>')}</div>
          </div>
        </div>
      </div>
    </section>
  `;
}

/**
 * Generates Top Actions section
 */
function generateTopActionsSection(
  topActions: TicketV2[],
  evidences: EvidenceV2[],
  loc: Locale,
  _darkMode: boolean
): string {
  return `
    <section id="top-actions" class="mb-16 page-break">
      <h2 class="text-3xl font-bold mb-6 text-slate-900">${t('ui.actionsPrioritaires', loc)}</h2>
      <div class="space-y-6">
        ${topActions.map((ticket, idx) => generateTicketCard(ticket, evidences, loc, false, false, idx + 1)).join('\n')}
      </div>
    </section>
  `;
}

/** Evidence details shape for screenshot URL */
type EvidenceDetailsShape = { screenshot_url?: string; full_url?: string; facts_summary?: Record<string, unknown> };

/**
 * Picks the best screenshot evidence for a ticket (mobile preferred for Mobile/Friction/Sticky ATC).
 * Falls back to all available screenshots when ticket refs only detection evidences.
 */
function pickScreenshotEvidence(
  ticket: TicketV2,
  ticketEvidences: EvidenceV2[],
  allEvidences: EvidenceV2[]
): EvidenceV2 | null {
  const fromTicket = ticketEvidences.filter((e) => {
    if (e.type !== 'screenshot') return false;
    const details = e.details as EvidenceDetailsShape | undefined;
    return !!(details?.screenshot_url ?? details?.full_url);
  });
  const screenshots = fromTicket.length > 0 ? fromTicket : allEvidences.filter((e) => {
    if (e.type !== 'screenshot') return false;
    const details = e.details as EvidenceDetailsShape | undefined;
    return !!(details?.screenshot_url ?? details?.full_url);
  });
  if (screenshots.length === 0) return null;
  const text = `${(ticket.title || '').toLowerCase()} ${(ticket.why || '').toLowerCase()} ${(ticket.category || '')}`;
  const prefersMobile = /mobile|friction|sticky|atc|mobil|ux/i.test(text);
  const mobile = screenshots.find((s) => s.viewport === 'mobile');
  const desktop = screenshots.find((s) => s.viewport === 'desktop');
  if (prefersMobile && mobile) return mobile;
  if (prefersMobile && !mobile && desktop) return desktop;
  return screenshots[0] ?? null;
}

/**
 * Generates a ticket card
 */
function generateTicketCard(
  ticket: TicketV2,
  evidences: EvidenceV2[],
  loc: Locale,
  _darkMode: boolean,
  isQuickWin: boolean = false,
  rank?: number
): string {
  const ticketEvidences = evidences.filter((e) => ticket.evidence_refs.includes(e.evidence_id));
  const screenshotEvidence = pickScreenshotEvidence(ticket, ticketEvidences, evidences);
  const screenshotUrl = screenshotEvidence
    ? ((screenshotEvidence.details as EvidenceDetailsShape)?.screenshot_url ?? (screenshotEvidence.details as EvidenceDetailsShape)?.full_url)
    : null;
  
  const impactColors = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-amber-200 bg-amber-50',
    low: 'border-slate-200 bg-slate-50',
  };

  const thumbnailBlock = screenshotUrl && screenshotEvidence
    ? `
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <a href="#evidence-${screenshotEvidence.evidence_id}" class="evidence-thumb-link group" data-modal-src="${escapeHtml(screenshotUrl)}" data-modal-alt="${escapeHtml(ticket.title)}">
          <img src="${escapeHtml(screenshotUrl)}" alt="${escapeHtml(ticket.title)}" class="w-40 h-auto rounded-lg border border-slate-200 shadow-sm object-cover object-top group-hover:ring-2 group-hover:ring-indigo-400 transition-all" loading="lazy"/>
        </a>
        <a href="#evidence-${screenshotEvidence.evidence_id}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium transition-colors evidence-thumb-link" data-modal-src="${escapeHtml(screenshotUrl)}" data-modal-alt="${escapeHtml(ticket.title)}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"/></svg>
          ${t('ui.voirLaPreuve', loc)}
        </a>
      </div>`
    : '';

  return `
    <div id="ticket-${ticket.ticket_id}" class="border ${impactColors[ticket.impact]} rounded-xl p-6 bg-white shadow-sm card-hover break-inside-avoid">
      ${thumbnailBlock}
      <!-- Ticket Header -->
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1">
          ${rank ? `<span class="text-slate-400 text-sm font-mono">#${rank}</span>` : ''}
          <h3 class="text-xl font-semibold text-slate-900 mb-2">
            ${isQuickWin ? '⚡ ' : ''}${escapeHtml(ticket.title)}
          </h3>
          <div class="flex flex-wrap gap-2 mt-3">
            <span class="badge badge-${ticket.impact}">${t('ui.impact', loc)} : ${t('enums.impact.' + ticket.impact, loc)}</span>
            <span class="badge badge-${ticket.effort === 's' ? 's' : ticket.effort === 'l' ? 'l' : 'm'}">${t('ui.effort', loc)} : ${t('enums.effort.' + ticket.effort, loc)}</span>
            <span class="badge bg-indigo-50 text-indigo-700 border-indigo-200">${t('ui.confiance', loc)} : ${t('enums.confidence.' + ticket.confidence, loc)}</span>
          </div>
        </div>
      </div>

      <!-- Why -->
      <div class="mb-4 section-why">
        <h4 class="text-indigo-600 font-semibold mb-2">${t('ui.pourquoi', loc)}</h4>
        <p class="text-slate-700">${escapeHtml(ticket.why)}</p>
      </div>

      <!-- How To -->
      <div class="mb-4 section-how">
        <h4 class="text-indigo-600 font-semibold mb-2">${t('ui.commentCorriger', loc)}</h4>
        <ul class="list-disc list-inside space-y-1 text-slate-700">
          ${ticket.how_to.map((step) => `<li>${escapeHtml(step)}</li>`).join('\n')}
        </ul>
      </div>

      <!-- Evidence References -->
      <div class="mb-4">
        <h4 class="text-indigo-600 font-semibold mb-2">${t('ui.preuves', loc)}</h4>
        <div class="flex flex-wrap gap-2">
          ${ticketEvidences.map((ev) => `
            <a href="#evidence-${ev.evidence_id}" class="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              ${escapeHtml(humanReadable(ev.label))} (${ev.viewport})
            </a>
          `).join('\n')}
        </div>
      </div>

      <!-- Validation -->
      <div>
        <h4 class="text-indigo-600 font-semibold mb-2">${t('ui.validation', loc)}</h4>
        <ul class="list-disc list-inside space-y-1 text-slate-700">
          ${ticket.validation.map((v) => `<li>${escapeHtml(v)}</li>`).join('\n')}
        </ul>
      </div>

      <!-- Footer -->
      <div class="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
        <span>${t('ui.category', loc)} : <strong>${ticket.category}</strong></span>
        <span>${t('ui.responsable', loc)} : <strong>${ticket.owner ?? (ticket as { owner_hint?: string }).owner_hint ?? 'dev'}</strong></span>
      </div>
    </div>
  `;
}

/**
 * Generates Evidences section (clean grid with viewport labels)
 */
function generateEvidencesSection(
  evidences: EvidenceV2[],
  _artefacts: Record<string, unknown>,
  loc: Locale,
  _darkMode: boolean
): string {
  const screenshots = evidences.filter((e) => e.type === 'screenshot');
  const detections = evidences.filter((e) => e.type === 'detection');

  return `
    <!-- ============================================================ -->
    <!-- EVIDENCES SECTION (#evidences) -->
    <!-- ============================================================ -->
    <section id="evidences" class="mb-16 page-break">
      <h2 class="text-3xl font-bold mb-6 text-slate-900">${t('ui.preuvesVisuelles', loc)}</h2>
      
      ${screenshots.length > 0 ? `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          ${screenshots.map((evidence) => {
            const details = evidence.details as EvidenceDetailsShape | undefined;
            const screenshotUrl = details?.screenshot_url ?? details?.full_url;
            const viewportLabel = evidence.viewport === 'mobile' ? t('ui.mobileView', loc) : evidence.viewport === 'desktop' ? t('ui.desktopView', loc) : t('ui.fullPage', loc);
            const cleanLabel = cleanString(evidence.label);

            return `
              <div id="evidence-${evidence.evidence_id}" class="break-inside-avoid bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-lg font-semibold text-slate-900">${viewportLabel}</h3>
                  <div class="flex gap-2">
                    <span class="badge ${evidence.level === 'A' ? 'badge-high' : evidence.level === 'B' ? 'badge-medium' : 'badge-low'}">${t('ui.niveau', loc)} ${evidence.level}</span>
                  </div>
                </div>
                ${screenshotUrl ? `
                  <div class="screenshot-container">
                    <img 
                      src="${screenshotUrl}" 
                      alt="${cleanLabel || t('ui.capture', loc)}" 
                      loading="lazy" 
                      onerror="this.parentElement.innerHTML='<div class=\\"bg-slate-50 text-slate-500 border-slate-200 p-8 rounded-lg text-center border-2 border-dashed flex flex-col items-center justify-center gap-3\\"><svg class=\\"w-12 h-12 opacity-50\\" fill=\\"none\\" stroke=\\"currentColor\\" viewBox=\\"0 0 24 24\\"><path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z\\"></path></svg><span class=\\"font-medium\\">${t('ui.imageUnavailable', loc)}</span><span class=\\"text-xs opacity-75\\">${t('ui.loadError', loc)}</span></div>'" 
                    />
                  </div>
                ` : `<div class="bg-slate-50 text-slate-500 border-slate-200 p-8 rounded-lg text-center border-2 border-dashed flex flex-col items-center justify-center gap-3">
                  <svg class="w-12 h-12 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <span class="font-medium">${t('ui.imageUnavailable', loc)}</span>
                  <span class="text-xs opacity-75">${t('ui.detectionPending', loc)}</span>
                </div>`}
                <div class="mt-3 text-sm text-slate-600">
                  ${t('ui.capturedOn', loc)} ${new Date(evidence.timestamp).toLocaleString(loc)}
                </div>
              </div>
            `;
          }).join('\n')}
        </div>
      ` : ''}
      
      ${detections.length > 0 ? `
        <div class="mt-8">
          <h3 class="text-xl font-semibold text-slate-900 mb-4">${t('ui.detections', loc)}</h3>
          <div class="space-y-4">
            ${detections.map((evidence) => `
              <div id="evidence-${evidence.evidence_id}" class="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h4 class="font-semibold text-slate-900">${evidence.label}</h4>
                    <pre class="mt-2 text-sm text-slate-600 overflow-x-auto">${JSON.stringify((evidence.details as EvidenceDetailsShape | undefined)?.facts_summary ?? {}, null, 2)}</pre>
                  </div>
                  <span class="badge ${evidence.level === 'A' ? 'badge-high' : evidence.level === 'B' ? 'badge-medium' : 'badge-low'}">${t('ui.niveau', loc)} ${evidence.level}</span>
                </div>
              </div>
            `).join('\n')}
          </div>
        </div>
      ` : ''}
    </section>
  `;
}

/**
 * Generates Appendix section
 */
function generateAppendixSection(
  appendixTickets: TicketV2[],
  facts: ShopifyFacts | null | undefined,
  evidences: EvidenceV2[],
  loc: Locale,
  _darkMode: boolean
): string {
  return `
    <!-- ============================================================ -->
    <!-- APPENDIX SECTION (#appendix) -->
    <!-- ============================================================ -->
    <section id="appendix" class="mb-16 page-break">
      <h2 class="text-3xl font-bold mb-6 text-slate-900">${t('ui.annexe', loc)}</h2>
      
      ${appendixTickets.length > 0 ? `
        <div class="mb-12">
          <h3 class="text-xl font-semibold text-slate-900 mb-4">
            ${t('ui.lowPriorityTickets', loc)}
          </h3>
          <div class="space-y-4">
            ${appendixTickets.map((ticket) => generateTicketCard(ticket, evidences, loc, false)).join('\n')}
          </div>
        </div>
      ` : ''}
      
      ${facts ? `
        <div>
          <h3 class="text-xl font-semibold text-slate-900 mb-4">
            ${t('ui.technicalFacts', loc)}
          </h3>
          <div class="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <pre class="text-sm text-slate-700 overflow-x-auto">${JSON.stringify(facts, null, 2)}</pre>
          </div>
        </div>
      ` : ''}
    </section>
  `;
}
