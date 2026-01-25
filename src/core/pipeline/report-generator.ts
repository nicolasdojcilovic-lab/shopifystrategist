/**
 * ⚠️ HTML REPORT GENERATOR (SSOT-Driven)
 * 
 * Ce module génère le rapport HTML agency-grade à partir d'un ScoreRun.
 * 
 * Principes SSOT:
 * - HTML = Source de vérité
 * - PDF = Rendu strict du HTML (Playwright)
 * - Structure conforme à REPORT_OUTLINE.md (v3.1)
 * - Anchors: #cover, #summary, #top-actions, #evidences, #appendix
 * - IDs déterministes: id="ticket-{ticket_id}", id="evidence-{evidence_id}"
 * 
 * Design:
 * - Dark Mode Premium (Linear/Stripe inspired)
 * - Tailwind CSS via CDN
 * - Autonome (Single File)
 * - Interactif (smooth scroll, collapsibles)
 * 
 * Référence:
 * - docs/REPORT_OUTLINE.md (v3.1)
 * - docs/SCORING_AND_DETECTION.md (v2.2)
 * 
 * @version REPORT_GENERATOR_VERSION = 1.0
 */

import type { ScoreRun, Snapshot, SnapshotSource } from '@prisma/client';
import type { TicketV2 } from '@/contracts/export/ticket.v2';
import type { EvidenceV2 } from '@/contracts/export/evidence.v2';

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
  GENERATOR: '1.0',
} as const;

/**
 * Nettoie une string pour l'affichage (trim + collapse whitespace)
 * UTILISÉ pour evidence labels et autres textes
 */
