/**
 * CSV Export Schema v1 (SSOT)
 * 
 * Stable CSV export format for tickets.
 * Conforme à: docs/REPORT_OUTLINE.md section 12 (CSV_EXPORT_VERSION: 1)
 * 
 * HARD RULE: No new field without version bump + SSOT docs update.
 */

import { z } from 'zod';
import type { TicketV2 } from './ticket.v2';

/**
 * CSV Export schema v1 (fixed columns)
 *
 * SSOT Reference: docs/REPORT_OUTLINE.md section 12
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
  
  // Separator: |
  evidence_refs: z.string(),
  how_to: z.string(),
  validation: z.string(),
  
  quick_win: z.string(), // "true" ou "false"
  owner: z.string(),
  
  // URL context (which URL to act on)
  // SOLO: <audited_pdp_url>
  // DUO AB: <url_a> or <url_b> or <url_a>|<url_b> (if scope=gap)
  // DUO Before/After: <url_before> or <url_after> or <url_before>|<url_after> (if scope=diff)
  url_context: z.string(),
});

export type CSVExportV1 = z.infer<typeof CSVExportV1Schema>;

/**
 * Convert a Ticket v2 to CSV v1 row
 *
 * @param ticket - Ticket v2 to convert
 * @param urlContext - URL(s) context (per mode and scope)
 * @returns CSV v1 row
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
    owner: ticket.owner ?? (ticket as { owner_hint?: string }).owner_hint ?? 'dev',
    url_context: urlContext,
  };
}

/**
 * Generate CSV v1 header (fixed columns)
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
    'owner',
    'url_context',
  ];
}

/**
 * Convert a CSV v1 row to value array
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
    row.owner,
    row.url_context,
  ];
}

/**
 * Escape a CSV value (per RFC 4180)
 *
 * Rules:
 * - If contains comma, quote, or newline → wrap in quotes
 * - Double internal quotes
 */
export function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate a complete CSV file
 *
 * @param tickets - List of tickets v2
 * @param urlContextMap - Map ticket_id → url_context
 * @returns CSV content (string)
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
