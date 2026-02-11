/**
 * ⚠️ SSOT CONTRACT — Export Orchestrator
 *
 * This file is the single entry point for data contracts.
 * It maps physical versions (v2, v1) to generic aliases
 * so the rest of the app does not depend on version numbers.
 */

// 1. Imports of specific versions (Source of Truth)
import { TicketV2Schema, type TicketV2 } from './ticket.v2';
import { EvidenceV2Schema, type EvidenceV2 } from './evidence.v2';
import { CSVExportV1Schema, type CSVExportV1 } from './csv.v1';

// 2. Export generic "Current" aliases for the rest of the app
// Usage: import { Ticket, TicketSchema } from '@/contracts/export';
export { 
  TicketV2Schema as TicketSchema, 
  type TicketV2 as Ticket 
};

export { 
  EvidenceV2Schema as EvidenceSchema, 
  type EvidenceV2 as Evidence 
};

export {
  CSVExportV1Schema as CSVSchema,
  type CSVExportV1 as CSV
};

// 3. Re-export business utilities (if direct access needed)
// Keeps access to sorting and ID generation functions
export * from './ticket.v2';
export * from './evidence.v2';
export * from './csv.v1';