function cleanString(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Calcule le score de priorité d'un ticket (SSOT)
 * 
 * Formula: impact*3 + confidence*2 - effort*2 - risk*1
 */
function calculatePriorityScore(ticket: TicketV2): number {
  const impactMap = { high: 3, medium: 2, low: 1 };
  const effortMap = { small: 1, medium: 2, large: 3 };
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
 * Trie les tickets par score de priorité (SSOT)
 */
function sortTicketsByPriority(tickets: TicketV2[]): TicketV2[] {
  return [...tickets].sort((a, b) => {
    const scoreA = calculatePriorityScore(a);
    const scoreB = calculatePriorityScore(b);
    
    if (scoreB !== scoreA) return scoreB - scoreA;
    
    // Tie-breaker: alphabétique sur ticket_id
    return a.ticket_id.localeCompare(b.ticket_id);
  });
}

/**
 * Filtre les Top Actions (confidence != low, preuves A/B)
 */
function filterTopActions(tickets: TicketV2[], evidences: EvidenceV2[]): TicketV2[] {
  return tickets.filter((ticket) => {
    // Exclure confidence low
    if (ticket.confidence === 'low') return false;
    
    // Vérifier que les evidences référencées sont de niveau A ou B
    const ticketEvidences = evidences.filter((e) =>
      ticket.evidence_refs.includes(e.evidence_id)
    );
    
    return ticketEvidences.some((e) => e.level === 'A' || e.level === 'B');
  });
}

/**
 * Filtre les Quick Wins (effort small + impact high + quick_win flag)
 */
function filterQuickWins(tickets: TicketV2[]): TicketV2[] {
  return tickets.filter(
    (t) => t.quick_win && t.effort === 'small' && t.impact === 'high'
  );
}

/**
 * Génère le rapport HTML complet
 */
export function generateHtmlReport(
  run: ScoreRunWithRelations,
  options: ReportOptions = {}
): ReportResult {
  const {
    locale = 'fr',
    darkMode = true,
    whiteLabel,
  } = options;

  // Parse exports
  const exports = run.exports as any;
  const tickets: TicketV2[] = exports?.tickets || [];
  const evidences: EvidenceV2[] = exports?.evidences || [];

  // Tri et filtrage
  const sortedTickets = sortTicketsByPriority(tickets);
  const topActions = filterTopActions(sortedTickets, evidences);
  const quickWins = filterQuickWins(topActions);
  const appendixTickets = sortedTickets.filter((t) => !topActions.includes(t));

  // Metadata du snapshot
  const snapshot = run.snapshot;
  const pageASource = snapshot.sources.find((s) => s.source === 'page_a');
  const artefacts = pageASource?.artefacts as any;
  const facts = artefacts?.facts;
  const evidenceCompleteness = pageASource?.evidenceCompleteness || 'unknown';

  // Génération HTML
  const html = `<!DOCTYPE html>
<html lang="${locale}" class="${darkMode ? 'dark' : ''}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShopifyStrategist Report - ${snapshot.snapshotKey}</title>
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <style>
    /* Custom CSS pour design premium */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    * {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    html {
      scroll-behavior: smooth;
    }
    
    body {
      background: ${darkMode ? '#0a0a0a' : '#ffffff'};
      color: ${darkMode ? '#e4e4e7' : '#18181b'};
    }
    
    /* Gradient backgrounds */
    .gradient-bg {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    .gradient-border {
      border-image: linear-gradient(135deg, #667eea 0%, #764ba2 100%) 1;
    }
    
    /* Card hover effects */
    .card-hover {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .card-hover:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }
    
    /* Badge styles */
    .badge {
      @apply inline-flex items-center px-3 py-1 rounded-full text-sm font-medium;
    }
    
    .badge-high { @apply bg-red-900/30 text-red-400 border border-red-800; }
    .badge-medium { @apply bg-yellow-900/30 text-yellow-400 border border-yellow-800; }
    .badge-low { @apply bg-gray-700/30 text-gray-400 border border-gray-700; }
    
    .badge-small { @apply bg-green-900/30 text-green-400 border border-green-800; }
    .badge-large { @apply bg-orange-900/30 text-orange-400 border border-orange-800; }
    
    /* Screenshot container */
    .screenshot-container {
      @apply relative overflow-hidden rounded-lg border;
      border-color: ${darkMode ? '#27272a' : '#e4e4e7'};
    }
    
    .screenshot-container img {
      @apply w-full h-auto;
    }
    
    /* Print styles for PDF export */
    @media print {
      @page {
        margin: 2cm;
      }
      
      body {
        background: white;
        color: black;
      }
      
      .no-print {
        display: none;
      }
      
      .page-break {
        page-break-before: always;
      }
      
      /* Éviter les coupures à l'intérieur des éléments */
      .break-inside-avoid {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      
      /* Cards ne doivent pas être coupées */
      .card-hover {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body class="antialiased">

  <!-- ============================================================ -->
  <!-- COVER SECTION (#cover) -->
  <!-- ============================================================ -->
  <section id="cover" class="min-h-screen flex flex-col justify-center items-center p-8 gradient-bg">
    <div class="max-w-4xl text-center text-white space-y-6">
      ${whiteLabel?.logo ? `<img src="${whiteLabel.logo}" alt="Logo" class="h-16 mx-auto mb-8">` : ''}
      
      <h1 class="text-6xl font-bold tracking-tight">
        ${whiteLabel?.brandName || 'ShopifyStrategist'} Report
      </h1>
      
      <div class="text-2xl font-light opacity-90">
        ${run.mode === 'solo' ? 'Teardown Analysis' : 'Comparison Analysis'}
      </div>
      
      <div class="flex flex-col gap-4 mt-8 text-lg">
        <div class="flex items-center justify-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span class="font-mono text-sm break-all">${(snapshot.canonicalInput as any)?.product_key || 'N/A'}</span>
        </div>
        
        <div class="flex items-center justify-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>${new Date().toLocaleString(locale, { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' })}</span>
        </div>
        
        <div class="flex items-center justify-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Evidence: <strong class="${evidenceCompleteness === 'complete' ? 'text-green-300' : evidenceCompleteness === 'partial' ? 'text-yellow-300' : 'text-red-300'}">${evidenceCompleteness}</strong></span>
        </div>
      </div>
      
      <div class="mt-12 pt-8 border-t border-white/20 text-sm opacity-75">
        <div>Report v${VERSIONS.REPORT_OUTLINE} | Ticket v${VERSIONS.TICKET_SCHEMA} | Evidence v${VERSIONS.EVIDENCE_SCHEMA}</div>
        <div class="mt-2">Generated by ShopifyStrategist Engine v${VERSIONS.GENERATOR}</div>
      </div>
    </div>
  </section>

  <!-- Main Content Container -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

    <!-- ============================================================ -->
    <!-- EXECUTIVE SUMMARY (#summary) -->
    <!-- ============================================================ -->
    <section id="summary" class="mb-16">
      <h2 class="text-4xl font-bold mb-8 ${darkMode ? 'text-white' : 'text-gray-900'}">
        Executive Summary
      </h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <!-- Stat Card: Total Tickets -->
        <div class="bg-gradient-to-br ${darkMode ? 'from-gray-900 to-gray-800' : 'from-gray-50 to-white'} rounded-xl p-6 border ${darkMode ? 'border-gray-800' : 'border-gray-200'}">
          <div class="text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2">Total Actions</div>
          <div class="text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}">${tickets.length}</div>
        </div>
        
        <!-- Stat Card: Top Actions -->
        <div class="bg-gradient-to-br ${darkMode ? 'from-purple-900/20 to-gray-800' : 'from-purple-50 to-white'} rounded-xl p-6 border ${darkMode ? 'border-purple-800/30' : 'border-purple-200'}">
          <div class="text-sm ${darkMode ? 'text-purple-400' : 'text-purple-600'} mb-2">Top Actions</div>
          <div class="text-4xl font-bold ${darkMode ? 'text-purple-300' : 'text-purple-900'}">${topActions.length}</div>
        </div>
        
        <!-- Stat Card: Quick Wins -->
        <div class="bg-gradient-to-br ${darkMode ? 'from-green-900/20 to-gray-800' : 'from-green-50 to-white'} rounded-xl p-6 border ${darkMode ? 'border-green-800/30' : 'border-green-200'}">
          <div class="text-sm ${darkMode ? 'text-green-400' : 'text-green-600'} mb-2">Quick Wins</div>
          <div class="text-4xl font-bold ${darkMode ? 'text-green-300' : 'text-green-900'}">${quickWins.length}</div>
        </div>
      </div>
      
      <div class="prose ${darkMode ? 'prose-invert' : ''} max-w-none">
        <p class="text-lg ${darkMode ? 'text-gray-300' : 'text-gray-700'}">
          ${locale === 'fr' 
            ? `Cette analyse a identifié <strong>${topActions.length} actions prioritaires</strong> pour optimiser votre page produit. Parmi celles-ci, <strong>${quickWins.length} quick wins</strong> peuvent être implémentées en moins de 48h pour un impact immédiat sur les conversions.`
            : `This analysis identified <strong>${topActions.length} priority actions</strong> to optimize your product page. Among these, <strong>${quickWins.length} quick wins</strong> can be implemented in less than 48h for immediate conversion impact.`
          }
        </p>
      </div>
    </section>

    ${quickWins.length > 0 ? generateQuickWinsSection(quickWins, evidences, locale, darkMode) : ''}
    
    ${generateTopActionsSection(topActions, evidences, locale, darkMode)}
    
    ${generateEvidencesSection(evidences, artefacts, locale, darkMode)}
    
    ${appendixTickets.length > 0 || facts ? generateAppendixSection(appendixTickets, facts, evidences, locale, darkMode) : ''}

  </div>

  <!-- Footer -->
  <footer class="mt-24 py-8 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <p class="text-sm ${darkMode ? 'text-gray-500' : 'text-gray-600'}">
        Generated on ${new Date().toLocaleString(locale, { timeZone: 'Europe/Paris' })} | 
        ShopifyStrategist Engine v${VERSIONS.GENERATOR}
      </p>
    </div>
  </footer>

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
 * Génère la section Quick Wins
 */
function generateQuickWinsSection(
  quickWins: TicketV2[],
  evidences: EvidenceV2[],
  _locale: string,
  darkMode: boolean
): string {
  return `
    <!-- ============================================================ -->
    <!-- QUICK WINS SECTION (#quick-wins) -->
    <!-- ============================================================ -->
    <section id="quick-wins" class="mb-16">
      <h2 class="text-4xl font-bold mb-8 ${darkMode ? 'text-white' : 'text-gray-900'}">
        ⚡ ${_locale === 'fr' ? 'Quick Wins (48h)' : 'Quick Wins (48h)'}
      </h2>
      
      <div class="space-y-6">
        ${quickWins.map((ticket) => generateTicketCard(ticket, evidences, _locale, darkMode, true)).join('\n')}
      </div>
    </section>
  `;
}

/**
 * Génère la section Top Actions
 */
function generateTopActionsSection(
  topActions: TicketV2[],
  evidences: EvidenceV2[],
  _locale: string,
  darkMode: boolean
): string {
  return `
    <!-- ============================================================ -->
    <!-- TOP ACTIONS SECTION (#top-actions) -->
    <!-- ============================================================ -->
    <section id="top-actions" class="mb-16 page-break">
      <h2 class="text-4xl font-bold mb-8 ${darkMode ? 'text-white' : 'text-gray-900'}">
        ${_locale === 'fr' ? 'Actions Prioritaires' : 'Top Actions'}
      </h2>
      
      <div class="space-y-8">
        ${topActions.map((ticket, idx) => generateTicketCard(ticket, evidences, _locale, darkMode, false, idx + 1)).join('\n')}
      </div>
    </section>
  `;
}

/**
 * Génère une carte ticket
 */
function generateTicketCard(
  ticket: TicketV2,
  evidences: EvidenceV2[],
  _locale: string,
  darkMode: boolean,
  isQuickWin: boolean = false,
  rank?: number
): string {
  const priorityScore = calculatePriorityScore(ticket);
  const ticketEvidences = evidences.filter((e) => ticket.evidence_refs.includes(e.evidence_id));
  
  const impactColors = {
    high: darkMode ? 'border-red-800 bg-red-900/10' : 'border-red-200 bg-red-50',
    medium: darkMode ? 'border-yellow-800 bg-yellow-900/10' : 'border-yellow-200 bg-yellow-50',
    low: darkMode ? 'border-gray-700 bg-gray-800/10' : 'border-gray-200 bg-gray-50',
  };

  return `
    <div id="ticket-${ticket.ticket_id}" class="border ${impactColors[ticket.impact]} rounded-xl p-6 card-hover break-inside-avoid ${darkMode ? 'bg-gray-900/50' : 'bg-white'}">
      <!-- Ticket Header -->
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1">
          ${rank ? `<span class="${darkMode ? 'text-gray-500' : 'text-gray-400'} text-sm font-mono">#${rank}</span>` : ''}
          <h3 class="text-2xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2">
            ${isQuickWin ? '⚡ ' : ''}${ticket.title}
          </h3>
          <div class="flex flex-wrap gap-2 mt-3">
            <span class="badge badge-${ticket.impact}">Impact: ${ticket.impact}</span>
            <span class="badge badge-${ticket.effort === 'small' ? 'small' : ticket.effort === 'large' ? 'large' : 'medium'}">Effort: ${ticket.effort}</span>
            <span class="badge ${darkMode ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200'}">Confidence: ${ticket.confidence}</span>
            <span class="badge ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}">Score: ${priorityScore}</span>
          </div>
        </div>
      </div>

      <!-- Why -->
      <div class="mb-4">
        <h4 class="${darkMode ? 'text-purple-400' : 'text-purple-600'} font-semibold mb-2">Why</h4>
        <p class="${darkMode ? 'text-gray-300' : 'text-gray-700'}">${ticket.why}</p>
      </div>

      <!-- How To -->
      <div class="mb-4">
        <h4 class="${darkMode ? 'text-green-400' : 'text-green-600'} font-semibold mb-2">How to fix</h4>
        <ul class="list-disc list-inside space-y-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}">
          ${ticket.how_to.map((step) => `<li>${step}</li>`).join('\n')}
        </ul>
      </div>

      <!-- Evidence References -->
      <div class="mb-4">
        <h4 class="${darkMode ? 'text-blue-400' : 'text-blue-600'} font-semibold mb-2">Evidence</h4>
        <div class="flex flex-wrap gap-2">
          ${ticketEvidences.map((ev) => `
            <a href="#evidence-${ev.evidence_id}" class="inline-flex items-center gap-1 px-3 py-1 rounded-lg ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} transition-colors text-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              ${ev.label} (${ev.viewport})
            </a>
          `).join('\n')}
        </div>
      </div>

      <!-- Validation -->
      <div>
        <h4 class="${darkMode ? 'text-orange-400' : 'text-orange-600'} font-semibold mb-2">Validation</h4>
        <ul class="list-disc list-inside space-y-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}">
          ${ticket.validation.map((v) => `<li>${v}</li>`).join('\n')}
        </ul>
      </div>

      <!-- Footer -->
      <div class="mt-4 pt-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex items-center justify-between text-sm">
        <span class="${darkMode ? 'text-gray-500' : 'text-gray-600'}">Category: <strong>${ticket.category}</strong></span>
        <span class="${darkMode ? 'text-gray-500' : 'text-gray-600'}">Owner: <strong>${ticket.owner_hint}</strong></span>
      </div>
    </div>
  `;
}

/**
 * Génère la section Evidences
 */
function generateEvidencesSection(
  evidences: EvidenceV2[],
  _artefacts: any,
  locale: string,
  darkMode: boolean
): string {
  const screenshots = evidences.filter((e) => e.type === 'screenshot');
  const detections = evidences.filter((e) => e.type === 'detection');

  return `
    <!-- ============================================================ -->
    <!-- EVIDENCES SECTION (#evidences) -->
    <!-- ============================================================ -->
    <section id="evidences" class="mb-16 page-break">
      <h2 class="text-4xl font-bold mb-8 ${darkMode ? 'text-white' : 'text-gray-900'}">
        ${locale === 'fr' ? 'Preuves Visuelles' : 'Visual Evidence'}
      </h2>
      
      ${screenshots.length > 0 ? `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          ${screenshots.map((evidence) => {
            const screenshotUrl = (evidence.details as any)?.screenshot_url;
            
            // Nettoyer le label pour éviter les problèmes d'affichage
            const cleanLabel = cleanString(evidence.label);

            return `
              <div id="evidence-${evidence.evidence_id}" class="break-inside-avoid ${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl p-6 border ${darkMode ? 'border-gray-800' : 'border-gray-200'}">
                <div class="mb-4">
                  <h3 class="text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2">${cleanLabel || 'Evidence'}</h3>
                  <div class="flex gap-2">
                    <span class="badge ${evidence.level === 'A' ? 'badge-high' : evidence.level === 'B' ? 'badge-medium' : 'badge-low'}">Level ${evidence.level}</span>
                    <span class="badge ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}">${evidence.viewport}</span>
                  </div>
                </div>
                ${screenshotUrl ? `
                  <div class="screenshot-container">
                    <img 
                      src="${screenshotUrl}" 
                      alt="${cleanLabel || 'Screenshot'}" 
                      loading="lazy" 
                      onerror="this.parentElement.innerHTML='<div class=\\"${darkMode ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-gray-50 text-gray-500 border-gray-200'} p-8 rounded-lg text-center border-2 border-dashed flex flex-col items-center justify-center gap-3\\"><svg class=\\"w-12 h-12 opacity-50\\" fill=\\"none\\" stroke=\\"currentColor\\" viewBox=\\"0 0 24 24\\"><path stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" stroke-width=\\"2\\" d=\\"M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z\\"></path></svg><span class=\\"font-medium\\">Image non disponible</span><span class=\\"text-xs opacity-75\\">Erreur de chargement</span></div>'" 
                    />
                  </div>
                ` : `<div class="${darkMode ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-gray-50 text-gray-500 border-gray-200'} p-8 rounded-lg text-center border-2 border-dashed flex flex-col items-center justify-center gap-3">
                  <svg class="w-12 h-12 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <span class="font-medium">Screenshot non disponible</span>
                  <span class="text-xs opacity-75">Capture en attente</span>
                </div>`}
                <div class="mt-3 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-600'}">
                  Captured: ${new Date(evidence.timestamp).toLocaleString(locale)}
                </div>
              </div>
            `;
          }).join('\n')}
        </div>
      ` : ''}
      
      ${detections.length > 0 ? `
        <div class="mt-8">
          <h3 class="text-2xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4">Detections</h3>
          <div class="space-y-4">
            ${detections.map((evidence) => `
              <div id="evidence-${evidence.evidence_id}" class="${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-lg p-4 border ${darkMode ? 'border-gray-800' : 'border-gray-200'}">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h4 class="font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}">${evidence.label}</h4>
                    <pre class="mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} overflow-x-auto">${JSON.stringify((evidence.details as any)?.facts_summary || {}, null, 2)}</pre>
                  </div>
                  <span class="badge ${evidence.level === 'A' ? 'badge-high' : evidence.level === 'B' ? 'badge-medium' : 'badge-low'}">Level ${evidence.level}</span>
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
 * Génère la section Appendix
 */
function generateAppendixSection(
  appendixTickets: TicketV2[],
  facts: any,
  evidences: EvidenceV2[],
  locale: string,
  darkMode: boolean
): string {
  return `
    <!-- ============================================================ -->
    <!-- APPENDIX SECTION (#appendix) -->
    <!-- ============================================================ -->
    <section id="appendix" class="mb-16 page-break">
      <h2 class="text-4xl font-bold mb-8 ${darkMode ? 'text-white' : 'text-gray-900'}">
        Appendix
      </h2>
      
      ${appendixTickets.length > 0 ? `
        <div class="mb-12">
          <h3 class="text-2xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4">
            ${locale === 'fr' ? 'Tickets Basse Priorité' : 'Low Priority Tickets'}
          </h3>
          <div class="space-y-4">
            ${appendixTickets.map((ticket) => generateTicketCard(ticket, evidences, locale, darkMode)).join('\n')}
          </div>
        </div>
      ` : ''}
      
      ${facts ? `
        <div>
          <h3 class="text-2xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4">
            ${locale === 'fr' ? 'Faits Techniques' : 'Technical Facts'}
          </h3>
          <div class="${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl p-6 border ${darkMode ? 'border-gray-800' : 'border-gray-200'}">
            <pre class="text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} overflow-x-auto">${JSON.stringify(facts, null, 2)}</pre>
          </div>
        </div>
      ` : ''}
    </section>
  `;
}
