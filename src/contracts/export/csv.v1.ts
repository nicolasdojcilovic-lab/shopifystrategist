/**
 * CSV Export Schema v1 (SSOT)
 * 
 * Format d'export CSV stable pour les tickets.
 * Conforme à: docs/REPORT_OUTLINE.md section 12 (CSV_EXPORT_VERSION: 1)
 * 
 * RÈGLE DURE : Aucun nouveau champ sans bump de version + mise à jour docs SSOT.
 */

import { z } from 'zod';
import type { TicketV2 } from './ticket.v2';

/**
 * Schéma CSV Export v1 (colonnes fixes)
 * 
 * Référence SSOT: docs/REPORT_OUTLINE.md section 12
 */
export const CSVExportV1Schema = z.object({
  ticket_id: z.string(),
  mode: z.string(),
  title: z.string(),
  impact: z.string(),
  effort: z.string(),
  risk: z.string(),
  confidence: z.string(),
  category: z.string(),
  why: z.string(),
  
  // Séparateur: |
  evidence_refs: z.string(),
  how_to: z.string(),
  validation: z.string(),
  
  quick_win: z.string(), // "true" ou "false"
  owner_hint: z.string(),
  
  // URL de contexte (sur quelle URL agir)
  // SOLO: <audited_pdp_url>
  // DUO AB: <url_a> ou <url_b> ou <url_a>|<url_b> (si scope=gap)
  // DUO Before/After: <url_before> ou <url_after> ou <url_before>|<url_after> (si scope=diff)
  url_context: z.string(),
});

export type CSVExportV1 = z.infer<typeof CSVExportV1Schema>;

/**
 * Convertir un Ticket v2 en ligne CSV v1
 * 
 * @param ticket - Ticket v2 à convertir
 * @param urlContext - URL(s) de contexte (selon mode et scope)
 * @returns Ligne CSV v1
 */
export function ticketToCSV(ticket: TicketV2, urlContext: string): CSVExportV1 {
  return {
    ticket_id: ticket.ticket_id,
    mode: ticket.mode,
    title: ticket.title,
    impact: ticket.impact,
    effort: ticket.effort,
    risk: ticket.risk,
    confidence: ticket.confidence,
    category: ticket.category,
    why: ticket.why,
    
    // Arrays → pipe-separated strings
    evidence_refs: ticket.evidence_refs.join('|'),
    how_to: ticket.how_to.join('|'),
    validation: ticket.validation.join('|'),
    
    quick_win: ticket.quick_win.toString(),
    owner_hint: ticket.owner_hint,
    url_context: urlContext,
  };
}

/**
 * Générer le header CSV v1 (colonnes fixes)
 */
export function getCSVHeader(): string[] {
  return [
    'ticket_id',
    'mode',
    'title',
    'impact',
    'effort',
    'risk',
    'confidence',
    'category',
    'why',
    'evidence_refs',
    'how_to',
    'validation',
    'quick_win',
    'owner_hint',
    'url_context',
  ];
}

/**
 * Convertir une ligne CSV v1 en tableau de valeurs
 */
export function csvRowToArray(row: CSVExportV1): string[] {
  return [
    row.ticket_id,
    row.mode,
    row.title,
    row.impact,
    row.effort,
    row.risk,
    row.confidence,
    row.category,
    row.why,
    row.evidence_refs,
    row.how_to,
    row.validation,
    row.quick_win,
    row.owner_hint,
    row.url_context,
  ];
}

/**
 * Échapper une valeur CSV (selon RFC 4180)
 * 
 * Règles:
 * - Si contient virgule, guillemet, ou newline → entourer de guillemets
 * - Doubler les guillemets internes
 */
export function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Générer un fichier CSV complet
 * 
 * @param tickets - Liste de tickets v2
 * @param urlContextMap - Map ticket_id → url_context
 * @returns Contenu CSV (string)
 */
export function generateCSV(
  tickets: TicketV2[],
  urlContextMap: Map<string, string>
): string {
  const lines: string[] = [];
  
  // Header
  lines.push(getCSVHeader().map(escapeCSVValue).join(','));
  
  // Rows
  for (const ticket of tickets) {
    const urlContext = urlContextMap.get(ticket.ticket_id) ?? '';
    const csvRow = ticketToCSV(ticket, urlContext);
    const values = csvRowToArray(csvRow).map(escapeCSVValue);
    lines.push(values.join(','));
  }
  
  return lines.join('\n');
}
